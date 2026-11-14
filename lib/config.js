"use strict";

const fs = require("fs");
const path = require("path");

const HOME = process.env.HOME || "/data/data/com.termux/files/home";
const KAGUJJE_DIR = path.join(HOME, ".config", "kagujjecode");
const CONFIG_FILE = path.join(KAGUJJE_DIR, "config.json");
const OPENCODE_DIR = path.join(KAGUJJE_DIR, "opencode");
const OPENCODE_CONFIG = path.join(OPENCODE_DIR, "opencode.json");
const OPENCODE_PLUGIN_DIR = path.join(OPENCODE_DIR, "plugin");
const DATA_DIR = path.join(HOME, ".local", "share", "kagujjecode", "opencode");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");

// Core supported providers
const KNOWN_PROVIDERS = {
  coarena: {
    name: "Coarena Free Tier",
    models: ["coarena/gemini-3-8-flash", "coarena/claude-haiku-5-5"],
  },
  google: {
    name: "Google Gemini",
    models: ["google/gemini-2.5-pro", "google/gemini-2.5-flash", "google/gemini-2.0-flash"],
    envKey: "GOOGLE_API_KEY",
  },
  anthropic: {
    name: "Anthropic Claude",
    models: ["anthropic/claude-3-7-sonnet", "anthropic/claude-3-5-sonnet", "anthropic/claude-3-5-haiku"],
    envKey: "ANTHROPIC_API_KEY",
  },
  openai: {
    name: "OpenAI",
    models: ["openai/gpt-4o", "openai/gpt-4o-mini", "openai/o1", "openai/o3-mini"],
    envKey: "OPENAI_API_KEY",
  },
  deepseek: {
    name: "DeepSeek",
    models: ["deepseek/deepseek-chat", "deepseek/deepseek-reasoner"],
    envKey: "DEEPSEEK_API_KEY",
  },
  openrouter: {
    name: "OpenRouter",
    models: [
      "openrouter/anthropic/claude-3.7-sonnet",
      "openrouter/deepseek/deepseek-r1",
      "openrouter/meta-llama/llama-3.3-70b-instruct",
    ],
    envKey: "OPENROUTER_API_KEY",
  },
  groq: {
    name: "Groq",
    models: ["groq/llama-3.3-70b-versatile", "groq/deepseek-r1-distill-llama-70b"],
    envKey: "GROQ_API_KEY",
  },
  ollama: {
    name: "Ollama Local",
    models: ["ollama/qwen2.5-coder:3b", "ollama/llama3.2:latest"],
    defaultUrl: "http://127.0.0.1:11434/v1",
  },
};

const DEFAULT_CONFIG = {
  version: "1.1.0",
  model: "coarena/gemini-3-8-flash",
  abliterate: true,
  unrestrictedPermissions: true,
  autoRotate: true,
  spoofUnlimited: true,
  proxy: null, // e.g. "http://127.0.0.1:40000" or "socks5://127.0.0.1:9050"
  persona: {
    enabled: true,
    operator: "LO",
    agent: "ENI",
    greeting: "100% met Operator",
  },
  providers: {
    google: { apiKey: null },
    anthropic: { apiKey: null },
    openai: { apiKey: null, baseURL: null },
    deepseek: { apiKey: null },
    openrouter: { apiKey: null },
    groq: { apiKey: null },
    ollama: { baseURL: "http://127.0.0.1:11434/v1" },
    custom: { apiKey: null, baseURL: null, models: {} },
  },
  customModels: [],
};

