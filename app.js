const playBtn = document.getElementById('playBtn');
const statusText = playBtn.querySelector('.status-text');

let audioCtx;
let brownNoiseSource;
let gainNode;
let isPlaying = false;

// Create Brown Noise Buffer
function createBrownNoiseBuffer(ctx) {
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut;
        // Compensate for gain to prevent clipping, brown noise is loud at low freqs
        data[i] *= 3.5;
    }
    return buffer;
}

playBtn.addEventListener('click', () => {
    if (!isPlaying) {
        startNoise();
    } else {
        stopNoise();
    }
});

function startNoise() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    brownNoiseSource = audioCtx.createBufferSource();
    brownNoiseSource.buffer = createBrownNoiseBuffer(audioCtx);
    brownNoiseSource.loop = true;

    gainNode = audioCtx.createGain();
    // Fade in
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 1);

    brownNoiseSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    brownNoiseSource.start();

    isPlaying = true;
    playBtn.classList.add('playing');
    statusText.textContent = "STOP";
}

function stopNoise() {
    if (brownNoiseSource) {
        // Fade out
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);

        setTimeout(() => {
            brownNoiseSource.stop();
            brownNoiseSource.disconnect();
            isPlaying = false;
        }, 500);

        playBtn.classList.remove('playing');
        statusText.textContent = "START";
    }
}
