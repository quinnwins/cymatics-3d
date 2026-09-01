/**
 * VocalBiometricsLab.ts
 * SoundForm 3D - High-Level Vocal Biometrics & Clinical Vocal Tract Orchestrator
 */

import * as THREE from 'three';
import { VocalTractTubeMesh } from './VocalTractTubeMesh';
import { FormantSpaceManifold } from './FormantSpaceManifold';
import { VocalBiomarkerReport } from '../math/VoiceBiometricsPhysics';

export class VocalBiometricsLab {
  public group: THREE.Group;
  public vocalTract: VocalTractTubeMesh;
  public formantSpace: FormantSpaceManifold;

  private isTherapyActive = false;
  private therapyProgress = 0.0;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // 1. Vocal Tract Tube Waveguide (Left Viewport)
    this.vocalTract = new VocalTractTubeMesh();
    this.vocalTract.group.position.set(-2.4, 0.45, 0);
    this.group.add(this.vocalTract.group);

    // 2. Formant & IPA Vowel Space Manifold (Right Viewport)
    this.formantSpace = new FormantSpaceManifold();
    this.formantSpace.group.position.set(2.4, 0.45, 0);
    this.group.add(this.formantSpace.group);
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

    this.vocalTract.setAreaRadii(report.vocalTractRadiiCm);
    this.vocalTract.setFormants(report.formantsHz);
    this.vocalTract.update(dt, time, camera, 1.0, this.therapyProgress);

    this.formantSpace.pushSpeakerFormants(
      report.formantsHz[0],
      report.formantsHz[1],
      report.formantsHz[2],
      report.pitchConfidence
    );
    this.formantSpace.update(time, report.fcr, this.isTherapyActive);

    this.group.rotation.y = Math.sin(time * 0.05) * 0.05;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public isVisible(): boolean {
    return this.group.visible;
  }

  public dispose(): void {
    this.vocalTract.dispose();
    this.formantSpace.dispose();
  }
}
