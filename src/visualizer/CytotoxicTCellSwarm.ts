/**
 * CytotoxicTCellSwarm.ts
 * SoundForm 3D - Autonomous CD8+ Cytotoxic T-Cell Swarm & Degranulation System
 */

import * as THREE from 'three';
import {
  TCELL_SWARM_VERTEX_SHADER,
  TCELL_SWARM_FRAGMENT_SHADER,
  PERFORIN_GRANZYME_VERTEX_SHADER,
  PERFORIN_GRANZYME_FRAGMENT_SHADER,
} from './shaders/tCellSwarmShader';

export type TCellState = 'patrolling' | 'engaging' | 'synapse' | 'burst' | 'detaching';

export interface TCellAgent {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPos: THREE.Vector3 | null;
  state: TCellState;
  stateTimer: number;
  synapseProgress: number;
  mtocDirection: THREE.Vector3;
}

export class CytotoxicTCellSwarm {
  public group: THREE.Group;

  private instancedMesh: THREE.InstancedMesh;
  private tCellMaterial: THREE.ShaderMaterial;
  private tCellGeometry: THREE.SphereGeometry;
  public readonly agentCount = 48;

  // Lytic Degranulation Stream
  private granulePoints: THREE.Points;
  private granuleGeometry: THREE.BufferGeometry;
  private granuleMaterial: THREE.ShaderMaterial;
  private readonly granuleCount = 384;

  // Boid Agents
  private agents: TCellAgent[] = [];
  private dummyTransform = new THREE.Object3D();

  // DAMP Chemokine Emitters
  private dampSources: THREE.Vector3[] = [new THREE.Vector3(-1.8, 0.4, 0)];

  constructor() {
    this.group = new THREE.Group();

    // 1. Instanced T-Cell Setup
    this.tCellGeometry = new THREE.SphereGeometry(0.13, 20, 20);

    const instanceVelocities = new Float32Array(this.agentCount * 4);
    const instanceMtoc = new Float32Array(this.agentCount * 4);

    this.tCellGeometry.setAttribute(
      'aInstanceVelocity',
      new THREE.InstancedBufferAttribute(instanceVelocities, 4)
    );
    this.tCellGeometry.setAttribute(
      'aTargetMtocDir',
      new THREE.InstancedBufferAttribute(instanceMtoc, 4)
    );

    this.tCellMaterial = new THREE.ShaderMaterial({
      vertexShader: TCELL_SWARM_VERTEX_SHADER,
      fragmentShader: TCELL_SWARM_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uCameraPosition: { value: new THREE.Vector3() },
        uAmoeboidDeformScale: { value: 0.045 },
        uCd8RestingColor: { value: new THREE.Color(0x1199ff) },
        uActivatedColor: { value: new THREE.Color(0xffaa11) },
        uSynapseGlowColor: { value: new THREE.Color(0xff1155) },
      },
      transparent: true,
      depthWrite: false,
    });

    this.instancedMesh = new THREE.InstancedMesh(
      this.tCellGeometry,
      this.tCellMaterial,
      this.agentCount
    );
    this.group.add(this.instancedMesh);

    // 2. Perforin/Granzyme Lytic Particle Stream
    this.granuleGeometry = new THREE.BufferGeometry();
    const origins = new Float32Array(this.granuleCount * 3);
    const targets = new Float32Array(this.granuleCount * 3);
    const offsets = new Float32Array(this.granuleCount);

    for (let i = 0; i < this.granuleCount; i++) {
      offsets[i] = Math.random();
    }

    this.granuleGeometry.setAttribute('position', new THREE.BufferAttribute(origins, 3));
    this.granuleGeometry.setAttribute('aStreamOrigin', new THREE.BufferAttribute(origins, 3));
    this.granuleGeometry.setAttribute('aStreamTarget', new THREE.BufferAttribute(targets, 3));
    this.granuleGeometry.setAttribute('aProgressOffset', new THREE.BufferAttribute(offsets, 1));

    this.granuleMaterial = new THREE.ShaderMaterial({
      vertexShader: PERFORIN_GRANZYME_VERTEX_SHADER,
      fragmentShader: PERFORIN_GRANZYME_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.granulePoints = new THREE.Points(this.granuleGeometry, this.granuleMaterial);
    this.group.add(this.granulePoints);

    this.initAgents();
  }

  private initAgents(): void {
    for (let i = 0; i < this.agentCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 2.2 + Math.random() * 2.0;
      const y = (Math.random() - 0.5) * 1.5;

      this.agents.push({
        position: new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4
        ),
        targetPos: this.dampSources[0],
        state: 'patrolling',
        stateTimer: Math.random() * 3.0,
        synapseProgress: 0.0,
        mtocDirection: new THREE.Vector3(0, 1, 0),
      });
    }
  }

  public setDampSources(sources: THREE.Vector3[]): void {
    this.dampSources = sources;
  }

