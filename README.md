# 🎵 SONANCE — Luxury Hi-Fi Music Player & WebRTC Remote Party PWA

> **A recruiter-grade, high-performance Progressive Web Application built with pure Vanilla JS (ES6), Web Audio API 5-Band DSP, Web Workers, Canvas Visualizers, and Serverless WebRTC PeerJS Audio Streaming.**

![Sonance Cover](./assets/icons/icon.svg)

---

## 🌟 Key Features

- **⚡ Zero Framework Architecture**: Built strictly with ES6 JavaScript Modules and a custom Pub/Sub `EventBus` design pattern for decoupled event management.
- **🎛️ Web Audio API 5-Band Equalizer DSP**: Real-time parametric BiquadFilter equalizer (`60Hz`, `250Hz`, `1kHz`, `4kHz`, `12kHz`) with instant presets (`Bass Boost`, `Rock`, `Pop`, `Jazz`, `Electronic`, `Speech`).
- **📊 60FPS Canvas Visualizer Deck**: Real-time spectrum analysis, oscilloscope waveform rendering, and circular radial visualizer driven by `AnalyserNode` and `requestAnimationFrame`.
- **📈 SoundCloud-Style Waveform Scrubber**: Asynchronous background peak extraction powered by a **Web Worker** and **Transferable Objects**, rendering interactive peak canvases without main thread UI freezing.
- **🌐 Serverless WebRTC Remote Party**: P2P state synchronization and raw `ArrayBuffer` MP3 audio file streaming across host and guest sessions using WebRTC and PeerJS.
- **📱 Progressive Web Application (PWA)**: Complete offline caching strategy via Service Worker (`sw.js`) and web app installation manifest (`manifest.json`).
- **🎨 Dynamic Palette Extraction**: Adaptive background aura dynamically extracted from album cover art using `ColorThief`.
- **🔒 macOS & Safari Compatibility**: Automatic Web Audio Context unblocking on physical user interaction, robust gain ramping anchors, and CORS-safe blob handling.

---

## 🔊 Audio Routing Architecture

```
[ HTMLAudioElement ]
        │
        ▼
[ MediaElementAudioSourceNode ]
        │
        ▼
[ GainNode (Volume Ramping & Mute) ]
        │
        ▼
[ 5x BiquadFilterNodes ] (60Hz -> 250Hz -> 1kHz -> 4kHz -> 12kHz)
        │
        ▼
[ AnalyserNode (FFT Size: 256) ]
        │
        ▼
[ AudioContext.destination ] (Physical Speakers)
```

---

## 🛠️ Technology Stack

- **Core Engine**: HTML5, Vanilla CSS3 (Custom Design System), ES6 JavaScript Modules
- **Audio Processing**: Web Audio API (`AudioContext`, `BiquadFilterNode`, `GainNode`, `AnalyserNode`)
- **Multithreading**: Web Workers API (`waveformWorker.js` with `Float32Array` Transferable Objects)
- **Visuals**: HTML5 Canvas 2D API & ColorThief
- **P2P Networking**: WebRTC API & PeerJS
- **Progressive Web App**: Service Workers & Cache API

---

## 🚀 How to Run Locally

Because Sonance uses ES6 JavaScript modules, Web Workers, and Service Workers, it requires a local HTTP server to bypass browser CORS security policies.

### Option 1: Python HTTP Server (Built-in)
```bash
# Navigate to the project root
cd /path/to/MusicPlayer

# Launch Python 3 local server
python3 -m http.server 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in Google Chrome, Safari, or Microsoft Edge.

### Option 2: VS Code Live Server
1. Install the **Live Server** extension in VS Code.
2. Right-click `index.html` and select **Open with Live Server**.

---

## 🌐 Deploying to Vercel

Sonance is pre-configured for instant Vercel deployment with clean URLs and immutable static asset headers via `vercel.json`:

```bash
npm i -g vercel
vercel --prod
```

---

## 👨‍💻 Developer & Project Credits

- **Developer**: [Shahil Raj](https://github.com/shahilraj)
- **Organization**: CodeAlpha Frontend Development Internship
- **License**: MIT
