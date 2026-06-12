# Zen Brown Noise (禅意白噪音)

A minimalist, ADHD-friendly brown noise generator designed for focus and relaxation. Featuring a calm tactile interface, drifting horizon clouds, and a simple volume slider.

![Zen Brown Noise Preview](https://github.com/lima1217/zen-brown-noise/raw/main/preview.png)

## ✨ Features

- **Minimalist Aesthetic**: warm paper tones, tactile controls, and a restrained moss accent.
- **Simple Playback**: tap the main button to start or pause brown noise.
- **Volume Slider**: adjust loudness with a quiet, hardware-inspired horizontal control.
- **Drifting Clouds**: soft horizon clouds move slowly behind the player for a calm atmosphere.
- **Breathing Rhythm**: subtle button motion promotes a sense of calm.
- **Pure Web Audio**: High-quality brown noise generated in real-time using the Web Audio API.

## 🎨 Design Philosophy

High-end, organic design with a focus on "tangibility" and "breath".
- **Center Button**: A warm, physical button surface designed for one clear action.
- **Volume Control**: A low-contrast recessed slider that matches the button material.
- **Atmosphere**: Slow-moving horizon clouds add depth without turning into a visualizer.

## 🚀 Getting Started

Simply open `index.html` in any modern web browser.

No build step required. This project uses vanilla HTML, CSS, and JavaScript.

## 🛠️ modification

- **Colors**: Defined in `style.css` variables.
- **Audio**: Logic in `app.js` using `AudioContext`.

## 📄 License

MIT

---

## 📋 Changelog

### v1.1.0 (2026-01-08)
**PWA & Mobile Enhancements**
- ✨ Added iOS home screen icon (`apple-touch-icon.png`)
- ✨ Added PWA meta tags for mobile web app support
- 🐛 Fixed: Audio now continues playing when switching browser tabs on desktop
- 🐛 Fixed: Touch gesture volume control now works on mobile devices
- 📱 Added `touchmove`, `touchend`, `touchcancel` event handlers for mobile

### v1.0.0 (2026-01-07)
**Initial Release**
- 🎨 Minimalist zen aesthetic with Green/Yellow/Blue color palette
- 🔊 Brown noise generation using Web Audio API
- 🖱️ Circular gesture volume control
- ✨ Breathing animation and visual feedback
