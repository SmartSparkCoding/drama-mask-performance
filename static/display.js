const STATE_TO_IMAGE = {
  0: null,
  1: null,
  2: 'time.png',
  3: 'wait.png',
  4: 'wait.png',
};

const STATE_TO_AUDIO = {
  0: { image: null, track: null },
  1: { image: null, track: 'kill' },
  2: { image: 'time.png', track: 'will' },
  3: { image: 'wait.png', track: 'will' },
  4: { image: 'wait.png', track: 'will', overlay: 'doorbell' },
};

const FADE_MS = 3000;
const POLL_MS = 250;

class AudioTrack {
  constructor(context, url, options = {}) {
    this.context = context;
    this.audio = new Audio(url);
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.source = context.createMediaElementSource(this.audio);
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.source.connect(this.gain).connect(context.destination);
    this.targetVolume = options.targetVolume ?? 1;
    this.loop = options.loop ?? true;
    this.audio.loop = this.loop;
    this._fader = null;
  }

  async playAtVolume(volume, fadeMs = 0) {
    this.audio.loop = this.loop;
    if (this.audio.paused) {
      this.audio.currentTime = 0;
      await this.audio.play();
    }

    await this.fadeTo(volume, fadeMs);
  }

  async stop(fadeMs = 0) {
    await this.fadeTo(0, fadeMs);
    if (!this.audio.paused) {
      this.audio.pause();
    }
  }

  async fadeTo(volume, fadeMs) {
    if (this._fader) {
      this._fader.abort();
    }

    const controller = new AbortController();
    this._fader = controller;
    const startVolume = this.gain.gain.value;
    const targetVolume = Math.max(0, volume);

    if (fadeMs <= 0) {
      this.gain.gain.value = targetVolume;
      return;
    }

    const startTime = performance.now();
    return new Promise((resolve) => {
      const tick = (now) => {
        if (controller.signal.aborted) {
          resolve();
          return;
        }

        const elapsed = Math.min(1, (now - startTime) / fadeMs);
        this.gain.gain.value = startVolume + (targetVolume - startVolume) * elapsed;
        if (elapsed >= 1) {
          resolve();
          return;
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }
}

class PerformanceAudioController {
  constructor() {
    this.context = null;
    this.tracks = null;
    this.unlocked = false;
    this.lastState = null;
  }

  async ensureReady() {
    if (this.context) {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    this.context = new AudioContextClass();
    this.tracks = {
      kill: new AudioTrack(this.context, '/static/audio/kill.mp3', { loop: true }),
      will: new AudioTrack(this.context, '/static/audio/will.mp3', { loop: true }),
      doorbell: new AudioTrack(this.context, '/static/audio/doorbell.mp3', { loop: false, targetVolume: 1.5 }),
    };
  }

  async unlock() {
    await this.ensureReady();
    if (!this.context || this.unlocked) {
      return;
    }

    try {
      await this.context.resume();
      this.unlocked = true;
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        await this.applyState(data.status, true);
      }
    } catch (_error) {
      // If autoplay is blocked, the browser will keep the tracks silent until it allows playback.
    }
  }

  async applyState(state, force = false) {
    await this.ensureReady();

    if (!this.context || !this.tracks) {
      return;
    }

    const nextState = STATE_TO_AUDIO[state] || STATE_TO_AUDIO[0];
    const image = document.getElementById('display-image');

    if (image) {
      if (nextState.image) {
        const nextSource = `/static/images/${nextState.image}`;
        image.classList.remove('is-hidden');
        if (image.dataset.currentSource !== nextSource) {
          image.dataset.currentSource = nextSource;
          image.src = nextSource;
        }
      } else {
        image.classList.add('is-hidden');
        image.removeAttribute('src');
        image.dataset.currentSource = '';
      }
    }

    if (!force && state === this.lastState) {
      return;
    }

    try {
      if (nextState.track === 'kill') {
        await Promise.all([
          this.tracks.will.stop(FADE_MS),
          this.tracks.doorbell.stop(200),
          this.tracks.kill.playAtVolume(1, FADE_MS),
        ]);
      } else if (nextState.track === 'will') {
        await Promise.all([
          this.tracks.kill.stop(FADE_MS),
          this.tracks.will.playAtVolume(1, FADE_MS),
        ]);
      } else {
        await this.tracks.kill.stop(500);
        await this.tracks.will.stop(500);
        await this.tracks.doorbell.stop(250);
      }

      if (nextState.overlay === 'doorbell') {
        await this.tracks.doorbell.playAtVolume(1.5, 150);
      }

      this.lastState = state;
    } catch (_error) {
      this.lastState = null;
    }
  }
}

const audioController = new PerformanceAudioController();

async function refreshDisplay() {
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    await audioController.applyState(data.status);
  } catch (_error) {
    // Keep the display stable if the control server is briefly unavailable.
  }
}

document.addEventListener('pointerdown', () => audioController.unlock(), { once: true });
document.addEventListener('keydown', () => audioController.unlock(), { once: true });

refreshDisplay();
setInterval(refreshDisplay, POLL_MS);