from pathlib import Path

path = Path('scripts/fix-anamnesis-review.py')
source = path.read_text()
old = '''    (
        "    this.model.reset(meta);\\n    this.latestLivePoints = [];\\n",
        "    this.model.reset(meta);\\n    this.savedRelicId = null;\\n    this.lastSavedFingerprint = '';\\n    this.latestLivePoints = [];\\n",
    ),
'''
new = '''    (
        "  public clearLiveMemory(): void {\\n    const meta = this.model.getMeta();\\n    this.model.reset(meta);\\n    this.latestLivePoints = [];\\n",
        "  public clearLiveMemory(): void {\\n    const meta = this.model.getMeta();\\n    this.model.reset(meta);\\n    this.savedRelicId = null;\\n    this.lastSavedFingerprint = '';\\n    this.latestLivePoints = [];\\n",
    ),
'''
if source.count(old) != 1:
    raise SystemExit('ambiguous reset replacement was not found exactly once')
path.write_text(source.replace(old, new, 1))
