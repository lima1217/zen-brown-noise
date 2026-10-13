const $ = (id) => document.getElementById(id);

const playBtn = $('playBtn');
const volumeSlider = $('volumeSlider');
const volumeValue = $('volumeValue');
const toneSlider = $('toneSlider');
const toneValue = $('toneValue');
const timerSlider = $('timerSlider');
const timerValue = $('timerValue');

// Timer slider stops in minutes; the far right (0) means no limit.
const TIMER_STEPS = [5, 10, 15, 25, 30, 45, 60, 75, 90, 120, 150, 180, 240, 0];
const timerProgress = $('timerProgress');
const statusMain = $('statusMain');
const statusSub = $('statusSub');
const themeBtn = $('themeBtn');
const orbWrap = $('orbWrap');
const breathWord = $('breathWord');
// Two stacked label layers so phase changes can crossfade.
const breathLayers = Array.from(breathWord.querySelectorAll('.breath-layer'));
let activeLayer = 0;
const langPicker = $('langPicker');
const langBtn = $('langBtn');
const langMenu = $('langMenu');
const langCode = $('langCode');
const langItems = Array.from(langMenu.querySelectorAll('[data-lang]'));

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

const LOOP_SECONDS = 12;
const CROSSFADE_SECONDS = 0.5;
const FADE_IN = 1.4;
const FADE_OUT = 0.6;
const TIMER_FADE_OUT = 8;

// Breathing guide: the 4-7-8 technique — inhale 4s, hold 7s, exhale 8s.
const BREATH_PHASES = [
    { key: 'in', seconds: 4 },
    { key: 'hold', seconds: 7 },
    { key: 'out', seconds: 8 },
];
const BREATH_CYCLE = BREATH_PHASES.reduce((sum, phase) => sum + phase.seconds, 0);
const BREATH_WORDS = { in: 'breatheIn', hold: 'breatheHold', out: 'breatheOut' };

// ---------- Persisted state ----------

function readNumber(key, fallback, min, max) {
    const value = parseFloat(localStorage.getItem(key));
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

const state = {
    playing: false,
    volume: readNumber('zenBrownNoiseVolume', 0.5, 0, 1),
    tone: readNumber('zenBrownNoiseTone', 0.4, 0, 1),
    timerMinutes: readNumber('zenBrownNoiseTimer', 0, 0, 240),
    timerRemaining: 0,
    elapsed: 0,
    lastTick: 0,
    stopTimeout: null,
    tickInterval: null,
    levelFrame: null,
    breathStart: 0,
    breathPhase: null,
    breathCount: null,
    level: 0,
};
if (!TIMER_STEPS.includes(state.timerMinutes)) state.timerMinutes = 0;
state.timerRemaining = state.timerMinutes * 60;

// ---------- Audio ----------

let ctx = null;
let source = null;
let filter = null;
let fadeGain = null;
let volumeGain = null;
let analyser = null;
let levelData = null;
let fadeGainTargetMakeup = 1;

function createBrownNoiseBuffer() {
    const rate = ctx.sampleRate;
    const length = Math.floor(LOOP_SECONDS * rate);
    const fade = Math.floor(CROSSFADE_SECONDS * rate);
    const buffer = ctx.createBuffer(2, length, rate);

    for (let channel = 0; channel < 2; channel++) {
        // Generate a little extra so the tail can be blended into the head,
        // making the loop point seamless (no periodic click).
        const raw = new Float32Array(length + fade);
        let last = 0;
        for (let i = 0; i < raw.length; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + 0.02 * white) / 1.02;
            raw[i] = last * 3.5;
        }

        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            if (i < fade) {
                const t = i / fade;
                data[i] = raw[i] * Math.sin(t * Math.PI / 2) + raw[length + i] * Math.cos(t * Math.PI / 2);
            } else {
                data[i] = raw[i];
            }
        }
    }

    return buffer;
}

