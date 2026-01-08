# Zen Brown Noise (禅意白噪音)

A minimalist, ADHD-friendly brown noise generator designed for focus and relaxation. Featuring an organic "Ink Wash" aesthetic and gesture-based interactions.

![Zen Brown Noise Preview](https://github.com/lima1217/zen-brown-noise/raw/main/preview.png)

## ✨ Features

- **Minimalist Aesthetic**: carefully curated Green, Blue, and Yellow color palette inspired by nature and ink wash paintings.
- **Gesture Control**: Adjust volume by circling your mouse around the center button (Clockwise to increase, Counter-clockwise to decrease).
- **Tangible Visual Feedback**: A "tangible" yellow aura ring that expands and solidifies as volume increases.
- **Breathing Rhythm**: Synchronized breathing animations on the button and ring to promote a sense of calm.
- **Pure Web Audio**: High-quality brown noise generated in real-time using the Web Audio API.

## 🎨 Design Philosophy

High-end, organic design with a focus on "tangibility" and "breath".
- **Center Button**: Softly blurred edges for a gentle feel.
- **Volume Ring**: Sharpens and becomes more opaque at higher volumes, providing tactile visual feedback.
- **Interaction**: No sliders or standard inputs. Just organic circular motion.

## 🚀 Getting Started

Simply open `index.html` in any modern web browser.

No build step required. This project uses vanilla HTML, CSS, and JavaScript.

## 🛠️ modification

- **Colors**: Defined in `style.css` variables (`--color-green`, `--color-yellow`, `--color-blue`).
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
