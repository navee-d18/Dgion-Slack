/**
 * Web Audio API Notification Chime Synthesizer
 * Custom synthesized dual-tone notification sound matching Slack alert profiles.
 * Fully offline-capable, highly secure, and works 100% locally.
 */
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    
    // Check if the current browser tab is active/focused
    const isTabFocused = document.hasFocus?.() ?? true;
    
    // Subtle gain (volume) for focused tabs, full gain for inactive background tabs
    const maxVolume = isTabFocused ? 0.02 : 0.09;

    // Tone 1: Standard Sine wave at D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(maxVolume, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start();
    osc1.stop(ctx.currentTime + 0.25);

    // Tone 2: Played slightly offset at A5 (880.00 Hz)
    setTimeout(() => {
      try {
        if (ctx.state === 'closed') return;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, ctx.currentTime);
        gain2.gain.setValueAtTime(maxVolume, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start();
        osc2.stop(ctx.currentTime + 0.35);
      } catch {
        // Safe catch for closed audio context
      }
    }, 75);

  } catch (error) {
    console.warn('Web Audio Playback failed:', error);
  }
}