function ensureAudio() {
    if (ctx) return;

    ctx = new (window.AudioContext || window.webkitAudioContext)();

    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.5;

    fadeGain = ctx.createGain();
    fadeGain.gain.value = 0;

    volumeGain = ctx.createGain();

    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    levelData = new Float32Array(analyser.fftSize);

    source = ctx.createBufferSource();
    source.buffer = createBrownNoiseBuffer();
    source.loop = true;

    source.connect(filter);
    filter.connect(fadeGain);
    fadeGain.connect(volumeGain);
    volumeGain.connect(analyser);
    analyser.connect(ctx.destination);
    source.start(0);

    applyVolume(true);
    applyTone(true);
}

function volumeToGain(v) {
    // Perceptual curve: finer control at low volumes.
    return Math.pow(v, 1.6);
}

function toneToCutoff(value) {
    return 120 * Math.pow(4200 / 120, value);
}

function applyVolume(immediate = false) {
    if (!ctx) return;
    const target = volumeToGain(state.volume);
    if (immediate) volumeGain.gain.value = target;
    else volumeGain.gain.setTargetAtTime(target, ctx.currentTime, 0.03);
}

function applyTone(immediate = false) {
    if (!ctx) return;
    const cutoff = toneToCutoff(state.tone);
    // Darker tones lose energy through the filter; add a little makeup gain.
    const makeup = 1 + (1 - state.tone) * 0.7;
    if (immediate) {
        filter.frequency.value = cutoff;
        fadeGainTargetMakeup = makeup;
    } else {
        filter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.05);
        fadeGainTargetMakeup = makeup;
        if (state.playing) fadeGain.gain.setTargetAtTime(makeup, ctx.currentTime, 0.05);
    }
}


function fadeTo(value, seconds) {
    const now = ctx.currentTime;
    fadeGain.gain.cancelScheduledValues(now);
    fadeGain.gain.setValueAtTime(fadeGain.gain.value, now);
    fadeGain.gain.setTargetAtTime(value, now, seconds / 4);
}

async function play() {
    ensureAudio();
    clearTimeout(state.stopTimeout);

    // Resume inside the user gesture (required on iOS Safari).
    try {
        await ctx.resume();
    } catch (error) {
        console.warn('Audio resume failed:', error);
    }

    if (state.timerMinutes > 0 && state.timerRemaining <= 0) {
        state.timerRemaining = state.timerMinutes * 60;
    }

    fadeTo(fadeGainTargetMakeup, FADE_IN);
    setPlaying(true);
}

function pause(fadeSeconds = FADE_OUT) {
    if (!ctx) return;
    fadeTo(0, fadeSeconds);
    setPlaying(false);

    clearTimeout(state.stopTimeout);
    state.stopTimeout = setTimeout(() => {
        if (!state.playing) ctx.suspend();
    }, fadeSeconds * 1000 + 200);
}

function toggle() {
    if (state.playing) pause();
    else play();
}

// ---------- UI state ----------

function setPlaying(playing) {
    const wasPlaying = state.playing;
    state.playing = playing;

    document.body.classList.toggle('is-playing', playing);
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.setAttribute('aria-label', t(playing ? 'pause' : 'play'));

    if (playing && !wasPlaying) {
        playBtn.classList.remove('drawing');
        void playBtn.offsetWidth; // restart the ensō brush animation
        playBtn.classList.add('drawing');
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }

    clearInterval(state.tickInterval);
    if (playing) {
        state.lastTick = performance.now();
        state.tickInterval = setInterval(tick, 250);
        if (!wasPlaying) {
            state.breathStart = performance.now();
            state.breathPhase = null;
        }
        startLevelLoop();
    } else {
        stopLevelLoop();
    }

    renderStatus();
}

function tick() {
    const now = performance.now();
    const delta = (now - state.lastTick) / 1000;
    state.lastTick = now;
    state.elapsed += delta;

    if (state.timerMinutes > 0) {
        state.timerRemaining = Math.max(0, state.timerRemaining - delta);
        if (state.timerRemaining <= 0) {
            pause(TIMER_FADE_OUT);
            statusMain.textContent = t('complete');
            statusSub.textContent = t('completeSub');
            return;
        }
    }

    renderStatus();
}

