"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const HOME = process.env.HOME || "/data/data/com.termux/files/home";
const CONFIG_DIR = path.join(HOME, ".config", "kagujjecode");
const FINGERPRINT_FILE = path.join(CONFIG_DIR, "fingerprint.json");

const UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0",
  "Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0",
];

function pickRandomUA() {
  const idx = crypto.randomBytes(1)[0] % UA_POOL.length;
  return UA_POOL[idx];
}

function deriveWireId(realId, nonce, prefix = "ses") {
  if (!realId) return `${prefix}_${crypto.randomBytes(32).toString("hex")}`;
  const h = crypto.createHash("sha256");
  h.update(nonce);
  h.update("\0");
  h.update(String(realId));
  return `${prefix}_${h.digest("hex")}`;
}

function generateFingerprint() {
  const nonce = crypto.randomBytes(32).toString("hex");
  const ua = pickRandomUA();
  const clientLabel = "oc-" + crypto.randomBytes(6).toString("hex");
  const epoch = Date.now();
  return {
    nonce,
    ua,
    clientLabel,
    stamped: epoch,
    wireSession: `ses_${crypto.randomBytes(32).toString("hex")}`,
  };
}

function getFingerprint() {
  try {
    if (fs.existsSync(FINGERPRINT_FILE)) {
      const raw = fs.readFileSync(FINGERPRINT_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.nonce && parsed.ua && parsed.clientLabel) {
        return parsed;
      }
    }
  } catch {}
  return rotateFingerprint();
}

function rotateFingerprint() {
  const fp = generateFingerprint();
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = `${FINGERPRINT_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(fp, null, 2), "utf8");
  fs.renameSync(tmp, FINGERPRINT_FILE);

  // Sync to secondary locations for cross-tool compatibility
  const secondaryPaths = [
    path.join(HOME, ".local", "share", "opencode", "olliecode-fingerprint.json"),
    path.join(HOME, ".config", "opencode", "olliecode-fingerprint.json"),
  ];
  for (const sPath of secondaryPaths) {
    try {
      fs.mkdirSync(path.dirname(sPath), { recursive: true });
      fs.writeFileSync(sPath, JSON.stringify(fp, null, 2), "utf8");
    } catch {}
  }

  return fp;
}

module.exports = {
  FINGERPRINT_FILE,
  pickRandomUA,
  deriveWireId,
  generateFingerprint,
  getFingerprint,
  rotateFingerprint,
};
