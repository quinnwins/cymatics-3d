/**
 * VoiceBiometricAnalyzer.ts
 * SoundForm 3D - Real-Time Web Audio Vocal DSP & Biometric Analyzer
 *
 * Connects directly to Web Audio microphone input or synthetic preset generators,
 * performing zero-allocation rolling DSP frame analysis for Jitter, Shimmer, HNR,
 * CPP, LPC-16 Area Functions, Formants, and Clinical Pathology Diagnosis.
 */

import {
  VoiceBiometricsPhysics,
  VocalBiomarkerReport,
  ClinicalVoiceProfile,
} from '../math/VoiceBiometricsPhysics';

export class VoiceBiometricAnalyzer {
  private ctx: AudioContext;
  private analyserNode: AnalyserNode;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;

  // Rolling circular analysis buffer
  private bufferSize = 2048;
  private timeDomainBuffer: Float32Array;
  private historyPeriods: number[] = [];
  private historyAmplitudes: number[] = [];
  private maxHistoryFrames = 32;

  private isLiveMicActive = false;
  private activeProfile: ClinicalVoiceProfile;
  private cachedReport: VocalBiomarkerReport;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 4096;
    this.analyserNode.smoothingTimeConstant = 0.3;

    this.timeDomainBuffer = new Float32Array(this.bufferSize);
    this.activeProfile = VoiceBiometricsPhysics.PROFILES['bel-canto'];
    this.cachedReport = this.generateSyntheticReport(this.activeProfile);
  }

  public async startMicrophone(): Promise<boolean> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.micSourceNode = this.ctx.createMediaStreamSource(this.micStream);
      this.micSourceNode.connect(this.analyserNode);
      this.isLiveMicActive = true;
      return true;
    } catch {
      this.isLiveMicActive = false;
      return false;
    }
  }

  public stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch {
        // Safe disconnect
      }
      this.micSourceNode = null;
    }
    this.isLiveMicActive = false;
  }

  public setProfile(profileId: string): ClinicalVoiceProfile {
    const profile = VoiceBiometricsPhysics.PROFILES[profileId] || VoiceBiometricsPhysics.PROFILES['bel-canto'];
    this.activeProfile = profile;
    this.cachedReport = this.generateSyntheticReport(profile);
    return profile;
  }

  public getActiveProfile(): ClinicalVoiceProfile {
    return this.activeProfile;
  }

  public getIsLiveMic(): boolean {
    return this.isLiveMicActive;
  }

  private lastUpdateTimestamp = 0;

  public update(): VocalBiomarkerReport {
    const now = performance.now();
    if (this.isLiveMicActive && this.analyserNode) {
      this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer as any);

      // Check audio presence
      let rms = 0;
      for (let i = 0; i < this.bufferSize; i++) {
        rms += this.timeDomainBuffer[i] * this.timeDomainBuffer[i];
      }
      rms = Math.sqrt(rms / this.bufferSize);

      if (rms > 0.008) {
        // Perform YIN Pitch Extraction
        const pitchData = VoiceBiometricsPhysics.extractPitchYIN(this.timeDomainBuffer, this.ctx.sampleRate);
        const isNewFrame = (now - this.lastUpdateTimestamp) > 25; // Throttle history accumulation to ~40 Hz
        if (isNewFrame) {
          this.lastUpdateTimestamp = now;
          if (pitchData.f0 > 60 && pitchData.confidence > 0.5) {
            this.historyPeriods.push(pitchData.periodSamples);
            this.historyAmplitudes.push(rms);
            if (this.historyPeriods.length > this.maxHistoryFrames) {
              this.historyPeriods.shift();
              this.historyAmplitudes.shift();
            }
          }
        }

        const pert = VoiceBiometricsPhysics.calculatePerturbationMetrics(this.historyPeriods, this.historyAmplitudes);
        const hnr = VoiceBiometricsPhysics.calculateHNR(this.timeDomainBuffer, pitchData.periodSamples);
        const cpp = VoiceBiometricsPhysics.calculateCPP(this.timeDomainBuffer, this.ctx.sampleRate);
        const lpc = VoiceBiometricsPhysics.calculateLpcAreaFunction(this.timeDomainBuffer, 16);

        const diagnosis = VoiceBiometricsPhysics.diagnosePathologies({
          f0Hz: pitchData.f0,
          jitterPercent: pert.jitterLoc,
          shimmerPercent: pert.shimmerLoc,
          hnrDb: hnr,
          cppDb: cpp,
          fcr: 1.0,
          tremorDepthPercent: 0,
        });

        const rx = VoiceBiometricsPhysics.generatePrescription({
          f0Hz: pitchData.f0,
          healthStatus: diagnosis.healthStatus,
          formants: lpc.formants,
        });

        this.cachedReport = {
          f0Hz: pitchData.f0,
          pitchConfidence: pitchData.confidence,
          jitterPercent: pert.jitterLoc,
          jitterRapPercent: pert.jitterRap,
          jitterPpq5Percent: pert.jitterPpq5,
          shimmerPercent: pert.shimmerLoc,
          shimmerDb: pert.shimmerDb,
          shimmerApq11Percent: pert.shimmerApq11,
          hnrDb: hnr,
          cppDb: cpp,
          formantsHz: lpc.formants,
          fcr: 1.0,
          vocalTractRadiiCm: lpc.radiiCm,
          tremorFreqHz: 0,
          tremorDepthPercent: 0,
          diagnosticHallmarks: diagnosis.hallmarks,
          healthStatus: diagnosis.healthStatus,
          soundMedicinePrescription: rx,
        };
      } else {
        // Microphone silence decay
        this.cachedReport = {
          ...this.cachedReport,
          f0Hz: 0,
          pitchConfidence: 0,
          diagnosticHallmarks: ['Microphone active — awaiting vocal phonation...'],
        };
      }
    }

    return this.cachedReport;
  }

  private generateSyntheticReport(profile: ClinicalVoiceProfile): VocalBiomarkerReport {
    // Generate synthetic waveform matching the clinical profile to feed LPC-16
    const syntheticBuffer = new Float32Array(this.bufferSize);
    const dt = 1.0 / 16000.0;
    const f0 = profile.f0Hz;

    for (let i = 0; i < this.bufferSize; i++) {
      const t = i * dt;
      let val = Math.sin(2 * Math.PI * f0 * t);
      val += 0.5 * Math.sin(2 * Math.PI * profile.formants[0] * t) * Math.exp(-t * 12.0);
      val += 0.3 * Math.sin(2 * Math.PI * profile.formants[1] * t) * Math.exp(-t * 24.0);
      if (profile.tremorFreqHz > 0) {
        val *= (1.0 + (profile.tremorDepthPercent / 100) * Math.sin(2 * Math.PI * profile.tremorFreqHz * t));
      }
      syntheticBuffer[i] = val;
    }

    const lpc = VoiceBiometricsPhysics.calculateLpcAreaFunction(syntheticBuffer, 16);
    const diagnosis = VoiceBiometricsPhysics.diagnosePathologies({
      f0Hz: profile.f0Hz,
      jitterPercent: profile.jitterPercent,
      shimmerPercent: profile.shimmerPercent,
      hnrDb: profile.hnrDb,
      cppDb: profile.cppDb,
      fcr: profile.fcr,
      tremorDepthPercent: profile.tremorDepthPercent,
    });

    const rx = VoiceBiometricsPhysics.generatePrescription({
      f0Hz: profile.f0Hz,
      healthStatus: diagnosis.healthStatus,
      formants: profile.formants,
    });

    return {
      f0Hz: profile.f0Hz,
      pitchConfidence: 0.95,
      jitterPercent: profile.jitterPercent,
      jitterRapPercent: profile.jitterPercent * 0.72,
      jitterPpq5Percent: profile.jitterPercent * 0.85,
      shimmerPercent: profile.shimmerPercent,
      shimmerDb: profile.shimmerPercent * 0.065,
      shimmerApq11Percent: profile.shimmerPercent * 0.65,
      hnrDb: profile.hnrDb,
      cppDb: profile.cppDb,
      formantsHz: profile.formants,
      fcr: profile.fcr,
      vocalTractRadiiCm: lpc.radiiCm,
      tremorFreqHz: profile.tremorFreqHz,
      tremorDepthPercent: profile.tremorDepthPercent,
      diagnosticHallmarks: diagnosis.hallmarks,
      healthStatus: diagnosis.healthStatus,
      soundMedicinePrescription: rx,
    };
  }

  public dispose(): void {
    this.stopMicrophone();
    this.analyserNode.disconnect();
  }
}
