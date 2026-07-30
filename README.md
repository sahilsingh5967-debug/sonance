# ⚡ SONANCE

### Luxury Hi-Fi Music Player & WebRTC Remote Party PWA

An elegant Progressive Web Application emulating Bang & Olufsen hi-fi acoustics, featuring an Event-Driven Pub/Sub architecture, 5-band Web Audio EQ with 7 one-click presets, 60FPS multi-mode Canvas visualizer, VS Code style Command Palette (`Ctrl + Shift + P`), offline PWA capabilities, and serverless WebRTC Remote Party synchronization via PeerJS.

🌐 **Live Demo:** [https://sonance-hifi.vercel.app](https://sonance-hifi.vercel.app)

---

![Sonance Preview](./assets/icons/icon.svg)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?logo=javascript&logoColor=black)
![WebRTC](https://img.shields.io/badge/WebRTC-PeerJS-red)
![PWA](https://img.shields.io/badge/PWA-Ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black)

---

## ✨ Features

- **Bang & Olufsen Inspired Chassis** — Matte Black & Champagne Bronze materials, vinyl disc rotation animations, and OLED glass display.
- **Data Persistence State Engine (`storage.js`)** — Automatically saves and restores Volume and 5-Band EQ settings across sessions via `localStorage`.
- **VS Code Style Command Palette (`Ctrl + Shift + P`)** — Keyboard-first modal triggering playback, theme, visualizer modes, and EQ presets.
- **Dynamic Album-Art Background Blur** — Real-time backdrop blur filter (`backdrop-filter: blur(90px)`) driven dynamically by current track cover art.
- **3 Visualizer Modes** — Hot-swappable 60FPS Canvas renderers: *Frequency Spectrum*, *Waveform Oscilloscope*, and *Circular Radial Pulse*.
- **5-Band Equalizer & 7 Presets** — `SourceNode -> GainNode -> 5 BiquadFilters -> AnalyserNode -> Speakers` with 1-click presets (*Flat*, *Rock*, *Pop*, *Jazz*, *Bass Boost*, *Electronic*, *Speech*).
- **Serverless WebRTC Remote Party Sync** — Real-time P2P playback state & latency compensation across devices using PeerJS.
- **ID3 Metadata Extraction (`jsmediatags`)** — Extracts ID3 tags and converts raw cover art byte arrays to Base64 image URLs.
- **Progressive Web App (PWA)** — 100% offline capability powered by Service Worker (`sw.js`).

---

## ⌨️ Desktop Keyboard Shortcuts Matrix

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Space` | Play / Pause | Toggle audio playback & vinyl disc spin |
| `←` / `→` | Seek -/+ 5s | Scrub audio timeline |
| `Ctrl + ←` / `Ctrl + →` | Previous / Next | Skip track queue |
| `M` | Mute | Toggle volume mute |
| `Ctrl + Shift + P` | Command Palette | Open VS Code style command modal |
| `Esc` | Close | Dismiss overlays & modals |

---

## 🏗 Architecture Pattern (Pub/Sub Event Bus)

No module communicates directly with another. Every interaction passes through `eventBus.js`:

```
User Action -> UIController -> EventBus.emit('PLAY_COMMAND') -> AudioEngine.play()
                                                            -> Visualizer.startLoop()
                                                            -> PartySync.broadcast()
```

---

## 🛠 Tech Stack

- **HTML5 & CSS3** — CSS Custom Properties, glassmorphism, 3D CSS transforms
- **JavaScript (ES6)** — Event-driven modular architecture (`eventBus.js`, `audioEngine.js`, `uiController.js`, `visualizer.js`, `partySync.js`, `playlist.js`, `storage.js`)
- **Web Audio API** — 5-band Equalizer graph & Audio Analyser
- **WebRTC / PeerJS** — Serverless P2P data channels for Remote Party listening
- **Canvas API** — 60FPS multi-mode spectrum visualizer
- **Service Worker & Manifest** — Offline PWA support
- **Vercel** — Production deployment configuration

---

## 📂 Project Structure

```
MusicPlayer/
├── index.html            # Sonance Luxury Hi-Fi Grid & Command Palette Modal
├── manifest.json         # PWA Web App Manifest
├── sw.js                 # Service Worker (offline cache engine)
├── vercel.json           # Vercel production headers
├── css/
│   ├── design-system.css # Design system tokens & materials
│   ├── layout.css        # Hi-Fi Chassis grid structure & fade-in startup
│   ├── components.css    # OLED display, Command Palette, Toast & visualizer
│   └── responsive.css    # Mobile & tablet adapters
├── js/
│   ├── main.js           # Bootstrapper, storage restore & PWA ServiceWorker
│   ├── eventBus.js       # Pub/Sub State Manager (.on, .emit, .off)
│   ├── audioEngine.js    # Web Audio Graph, 5-band EQ & Presets
│   ├── uiController.js   # DOM Manipulator, Shortcuts & Command Palette
│   ├── visualizer.js     # 60FPS Multi-Mode Canvas Visualizer
│   ├── partySync.js      # PeerJS WebRTC P2P remote party sync
│   ├── playlist.js       # Data Ingestion, ID3 Tags & queue manager
│   └── storage.js        # LocalStorage state persistence
├── test/
│   └── Auralis.test.js   # Automated unit test suite
└── README.md             # Open-source recruiter-grade documentation
```

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/shahilraj/sonance.git

# Navigate into project directory
cd sonance

# Run unit tests
npm test
```

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">Made with ❤️ by Shahil Raj</p>
