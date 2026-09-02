/**
 * MusicLibraryCard.test.ts
 * Tests for MusicLibraryCard 5-Way Streaming & Audio Source Deck
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AudioEngine } from "../audio/AudioEngine";
import { MusicLibraryCard } from "./MusicLibraryCard";

describe("MusicLibraryCard UI - 5-Way Unified Source Deck", () => {
  let audioEngine: AudioEngine;
  let card: MusicLibraryCard;

  beforeEach(() => {
    audioEngine = new AudioEngine();
    card = new MusicLibraryCard(audioEngine);
  });

  it("should initialize with 5-way source selector tabs", () => {
    const el = card.getElement();
    expect(el.querySelector("#tab-source-crate")).not.toBeNull();
    expect(el.querySelector("#tab-source-apple")).not.toBeNull();
    expect(el.querySelector("#tab-source-spotify")).not.toBeNull();
    expect(el.querySelector("#tab-source-upload")).not.toBeNull();
    expect(el.querySelector("#tab-source-mic")).not.toBeNull();
    expect(el.querySelectorAll(".btn-track-card").length).toBe(15);
  });

  it("should switch between Crate, Apple Music, Spotify, Upload, and Mic tabs", () => {
    const el = card.getElement();

    // 1. Switch to Apple Music
    const appleBtn = el.querySelector("#tab-source-apple") as HTMLButtonElement;
    appleBtn.click();
    expect(card.getActiveSource()).toBe("apple-music");
    expect(el.querySelector("#apple-search-input")).not.toBeNull();
    expect(el.querySelectorAll(".btn-apple-track-card").length).toBeGreaterThan(0);

    // 2. Switch to Spotify
    const spotifyBtn = el.querySelector("#tab-source-spotify") as HTMLButtonElement;
    spotifyBtn.click();
    expect(card.getActiveSource()).toBe("spotify");
    expect(el.querySelector("#spotify-search-input")).not.toBeNull();
    expect(el.querySelectorAll(".btn-spotify-track-card").length).toBeGreaterThan(0);

    // 3. Switch to Upload
    const uploadBtn = el.querySelector("#tab-source-upload") as HTMLButtonElement;
    uploadBtn.click();
    expect(card.getActiveSource()).toBe("upload");
    expect(el.querySelector("#upload-dropzone")).not.toBeNull();

    // 4. Switch to Mic
    const micBtn = el.querySelector("#tab-source-mic") as HTMLButtonElement;
    micBtn.click();
    expect(card.getActiveSource()).toBe("mic");
    expect(el.querySelector("#mic-vu-level")).not.toBeNull();

    // 5. Switch back to Crate
    const crateBtn = el.querySelector("#tab-source-crate") as HTMLButtonElement;
    crateBtn.click();
    expect(card.getActiveSource()).toBe("crate");
    expect(el.querySelectorAll(".btn-track-card").length).toBe(15);
  });

  it("should filter procedural crate tracks in real-time when searching", () => {
    const el = card.getElement();
    const searchInput = el.querySelector("#lib-search-input") as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    searchInput.value = "Quantum";
    searchInput.dispatchEvent(new Event("input"));

    const trackCards = el.querySelectorAll(".btn-track-card");
    expect(trackCards.length).toBeGreaterThanOrEqual(1);
    expect(trackCards[0].textContent).toContain("Quantum");
  });

  it("should trigger loadStreamTrack when selecting an Apple Music track", async () => {
    card.setActiveSource("apple-music");
    const el = card.getElement();

    const streamSpy = vi.spyOn(audioEngine, "loadStreamTrack").mockResolvedValue(undefined);

    const firstTrackCard = el.querySelector(".btn-apple-track-card") as HTMLButtonElement;
    expect(firstTrackCard).not.toBeNull();

    firstTrackCard.click();
    await Promise.resolve();

    expect(streamSpy).toHaveBeenCalled();
    expect(streamSpy.mock.calls[0][0].source).toBe("apple-music");
  });

  it("should trigger loadStreamTrack when selecting a Spotify track", async () => {
    card.setActiveSource("spotify");
    const el = card.getElement();

    const streamSpy = vi.spyOn(audioEngine, "loadStreamTrack").mockResolvedValue(undefined);

    const firstTrackCard = el.querySelector(".btn-spotify-track-card") as HTMLButtonElement;
    expect(firstTrackCard).not.toBeNull();

    firstTrackCard.click();
    await Promise.resolve();

    expect(streamSpy).toHaveBeenCalled();
    expect(streamSpy.mock.calls[0][0].source).toBe("spotify");
  });

  it("should render loaded file playback card with scrubber and handle seek & play/pause", async () => {
    vi.spyOn(audioEngine, "getLoadedFileName").mockReturnValue("test-song.mp3");
    vi.spyOn(audioEngine, "getDuration").mockReturnValue(180);
    vi.spyOn(audioEngine, "getCurrentTime").mockReturnValue(45);

    card.setActiveSource("upload");
    const el = card.getElement();

    expect(el.textContent).toContain("test-song.mp3");
    expect(el.querySelector("#lib-file-play-pause")).not.toBeNull();
    expect(el.querySelector("#lib-file-scrubber")).not.toBeNull();
    expect(el.querySelector("#lib-file-cur-time")?.textContent).toBe("0:45");
    expect(el.querySelector("#lib-file-dur-time")?.textContent).toBe("3:00");

    // Test Play/Pause toggle
    const initSpy = vi.spyOn(audioEngine, "initialize").mockResolvedValue(undefined);
    const toggleSpy = vi.spyOn(audioEngine, "togglePlayPause").mockReturnValue(true);
    const playPauseBtn = el.querySelector("#lib-file-play-pause") as HTMLButtonElement;
    playPauseBtn.click();
    await Promise.resolve();
    expect(initSpy).toHaveBeenCalled();
    expect(toggleSpy).toHaveBeenCalled();

    // Test Scrubber seek
    const seekSpy = vi.spyOn(audioEngine, "seek");
    const scrubber = el.querySelector("#lib-file-scrubber") as HTMLInputElement;
    scrubber.value = "90";
    scrubber.dispatchEvent(new Event("input"));
    expect(seekSpy).toHaveBeenCalledWith(90);
    expect(el.querySelector("#lib-file-cur-time")?.textContent).toBe("1:30");
  });
});
