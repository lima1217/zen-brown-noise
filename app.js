const playBtn = document.getElementById('playBtn');
const statusText = playBtn.querySelector('.status-text');
const volumeRing = document.getElementById('volumeRing');
const hintText = document.getElementById('hintText');

// Use HTML5 Audio for iOS background playback support
let audioElement;
let isPlaying = false;
let volume = 0.5;

// Circular gesture tracking
let lastAngle = null;
let isTracking = false;
const SENSITIVITY = 0.002;

// Initialize audio element
function initAudio() {
    if (audioElement) return audioElement;

    audioElement = new Audio('brown-noise.wav');
    audioElement.loop = true;
    audioElement.volume = volume;
    audioElement.preload = 'auto';

    // Handle audio errors
    audioElement.onerror = (e) => {
        console.error('Audio error:', e);
    };

    return audioElement;
}

// Setup Media Session API for lock screen controls
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
    if (audioElement) {
        audioElement.volume = volume;
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

document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('touchend', handleTouchEnd);
document.addEventListener('touchcancel', handleTouchEnd);

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (audioElement && isPlaying) {
        if (document.visibilityState === 'visible') {
            // Resume if paused
            if (audioElement.paused) {
                audioElement.play().catch(() => { });
            }
        }
    }
});

async function startNoise() {
    const audio = initAudio();

    try {
        await audio.play();

        isPlaying = true;
        playBtn.classList.add('playing');
        statusText.textContent = "STOP";
        volumeRing.classList.add('active');
        updateVolumeRing();
        showHint();

        // Setup media session for lock screen controls
        setupMediaSession();

        // Update media session playback state
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
        }
    } catch (error) {
        console.error('Failed to start audio:', error);
    }
}

function stopNoise() {
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
    }

    isPlaying = false;
    playBtn.classList.remove('playing');
    statusText.textContent = "START";
    volumeRing.classList.remove('active');
    volumeRing.classList.remove('adjusting');
    lastAngle = null;

    // Update media session playback state
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
    }
}

// Preload audio on page load
document.addEventListener('DOMContentLoaded', () => {
    initAudio();
});
