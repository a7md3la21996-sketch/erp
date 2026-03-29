/**
 * Notification sound utility.
 * Plays a short beep sound when called.
 * Uses Web Audio API — no external files needed.
 */

let _ctx = null;

function getAudioContext() {
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  return _ctx;
}

/**
 * Play a short notification beep.
 * @param {number} frequency - Hz (default 800)
 * @param {number} duration - ms (default 150)
 */
export function playNotificationSound(frequency = 800, duration = 150) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.value = 0.15; // soft volume

    oscillator.start(ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch {}
}

/**
 * Play a double-beep for important notifications.
 */
export function playImportantSound() {
  playNotificationSound(800, 120);
  setTimeout(() => playNotificationSound(1000, 120), 180);
}
