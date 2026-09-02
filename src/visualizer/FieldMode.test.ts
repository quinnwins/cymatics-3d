import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GpuAcousticParticles } from './GpuAcousticParticles';
import { VolumetricChladniMesh } from './VolumetricChladniMesh';
import { ChamberEnclosure } from './ChamberEnclosure';
import { VisualizerEngine } from './VisualizerEngine';
import { CustomMeshFieldSampler } from './CustomMeshFieldSampler';
import { ColorPalettes } from './ColorPalettes';
import { AudioEngine } from '../audio/AudioEngine';
import { ModalSweeperControls } from '../ui/ModalSweeperControls';

describe('Field Mode & Shape Manifold Engine', () => {
  const palette = ColorPalettes.getPalette('cosmic-nebula');

  describe('CustomMeshFieldSampler', () => {
    it('parses OBJ text into normalized vertices, surface samples, and edge wireframes', () => {
      const objText = `
v 1.0 1.0 1.0
v -1.0 -1.0 1.0
v -1.0 1.0 -1.0
v 1.0 -1.0 -1.0
f 1 2 3
f 1 3 4
f 1 4 2
f 2 4 3
`;
      const parsed = CustomMeshFieldSampler.parseOBJ(objText, 'TestTetrahedron', 100);
      expect(parsed.name).toBe('TestTetrahedron');
      expect(parsed.vertexCount).toBe(4);
      expect(parsed.faceCount).toBe(4);
      expect(parsed.surfaceSamples.length).toBe(300); // 100 * 3
      expect(parsed.wireframePositions.length).toBeGreaterThan(0);
    });

    it('handles tabs, whitespace, negative relative indexing, and quad fan triangulation', () => {
      const complexObj = `
# Comment line
v\t1.0\t0.0\t0.0
v  0.0  1.0  0.0
v -1.0\t0.0\t0.0
v\t0.0 -1.0\t0.0
# Quad face with texture/normal tokens and negative indexing
f -4/1/1 -3/2/2 -2/3/3 -1/4/4
`;
      const parsed = CustomMeshFieldSampler.parseOBJ(complexObj, 'QuadTest', 50);
      expect(parsed.vertexCount).toBe(4);
      expect(parsed.faceCount).toBe(2); // 1 quad triangulated into 2 triangles
      expect(parsed.surfaceSamples.length).toBe(150);
    });

    it('gracefully handles duplicate vertex edges and degenerate scale', () => {
      const degenerateObj = `
v 0.0000001 0.0000001 0.0000001
v 0.0000002 0.0000001 0.0000001
v 0.0000001 0.0000002 0.0000001
f 1 1 2
f 1 2 3
`;
      const parsed = CustomMeshFieldSampler.parseOBJ(degenerateObj, 'DegenerateTest', 20);
      expect(parsed.vertexCount).toBe(3);
      expect(Number.isFinite(parsed.surfaceSamples[0])).toBe(true);
    });

    it('enforces CDF binary search edge-case clamping to terminal face', () => {
      const simpleObj = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
      const parsed = CustomMeshFieldSampler.parseOBJ(simpleObj, 'SingleTri', 10);
      expect(parsed.surfaceSamples.length).toBe(30);
      // All sampled points must be finite
      for (let i = 0; i < parsed.surfaceSamples.length; i++) {
        expect(Number.isFinite(parsed.surfaceSamples[i])).toBe(true);
      }
    });

    it('provides built-in presets: Bunny, Teapot, and Star', () => {
      const bunny = CustomMeshFieldSampler.getStanfordBunnyPreset(200);
      expect(bunny.name).toContain('Bunny');
      expect(bunny.surfaceSamples.length).toBe(600);

      const teapot = CustomMeshFieldSampler.getUtahTeapotPreset(200);
      expect(teapot.name).toContain('Teapot');
      expect(teapot.surfaceSamples.length).toBe(600);

      const star = CustomMeshFieldSampler.getStellatedStarPreset(200);
      expect(star.name).toContain('Star');
      expect(star.surfaceSamples.length).toBe(600);
    });
  });

  describe('GpuAcousticParticles Field Mode Integration', () => {
    let particles: GpuAcousticParticles;

    beforeEach(() => {
      const renderer = {} as THREE.WebGLRenderer;
      particles = new GpuAcousticParticles(renderer, palette, { particleCount: 1024 });
    });

    it('defaults to Cavity Chamber mode (fieldMode = false)', () => {
      expect(particles.getFieldMode()).toBe(false);
      expect(particles.getFieldShape()).toBe('free-field');
    });

    it('enables Field Mode and updates shader uniform', () => {
      particles.setFieldMode(true);
      expect(particles.getFieldMode()).toBe(true);

      const material = (particles as any).renderMaterial as THREE.ShaderMaterial;
      expect(material.uniforms.uFieldMode.value).toBe(1);

      particles.setFieldMode(false);
      expect(particles.getFieldMode()).toBe(false);
      expect(material.uniforms.uFieldMode.value).toBe(0);
    });

    it('sets curated field shapes: Torus, Octahedron, Tetrahedron, Dodecahedron, Helix, Heart', () => {
      particles.setFieldShape('torus');
      expect(particles.getFieldShape()).toBe('torus');
      const material = (particles as any).renderMaterial as THREE.ShaderMaterial;
      expect(material.uniforms.uFieldShapeType.value).toBe(2);

      particles.setFieldShape('octahedron');
      expect(particles.getFieldShape()).toBe('octahedron');
      expect(material.uniforms.uFieldShapeType.value).toBe(3);

      particles.setFieldShape('tetrahedron');
      expect(particles.getFieldShape()).toBe('tetrahedron');
      expect(material.uniforms.uFieldShapeType.value).toBe(4);

      particles.setFieldShape('dodecahedron');
      expect(particles.getFieldShape()).toBe('dodecahedron');
      expect(material.uniforms.uFieldShapeType.value).toBe(5);

      particles.setFieldShape('helix');
      expect(particles.getFieldShape()).toBe('helix');
      expect(material.uniforms.uFieldShapeType.value).toBe(6);

      particles.setFieldShape('heart');
      expect(particles.getFieldShape()).toBe('heart');
      expect(material.uniforms.uFieldShapeType.value).toBe(7);
    });

    it('updates Superquadric morph parameters (eps1, eps2, pinch, lobes, lobeAmp)', () => {
      particles.setFieldShape('superquadric', {
        eps1: 0.5,
        eps2: 2.0,
        pinch: 0.3,
        lobes: 4,
        lobeAmp: 0.25,
      });

      const params = particles.getSuperquadricParams();
      expect(params.eps1).toBeCloseTo(0.5);
      expect(params.eps2).toBeCloseTo(2.0);
      expect(params.pinch).toBeCloseTo(0.3);
      expect(params.lobes).toBe(4);
      expect(params.lobeAmp).toBeCloseTo(0.25);

      const material = (particles as any).renderMaterial as THREE.ShaderMaterial;
      expect(material.uniforms.uSuperquadricParams.value.x).toBeCloseTo(0.5);
      expect(material.uniforms.uSuperquadricParams.value.y).toBeCloseTo(2.0);
      expect(material.uniforms.uSuperquadricParams.value.z).toBeCloseTo(0.3);
      expect(material.uniforms.uSuperquadricParams.value.w).toBe(4);
      expect(material.uniforms.uSuperquadricLobeAmp.value).toBeCloseTo(0.25);
    });

    it('injects custom mesh samples and automatically restores canonical distribution when leaving custom mode', () => {
      const customSamples = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
      particles.setFieldShape('custom');
      particles.setCustomMeshSamples(customSamples);

      let posAttr = (particles as any).pointsMesh.geometry.getAttribute('position');
      expect(posAttr.getX(0)).toBe(1.0);
      expect(posAttr.getY(0)).toBe(2.0);
      expect(posAttr.getZ(0)).toBe(3.0);

      // Transition away to torus
      particles.setFieldShape('torus');
      posAttr = (particles as any).pointsMesh.geometry.getAttribute('position');
      // Position has been regenerated to canonical volume distribution
      expect(posAttr.getX(0)).not.toBe(1.0);

      // Transition back to custom - restores cached samples
      particles.setFieldShape('custom');
      posAttr = (particles as any).pointsMesh.geometry.getAttribute('position');
      expect(posAttr.getX(0)).toBe(1.0);
    });

    it('sets field boundary strength uniform', () => {
      particles.setFieldBoundaryStrength(1.15);
      const material = (particles as any).renderMaterial as THREE.ShaderMaterial;
      expect(material.uniforms.uFieldBoundaryStrength.value).toBeCloseTo(1.15);
    });
  });

  describe('VolumetricChladniMesh Field Mode Integration', () => {
    it('sets Field Mode and shape uniforms on raymarching material', () => {
      const chladni = new VolumetricChladniMesh(palette);
      chladni.setFieldMode(true);
      expect(chladni.material.uniforms.uFieldMode.value).toBe(1);

      chladni.setFieldShape('torus');
      expect(chladni.material.uniforms.uFieldShapeType.value).toBe(2);

      chladni.setFieldShape('superquadric', { eps1: 0.8, pinch: -0.2 });
      expect(chladni.material.uniforms.uSuperquadricParams.value.x).toBeCloseTo(0.8);
      expect(chladni.material.uniforms.uSuperquadricParams.value.z).toBeCloseTo(-0.2);

      chladni.setFieldMode(false);
      expect(chladni.material.uniforms.uFieldMode.value).toBe(0);
    });
  });

  describe('ChamberEnclosure Field Mode Enclosure Transformation', () => {
    it('switches from rigid box to acoustic transducer array or wireframe contours without leaking geometries', () => {
      const enclosure = new ChamberEnclosure(palette);
      expect(enclosure.getFieldMode()).toBe(false);

      enclosure.setFieldMode(true, 'free-field');
      expect(enclosure.getFieldMode()).toBe(true);
      expect(enclosure.getFieldShape()).toBe('free-field');

      const internals = enclosure as any;
      expect(internals.chamberGroup.visible).toBe(false);
      expect(internals.frameGroup.visible).toBe(false);
      expect(internals.fieldGroup.visible).toBe(true);
      expect(internals.freeFieldEmitterGroup.visible).toBe(true);

      // Switch to Octahedron
      enclosure.setFieldShape('octahedron');
      expect(internals.octahedronFrameGroup.visible).toBe(true);
      expect(internals.freeFieldEmitterGroup.visible).toBe(false);

      // Dragging superquadric parameters does not leak or reallocate geometries
      enclosure.setFieldShape('superquadric');
      const geoCountBefore = internals.superquadricFrameGroup.children.length;
      for (let i = 0; i < 20; i++) {
        enclosure.setFieldShape('superquadric', { eps1: 0.5 + i * 0.05, pinch: i * 0.02 });
      }
      expect(internals.superquadricFrameGroup.children.length).toBe(geoCountBefore);

      // Toggle Contour Frame visibility
      enclosure.setContourVisible(false);
      expect(enclosure.getContourVisible()).toBe(false);
      expect(internals.fieldGroup.visible).toBe(false);

      enclosure.setContourVisible(true);
      expect(internals.fieldGroup.visible).toBe(true);

      // Clean disposal without double-dispose exceptions
      expect(() => enclosure.dispose()).not.toThrow();
    });
  });

  describe('VisualizerEngine Coordination', () => {
    it('coordinates field mode and shape changes cleanly', () => {
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      const mockCtx = new Proxy(
        {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          font: '',
          measureText: () => ({ width: 10 }),
          getImageData: () => ({ data: new Uint8ClampedArray(4) }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
          createLinearGradient: () => ({ addColorStop: () => {} }),
        },
        {
          get: (target, prop) => {
            if (prop in target) return (target as any)[prop];
            return () => {};
          },
        }
      );
      HTMLCanvasElement.prototype.getContext = ((type: string) => {
        if (type === '2d') return mockCtx;
        return null;
      }) as any;

      try {
        const container = document.createElement('div');
        const audioEngine = new AudioEngine();
        const engine = new VisualizerEngine(container, audioEngine);
        engine.setFieldMode(true, 'octahedron');
        expect(engine.getFieldMode()).toBe(true);
        expect(engine.getFieldShape()).toBe('octahedron');

        engine.setFieldContourVisible(false);
        expect(engine.getFieldContourVisible()).toBe(false);

        engine.dispose();
      } finally {
        HTMLCanvasElement.prototype.getContext = origGetContext;
      }
    });
  });

  describe('ModalSweeperControls Field Mode UI Integration', () => {
    let audioEngine: AudioEngine;
    let controls: ModalSweeperControls;

    beforeEach(() => {
      audioEngine = new AudioEngine();
      controls = new ModalSweeperControls(audioEngine);
    });

    it('toggles Field Mode and exposes shape selector pills', () => {
      expect(controls.getFieldMode()).toBe(false);

      controls.setFieldMode(true, 'torus');
      expect(controls.getFieldMode()).toBe(true);
      expect(controls.getFieldShape()).toBe('torus');

      const el = controls.getElement();
      expect(el.querySelector('#btn-regime-field')?.classList.contains('is-active-emerald')).toBe(true);
      expect(el.querySelector('button[data-shape="torus"]')?.classList.contains('bg-emerald-500/20')).toBe(true);
    });

    it('switches between shapes and updates parametric sliders', () => {
      controls.setFieldMode(true, 'superquadric', { eps1: 0.4, pinch: 0.2 });
      const el = controls.getElement();
      const sliderEps1 = el.querySelector('#slider-sq-eps1') as HTMLInputElement;
      expect(sliderEps1).not.toBeNull();
      expect(parseFloat(sliderEps1.value)).toBeCloseTo(0.4);

      // Contour toggle
      controls.setContourVisible(false);
      expect(controls.getContourVisible()).toBe(false);
    });
  });
});
