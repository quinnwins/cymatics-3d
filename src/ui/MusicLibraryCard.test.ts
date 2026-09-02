import { describe, it, expect, beforeEach, vi } from "vitest";
import { AudioEngine } from "../audio/AudioEngine";
import { MusicLibraryCard } from "./MusicLibraryCard";

describe("MusicLibraryCard UI & Cymatic Shapes Deck", () => {
  let audioEngine: AudioEngine;
  let card: MusicLibraryCard;
  let mockVisualizer: {
    currentStyle: string;
    layers: { plate: boolean; droplet: boolean; trap: boolean };
    getStyle: any;
    setStyle: any;
    getCymaticsLayers: any;
    setCymaticsLayers: any;
    cymaticsPlateMesh: { setModes: any; setChamberType: any; setAutoModal: any };
    cymaticsMesh: { setModes: any; setChamberType: any; setAutoModal: any };
    volumetricChladni: { setModes: any; setChamberType: any };
    gpuAcousticParticles: { setModalNumbers: any; setChamberGeometry: any; setChladniMode: any };
    chamberEnclosure: { setChamberType: any; setVisible: any };
  };

  beforeEach(() => {
    audioEngine = new AudioEngine();
    mockVisualizer = {
      currentStyle: "hybrid",
      layers: { plate: false, droplet: true, trap: true },
      getStyle: vi.fn(() => mockVisualizer.currentStyle),
      setStyle: vi.fn((s: string) => { mockVisualizer.currentStyle = s; }),
      getCymaticsLayers: vi.fn(() => ({ ...mockVisualizer.layers })),
      setCymaticsLayers: vi.fn((l: any) => { mockVisualizer.layers = { ...mockVisualizer.layers, ...l }; }),
      cymaticsPlateMesh: {
        setModes: vi.fn(),
        setChamberType: vi.fn(),
        setAutoModal: vi.fn(),
      },
      cymaticsMesh: {
        setModes: vi.fn(),
        setChamberType: vi.fn(),
        setAutoModal: vi.fn(),
      },
      volumetricChladni: {
        setModes: vi.fn(),
        setChamberType: vi.fn(),
      },
      gpuAcousticParticles: {
        setModalNumbers: vi.fn(),
        setChamberGeometry: vi.fn(),
        setChladniMode: vi.fn(),
      },
      chamberEnclosure: {
        setChamberType: vi.fn(),
        setVisible: vi.fn(),
      },
    };

    card = new MusicLibraryCard(audioEngine, mockVisualizer as any);
  });

  it("should initialize with Audio Library tab displaying demo tracks", () => {
    const el = card.getElement();
    expect(el.querySelector("#tab-btn-library")).toBeDefined();
    expect(el.querySelector("#tab-btn-cymatics")).toBeDefined();
    expect(el.querySelectorAll(".btn-track-card").length).toBeGreaterThan(0);
  });

  it("should switch between Audio Library and Cymatic Shapes tabs", () => {
    const el = card.getElement();
    const cymTabBtn = el.querySelector("#tab-btn-cymatics") as HTMLButtonElement;
    expect(cymTabBtn).toBeDefined();

    cymTabBtn.click();
    expect(mockVisualizer.setStyle).toHaveBeenCalledWith("cymatics");

    const quickStyles = el.querySelectorAll(".btn-quick-style");
    expect(quickStyles.length).toBe(6);

    const apparatusBtns = el.querySelectorAll(".btn-cym-layer");
    expect(apparatusBtns.length).toBe(3);

    const libTabBtn = el.querySelector("#tab-btn-library") as HTMLButtonElement;
    libTabBtn.click();
    expect(el.querySelectorAll(".btn-track-card").length).toBeGreaterThan(0);
  });

  it("should allow multi-select apparatus layering (plate + droplet + trap)", () => {
    const el = card.getElement();
    const cymTabBtn = el.querySelector("#tab-btn-cymatics") as HTMLButtonElement;
    cymTabBtn.click();

    const plateBtn = el.querySelector("[data-cym-layer=\"plate\"]") as HTMLButtonElement;
    expect(plateBtn).toBeDefined();

    plateBtn.click();
    expect(mockVisualizer.setCymaticsLayers).toHaveBeenCalledWith({ plate: true });
    expect(mockVisualizer.layers.plate).toBe(true);
    expect(mockVisualizer.layers.droplet).toBe(true);
    expect(mockVisualizer.layers.trap).toBe(true);
  });

  it("should apply 1-click wave shape presets to visualizer components", () => {
    const el = card.getElement();
    const cymTabBtn = el.querySelector("#tab-btn-cymatics") as HTMLButtonElement;
    cymTabBtn.click();

    const honeycombPreset = el.querySelector("[data-preset-id=\"honeycomb-membrane\"]") as HTMLButtonElement;
    expect(honeycombPreset).toBeDefined();

    honeycombPreset.click();

    expect(mockVisualizer.cymaticsMesh.setModes).toHaveBeenCalledWith(3, 2, 2);
    expect(mockVisualizer.cymaticsPlateMesh.setModes).toHaveBeenCalledWith(3, 2, 2);
    expect(mockVisualizer.gpuAcousticParticles.setModalNumbers).toHaveBeenCalledWith(3, 2, 2);
  });

  it("should step modal numbers (n, m, l) with stepper buttons", () => {
    const el = card.getElement();
    const cymTabBtn = el.querySelector("#tab-btn-cymatics") as HTMLButtonElement;
    cymTabBtn.click();

    const stepNPlus = el.querySelector("[data-step-n=\"1\"]") as HTMLButtonElement;
    expect(stepNPlus).toBeDefined();

    stepNPlus.click(); // n becomes 3
    expect(mockVisualizer.cymaticsMesh.setModes).toHaveBeenCalledWith(3, 2, 1);
  });

  it("should automatically switch to Cymatic Shapes tab when visual style changes to cymatics", () => {
    window.dispatchEvent(new CustomEvent("visual-style-changed", { detail: { style: "cymatics" } }));
    const el = card.getElement();
    expect(el.querySelectorAll(".btn-cym-layer").length).toBe(3);
  });
});
