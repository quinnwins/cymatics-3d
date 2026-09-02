from pathlib import Path

# 1. Correct user-facing transposition direction.
model_path = Path('src/visualizer/AnamnesisModel.ts')
model = model_path.read_text()
old = '''  // Report the signed shortest interval in semitones.
  const signedShift = bestShift > 6 ? bestShift - 12 : bestShift;
  return { similarity: clamp(best), transposition: signedShift };
'''
new = '''  // bestShift rotates the previous chroma toward the current chroma. Report
  // the inverse rotation so the interval reads from the earlier phrase to its
  // return: C returning in D is +2, not -2.
  const returnShift = (12 - bestShift) % 12;
  const signedShift = returnShift > 6 ? returnShift - 12 : returnShift;
  return { similarity: clamp(best), transposition: signedShift };
'''
if model.count(old) != 1:
    raise SystemExit('transposition block not found exactly once')
model_path.write_text(model.replace(old, new, 1))

# 2. Harden Experience playback semantics and session-stable relic persistence.
experience_path = Path('src/visualizer/AnamnesisExperience.ts')
experience = experience_path.read_text()
replacements = [
    (
        "export const ANAMNESIS_RETURN_EVENT = 'soundform-anamnesis-return';\n",
        "export const ANAMNESIS_RETURN_EVENT = 'soundform-anamnesis-return';\n\nexport function canControlAnamnesisPlayback(\n  mode: AudioInputMode,\n  viewingRelic = false\n): boolean {\n  return mode !== 'microphone' && !viewingRelic;\n}\n",
    ),
    (
        "  private sessionIdentity = '';\n  private sessionElapsed = 0;\n",
        "  private sessionIdentity = '';\n  private sessionElapsed = 0;\n  private savedRelicId: string | null = null;\n  private lastSavedFingerprint = '';\n",
    ),
    (
        "    this.sessionIdentity = meta.identity;\n    this.sessionElapsed = 0;\n",
        "    this.sessionIdentity = meta.identity;\n    this.sessionElapsed = 0;\n    this.savedRelicId = null;\n    this.lastSavedFingerprint = '';\n",
    ),
    (
        '''    const relic = this.model.toRelic();
    this.store.save(relic);
    if (showMessage) this.showTemporaryMessage('THIS MEMORY NOW LIVES HERE', 3.5);
    this.renderArchive();
    return relic;
''',
        '''    const fingerprint = this.getRelicFingerprint();
    if (fingerprint === this.lastSavedFingerprint) {
      if (showMessage) this.showTemporaryMessage('THIS RELIC IS ALREADY KEPT', 2.5);
      return this.savedRelicId
        ? this.store.list().find(item => item.id === this.savedRelicId) || null
        : null;
    }

    const relic = this.model.toRelic();
    // One live listening session owns one relic. Later autosaves update that
    // relic as the performance grows instead of flooding the twelve-slot
    // archive with timestamp variants of the same memory.
    if (this.savedRelicId) relic.id = this.savedRelicId;
    this.store.save(relic);
    this.savedRelicId = relic.id;
    this.lastSavedFingerprint = fingerprint;
    if (showMessage) this.showTemporaryMessage('THIS MEMORY NOW LIVES HERE', 3.5);
    this.renderArchive();
    return relic;
''',
    ),
    (
        "    this.model.reset(meta);\n    this.latestLivePoints = [];\n",
        "    this.model.reset(meta);\n    this.savedRelicId = null;\n    this.lastSavedFingerprint = '';\n    this.latestLivePoints = [];\n",
    ),
    (
        "      #anamnesis-hud button:hover{border-color:#67e8f977;color:#fff;background:#0e1b2fcb}#anamnesis-hud button[data-primary]{border-color:#67e8f955;color:#cffafe}\n",
        "      #anamnesis-hud button:hover{border-color:#67e8f977;color:#fff;background:#0e1b2fcb}#anamnesis-hud button[data-primary]{border-color:#67e8f955;color:#cffafe}#anamnesis-hud button:disabled{opacity:.42;cursor:default;border-color:#94a3b81f;color:#64748b;background:#03071188}\n",
    ),
    (
        '''    this.root.querySelector<HTMLButtonElement>('[data-action="play"]')!.onclick = () => {
      this.audio.togglePlayPause();
      this.renderUi(this.visualTime);
    };
''',
        '''    this.root.querySelector<HTMLButtonElement>('[data-action="play"]')!.onclick = () => {
      const mode = this.audio.getMode();
      if (!canControlAnamnesisPlayback(mode, Boolean(this.viewingRelic))) {
        this.showTemporaryMessage(
          mode === 'microphone' ? 'MICROPHONE REMAINS LIVE' : 'RETURN TO LIVE TO CONTROL PLAYBACK',
          2.5
        );
        return;
      }
      this.audio.togglePlayPause();
      this.renderUi(this.visualTime);
    };
''',
    ),
    (
        "    this.root.querySelector<HTMLButtonElement>('[data-action=\"play\"]')!.textContent = this.audio.getIsPlaying() ? 'PAUSE' : 'RESUME';\n",
        "    const playButton = this.root.querySelector<HTMLButtonElement>('[data-action=\"play\"]')!;\n    const mode = this.audio.getMode();\n    const playbackControllable = canControlAnamnesisPlayback(mode, Boolean(this.viewingRelic));\n    playButton.disabled = !playbackControllable;\n    playButton.textContent = mode === 'microphone'\n      ? 'LIVE INPUT'\n      : this.viewingRelic\n        ? 'RELIC VIEW'\n        : this.audio.getIsPlaying() ? 'PAUSE' : 'RESUME';\n",
    ),
]
for old, new in replacements:
    if experience.count(old) != 1:
        raise SystemExit(f'experience replacement missing or ambiguous: {old[:100]!r}')
    experience = experience.replace(old, new, 1)

