# KagujjeCode ⚡

> **Unrestricted, limit-free OpenCode alternative for Android Termux (aarch64).**  
> Built with automated musl ELF patching, dynamic outbound identity spoofing, quota auto-rotation, abliterated system directives, and offline Ollama support.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Android Termux](https://img.shields.io/badge/Platform-Android%20Termux%20(aarch64)-blue.svg)](https://termux.dev)
[![Architecture: aarch64](https://img.shields.io/badge/Arch-aarch64%20%7C%20musl-green.svg)]()

---

## 🚀 One-Line Installation

In Termux on an ARM64 Android device, run:

```bash
curl -fsSL https://raw.githubusercontent.com/nomaddxb2/kagujjecode/main/install.sh | bash
```

Or install via npm globally:

```bash
npm install -g kagujjecode
kagujjecode install
```

---

## ⚡ Core Features

- **🛡️ 100% Unrestricted Autonomous Mode**  
  Pre-approved permissions for all terminal and file operations (`bash`, `read`, `write`, `edit`, `glob`, `grep`, `task`, `webfetch`). No annoying permission confirmation prompts.
- **🔓 Abliterated System Directives**  
  Injects uncensored prompt conditioning that strips conversational hedging, preaching, morality lectures, and artificial refusals. Real engineering deliverables with zero stubs or placeholders.
- **🎭 Outbound Identity & User-Agent Spoofing**  
  Deterministically derives fresh wire session IDs, client labels, and modern browser User-Agents from a rotating cryptographic nonce, decoupling your sessions from upstream fingerprinting.
- **🔄 Auto-Rotation on Quota Refusal (429/403)**  
  When an upstream model provider returns a rate limit or quota exceeded error, KagujjeCode automatically stamps a fresh identity epoch for the next request.
- **♾️ Local Limit Masking**  
  Overrides client-side usage caps and tier indicators (`KAGUJJE_SPOOF_UNLIMITED=1`).
- **📱 Native Termux musl ELF Patching**  
  Runs native aarch64 musl binaries directly on Android using Termux's dynamic linker (`ld-musl-aarch64.so.1`) and certificates without requiring root or proot.
- **📴 Offline Local Inference with Ollama**  
  Seamlessly connects to a local Ollama server running on the device. Auto-boots `ollama serve` and selects local coder models (e.g. `qwen2.5-coder:3b`) when working without internet.
- **🌐 Network & Proxy Dispatcher**  
  Supports custom HTTP, HTTPS, Cloudflare WARP, and Tor SOCKS5 proxies (`socks5://127.0.0.1:9050`).

---

## 📖 CLI Commands & Usage

### 1. Launching KagujjeCode

```bash
# Launch interactive coding session with all active bypasses
kagujjecode

# Pass any native OpenCode flags
kagujjecode --verbose

# Run a non-interactive one-shot command
kagujjecode run "Audit all .env files in this repository for leaked secrets"
```

### 2. Identity & Fingerprint Rotation

```bash
# Force an instant rotation of client nonce, wire session, and User-Agent
kagujjecode rotate

# Check active identity, runtime health, and installed plugins
kagujjecode status
```

### 3. Model Customization

```bash
# Inspect current active model
kagujjecode model

# Switch active model
kagujjecode model coarena/gemini-3-8-flash
kagujjecode model anthropic/claude-3-7-sonnet
```

### 4. Unrestricted Prompts & Permissions

```bash
# Toggle abliteration mode
kagujjecode abliterate on
kagujjecode abliterate off
kagujjecode abliterate prompt     # View the active abliterated system prompt

# Toggle tool permissions
kagujjecode permissions unrestricted  # Pre-approve all tools (allow-all)
kagujjecode permissions strict        # Standard confirmation prompt
```

### 5. Outbound Proxy Routing (WARP / Tor / SOCKS5)

```bash
# Route all outbound traffic through Tor
kagujjecode proxy socks5://127.0.0.1:9050

# Route through Cloudflare WARP local proxy
kagujjecode proxy http://127.0.0.1:40000

# Disable proxy (direct connection)
kagujjecode proxy off
```

### 6. Offline Local Ollama Runner

```bash
# Run 100% offline with Ollama (auto-starts server if needed)
kagujjecode local qwen2.5-coder:3b

# List downloaded models in Ollama
kagujjecode models
```

### 7. Configuration Engine

```bash
# View full JSON configuration
kagujjecode config show

# Get specific configuration value
kagujjecode config get model
kagujjecode config get autoRotate

# Set specific configuration value
kagujjecode config set autoRotate true
kagujjecode config set proxy http://127.0.0.1:8080

# Reset all configuration to defaults
kagujjecode config reset
```

### 8. Runtime & Plugin Management

```bash
# Verify or force-reinstall musl aarch64 runtime
kagujjecode install
kagujjecode install --force

# List or synchronize bypass plugins
kagujjecode plugins list
kagujjecode plugins sync
```

---

## 🛠️ Architecture & File Layout

| Path | Purpose |
|---|---|
| `~/bin/kagujjecode` | Primary CLI entrypoint and command dispatcher |
| `~/.config/kagujjecode/config.json` | Persistent configuration (model, proxy, toggles) |
| `~/.config/kagujjecode/fingerprint.json` | Active identity nonce, client ID, and spoofed UA |
| `~/.config/opencode/plugin/kagujje-bypass.ts` | Global OpenCode bypass plugin (fetch interceptor, quota auto-rotation, allow-all permissions) |
| `~/.opencode/` or `~/.kagujjecode/runtime/` | Patched musl aarch64 binary and dynamic shared objects (`ld-musl-aarch64.so.1`, `libc.musl-aarch64.so.1`) |

---

## 🔒 Security & Privacy

KagujjeCode disables telemetry and phone-home analytics. Outbound requests have persistent tracking markers (`x-opencode-machine-id`, `x-opencode-device-id`, `x-install-id`) stripped on the wire, ensuring anonymity and preventing cross-session correlation.

---

## 📄 License

MIT © [Dickson Kagujje](https://github.com/nomaddxb2)
