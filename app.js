const playBtn = document.getElementById('playBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');

let isPlaying = false;
const savedVolume = parseFloat(localStorage.getItem('zenBrownNoiseVolume'));
let volume = Number.isFinite(savedVolume) ? Math.max(0, Math.min(1, savedVolume)) : 0.5;

let audioContext = null;
let gainNode = null;
let brownNoiseSource = null;
const BUFFER_SIZE = 10 * 44100;

let audioUnlocked = false;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = volume;
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function unlockAudioForIOS() {
    if (audioUnlocked) return Promise.resolve();

    initAudio();

    const silentBuffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(audioContext.destination);
    source.start(0);

    return audioContext.resume().then(() => {
        audioUnlocked = true;
    }).catch((error) => {
        console.warn('Audio unlock failed:', error);
    });
}

function createBrownNoiseBuffer() {
    const buffer = audioContext.createBuffer(1, BUFFER_SIZE, audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < BUFFER_SIZE; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5;
    }

    return buffer;
}

function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Brown Noise',
        artist: 'Zen Focus',
        album: 'Ambient Sounds',
        artwork: [
            { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
        ]
    });

    navigator.mediaSession.setActionHandler('play', () => {
        if (!isPlaying) startNoise();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        if (isPlaying) stopNoise();
    });
    navigator.mediaSession.setActionHandler('stop', () => {
        if (isPlaying) stopNoise();
    });
}

function updateVisualState() {
    const percentage = Math.round(volume * 100);

    document.documentElement.style.setProperty('--volume-percent', `${percentage}%`);
    volumeSlider.value = percentage.toString();
    volumeValue.textContent = percentage.toString();

    localStorage.setItem('zenBrownNoiseVolume', volume.toString());

    if (gainNode && audioContext) {
        gainNode.gain.setTargetAtTime(volume, audioContext.currentTime, 0.01);
    }
}

function setPlayingState(nextPlaying) {
    isPlaying = nextPlaying;
    playBtn.classList.toggle('playing', isPlaying);
    playBtn.setAttribute('aria-pressed', isPlaying.toString());
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause brown noise' : 'Play brown noise');
}

async function startNoise() {
    try {
        await unlockAudioForIOS();
        initAudio();

        if (brownNoiseSource) {
            brownNoiseSource.stop();
            brownNoiseSource.disconnect();
        }

        brownNoiseSource = audioContext.createBufferSource();
        brownNoiseSource.buffer = createBrownNoiseBuffer();
        brownNoiseSource.loop = true;
        brownNoiseSource.connect(gainNode);
        brownNoiseSource.start(0);

        setPlayingState(true);
        updateVisualState();
        setupMediaSession();

        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
    } catch (error) {
        console.error('Failed to start audio:', error);
        window.setTimeout(() => setPlayingState(false), 1600);
    }
}

function stopNoise() {
    if (brownNoiseSource) {
        try {
            brownNoiseSource.stop();
            brownNoiseSource.disconnect();
        } catch (error) {
            console.warn('Audio source already stopped:', error);
        }

        brownNoiseSource = null;
    }

    setPlayingState(false);

    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
    }
}

function toggleNoise() {
    if (isPlaying) {
        stopNoise();
    } else {
        startNoise();
    }
}

function handleVolumeInput(event) {
    const nextVolume = Number(event.target.value) / 100;
    volume = Math.max(0, Math.min(1, nextVolume));
    updateVisualState();
}

playBtn.addEventListener('click', toggleNoise);
volumeSlider.addEventListener('input', handleVolumeInput);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isPlaying && audioContext?.state === 'suspended') {
        audioContext.resume();
    }
});

function init() {
    updateVisualState();
    setPlayingState(false);

    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);

    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isLocalHost) {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => console.log('Service Worker registered:', registration.scope))
            .catch((error) => console.log('Service Worker registration failed:', error));
    }
}

init();
