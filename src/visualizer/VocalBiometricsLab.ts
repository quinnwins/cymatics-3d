/**
 * VocalBiometricsLab.ts
 * SoundForm 3D - High-Level Vocal Biometrics & Clinical Vocal Tract Orchestrator
 *
 * Implements:
 * 1. 3 Interactive Stage View Modes:
 *    - 'airway' (Default Focus): Centers the 3D Volumetric Head & Vocal Tract at X = 0.
 *    - 'vowels': Centers the 3D Calibrated Vowel Bullseye at X = 0.
 *    - 'dual': Side-by-side comparative layout with wide 7.6-unit separation.
 * 2. True 3D Volumetric Head Shell with Fresnel glassmorphism rim.
 * 3. Dynamic breath stream particle advection.
 */

import * as THREE from 'three';
import { VocalTractTubeMesh } from './VocalTractTubeMesh';
import { HeadProfileSilhouette } from './HeadProfileSilhouette';
import { VocalAirflowParticles } from './VocalAirflowParticles';
import { FormantSpaceManifold } from './FormantSpaceManifold';
import { VocalBiomarkerReport } from '../math/VoiceBiometricsPhysics';

export type StageFocusMode = 'airway' | 'vowels' | 'dual';

export class VocalBiometricsLab {
  public group: THREE.Group;
  public vocalTract: VocalTractTubeMesh;
  public headSilhouette: HeadProfileSilhouette;
  public airflowParticles: VocalAirflowParticles;
  public formantSpace: FormantSpaceManifold;

  private currentFocusMode: StageFocusMode = 'dual';
  private isTherapyActive = false;
  private therapyProgress = 0.0;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // 1. Left Viewport: 3D Volumetric Head + Vocal Tract + Breath Stream
    this.vocalTract = new VocalTractTubeMesh();
    this.vocalTract.group.position.set(-3.6, 0.35, 0);

    this.headSilhouette = new HeadProfileSilhouette();
    this.vocalTract.group.add(this.headSilhouette.group);

    this.airflowParticles = new VocalAirflowParticles();
    this.vocalTract.group.add(this.airflowParticles.group);

    this.group.add(this.vocalTract.group);

    // 2. Right Viewport: Formant & IPA Vowel Target Manifold
    this.formantSpace = new FormantSpaceManifold();
    this.formantSpace.group.position.set(3.6, 0.35, 0);
    this.group.add(this.formantSpace.group);

    this.setFocusMode('dual');
  }

  public setFocusMode(mode: StageFocusMode): void {
    this.currentFocusMode = mode;

    if (mode === 'airway') {
      this.vocalTract.group.position.set(0, 0.35, 0);
      this.vocalTract.group.visible = true;
      this.formantSpace.group.visible = false;
    } else if (mode === 'vowels') {
      this.formantSpace.group.position.set(0, 0.35, 0);
      this.formantSpace.group.visible = true;
      this.vocalTract.group.visible = false;
    } else {
      // Dual side-by-side with wide separation
      this.vocalTract.group.position.set(-3.6, 0.35, 0);
      this.vocalTract.group.visible = true;
      this.formantSpace.group.position.set(3.6, 0.35, 0);
      this.formantSpace.group.visible = true;
    }
  }

  public setStageMode(mode: StageFocusMode): void {
    this.setFocusMode(mode);
  }

  public getFocusMode(): StageFocusMode {
    return this.currentFocusMode;
  }

  public setTherapyActive(active: boolean): void {
    this.isTherapyActive = active;
  }

  public updateTelemetry(report: VocalBiomarkerReport): void {
    this.vocalTract.setAreaRadii(report.vocalTractRadiiCm);
    this.vocalTract.setFormants(report.formantsHz);
    this.formantSpace.pushSpeakerFormants(
      report.formantsHz[0],
      report.formantsHz[1],
      report.formantsHz[2],
      report.pitchConfidence
    );
  }

  public update(dt: number, time: number, camera: THREE.Camera, report: VocalBiomarkerReport): void {
    if (!this.group.visible) return;

    if (this.isTherapyActive) {
      this.therapyProgress = Math.min(1.0, this.therapyProgress + dt * 0.45);
    } else {
      this.therapyProgress = Math.max(0.0, this.therapyProgress - dt * 0.85);
    }

    const isTurbulent =
      report.healthStatus === 'pathological-dysphonia' ||
      (report.cppDb !== undefined && report.cppDb < 11.0) ||
      (report.jitterPercent !== undefined && report.jitterPercent > 1.2);

    // Update Left Stage
    if (this.vocalTract.group.visible) {
      this.vocalTract.setAreaRadii(report.vocalTractRadiiCm);
      this.vocalTract.setFormants(report.formantsHz);
      this.vocalTract.update(dt, time, camera, 1.0, this.therapyProgress);
      this.headSilhouette.update(time);
      this.airflowParticles.update(dt, time, report.pitchConfidence || 1.0, isTurbulent);
    }

    // Update Right Stage
    if (this.formantSpace.group.visible) {
      this.formantSpace.pushSpeakerFormants(
        report.formantsHz[0],
        report.formantsHz[1],
        report.formantsHz[2],
        report.pitchConfidence
      );
      this.formantSpace.update(time, report.fcr, this.isTherapyActive);
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public isVisible(): boolean {
    return this.group.visible;
  }

  public dispose(): void {
    this.vocalTract.dispose();
    this.headSilhouette.dispose();
    this.airflowParticles.dispose();
    this.formantSpace.dispose();
  }
}
