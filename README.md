# 🎵 Sonance — Hi-Fi Music Player & WebRTC Remote Party

[![CI Pipeline](https://github.com/sahilsingh5967-debug/sonance/actions/workflows/ci.yml/badge.svg)](https://github.com/sahilsingh5967-debug/sonance/actions/workflows/ci.yml)
[![Vercel](https://img.shields.io/badge/Vercel-Live-000000?logo=vercel&logoColor=white)](https://vercel.com)

> A high-performance Progressive Web Application built with **pure Vanilla JS (ES6 Modules)**, Web Audio API 5-Band DSP, Web Workers, Canvas Visualizers, and serverless WebRTC P2P audio streaming — zero frameworks, zero dependencies on runtime libraries.

![Sonance UI](./assets/sonance-preview.png)

---

## ✨ Features

- **⚡ Zero Framework Architecture** — ES6 modules with a custom Pub/Sub `EventBus` for fully decoupled event management
- **🎛️ 5-Band Web Audio EQ** — Real-time BiquadFilter DSP at `60Hz · 250Hz · 1kHz · 4kHz · 12kHz` with instant presets: Bass Boost, Rock, Pop, Jazz, Electronic, Speech
- **📊 60FPS Canvas Visualizer** — Spectrum analyser, oscilloscope waveform, and circular radial mode via `AnalyserNode` + `requestAnimationFrame`
- **📈 Waveform Scrubber** — Asynchronous background peak extraction via Web Worker and `Float32Array` Transferable Objects — no main thread blocking
- **🌐 WebRTC Remote Party** — P2P state sync and raw `ArrayBuffer` audio file streaming across host and guest sessions via PeerJS
- **📱 Progressive Web App** — Full offline support via versioned Service Worker (`sw.js`) and `manifest.json`
- **🎨 Dynamic Aura** — Adaptive background colour extracted from album art using ColorThief
- **🔒 Safari / macOS Compatible** — Automatic `AudioContext` unblocking on user interaction, gain ramping, and CORS-safe blob handling

---

## 🖥️ Audio Routing Architecture

```
[ HTMLAudioElement ]
        │
        ▼
[ MediaElementAudioSourceNode ]
        │
        ▼
[ GainNode  ←  Volume Ramping & Mute ]
        │
        ▼
[ BiquadFilterNode  60 Hz  ]
[ BiquadFilterNode  250 Hz ]
[ BiquadFilterNode  1 kHz  ]
[ BiquadFilterNode  4 kHz  ]
[ BiquadFilterNode  12 kHz ]
        │
        ▼
[ AnalyserNode  ←  FFT Size 256 ]
        │
        ▼
[ AudioContext.destination  →  🔊 Speakers ]
```

---

## ⚙️ CI / CD Pipeline

GitHub Actions runs automatically on every push and pull request to `main`:

| Step | Action |
|---|---|
| 1 | Repository checkout via `actions/checkout@v4` |
| 2 | Node.js 22 setup with npm cache |
| 3 | `npm install` |
| 4 | `npm run lint` — ESLint + Prettier code quality check |
| 5 | `npm test` — unit tests for `eventBus`, `playlist`, `audioEngine`, `partySync` |
| 6 | Fail-fast guard — blocks merges on any lint or test failure |

Vercel deploys automatically on every successful merge to `main`.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Core | HTML5, CSS3 Custom Design System, ES6 Modules |
| Audio | Web Audio API (`AudioContext`, `BiquadFilterNode`, `GainNode`, `AnalyserNode`) |
| Threading | Web Workers API (`waveformWorker.js`, `Float32Array` Transferable Objects) |
| Visuals | HTML5 Canvas 2D API, ColorThief |
| Networking | WebRTC API, PeerJS |
| PWA | Service Worker, Cache API |
| Tooling | GitHub Actions, ESLint, Prettier |

---

## 🚀 Running Locally

ES6 modules, Web Workers, and Service Workers require an HTTP server — opening `index.html` directly via `file://` will not work.

**Option 1 — Python (built-in):**
```bash
cd sonance
python3 -m http.server 8000
```
Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in Chrome, Safari, or Edge.

**Option 2 — VS Code Live Server:**
1. Install the **Live Server** extension
2. Right-click `index.html` → **Open with Live Server**

---

## ☁️ Deploying to Vercel

Pre-configured with `vercel.json` for clean URLs and immutable static asset caching:

```bash
npm i -g vercel
vercel --prod
```

---

## 👨‍💻 Developer

Built by **Sahil Singh** ([@sahilsingh5967-debug](https://github.com/sahilsingh5967-debug))
as part of the **CodeAlpha Frontend Development Internship**.
