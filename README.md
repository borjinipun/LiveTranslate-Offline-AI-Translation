# 🌍 LiveTranslate — Offline AI Translation

A modern, high-performance browser application for **real-time, offline translation**. Powered by WebGPU and local LLMs, LiveTranslate allows you to translate text and speech entirely within your browser with zero network latency and total privacy.

All processing happens locally on your device. No server required. No data leaves your machine. 💯% Offline.

## 🌟 Live URL

🔗 Use the app at [https://borjinipun.github.io/LiveTranslate-Offline-AI-Translation/](https://borjinipun.github.io/LiveTranslate-Offline-AI-Translation/)

## ✅ Features

- 🎤 **Live Voice Translation**: Speak into your microphone and watch the translation appear in real-time (powered by the Web Speech API).
- ⚡ **WebGPU Acceleration**: Utilizes the power of your local GPU for near-instant inference via WebLLM.
- 🤖 **Local LLMs**: Runs multilingual models like Qwen2.5 directly in your browser.
- 🔒 **Privacy First**: No cloud APIs, no data collection. Your conversations and voice data never leave your browser.
- 📜 **Session History**: Automatically maintains a log of your translation pairs for easy reference during a session.
- 🔄 **Instant Language Swap**: Easily toggle between source and target languages with a single click.
- 📊 **Progress Tracking**: Real-time visual feedback for model downloads and initialization.

## 🔧 Requirements

- **Browser Support**: Chrome 113+, Edge 113+, or Firefox 118+ with WebGPU enabled.
- **Microphone**: Required for voice-to-text features (currently best supported in Chrome and Edge).
- **Hardware**: Dedicated GPU recommended for the best experience.
  - 🟢 **Small models (0.5B - 1.5B)**: ~1-2GB VRAM (Works on most modern laptops)
  - 🟠 **Medium models (3B - 7B)**: ~4-8GB VRAM (Requires gaming GPU)

## ⚙️ How It Works

This application is built on top of:
- **[Web-LLM](https://github.com/mlc-ai/web-llm)**: The core engine that compiles and runs LLMs on WebGPU.
- **Web Speech API**: For real-time speech-to-text recognition.
- **Dexie.js**: For managing local model cache metadata in IndexedDB.
- **Qwen2.5 Models**: Optimized multilingual models provided by the MLC AI team.

## 🚀 Local Development

1. Clone this repository.
2. Serve the directory using a local HTTP server (required for ES modules):
   ```bash
   python3 -m http.server 8080
   ```
3. Open `http://localhost:8080` in a WebGPU-enabled browser.

## 🙏 Credits

- **Core Engine**: [Web-LLM](https://github.com/mlc-ai/web-llm) by the MLC AI team.
- **Model Hosting**: Models are served via the MLC AI Hugging Face repositories.

## 📝 License

GNU GPL v3
