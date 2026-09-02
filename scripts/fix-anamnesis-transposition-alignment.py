from pathlib import Path

path = Path('src/visualizer/AnamnesisModel.ts')
source = path.read_text()
old = '''    const shift = chromaAlignment.transposition < 0
      ? chromaAlignment.transposition + 12
      : chromaAlignment.transposition;
'''
new = '''    // The public interval reads from the earlier phrase to its return. Texture
    // alignment needs the inverse rotation because each current pitch class
    // looks up the source bin in the previous phrase.
    const shift = ((12 - chromaAlignment.transposition) % 12 + 12) % 12;
'''
if source.count(old) != 1:
    raise SystemExit('sequence alignment block not found exactly once')
path.write_text(source.replace(old, new, 1))