  public update(time: number, dt: number, camera: THREE.Camera): void {
    this.tCellMaterial.uniforms.uTime.value = time;
    this.tCellMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    this.granuleMaterial.uniforms.uTime.value = time;

    const velAttr = this.tCellGeometry.getAttribute('aInstanceVelocity') as THREE.InstancedBufferAttribute;
    const mtocAttr = this.tCellGeometry.getAttribute('aTargetMtocDir') as THREE.InstancedBufferAttribute;
    const velArray = velAttr.array as Float32Array;
    const mtocArray = mtocAttr.array as Float32Array;

    const granOriginAttr = this.granuleGeometry.getAttribute('aStreamOrigin') as THREE.BufferAttribute;
    const granTargetAttr = this.granuleGeometry.getAttribute('aStreamTarget') as THREE.BufferAttribute;
    const granOrigins = granOriginAttr.array as Float32Array;
    const granTargets = granTargetAttr.array as Float32Array;

    let activeLyticStreams = 0;

    for (let i = 0; i < this.agentCount; i++) {
      const agent = this.agents[i];
      agent.stateTimer += dt;

      // 1. Chemotaxis Steering Vector toward DAMP source
      const fChemo = new THREE.Vector3();
      if (this.dampSources.length > 0) {
        let nearestDist = Infinity;
        let nearestTarget = this.dampSources[0];

        for (const src of this.dampSources) {
          const d = agent.position.distanceTo(src);
          if (d < nearestDist) {
            nearestDist = d;
            nearestTarget = src;
          }
        }
        agent.targetPos = nearestTarget;

        const dirToDamp = nearestTarget.clone().sub(agent.position);
        const dist = dirToDamp.length();
        if (dist > 0.001) {
          fChemo.copy(dirToDamp.normalize().multiplyScalar(Math.min(1.8, 3.5 / (dist + 0.5))));
        }
      }

      // 2. Separation & Flocking
      const fSep = new THREE.Vector3();
      for (let j = 0; j < this.agentCount; j++) {
        if (i === j) continue;
        const other = this.agents[j];
        const dist = agent.position.distanceTo(other.position);
        if (dist < 0.4 && dist > 0.001) {
          fSep.add(agent.position.clone().sub(other.position).normalize().divideScalar(dist));
        }
      }

      // 3. State Machine Evolution
      const distToTarget = agent.targetPos ? agent.position.distanceTo(agent.targetPos) : 999.0;

      if (agent.state === 'patrolling') {
        agent.synapseProgress = 0.0;
        if (distToTarget < 1.0) {
          agent.state = 'engaging';
          agent.stateTimer = 0.0;
        }
      } else if (agent.state === 'engaging') {
        agent.synapseProgress = Math.min(1.0, agent.stateTimer / 0.8);
        if (distToTarget < 0.4) {
          agent.state = 'synapse';
          agent.stateTimer = 0.0;
        }
      } else if (agent.state === 'synapse') {
        agent.synapseProgress = 1.0;
        if (agent.targetPos) {
          agent.mtocDirection.copy(agent.targetPos).sub(agent.position).normalize();
        }
        if (agent.stateTimer > 0.5) {
          agent.state = 'burst';
          agent.stateTimer = 0.0;
        }
      } else if (agent.state === 'burst') {
        agent.synapseProgress = 1.0;
        if (agent.targetPos && activeLyticStreams < this.granuleCount - 6) {
          const gIdx = activeLyticStreams;
          for (let k = 0; k < 6; k++) {
            granOrigins[(gIdx + k) * 3 + 0] = agent.position.x;
            granOrigins[(gIdx + k) * 3 + 1] = agent.position.y;
            granOrigins[(gIdx + k) * 3 + 2] = agent.position.z;

            granTargets[(gIdx + k) * 3 + 0] = agent.targetPos.x + (Math.random() - 0.5) * 0.4;
            granTargets[(gIdx + k) * 3 + 1] = agent.targetPos.y + (Math.random() - 0.5) * 0.4;
            granTargets[(gIdx + k) * 3 + 2] = agent.targetPos.z + (Math.random() - 0.5) * 0.4;
          }
          activeLyticStreams += 6;
        }

        if (agent.stateTimer > 1.2) {
          agent.state = 'detaching';
          agent.stateTimer = 0.0;
        }
      } else if (agent.state === 'detaching') {
        agent.synapseProgress = Math.max(0.0, 1.0 - agent.stateTimer / 0.5);
        if (agent.stateTimer > 0.6) {
          agent.state = 'patrolling';
          agent.stateTimer = 0.0;
        }
      }

      // 4. Update Dynamics
      const fTotal = fChemo.add(fSep.multiplyScalar(0.7));
      agent.velocity.add(fTotal.multiplyScalar(dt));
      agent.velocity.multiplyScalar(0.92); // Viscous damping

      agent.position.add(agent.velocity.clone().multiplyScalar(dt));

      // Update Instance Transform Matrix
      this.dummyTransform.position.copy(agent.position);
      if (agent.velocity.lengthSq() > 0.001) {
        this.dummyTransform.lookAt(agent.position.clone().add(agent.velocity));
      }
      this.dummyTransform.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummyTransform.matrix);

      // Update Attribute Buffers
      velArray[i * 4 + 0] = agent.velocity.x;
      velArray[i * 4 + 1] = agent.velocity.y;
      velArray[i * 4 + 2] = agent.velocity.z;
      velArray[i * 4 + 3] =
        agent.state === 'patrolling'
          ? 0.0
          : agent.state === 'engaging'
          ? 1.0
          : agent.state === 'synapse'
          ? 2.0
          : agent.state === 'burst'
          ? 3.0
          : 4.0;

      mtocArray[i * 4 + 0] = agent.mtocDirection.x;
      mtocArray[i * 4 + 1] = agent.mtocDirection.y;
      mtocArray[i * 4 + 2] = agent.mtocDirection.z;
      mtocArray[i * 4 + 3] = agent.synapseProgress;
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    velAttr.needsUpdate = true;
    mtocAttr.needsUpdate = true;
    this.granuleGeometry.setDrawRange(0, activeLyticStreams);
    granOriginAttr.needsUpdate = true;
    granTargetAttr.needsUpdate = true;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    this.tCellGeometry.dispose();
    this.tCellMaterial.dispose();
    this.granuleGeometry.dispose();
    this.granuleMaterial.dispose();
  }
}