function formatTime(totalSeconds) {
    const s = Math.ceil(totalSeconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function renderStatus() {
    const hasTimer = state.timerMinutes > 0;
    document.body.classList.toggle('has-timer', hasTimer);

    const total = state.timerMinutes * 60;
    const fraction = hasTimer && total > 0 ? state.timerRemaining / total : 1;
    timerProgress.style.strokeDashoffset = String(100 * (1 - fraction));

    if (state.playing) {
        if (hasTimer) {
            statusMain.textContent = formatTime(state.timerRemaining);
            statusSub.textContent = t('remainingSub');
        } else {
            statusMain.textContent = formatTime(state.elapsed);
            statusSub.textContent = t('elapsedSub');
        }
        updateMediaTitle();
    } else if (state.elapsed > 0) {
        statusMain.textContent = t('paused');
        statusSub.textContent = hasTimer
            ? t('pausedTimerSub', { time: formatTime(state.timerRemaining) })
            : t('pausedSub');
    } else {
        statusMain.textContent = t('idle');
        statusSub.textContent = hasTimer
            ? t('idleTimerSub', { time: formatTime(total) })
            : t('idleSub');
    }
}

// Breathing guide + audio-reactive pulse, driven from one animation frame loop.
function easeInOutSine(x) {
    return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

function breathAt(now) {
    let elapsed = ((now - state.breathStart) / 1000) % BREATH_CYCLE;
    for (const phase of BREATH_PHASES) {
        if (elapsed < phase.seconds) {
            const progress = elapsed / phase.seconds;
            const amount = phase.key === 'in' ? easeInOutSine(progress)
                : phase.key === 'hold' ? 1
                    : 1 - easeInOutSine(progress);
            return { phase: phase.key, amount, count: Math.ceil(phase.seconds - elapsed) };
        }
        elapsed -= phase.seconds;
    }
    return { phase: 'in', amount: 0, count: BREATH_PHASES[0].seconds };
}

function layerParts(index) {
    const layer = breathLayers[index];
    return { layer, phase: layer.querySelector('.breath-phase'), count: layer.querySelector('.breath-count') };
}

function renderBreathWord() {
    if (!state.breathPhase) return;
    layerParts(activeLayer).phase.textContent = t(BREATH_WORDS[state.breathPhase]);
}

function onBreathPhase(phase, count) {
    state.breathPhase = phase;
    state.breathCount = count;
    orbWrap.dataset.breath = phase;

    // Write the new phase into the hidden layer, then swap: old fades out while new fades in.
    const next = 1 - activeLayer;
    const incoming = layerParts(next);
    incoming.phase.textContent = t(BREATH_WORDS[phase]);
    incoming.count.textContent = String(count);
    breathLayers[activeLayer].classList.remove('is-active');
    incoming.layer.classList.add('is-active');
    activeLayer = next;

    if (phase === 'out' && !reduceMotion.matches) {
        orbWrap.classList.remove('exhale-wave');
        void orbWrap.offsetWidth;
        orbWrap.classList.add('exhale-wave');
    }
}

function startLevelLoop() {
    if (state.levelFrame) return;
    const root = document.documentElement.style;

    const loop = (now) => {
        const breath = breathAt(now);
        if (breath.phase !== state.breathPhase) {
            onBreathPhase(breath.phase, breath.count);
        } else if (breath.count !== state.breathCount) {
            state.breathCount = breath.count;
            layerParts(activeLayer).count.textContent = String(breath.count);
        }

        // With reduced motion only the word changes; nothing scales.
        if (!reduceMotion.matches) {
            root.setProperty('--inhale', breath.amount.toFixed(3));

            analyser.getFloatTimeDomainData(levelData);
            let sum = 0;
            for (let i = 0; i < levelData.length; i++) sum += levelData[i] * levelData[i];
            const rms = Math.sqrt(sum / levelData.length);
            state.level += (Math.min(1, rms * 3) - state.level) * 0.12;
            root.setProperty('--level', state.level.toFixed(3));
        }

        state.levelFrame = requestAnimationFrame(loop);
    };
    state.levelFrame = requestAnimationFrame(loop);
}

function stopLevelLoop() {
    cancelAnimationFrame(state.levelFrame);
    state.levelFrame = null;
    state.level = 0;
    state.breathPhase = null;
    state.breathCount = null;
    delete orbWrap.dataset.breath;
    breathLayers.forEach((layer) => layer.classList.remove('is-active'));
    orbWrap.classList.remove('exhale-wave');
    document.documentElement.style.setProperty('--level', '0');
    document.documentElement.style.setProperty('--inhale', '0');
}

// ---------- Controls ----------

function toneLabel(value) {
    if (value < 0.25) return 'toneDeep';
    if (value < 0.5) return 'toneWarm';
    if (value < 0.75) return 'toneSoft';
    return 'toneBright';
}

function renderVolume() {
    const pct = Math.round(state.volume * 100);
    volumeSlider.value = String(pct);
    volumeSlider.style.setProperty('--fill', `${pct}%`);
    volumeValue.textContent = pct === 0 ? t('mute') : String(pct);
}

function renderTone() {
    const pct = Math.round(state.tone * 100);
    const label = t(toneLabel(state.tone));
    toneSlider.value = String(pct);
    toneSlider.style.setProperty('--fill', `${pct}%`);
    toneSlider.setAttribute('aria-valuetext', label);
    toneValue.textContent = label;
}

function timerLabel(minutes) {
    if (minutes === 0) return '∞';
    return minutes % 60 === 0 ? t('hour', { n: minutes / 60 }) : t('min', { n: minutes });
}

function renderTimer() {
    const index = Math.max(0, TIMER_STEPS.indexOf(state.timerMinutes));
    const pct = (index / (TIMER_STEPS.length - 1)) * 100;
    timerSlider.value = String(index);
    timerSlider.style.setProperty('--fill', `${pct}%`);
    timerSlider.setAttribute('aria-valuetext', state.timerMinutes === 0 ? t('unlimited') : timerLabel(state.timerMinutes));
    timerValue.textContent = timerLabel(state.timerMinutes);
    timerValue.classList.toggle('is-infinite', state.timerMinutes === 0);
}

function setVolume(v) {
    state.volume = Math.min(1, Math.max(0, v));
    localStorage.setItem('zenBrownNoiseVolume', String(state.volume));
    renderVolume();
    applyVolume();
}

function setTone(value) {
    state.tone = Math.min(1, Math.max(0, value));
    localStorage.setItem('zenBrownNoiseTone', String(state.tone));
    renderTone();
    applyTone();
}

function setTimer(minutes) {
    state.timerMinutes = minutes;
    state.timerRemaining = minutes * 60;
    localStorage.setItem('zenBrownNoiseTimer', String(minutes));
    renderTimer();
    renderStatus();
}

function cycleTimer(direction = 1) {
    const index = TIMER_STEPS.indexOf(state.timerMinutes);
    setTimer(TIMER_STEPS[(index + direction + TIMER_STEPS.length) % TIMER_STEPS.length]);
}

volumeSlider.addEventListener('input', (e) => setVolume(Number(e.target.value) / 100));
toneSlider.addEventListener('input', (e) => setTone(Number(e.target.value) / 100));

timerSlider.addEventListener('input', (e) => setTimer(TIMER_STEPS[Number(e.target.value)]));

playBtn.addEventListener('click', toggle);

// ---------- Keyboard ----------

document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    if (langPicker.contains(target)) return;
    const onSlider = target instanceof HTMLInputElement;

    switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
            // Let the orb handle its own native activation; elsewhere Space always means play/pause.
            if (target === playBtn && e.key === ' ') return;
            e.preventDefault();
            toggle();
            break;
        case 'ArrowUp':
            if (onSlider) return;
            e.preventDefault();
            setVolume(state.volume + 0.05);
            break;
        case 'ArrowDown':
            if (onSlider) return;
            e.preventDefault();
            setVolume(state.volume - 0.05);
            break;
        case 'ArrowRight':
            if (onSlider) return;
            e.preventDefault();
            setTone(state.tone + 0.05);
            break;
        case 'ArrowLeft':
            if (onSlider) return;
            e.preventDefault();
            setTone(state.tone - 0.05);
            break;
        case 't':
        case 'T':
            cycleTimer(1);
            break;
        case 'd':
        case 'D':
            toggleTheme();
            break;
        default:
    }
});

