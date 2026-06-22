const FADE_MS = 3000;
const POLL_MS = 250;
const TRACK_VOLUME = 1;
const DUCKED_VOLUME = 0.25;
const DOORBELL_VOLUME = 1;
const DOORBELL_DUCK_MS = 6000;

const STATE_TO_IMAGE = {
  0: null,
  1: null,
  2: 'time.png',
  3: 'wait.png',
  4: 'wait.png',
};

const AUDIO_URLS = {
  kill: '/static/audio/kill.mp3',
  will: '/static/audio/will.mp3',
  doorbell: '/static/audio/doorbell.mp3',
};

const audioFiles = {
  kill: createAudio(AUDIO_URLS.kill, true),
  will: createAudio(AUDIO_URLS.will, true),
  doorbell: createAudio(AUDIO_URLS.doorbell, false),
};

let lastState = null;
let audioUnlocked = false;
let pendingState = 0;
let doorbellRecoveryTimer = null;

function clearDoorbellRecoveryTimer() {
  if (doorbellRecoveryTimer) {
    clearTimeout(doorbellRecoveryTimer);
    doorbellRecoveryTimer = null;
  }
}

function createAudio(url, loop) {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.loop = loop;
  audio.playsInline = true;
  audio.volume = 0;
  return audio;
}

function getImage() {
  return document.getElementById('display-image');
}

function getUnlockButton() {
  return document.getElementById('audio-unlock');
}

function showUnlockButton() {
  const button = getUnlockButton();
  if (button) {
    button.classList.remove('is-hidden');
  }
}

function hideUnlockButton() {
  const button = getUnlockButton();
  if (button) {
    button.classList.add('is-hidden');
  }
}

async function primeAudio(audio) {
  audio.muted = true;
  try {
    audio.load();
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = 0;
    return true;
  } catch (_error) {
    audio.muted = false;
    audio.volume = 0;
    return false;
  }
}

async function unlockAudio() {
  let unlockedCount = 0;

  for (const audio of Object.values(audioFiles)) {
    if (await primeAudio(audio)) {
      unlockedCount += 1;
    }
  }

  if (unlockedCount > 0) {
    audioUnlocked = true;
    hideUnlockButton();
    await refreshState();
    return;
  }

  showUnlockButton();
}

async function ensureAudioUnlocked() {
  if (audioUnlocked) {
    return true;
  }

  showUnlockButton();
  return false;
}

async function fadeAudio(audio, targetVolume, durationMs) {
  const startVolume = audio.volume;
  const destination = Math.min(1, Math.max(0, targetVolume));

  if (durationMs <= 0) {
    audio.volume = destination;
    return;
  }

  const startTime = performance.now();
  await new Promise((resolve) => {
    const step = (now) => {
      const elapsed = Math.min(1, (now - startTime) / durationMs);
      audio.volume = startVolume + (destination - startVolume) * elapsed;
      if (elapsed >= 1) {
        resolve();
        return;
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  });
}

async function stopAudio(audio, durationMs = 0) {
  if (audio.paused) {
    audio.volume = 0;
    return;
  }

  await fadeAudio(audio, 0, durationMs);
  audio.pause();
  audio.currentTime = 0;
}

async function startAudio(audio, targetVolume, fadeMs = 0, restart = false) {
  if (restart || audio.paused) {
    audio.currentTime = 0;
    await audio.play();
  }

  await fadeAudio(audio, targetVolume, fadeMs);
}

async function updateImage(state) {
  const image = getImage();
  if (!image) {
    return;
  }

  const nextImage = STATE_TO_IMAGE[state] || null;
  if (!nextImage) {
    image.classList.add('is-hidden');
    image.removeAttribute('src');
    image.dataset.currentSource = '';
    return;
  }

  const nextSource = `/static/images/${nextImage}`;
  image.classList.remove('is-hidden');
  if (image.dataset.currentSource !== nextSource) {
    image.dataset.currentSource = nextSource;
    image.src = nextSource;
  }
}

async function applyState(state, force = false) {
  pendingState = state;
  await updateImage(state);

  if (!await ensureAudioUnlocked()) {
    return;
  }

  if (!force && state === lastState) {
    return;
  }

  if (state === 0) {
    clearDoorbellRecoveryTimer();
    await Promise.all([
      stopAudio(audioFiles.kill, 150),
      stopAudio(audioFiles.will, 150),
      stopAudio(audioFiles.doorbell, 150),
    ]);
    lastState = state;
    return;
  }

  if (state === 1) {
    clearDoorbellRecoveryTimer();
    await Promise.all([
      stopAudio(audioFiles.will, 50),
      stopAudio(audioFiles.doorbell, 50),
      startAudio(audioFiles.kill, TRACK_VOLUME, 0, true),
    ]);
    lastState = state;
    return;
  }

  if (state === 2) {
    clearDoorbellRecoveryTimer();
    await Promise.all([
      stopAudio(audioFiles.kill, FADE_MS),
      startAudio(audioFiles.will, TRACK_VOLUME, FADE_MS, true),
      stopAudio(audioFiles.doorbell, 100),
    ]);
    lastState = state;
    return;
  }

  if (state === 3) {
    clearDoorbellRecoveryTimer();
    await Promise.all([
      stopAudio(audioFiles.kill, 100),
      startAudio(audioFiles.will, TRACK_VOLUME, 0, false),
      stopAudio(audioFiles.doorbell, 100),
    ]);

    lastState = state;
    return;
  }

  if (state === 4) {
    clearDoorbellRecoveryTimer();
    await Promise.all([
      stopAudio(audioFiles.kill, 100),
      startAudio(audioFiles.will, TRACK_VOLUME, 0, false),
    ]);

    await fadeAudio(audioFiles.will, DUCKED_VOLUME, 150);
    await startAudio(audioFiles.doorbell, DOORBELL_VOLUME, 150, true);

    doorbellRecoveryTimer = setTimeout(() => {
      if (lastState === 4 && !audioFiles.will.paused) {
        fadeAudio(audioFiles.will, TRACK_VOLUME, 600);
      }
    }, DOORBELL_DUCK_MS);

    lastState = state;
    return;
  }
}

async function refreshState() {
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    await applyState(data.status);
  } catch (_error) {
    // Leave the current scene alone if the state API is temporarily unavailable.
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const unlockButton = getUnlockButton();
  if (unlockButton) {
    unlockButton.addEventListener('click', unlockAudio);
  }

  refreshState();
  setInterval(refreshState, POLL_MS);
});