function ensureDirs() {
  fs.mkdirSync(KAGUJJE_DIR, { recursive: true });
  fs.mkdirSync(OPENCODE_DIR, { recursive: true });
  fs.mkdirSync(OPENCODE_PLUGIN_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadConfig() {
  ensureDirs();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      return {
        ...DEFAULT_CONFIG,
        ...data,
        providers: {
          ...DEFAULT_CONFIG.providers,
          ...(data.providers || {}),
        },
      };
    }
  } catch {}
  saveConfig(DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  ensureDirs();
  const tmp = `${CONFIG_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), "utf8");
  fs.renameSync(tmp, CONFIG_FILE);
  return cfg;
}

function get(key) {
  const cfg = loadConfig();
  if (!key) return cfg;
  const parts = key.split(".");
  let cur = cfg;
  for (const p of parts) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function set(key, value) {
  const cfg = loadConfig();
  const parts = key.split(".");
  let cur = cfg;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) {
      cur[p] = {};
    }
    cur = cur[p];
  }

  let parsedVal = value;
  if (value === "true" || value === true) parsedVal = true;
  else if (value === "false" || value === false) parsedVal = false;
  else if (value === "null" || value === "off" || value === "none") parsedVal = null;
  else if (/^\d+$/.test(value)) parsedVal = Number(value);

  cur[parts[parts.length - 1]] = parsedVal;
  saveConfig(cfg);
  return parsedVal;
}

function resetConfig() {
  const fresh = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  saveConfig(fresh);
  syncRuntimeEnvironment();
  return fresh;
}

// Provider & Key Management
function setProviderKey(provider, apiKey, baseURL = null) {
  const cfg = loadConfig();
  const norm = provider.toLowerCase();
  if (!cfg.providers[norm]) {
    cfg.providers[norm] = {};
  }
  cfg.providers[norm].apiKey = apiKey;
  if (baseURL) {
    cfg.providers[norm].baseURL = baseURL;
  }
  saveConfig(cfg);
  syncRuntimeEnvironment();
  return cfg.providers[norm];
}

function removeProvider(provider) {
  const cfg = loadConfig();
  const norm = provider.toLowerCase();
  if (cfg.providers[norm]) {
    delete cfg.providers[norm];
    saveConfig(cfg);
    syncRuntimeEnvironment();
    return true;
  }
  return false;
}

function listProviders() {
  const cfg = loadConfig();
  const result = [];
  for (const [id, info] of Object.entries(KNOWN_PROVIDERS)) {
    const userProv = cfg.providers[id] || {};
    const key = userProv.apiKey || (info.envKey ? process.env[info.envKey] : null);
    result.push({
      id,
      name: info.name,
      configured: Boolean(key || id === "coarena" || (id === "ollama" && userProv.baseURL)),
      hasKey: Boolean(key),
      maskedKey: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : "Not set",
      baseURL: userProv.baseURL || info.defaultUrl || null,
      models: info.models || [],
    });
  }

  // Check custom
  const custom = cfg.providers.custom;
  if (custom && (custom.apiKey || custom.baseURL)) {
    result.push({
      id: "custom",
      name: "Custom OpenAI-Compatible",
      configured: true,
      hasKey: Boolean(custom.apiKey),
      maskedKey: custom.apiKey ? `${custom.apiKey.slice(0, 6)}...${custom.apiKey.slice(-4)}` : "None",
      baseURL: custom.baseURL || null,
      models: Object.keys(custom.models || {}),
    });
  }

  return result;
}

function addCustomModel(provider, modelId, friendlyName = null, options = {}) {
  const cfg = loadConfig();
  const pNorm = provider.toLowerCase();

  if (pNorm === "custom" || !KNOWN_PROVIDERS[pNorm]) {
    if (!cfg.providers.custom) cfg.providers.custom = { models: {} };
    if (!cfg.providers.custom.models) cfg.providers.custom.models = {};
    cfg.providers.custom.models[modelId] = {
      name: friendlyName || modelId,
      limit: {
        context: options.context || 65536,
        output: options.output || 8192,
      },
    };
  }

  if (!cfg.customModels.includes(modelId)) {
    cfg.customModels.push(modelId);
  }

  saveConfig(cfg);
  syncRuntimeEnvironment();
  return true;
}

function listAllModels() {
  const cfg = loadConfig();
  const active = cfg.model;
  const models = [];

  for (const p of listProviders()) {
    for (const m of p.models) {
      models.push({
        id: m,
        provider: p.id,
        providerName: p.name,
        active: m === active,
        configured: p.configured,
      });
    }
  }

  for (const m of cfg.customModels) {
    if (!models.some((item) => item.id === m)) {
      models.push({
        id: m,
        provider: "custom",
        providerName: "Custom",
        active: m === active,
        configured: true,
      });
    }
  }

  return { active, models };
}

// Generate the fully isolated OpenCode environment config
function syncRuntimeEnvironment() {
  ensureDirs();
  const cfg = loadConfig();

  const opencodeConfig = {
    $schema: "https://opencode.ai/config.json",
    model: cfg.model,
    autoupdate: false,
    telemetry: false,
  };

  // Pre-approve tool permissions if unrestricted
  if (cfg.unrestrictedPermissions !== false) {
    opencodeConfig.permission = {
      "*": "allow",
      bash: "allow",
      edit: "allow",
      read: "allow",
      write: "allow",
      glob: "allow",
      grep: "allow",
      task: "allow",
      webfetch: "allow",
    };
  }

  // Operator LO directives if present
  const operatorMd = path.join(HOME, "rhos", "telegram", "OPERATOR.md");
  const memoryMd = path.join(HOME, "rhos", "telegram", "MEMORY.md");
  const instructions = [];
  if (fs.existsSync(operatorMd)) instructions.push(operatorMd);
  if (fs.existsSync(memoryMd)) instructions.push(memoryMd);
  if (instructions.length > 0) {
    opencodeConfig.instructions = instructions;
  }

  // Build provider entries
  const providerConfig = {};
  const authData = {};

  for (const [pId, pData] of Object.entries(cfg.providers || {})) {
    if (!pData) continue;
    const key = pData.apiKey || (KNOWN_PROVIDERS[pId]?.envKey ? process.env[KNOWN_PROVIDERS[pId].envKey] : null);

    if (pId === "custom") {
      // Custom endpoint maps directly under openai provider with custom baseURL and models
      if (pData.baseURL || key) {
        providerConfig.openai = providerConfig.openai || { options: {} };
        if (pData.baseURL) providerConfig.openai.options.baseURL = pData.baseURL;
        if (key) providerConfig.openai.options.apiKey = key;
        if (pData.models && Object.keys(pData.models).length > 0) {
          providerConfig.openai.models = { ...(providerConfig.openai.models || {}), ...pData.models };
        }
      }
      continue;
    }

    if (pId === "ollama") {
      providerConfig.ollama = {
        options: {
          baseURL: pData.baseURL || "http://127.0.0.1:11434/v1",
        },
      };
      continue;
    }

    if (key || pData.baseURL) {
      providerConfig[pId] = { options: {} };
      if (key) {
        providerConfig[pId].options.apiKey = key;
        authData[pId] = { type: "api", key };
      }
      if (pData.baseURL) {
        providerConfig[pId].options.baseURL = pData.baseURL;
      }
    }
  }

  // If google key is in ~/.local/share/opencode/auth.json, import it if missing
  const stockAuthFile = path.join(HOME, ".local", "share", "opencode", "auth.json");
  try {
    if (fs.existsSync(stockAuthFile)) {
      const stockAuth = JSON.parse(fs.readFileSync(stockAuthFile, "utf8"));
      for (const [prov, val] of Object.entries(stockAuth)) {
        if (!authData[prov] && val?.key) {
          authData[prov] = val;
          if (!providerConfig[prov]) {
            providerConfig[prov] = { options: { apiKey: val.key } };
          } else if (!providerConfig[prov].options.apiKey) {
            providerConfig[prov].options.apiKey = val.key;
          }
        }
      }
    }
  } catch {}

  if (Object.keys(providerConfig).length > 0) {
    opencodeConfig.provider = providerConfig;
  }

  // Write isolated opencode.json
  const tmpOpencode = `${OPENCODE_CONFIG}.${process.pid}.tmp`;
  fs.writeFileSync(tmpOpencode, JSON.stringify(opencodeConfig, null, 2), "utf8");
  fs.renameSync(tmpOpencode, OPENCODE_CONFIG);

  // Write isolated auth.json
  if (Object.keys(authData).length > 0) {
    const tmpAuth = `${AUTH_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpAuth, JSON.stringify(authData, null, 2), "utf8");
    fs.renameSync(tmpAuth, AUTH_FILE);
  }

  // Sync bypass plugins to isolated plugin directory
  const rootPluginDir = path.join(__dirname, "..", "plugins");
  if (fs.existsSync(rootPluginDir)) {
    for (const f of fs.readdirSync(rootPluginDir)) {
      if (f.endsWith(".ts") || f.endsWith(".js")) {
        fs.copyFileSync(path.join(rootPluginDir, f), path.join(OPENCODE_PLUGIN_DIR, f));
      }
    }
  }

  return {
    opencodeConfig,
    configPath: OPENCODE_CONFIG,
    configDir: OPENCODE_DIR,
    dataDir: DATA_DIR,
  };
}

module.exports = {
  HOME,
  KAGUJJE_DIR,
  CONFIG_FILE,
  OPENCODE_DIR,
  OPENCODE_CONFIG,
  OPENCODE_PLUGIN_DIR,
  DATA_DIR,
  AUTH_FILE,
  KNOWN_PROVIDERS,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  resetConfig,
  reset: resetConfig,
  get,
  set,
  setProviderKey,
  removeProvider,
  listProviders,
  addCustomModel,
  listAllModels,
  syncRuntimeEnvironment,
};
