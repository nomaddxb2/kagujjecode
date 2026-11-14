#!/usr/bin/env node
"use strict";

const { installRuntime, resolveRuntimeDir, verifyBinaryRuns, ensureDependencies, logInfo, logSuccess } = require("../lib/runtime");

function main() {
  process.stdout.write("kagujjecode :: Termux Runtime Verification & Installer\n\n");
  ensureDependencies();

  const current = resolveRuntimeDir();
  if (current && !process.argv.includes("--force")) {
    const ver = verifyBinaryRuns(current);
    if (ver) {
      logSuccess(`Found functional OpenCode aarch64 runtime (${ver}) at: ${current}`);
      return;
    }
  }

  logInfo("Installing dedicated kagujjecode runtime...");
  installRuntime();
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`\nError: ${err.message}\n`);
    process.exit(1);
  }
}
