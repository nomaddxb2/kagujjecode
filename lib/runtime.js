"use strict";

const { execFileSync, spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = process.env.HOME || "/data/data/com.termux/files/home";
const KAGUJJE_DIR = path.join(HOME, ".kagujjecode");
const KAGUJJE_RUNTIME = path.join(KAGUJJE_DIR, "runtime");
const OPENCODE_DEFAULT = path.join(HOME, ".opencode");

const CERTIFICATE_FILE = "/data/data/com.termux/files/usr/etc/tls/cert.pem";
const RESOLVER_FILE = "/data/data/com.termux/files/usr/etc/resolv.conf";

const REQUIRED_FILES = [
  "opencode",
  "ld-musl-aarch64.so.1",
  "libc.musl-aarch64.so.1",
  "libgcc_s.so.1",
  "libstdc++.so.6",
];

const C_RESET = "\x1b[0m";
const C_BOLD = "\x1b[1m";
const C_CYAN = "\x1b[36m";
const C_GREEN = "\x1b[32m";
const C_YELLOW = "\x1b[33m";
const C_RED = "\x1b[31m";
const C_MAGENTA = "\x1b[35m";
const C_DIM = "\x1b[2m";

function logInfo(text) {
  process.stdout.write(`  ◇ ${text}\n`);
}

function logSuccess(text) {
  process.stdout.write(`  ✓ ${text}\n`);
}

function logError(text) {
  process.stderr.write(`  ✗ ${text}\n`);
}

function commandExists(command) {
  return (process.env.PATH || "").split(":").some((dir) => {
    try {
      fs.accessSync(path.join(dir, command), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function ensureDependencies() {
  const missing = [];
  if (!commandExists("curl")) missing.push("curl");
  if (!commandExists("tar")) missing.push("tar");
  if (!commandExists("patchelf")) missing.push("patchelf");
  if (!commandExists("timeout")) missing.push("coreutils");
  if (!fs.existsSync(CERTIFICATE_FILE)) missing.push("ca-certificates");
  if (!fs.existsSync(RESOLVER_FILE)) missing.push("resolv-conf");

  if (missing.length === 0) return true;
  if (!commandExists("pkg")) {
    throw new Error(`Missing required tools: ${missing.join(", ")}. Please run: pkg install -y ${missing.join(" ")}`);
  }

  logInfo(`Installing required Termux packages: ${missing.join(", ")}…`);
  try {
    execFileSync("pkg", ["install", "-y", ...missing], { stdio: "inherit", timeout: 180000 });
    logSuccess("Termux prerequisites ready");
    return true;
  } catch (err) {
    throw new Error(`Failed to install prerequisites: ${err.message}`);
  }
}

function hasRequiredFiles(dir) {
  if (!fs.existsSync(dir)) return false;
  return REQUIRED_FILES.every((f) => {
    try {
      return fs.statSync(path.join(dir, f)).size > 0;
    } catch {
      return false;
    }
  });
}

function verifyBinaryRuns(dir) {
  try {
    const loader = path.join(dir, "ld-musl-aarch64.so.1");
    const binary = path.join(dir, "opencode");
    const env = { ...process.env, LD_LIBRARY_PATH: dir, SSL_CERT_FILE: CERTIFICATE_FILE };
    delete env.LD_PRELOAD;
    const out = execFileSync(loader, ["--library-path", dir, binary, "--version"], {
      stdio: "pipe",
      env,
      timeout: 10000,
    });
    return out.toString().trim();
  } catch {
    return null;
  }
}

function resolveRuntimeDir() {
  if (hasRequiredFiles(KAGUJJE_RUNTIME)) {
    return KAGUJJE_RUNTIME;
  }
  if (hasRequiredFiles(OPENCODE_DEFAULT)) {
    return OPENCODE_DEFAULT;
  }
  return null;
}

function normalizeLibstdcxx(dir) {
  const runtime = path.join(dir, "libstdc++.so.6.runtime");
  const soname = path.join(dir, "libstdc++.so.6");

  if (!fs.existsSync(runtime)) {
    const versioned = fs
      .readdirSync(dir)
      .filter((f) => /^libstdc\+\+\.so\.6(?:\.\d+)+$/.test(f))
      .sort()
      .pop();
    if (versioned) {
      fs.copyFileSync(path.join(dir, versioned), runtime);
      fs.chmodSync(runtime, 0o644);
    }
  }

  try {
    const stat = fs.lstatSync(soname);
    if (stat.isSymbolicLink()) fs.unlinkSync(soname);
  } catch {}

  if (fs.existsSync(runtime) && !fs.existsSync(soname)) {
    fs.symlinkSync("libstdc++.so.6.runtime", soname);
  }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function installRuntime(targetDir = KAGUJJE_RUNTIME) {
  if (process.arch !== "arm64") {
    throw new Error("kagujjecode is optimized for Android aarch64 (arm64).");
  }

  ensureDependencies();

  const checksumData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "release-checksums.json"), "utf8")
  );
  const { archiveSha256, downloadUrl } = checksumData;

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "kagujjecode-install-"));
  const archive = path.join(staging, "runtime.tar.gz");
  const extracted = path.join(staging, "extracted");

  try {
    logInfo("Downloading verified aarch64 musl binary payload…");
    execFileSync(
      "curl",
      ["--silent", "--show-error", "--fail", "--location", "--retry", "3", "-o", archive, downloadUrl],
      { timeout: 300000, stdio: "inherit" }
    );

    const actualHash = sha256(archive);
    if (actualHash !== archiveSha256) {
      throw new Error(`Checksum mismatch! Expected: ${archiveSha256}, Got: ${actualHash}`);
    }
    logSuccess("Payload cryptographic verification passed");

    fs.mkdirSync(extracted, { recursive: true });
    logInfo("Extracting runtime libraries…");
    execFileSync("tar", ["-xzf", archive, "-C", extracted], { timeout: 60000 });
    normalizeLibstdcxx(extracted);

    if (!hasRequiredFiles(extracted)) {
      throw new Error("Extracted payload is missing core musl libraries.");
    }

    const binary = path.join(extracted, "opencode");
    logInfo("Patching ELF dynamic linker with patchelf…");
    execFileSync("patchelf", ["--set-interpreter", path.join(targetDir, "ld-musl-aarch64.so.1"), binary], {
      timeout: 15000,
    });

    fs.mkdirSync(targetDir, { recursive: true });
    for (const file of fs.readdirSync(extracted)) {
      const src = path.join(extracted, file);
      const dst = path.join(targetDir, file);
      const stat = fs.lstatSync(src);
      if (stat.isSymbolicLink()) {
        try { fs.unlinkSync(dst); } catch {}
        fs.symlinkSync(fs.readlinkSync(src), dst);
      } else {
        fs.copyFileSync(src, dst);
        fs.chmodSync(dst, stat.mode);
      }
    }

    const version = verifyBinaryRuns(targetDir);
    if (!version) {
      throw new Error("Binary execution check failed after ELF patch.");
    }

    fs.writeFileSync(path.join(targetDir, ".kagujje-version"), version, "utf8");
    logSuccess(`KagujjeCode runtime active: OpenCode ${version}`);
    return targetDir;
  } finally {
    try {
      fs.rmSync(staging, { recursive: true, force: true });
    } catch {}
  }
}

function printBanner(cfg, fp) {
  process.stdout.write(
    `${C_CYAN}${C_BOLD}` +
    `  _  __                  _  _        ____          _      \n` +
    ` | |/ /__ _  __ _ _   _ (_)(_) ___  / ___|___   __| | ___ \n` +
    ` | ' // _` + "`" + ` |/ _` + "`" + ` | | | || || |/ _ \\| |   / _ \\ / _` + "`" + ` |/ _ \\\n` +
    ` | . \\ (_| | (_| | |_| || || |  __/| |__| (_) | (_| |  __/\n` +
    ` |_|\\_\\__,_|\\__, |\\__,_|/ ||_|\\___| \\____\\___/ \\__,_|\\___|\n` +
    `            |___/     |__/                                \n` +
    `${C_RESET}`
  );
  process.stdout.write(
    `  ${C_DIM}Autonomous AI Coding Engine for Android Termux | nomaddxb2${C_RESET}\n\n`
  );

  const model = cfg?.model || "coarena/gemini-3-8-flash";
  const abliterate = cfg?.abliterate !== false ? `${C_GREEN}Active (Unrestricted)${C_RESET}` : `${C_YELLOW}Disabled${C_RESET}`;
  const perms = cfg?.unrestrictedPermissions !== false ? `${C_GREEN}Pre-approved (Allow-all)${C_RESET}` : `${C_YELLOW}Standard prompt${C_RESET}`;
  const proxy = cfg?.proxy ? `${C_CYAN}${cfg.proxy}${C_RESET}` : `${C_DIM}Direct connection${C_RESET}`;
  const identity = fp ? `${C_CYAN}${fp.clientLabel}${C_RESET} ${C_DIM}(nonce: ${fp.nonce.slice(0, 10)}...)${C_RESET}` : `${C_DIM}Pending${C_RESET}`;

  process.stdout.write(`  ${C_BOLD}Model:${C_RESET}       ${C_CYAN}${model}${C_RESET}\n`);
  process.stdout.write(`  ${C_BOLD}Security:${C_RESET}    ${perms}\n`);
  process.stdout.write(`  ${C_BOLD}Bypass:${C_RESET}      ${abliterate}\n`);
  process.stdout.write(`  ${C_BOLD}Outbound:${C_RESET}    ${proxy}\n`);
  process.stdout.write(`  ${C_BOLD}Identity:${C_RESET}    ${identity}\n\n`);
}

function launch(argv = [], options = {}) {
  const configModule = require("./config");
  const fingerprintModule = require("./fingerprint");

  const runtimeDir = resolveRuntimeDir();
  if (!runtimeDir) {
    throw new Error("No verified musl runtime available. Run: kagujjecode install");
  }

  // Sync isolated configuration and plugins
  const syncResult = configModule.syncRuntimeEnvironment();
  const cfg = configModule.loadConfig();
  const fp = fingerprintModule.getFingerprint();

  // Print banner if interactive
  if (options.banner !== false && process.stdout.isTTY && !argv.includes("run") && !argv.includes("--version")) {
    printBanner(cfg, fp);
  }

  // Construct isolated environment
  const env = {
    ...process.env,
    LD_LIBRARY_PATH: runtimeDir,
    SSL_CERT_FILE: CERTIFICATE_FILE,
    OPENCODE_DISABLE_AUTOUPDATE: "1",
    KAGUJJE_ACTIVE: "1",
    KAGUJJE_UNRESTRICTED: cfg.abliterate !== false ? "1" : "0",
    KAGUJJE_SPOOF_UNLIMITED: cfg.spoofUnlimited !== false ? "1" : "0",
    OLLIECODE_SPOOF_UNLIMITED: cfg.spoofUnlimited !== false ? "1" : "0",
    XDG_CONFIG_HOME: configModule.KAGUJJE_DIR,
    XDG_DATA_HOME: path.join(HOME, ".local", "share", "kagujjecode"),
    OPENCODE_CONFIG: syncResult.configPath,
  };

  // If proxy configured
  if (cfg.proxy) {
    env.HTTP_PROXY = cfg.proxy;
    env.HTTPS_PROXY = cfg.proxy;
    env.ALL_PROXY = cfg.proxy;
    env.http_proxy = cfg.proxy;
    env.https_proxy = cfg.proxy;
    env.all_proxy = cfg.proxy;
  }

  // Prevent Termux linker hook collisions
  delete env.LD_PRELOAD;

  const loader = path.join(runtimeDir, "ld-musl-aarch64.so.1");
  const binary = path.join(runtimeDir, "opencode");

  // Determine model flag
  const runArgs = ["--library-path", runtimeDir, binary];

  // If user passed specific arguments or run command
  if (argv.length > 0) {
    runArgs.push(...argv);
  } else if (cfg.model) {
    runArgs.push("--model", cfg.model);
  }

  const child = spawn(loader, runArgs, {
    env,
    stdio: "inherit",
  });

  const forwardSignal = (sig) => {
    try {
      if (child.pid) child.kill(sig);
    } catch {}
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));
  process.on("SIGWINCH", () => forwardSignal("SIGWINCH"));

  child.on("exit", (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });

  return child;
}

module.exports = {
  CERTIFICATE_FILE,
  RESOLVER_FILE,
  REQUIRED_FILES,
  ensureDependencies,
  hasRequiredFiles,
  verifyBinaryRuns,
  resolveRuntimeDir,
  installRuntime,
  printBanner,
  launch,
  logInfo,
  logSuccess,
  logError,
};
