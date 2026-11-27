let audioCtx: AudioContext | null = null;
let soundsEnabled = true;
let lastClickAt = 0;
let initializedListener = false;

function getAudioContext(): AudioContext | null {
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
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setUiSoundsEnabled(enabled: boolean): void {
  soundsEnabled = enabled;
}

export function isUiSoundsEnabled(): boolean {
  return soundsEnabled;
}

export function playClickSound(): void {
  if (!soundsEnabled) return;
  const nowMs = Date.now();
  if (nowMs - lastClickAt < 45) return;
  lastClickAt = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, t);
    osc.frequency.exponentialRampToValueAtTime(290, t + 0.042);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.045, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.048);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.052);
  } catch {
    // ignore Web Audio restrictions
  }
}

export function playNavSound(): void {
  if (!soundsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, t);
    osc1.frequency.exponentialRampToValueAtTime(659.25, t + 0.085);
    gain1.gain.setValueAtTime(0.001, t);
    gain1.gain.linearRampToValueAtTime(0.036, t + 0.012);
    gain1.gain.exponentialRampToValueAtTime(0.0008, t + 0.11);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.12);
  } catch {
    // ignore Web Audio restrictions
  }
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
      'button:not(:disabled), a[href], [role="button"], select:not(:disabled), summary'
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
