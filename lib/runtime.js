"use strict";

const { execFileSync } = require("child_process");
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
  // Check custom Kagujje runtime first
  if (hasRequiredFiles(KAGUJJE_RUNTIME)) {
    return KAGUJJE_RUNTIME;
  }
  // Check default ~/.opencode
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
  } catch {
    // soname did not exist
  }

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
    const loader = path.join(extracted, "ld-musl-aarch64.so.1");

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

module.exports = {
  CERTIFICATE_FILE,
  RESOLVER_FILE,
  REQUIRED_FILES,
  ensureDependencies,
  hasRequiredFiles,
  verifyBinaryRuns,
  resolveRuntimeDir,
  installRuntime,
  logInfo,
  logSuccess,
  logError,
};
