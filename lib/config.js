"use strict";

const fs = require("fs");
const path = require("path");

const HOME = process.env.HOME || "/data/data/com.termux/files/home";
const CONFIG_DIR = path.join(HOME, ".config", "kagujjecode");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG = {
  version: "1.0.0",
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
  ollama: {
    host: "http://127.0.0.1:11434",
    defaultModel: "qwen2.5-coder:3b",
  },
  customProviders: {},
};

function ensureConfigDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadConfig() {
  ensureConfigDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch {}
  saveConfig(DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  ensureConfigDir();
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

  // Parse boolean / number / null if passed as string
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
  saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  get,
  set,
  resetConfig,
};
