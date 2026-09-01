/**
 * VocalBiometricsLab.ts
 * SoundForm 3D - High-Level Vocal Biometrics & Personalized Sound Medicine Orchestrator
 */

import * as THREE from 'three';
import { VocalTractTubeMesh } from './VocalTractTubeMesh';
import { FormantSpaceManifold } from './FormantSpaceManifold';
import { SoundMedicineField } from './SoundMedicineField';
import { VocalBiomarkerReport } from '../math/VoiceBiometricsPhysics';

export class VocalBiometricsLab {
  public group: THREE.Group;
  public vocalTract: VocalTractTubeMesh;
  public formantSpace: FormantSpaceManifold;
  public soundMedicine: SoundMedicineField;

  private lightsGroup: THREE.Group;
  private isTherapyActive = false;
  private therapyProgress = 0.0;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // 1. Stage Lighting
    this.lightsGroup = new THREE.Group();
    const cyanLight = new THREE.PointLight(0x00e5ff, 2.5, 20);
    cyanLight.position.set(-4, 3, 4);
    this.lightsGroup.add(cyanLight);

    const magentaLight = new THREE.PointLight(0xff0077, 2.0, 20);
    magentaLight.position.set(4, 2, 4);
    this.lightsGroup.add(magentaLight);

    const goldLight = new THREE.PointLight(0xffaa00, 2.5, 25);
    goldLight.position.set(0, 4, 3);
    this.lightsGroup.add(goldLight);
    this.group.add(this.lightsGroup);

    // 2. Vocal Tract Tube Waveguide (Left Viewport)
    this.vocalTract = new VocalTractTubeMesh();
    this.vocalTract.group.position.set(-2.8, 0.4, 0);
    this.group.add(this.vocalTract.group);

    // 3. Formant & Vowel Space Manifold (Right Viewport)
    this.formantSpace = new FormantSpaceManifold();
    this.formantSpace.group.position.set(2.8, 0.4, 0);
    this.group.add(this.formantSpace.group);

    // 4. Restorative Sound Medicine Hologram (Center Stage)
    this.soundMedicine = new SoundMedicineField();
    this.soundMedicine.group.position.set(0, 0.4, 0);
    this.group.add(this.soundMedicine.group);
  }

  public setTherapyActive(active: boolean): void {
    this.isTherapyActive = active;
  }

  public updateTelemetry(report: VocalBiomarkerReport): void {
    this.vocalTract.setAreaRadii(report.vocalTractRadiiCm);
    this.vocalTract.setFormants(report.formantsHz);
  }

  public update(dt: number, time: number, camera: THREE.Camera, report: VocalBiomarkerReport): void {
    if (!this.group.visible) return;

    if (this.isTherapyActive) {
      this.therapyProgress = Math.min(1.0, this.therapyProgress + dt * 0.45);
    } else {
      this.therapyProgress = Math.max(0.0, this.therapyProgress - dt * 0.85);
    }

    this.soundMedicine.setCoherenceProgress(this.therapyProgress);

    this.vocalTract.setAreaRadii(report.vocalTractRadiiCm);
    this.vocalTract.setFormants(report.formantsHz);
    this.vocalTract.update(dt, time, camera, 1.0, this.therapyProgress);

    this.formantSpace.update(
      time,
      camera,
      report.fcr,
      this.therapyProgress,
      report.formantsHz[0],
      report.formantsHz[1],
      report.formantsHz[2]
    );

    this.soundMedicine.update(dt, time, camera);

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
    this.soundMedicine.dispose();
  }
}