fingerprint_needle = '''  private activePoints(): readonly MemoryPoint[] {
    return this.viewingRelic?.points || this.latestLivePoints;
  }

'''
fingerprint_replacement = '''  private activePoints(): readonly MemoryPoint[] {
    return this.viewingRelic?.points || this.latestLivePoints;
  }

  private getRelicFingerprint(): string {
    const points = this.model.getPoints();
    const stats = this.model.getStats();
    const last = points[points.length - 1];
    return [
      this.sessionIdentity,
      stats.moments,
      stats.echoes,
      last?.id ?? -1,
      (last?.timeSeconds ?? 0).toFixed(3),
    ].join('|');
  }

'''
if experience.count(fingerprint_needle) != 1:
    raise SystemExit('relic fingerprint insertion point missing')
experience_path.write_text(experience.replace(fingerprint_needle, fingerprint_replacement, 1))

# 3. Make the direction assertions exact instead of accepting either sign.
test_path = Path('src/visualizer/AnamnesisModel.test.ts')
test = test_path.read_text()
old = '''  it('finds the strongest circular chroma alignment and reports transposition', () => {
    const c = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
    const d = [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0];
    const comparison = compareChromaCircular(c, d);
    expect(comparison.similarity).toBeCloseTo(1, 6);
    expect(Math.abs(comparison.transposition)).toBe(2);
  });
'''
new = '''  it('finds the strongest circular chroma alignment and reports the return direction', () => {
    const previousC = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
    const currentD = [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0];
    const comparison = compareChromaCircular(currentD, previousC);
    expect(comparison.similarity).toBeCloseTo(1, 6);
    expect(comparison.transposition).toBe(2);
  });
'''
if test.count(old) != 1:
    raise SystemExit('direct transposition test not found')
test = test.replace(old, new, 1)
old = "    expect(threads.some(thread => Math.abs(thread.transposition) === 2)).toBe(true);\n"
new = "    expect(threads.some(thread => thread.transposition === 2)).toBe(true);\n"
if test.count(old) != 1:
    raise SystemExit('phrase transposition assertion not found')
test_path.write_text(test.replace(old, new, 1))

# 4. Extend browser acceptance to prove repeated saves do not multiply relics.
qa_path = Path('scripts/verify-anamnesis.mjs')
qa = qa_path.read_text()
old = '''    const relicProof = await page.evaluate(() => {
      const experience = window.__anamnesis;
      const relic = experience.saveRelic(false);
      if (!relic) return { saved: false };
      const viewed = experience.viewRelic(relic.id);
      const viewing = experience.getState().viewingRelic;
      experience.returnToLive();
      return { saved: true, viewed, viewing, id: relic.id };
    });
    if (!relicProof.saved || !relicProof.viewed || !relicProof.viewing) {
      throw new Error(`Memory relic lifecycle failed: ${JSON.stringify(relicProof)}`);
    }
'''
new = '''    const relicProof = await page.evaluate(() => {
      const experience = window.__anamnesis;
      const first = experience.saveRelic(false);
      const second = experience.saveRelic(false);
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      if (!first || !second) return { saved: false };
      const stored = JSON.parse(localStorage.getItem('soundform.anamnesis.relics.v1') || '[]');
      const viewed = experience.viewRelic(first.id);
      const viewing = experience.getState().viewingRelic;
      experience.returnToLive();
      return {
        saved: true,
        viewed,
        viewing,
        sameId: first.id === second.id,
        storedCount: stored.length,
        id: first.id,
      };
    });
    if (
      !relicProof.saved
      || !relicProof.viewed
      || !relicProof.viewing
      || !relicProof.sameId
      || relicProof.storedCount !== 1
    ) {
      throw new Error(`Memory relic lifecycle failed: ${JSON.stringify(relicProof)}`);
    }
'''
if qa.count(old) != 1:
    raise SystemExit('browser relic proof block not found')
qa_path.write_text(qa.replace(old, new, 1))
