const playBtn = document.getElementById('playBtn');
const statusText = playBtn.querySelector('.status-text');
const volumeRing = document.getElementById('volumeRing');
const hintText = document.getElementById('hintText');

let isPlaying = false;
let volume = 0.5;

// Audio Context and Nodes
let audioContext = null;
let gainNode = null;
let brownNoiseSource = null;
const BUFFER_SIZE = 10 * 44100; // 10 seconds buffer

// Circular gesture tracking
let lastAngle = null;
let isTracking = false;
const SENSITIVITY = 0.002;

// Initialize AudioContext
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = volume;
    }
    // Resume context if suspended (browser policy)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// Generate Brown Noise Buffer
function createBrownNoiseBuffer() {
    const buffer = audioContext.createBuffer(1, BUFFER_SIZE, audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < BUFFER_SIZE; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5; // Compensate for gain loss
    }
    return buffer;
}

// Setup Media Session API (Simplified for generated audio)
function setupMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Brown Noise',
            artist: 'Zen Focus',
            album: 'Ambient Sounds',
            artwork: [
                { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
            ]
        });

        // Background play handlers might not work perfectly without an HTMLAudioElement 
        // playing content, but we'll register them anyway.
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
}

// Update ink wash visual feedback - scale and intensity based on volume
function updateVolumeRing() {
    // Scale from 0.8 to 1.3
    const scale = 0.8 + (volume * 0.5);
    // Intensity (opacity) from 0.1 to 0.9 based on volume
    const intensity = 0.1 + (volume * 0.8);

    volumeRing.style.setProperty('--volume-scale', scale);
    volumeRing.style.setProperty('--volume-intensity', intensity);

    // Update audio volume
    if (gainNode) {
        // Smooth transition to avoid clicking
        gainNode.gain.setTargetAtTime(volume, audioContext.currentTime, 0.01);
    }
}

// Calculate angle from center of button to mouse position
function getAngle(centerX, centerY, mouseX, mouseY) {
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return angle;
}

// Get center of the play button
function getButtonCenter() {
    const rect = playBtn.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        radius: rect.width / 2
    };
}

// Handle mouse move for circular gesture
function handleMouseMove(e) {
    if (!isPlaying) return;

    const center = getButtonCenter();
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const dx = mouseX - center.x;
    const dy = mouseY - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const innerRadius = center.radius;
    const outerRadius = center.radius + 120;

    if (distance > innerRadius && distance < outerRadius) {
        volumeRing.classList.add('adjusting');

        const currentAngle = getAngle(center.x, center.y, mouseX, mouseY);

        if (lastAngle !== null) {
            let delta = currentAngle - lastAngle;

            if (delta > 180) delta -= 360;
            if (delta < -180) delta += 360;

            volume += delta * SENSITIVITY;
            volume = Math.max(0, Math.min(1, volume));

            updateVolumeRing();
        }

        lastAngle = currentAngle;
        isTracking = true;
    } else {
        volumeRing.classList.remove('adjusting');
        lastAngle = null;
        isTracking = false;
    }
}

// Show hint when playing starts
function showHint() {
    hintText.classList.add('visible');
    setTimeout(() => {
        hintText.classList.remove('visible');
    }, 3000);
}

playBtn.addEventListener('click', () => {
    if (!isPlaying) {
        startNoise();
    } else {
        stopNoise();
    }
});

// Desktop: mouse move for circular gesture
document.addEventListener('mousemove', handleMouseMove);

// Mobile: touch events for circular gesture
function handleTouchMove(e) {
    if (!isPlaying || e.touches.length === 0) return;

    // Prevent scrolling while adjusting volume
    e.preventDefault();

    const touch = e.touches[0];
    const center = getButtonCenter();
    const touchX = touch.clientX;
    const touchY = touch.clientY;

    const dx = touchX - center.x;
    const dy = touchY - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const innerRadius = center.radius;
    const outerRadius = center.radius + 120;

    if (distance > innerRadius && distance < outerRadius) {
        volumeRing.classList.add('adjusting');

        const currentAngle = getAngle(center.x, center.y, touchX, touchY);

        if (lastAngle !== null) {
            let delta = currentAngle - lastAngle;

            if (delta > 180) delta -= 360;
            if (delta < -180) delta += 360;

            volume += delta * SENSITIVITY;
            volume = Math.max(0, Math.min(1, volume));

            // Directly update audio volume logic incorporated in updateVolumeRing
            updateVolumeRing();
        }

        lastAngle = currentAngle;
        isTracking = true;
    } else {
        volumeRing.classList.remove('adjusting');
        lastAngle = null;
        isTracking = false;
    }
}

function handleTouchEnd() {
    volumeRing.classList.remove('adjusting');
    lastAngle = null;
    isTracking = false;
}

// Initialize lastAngle on touch start for smoother gesture
function handleTouchStart(e) {
    if (!isPlaying || e.touches.length === 0) return;

    const touch = e.touches[0];
    const center = getButtonCenter();
    const touchX = touch.clientX;
    const touchY = touch.clientY;

    const dx = touchX - center.x;
    const dy = touchY - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const innerRadius = center.radius;
    const outerRadius = center.radius + 120;

    if (distance > innerRadius && distance < outerRadius) {
        lastAngle = getAngle(center.x, center.y, touchX, touchY);
        isTracking = true;
    }
}

document.addEventListener('touchstart', handleTouchStart, { passive: true });
document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('touchend', handleTouchEnd);
document.addEventListener('touchcancel', handleTouchEnd);

// Handle page visibility changes - minimal logic for generated audio
// We generally want it to stop if the page is hidden if we can't sustain it, 
// OR keep playing if the browser allows. With standard WebAudio, it might pause automatically
// when backgrounded on mobile, which is what the user accepted ("give up background playback").
document.addEventListener('visibilitychange', () => {
    // Optional: Auto-pause or resume logic could go here, 
    // but the user's request specifically mentions "giving up background playback",
    // implying we rely on the browser's default behavior for active tabs.
});

async function startNoise() {
    try {
        initAudio();

        // Create source
        brownNoiseSource = audioContext.createBufferSource();
        brownNoiseSource.buffer = createBrownNoiseBuffer();
        brownNoiseSource.loop = true;
        brownNoiseSource.connect(gainNode);

        brownNoiseSource.start(0);

        isPlaying = true;
        playBtn.classList.add('playing');
        statusText.textContent = "STOP";
        volumeRing.classList.add('active');
        updateVolumeRing();
        showHint();

        // Setup media session
        setupMediaSession();
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
    } catch (error) {
        console.error('Failed to start audio:', error);
        statusText.textContent = "ERROR";
        setTimeout(() => {
            statusText.textContent = "START";
        }, 2000);
    }
}

function stopNoise() {
    if (brownNoiseSource) {
        try {
            brownNoiseSource.stop();
            brownNoiseSource.disconnect();
        } catch (e) {
            // Ignore if already stopped
        }
        brownNoiseSource = null;
    }

    isPlaying = false;
    playBtn.classList.remove('playing');
    statusText.textContent = "START";
    volumeRing.classList.remove('active');
    volumeRing.classList.remove('adjusting');
    lastAngle = null;

    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
    }
}
