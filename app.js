const playBtn = document.getElementById('playBtn');
const statusText = playBtn.querySelector('.status-text');
const volumeRing = document.getElementById('volumeRing');
const hintText = document.getElementById('hintText');

let audioCtx;
let brownNoiseSource;
let gainNode;
let isPlaying = false;
let volume = 0.5;

// Silent audio element for iOS background playback
let silentAudio;

// Circular gesture tracking
let lastAngle = null;
let isTracking = false;
const SENSITIVITY = 0.002;

// Create a silent audio element for iOS background playback workaround
function createSilentAudio() {
    if (silentAudio) return silentAudio;

    // Create a very short silent audio using data URI
    // This is a minimal valid MP3 file (silence)
    const silentMP3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+9DEAAAIAANIAAAAQigA0gAAABERERERERERERERERERERERERERERERERERERERERERERERERERERP/7UMQFgAAADSAAAAAAAANIAAAARERERERERERERERERERERERERERERERERERERERERERERERERERE//tQxAWAAAANIAAAAAAAA0gAAABERERERERERERERERERERERERERERERERERERERERERERERERERET/+1DEBYAAAANIAAAAAAAADSAAAABEREREREREREREREREREREREREREREREREREREREREREREREREREf/7UMQFAAAAA0gAAAAAAANIAAAARERERERERERERERERERERERERERERERERERERERERERERERERERE';

    silentAudio = new Audio(silentMP3);
    silentAudio.loop = true;
    silentAudio.volume = 0.01; // Nearly silent

    return silentAudio;
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

// Create Brown Noise Buffer
function createBrownNoiseBuffer(ctx) {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5;
    }
    return buffer;
}

// Update ink wash visual feedback - scale and intensity based on volume
function updateVolumeRing() {
    // Scale from 0.8 to 1.3
    const scale = 0.8 + (volume * 0.5);
    // Intensity (opacity) from 0.1 to 0.9 based on volume
    const intensity = 0.1 + (volume * 0.8);

    volumeRing.style.setProperty('--volume-scale', scale);
    volumeRing.style.setProperty('--volume-intensity', intensity);
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

            if (gainNode) {
                gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
            }

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

            if (gainNode) {
                gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
            }

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

// Fix: Keep audio playing when switching tabs/apps
document.addEventListener('visibilitychange', () => {
    if (audioCtx && isPlaying) {
        if (document.visibilityState === 'visible') {
            // Resume audio when page becomes visible again
            audioCtx.resume();
        }
    }
});

function startNoise() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Start silent audio for iOS background playback
    const silent = createSilentAudio();
    silent.play().catch(() => {
        // Ignore errors - user gesture may be required
    });

    brownNoiseSource = audioCtx.createBufferSource();
    brownNoiseSource.buffer = createBrownNoiseBuffer(audioCtx);
    brownNoiseSource.loop = true;

    gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 1);

    brownNoiseSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    brownNoiseSource.start();

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
}

function stopNoise() {
    if (brownNoiseSource) {
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);

        setTimeout(() => {
            brownNoiseSource.stop();
            brownNoiseSource.disconnect();
            isPlaying = false;
        }, 500);

        // Stop silent audio
        if (silentAudio) {
            silentAudio.pause();
            silentAudio.currentTime = 0;
        }

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
}
