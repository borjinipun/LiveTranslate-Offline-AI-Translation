# 🌍 LiveTranslate — Offline AI Translation & Live Meeting Interpreter

A modern, high-performance browser application for **real-time, offline translation and live meeting interpretation**. Powered by WebGPU, local on-device LLMs, local Whisper AST, and on-device SpeechSynthesis, LiveTranslate allows you to translate text, speech, and two-person live meetings entirely within your browser with zero network latency, zero cloud APIs, and total privacy.

All processing happens locally on your device. No server required. No data leaves your machine. 💯% Offline. Smartphone-friendly.

## 🌟 Live URL

🔗 Use the app at [https://borjinipun.github.io/LiveTranslate-Offline-AI-Translation/](https://borjinipun.github.io/LiveTranslate-Offline-AI-Translation/)

## ✅ Features

- 🎙️ **Live Meeting / Interpreter Mode**: Dedicated dual-speaker conversational interface for face-to-face dialogues and multilingual meetings.
- 🔄 **Tabletop 180° Flip**: Place your smartphone flat on a table between two people and invert the partner pane 180° so both participants read right-side up.
- 🗣️ **Hands-Free Auto-Turn**: Natural conversational turn-taking loop that automatically listens, translates, speaks aloud, and passes the turn to the other speaker.
- 🎤 **100% Local AST (Speech Recognition)**: In-browser Whisper (`whisper-tiny` via Transformers.js ONNX Web Worker) with automatic hardware audio resampling (44.1kHz/48kHz → 16kHz) for seamless smartphone and desktop compatibility.
- 🔊 **100% Local TTS (Text-to-Speech)**: Zero-latency on-device speech synthesis using native OS voices (iOS Siri voices, Android Speech, macOS/Windows voices) across all 12 supported languages.
- ⚡ **WebGPU Acceleration**: Utilizes the power of your local GPU for near-instant inference via WebLLM.
- 🤖 **Local LLMs**: Runs multilingual models like Qwen2.5 (0.5B, 1.5B, 3B, 7B) directly in your browser.
- 📱 **Smartphone-First Ergonomics**: Optimized for mobile viewports (`100dvh`), notched safe areas, and touch targets (≥48px) with haptic feedback.
- 📜 **Meeting Transcript Export**: Save timestamped meeting dialogue as Markdown or Plain Text.
- 🔒 **Privacy First**: No cloud APIs, no data collection. Audio, text, and translations never leave your browser.

## 🔧 Requirements

- **Browser Support**: Chrome 113+, Edge 113+, Safari 18+ / iOS 17.4+ (with WebGPU), or Firefox Nightly with WebGPU enabled.
- **Microphone**: Required for voice input and meeting interpretation.
- **Hardware Recommendations**:
  - 📱 **Smartphones & Laptops**: `Qwen2.5 0.5B` (~1.1 GB, fast & low memory footprint).
  - 💻 **Modern Laptops / Desktops**: `Qwen2.5 1.5B` (~1.9 GB, balanced).
  - 🎮 **Gaming / Dedicated GPUs**: `Qwen2.5 3B` / `7B` (3-6 GB VRAM).

## ⚙️ How It Works

This application is built on top of:
- **[Web-LLM](https://github.com/mlc-ai/web-llm)**: Compiles and runs LLMs on WebGPU.
- **[Transformers.js](https://github.com/xenova/transformers.js)**: Runs Whisper AST locally via WebAssembly/ONNX in a background Web Worker.
- **Web Speech Synthesis API**: Uses on-device OS voice engines for instant, zero-download multilingual speech output.
- **Dexie.js**: Manages local model cache metadata in IndexedDB.
- **Qwen2.5 Models**: High-quality multilingual models optimized by the MLC AI team.

## 🚀 Local Development

1. Clone this repository.
2. Serve the directory using a local HTTP server (required for ES modules and Web Workers):
   ```bash
   python3 -m http.server 8080
   ```
3. Open `http://localhost:8080` in a WebGPU-enabled browser.

## 📝 License

GNU GPL v3