// ---------- Theme ----------

function effectiveTheme() {
    return document.documentElement.dataset.theme || (prefersDark.matches ? 'dark' : 'light');
}

function syncThemeColor() {
    const color = effectiveTheme() === 'dark' ? '#171615' : '#EEEBE5';
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        meta.setAttribute('content', color);
    });
    themeBtn.setAttribute('aria-label', t(effectiveTheme() === 'dark' ? 'themeToLight' : 'themeToDark'));
}

function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('zenTheme', next);
    syncThemeColor();
}

themeBtn.addEventListener('click', toggleTheme);
prefersDark.addEventListener?.('change', syncThemeColor);

// ---------- Language ----------

function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('zenLang', lang);

    document.documentElement.lang = HTML_LANG[lang];
    document.title = t('title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('description'));

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
        el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });

    langCode.textContent = t('_short');
    langItems.forEach((item) => {
        item.setAttribute('aria-checked', String(item.dataset.lang === lang));
    });

    playBtn.setAttribute('aria-label', t(state.playing ? 'pause' : 'play'));
    renderBreathWord();
    renderVolume();
    renderTone();
    renderTimer();
    renderStatus();
    syncThemeColor();
    setMediaMetadata();
}

function openLangMenu() {
    langMenu.hidden = false;
    langBtn.setAttribute('aria-expanded', 'true');
    (langItems.find((item) => item.dataset.lang === currentLang) || langItems[0]).focus();
}

