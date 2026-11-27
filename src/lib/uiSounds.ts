import type { UiSoundPreset } from '../types.ts';

let audioCtx: AudioContext | null = null;
let soundsEnabled = true;
let activePreset: UiSoundPreset = 'classic';
let lastClickAt = 0;
let initializedListener = false;

const VALID_PRESETS = new Set<UiSoundPreset>(['classic', 'soft', 'chime', 'playful', 'crisp']);

async function ensureReadyAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function setUiSoundsEnabled(enabled: boolean): void {
  soundsEnabled = enabled;
}

export function isUiSoundsEnabled(): boolean {
  return soundsEnabled;
}

export function setUiSoundPreset(preset: string | undefined): void {
  if (preset && VALID_PRESETS.has(preset as UiSoundPreset)) {
    activePreset = preset as UiSoundPreset;
  } else {
    activePreset = 'classic';
  }
}

export function getUiSoundPreset(): UiSoundPreset {
  return activePreset;
}

function triggerClickTone(ctx: AudioContext, preset: UiSoundPreset): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  switch (preset) {
    case 'soft': {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(290, t + 0.06);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
      break;
    }
    case 'chime': {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, t);
      osc.frequency.exponentialRampToValueAtTime(1318.5, t + 0.07);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
      break;
    }
    case 'playful': {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.065);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.095);
      break;
    }
    case 'crisp': {
      osc.type = 'square';
      osc.frequency.setValueAtTime(1180, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.032);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.042);
      break;
    }
    default: {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(760, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.055);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.007);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
      break;
    }
  }
}

function triggerNavTone(ctx: AudioContext, preset: UiSoundPreset): void {
  const t = ctx.currentTime;

  switch (preset) {
    case 'soft': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(392, t);
      osc.frequency.exponentialRampToValueAtTime(523.25, t + 0.12);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
      break;
    }
    case 'chime': {
      const notes = [659.25, 987.77];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.055;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.11, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.19);
      });
      break;
    }
    case 'playful': {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t + i * 0.045;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.12);
      });
      break;
    }
    case 'crisp': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1174.66, t + 0.06);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
      break;
    }
    default: {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, t);
      osc1.frequency.exponentialRampToValueAtTime(783.99, t + 0.095);
      gain1.gain.setValueAtTime(0.001, t);
      gain1.gain.linearRampToValueAtTime(0.14, t + 0.012);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.14);
      break;
    }
  }
}

export function playClickSound(): void {
  if (!soundsEnabled) return;
  const nowMs = Date.now();
  if (nowMs - lastClickAt < 45) return;
  lastClickAt = nowMs;

  const presetSnapshot = activePreset;
  void ensureReadyAudioContext().then((ctx) => {
    if (!ctx) return;
    try {
      triggerClickTone(ctx, presetSnapshot);
    } catch {
      // ignore Web Audio restrictions
    }
  });
}

export function playNavSound(): void {
  if (!soundsEnabled) return;

  const presetSnapshot = activePreset;
  void ensureReadyAudioContext().then((ctx) => {
    if (!ctx) return;
    try {
      triggerNavTone(ctx, presetSnapshot);
    } catch {
      // ignore Web Audio restrictions
    }
  });
}

export function playSoundPreview(preset: UiSoundPreset): void {
  const validPreset = VALID_PRESETS.has(preset) ? preset : 'classic';
  void ensureReadyAudioContext().then((ctx) => {
    if (!ctx) return;
    try {
      triggerClickTone(ctx, validPreset);
      setTimeout(() => {
        try {
          triggerNavTone(ctx, validPreset);
        } catch {
          // ignore
        }
      }, 145);
    } catch {
      // ignore
    }
  });
}

export function initGlobalUiSounds(): () => void {
  if (typeof document === 'undefined' || initializedListener) {
    return () => {};
  }
  initializedListener = true;

  const onPointerDown = (e: PointerEvent) => {
    if (!soundsEnabled) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest(
      'button:not(:disabled), a[href], [role="button"], select:not(:disabled), summary, label input[type="checkbox"], label input[type="radio"]'
    );
    if (interactive) {
      playClickSound();
    }
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    initializedListener = false;
  };
}
