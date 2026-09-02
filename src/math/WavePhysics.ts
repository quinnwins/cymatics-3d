/**
 * Acoustic & Wave Physics Formulas
 */

export interface NoteInfo {
  name: string;
  octave: number;
  frequency: number;
  cents: number;
}

export class WavePhysics {
  public static readonly SPEED_OF_SOUND_AIR = 343; // m/s at 20°C

  // Standard Solfeggio & Harmonic Sacred Frequencies
  public static readonly SOLFEGGIO_PRESETS = [
    { hz: 174, name: '174 Hz', label: 'Pain Relief & Grounding' },
    { hz: 285, name: '285 Hz', label: 'Tissue Healing & Energy' },
    { hz: 396, name: '396 Hz', label: 'Liberation from Fear' },
    { hz: 417, name: '417 Hz', label: 'Facilitating Change' },
    { hz: 432, name: '432 Hz', label: 'Verdi / Natural Harmonic' },
    { hz: 528, name: '528 Hz', label: 'Transformation & Miracles' },
    { hz: 639, name: '639 Hz', label: 'Connecting Relationships' },
    { hz: 741, name: '741 Hz', label: 'Awakening Intuition' },
    { hz: 852, name: '852 Hz', label: 'Spiritual Order' },
    { hz: 963, name: '963 Hz', label: 'Pure Crown Consciousness' },
  ];

  public static readonly NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /**
   * Converts a frequency (Hz) to musical note info.
   */
  public static frequencyToNote(freq: number): NoteInfo {
    if (!Number.isFinite(freq) || freq <= 0) return { name: '---', octave: 0, frequency: 0, cents: 0 };
    const midi = 69 + 12 * Math.log2(freq / 440);
    const roundedMidi = Math.round(midi);
    const cents = Math.round((midi - roundedMidi) * 100);
    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const octave = Math.floor(roundedMidi / 12) - 1;
    return {
      name: `${this.NOTE_NAMES[noteIndex]}${octave}`,
      octave,
      frequency: freq,
      cents,
    };
  }

  /**
   * Converts MIDI note number (e.g. 69 = A4) to frequency in Hz.
   */
  public static midiToFrequency(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Calculates acoustic wavenumber k = 2 * PI * f / c.
   */
  public static wavenumber(freq: number, speedOfSound = this.SPEED_OF_SOUND_AIR): number {
    if (!Number.isFinite(freq) || speedOfSound <= 0) return 0;
    return (2 * Math.PI * freq) / speedOfSound;
  }

  /**
   * Evaluates 3D Chladni modal standing wave value at point (x, y, z).
   * Standing nodal surfaces occur at p(x,y,z) = 0.
   */
  public static chladni3D(x: number, y: number, z: number, n: number, m: number, l: number): number {
    const term1 = Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) * Math.cos(l * Math.PI * z);
    const term2 = Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * z) * Math.cos(l * Math.PI * y);
    const term3 = Math.cos(l * Math.PI * x) * Math.cos(n * Math.PI * y) * Math.cos(m * Math.PI * z);
    return term1 - term2 + term3;
  }
}