function closeLangMenu(returnFocus = false) {
    if (langMenu.hidden) return;
    langMenu.hidden = true;
    langBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) langBtn.focus();
}

langBtn.addEventListener('click', () => {
    if (langMenu.hidden) openLangMenu();
    else closeLangMenu();
});

langItems.forEach((item) => {
    item.addEventListener('click', () => {
        applyLanguage(item.dataset.lang);
        closeLangMenu(true);
    });
});

langMenu.addEventListener('keydown', (e) => {
    const index = langItems.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        langItems[(index + dir + langItems.length) % langItems.length].focus();
    } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        langItems[e.key === 'Home' ? 0 : langItems.length - 1].focus();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeLangMenu(true);
    } else if (e.key === 'Tab') {
        closeLangMenu();
    }
});

document.addEventListener('pointerdown', (e) => {
    if (!langPicker.contains(e.target)) closeLangMenu();
});

// ---------- System integration ----------

function setMediaMetadata() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: t('mediaTitle'),
        artist: t('mediaArtist'),
        album: t('title'),
        artwork: [{ src: 'apple-touch-icon.png', sizes: '512x512', type: 'image/png' }],
    });
    updateMediaTitle();
}

function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => { if (!state.playing) play(); });
    navigator.mediaSession.setActionHandler('pause', () => { if (state.playing) pause(); });
    try {
        navigator.mediaSession.setActionHandler('stop', () => { if (state.playing) pause(); });
    } catch (_) { /* unsupported action */ }
}

function updateMediaTitle() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.metadata) return;
    navigator.mediaSession.metadata.artist = state.timerMinutes > 0
        ? t('mediaRemaining', { time: formatTime(state.timerRemaining) })
        : t('mediaArtist');
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.playing && ctx?.state !== 'running') {
        ctx.resume();
    }
});

function init() {
    setupMediaSession();
    applyLanguage(currentLang);

    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !isLocalHost) {
        navigator.serviceWorker.register('/sw.js').catch((error) => {
            console.log('Service Worker registration failed:', error);
        });
    }
}

init();
