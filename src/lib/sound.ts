let context: AudioContext | undefined

export function playRitual() {
  try {
    context ??= new AudioContext()
    void context.resume()
    const start = context.currentTime
    for (const [index, frequency] of [110, 164.81, 220, 329.63].entries()) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.025, start + index * 0.16 + 0.12)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 2.8)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start + index * 0.16)
      oscillator.stop(start + 3)
    }
  } catch { /* Sound is optional if unavailable. */ }
}
