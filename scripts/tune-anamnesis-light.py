from pathlib import Path

path = Path('src/visualizer/AnamnesisField.ts')
source = path.read_text()
replacements = [
    ('float layerScale = mix(1.0, 2.15, uLayer);', 'float layerScale = mix(1.0, 2.35, uLayer);'),
    ('mix(18.0, 34.0, uLayer)', 'mix(18.0, 38.0, uLayer)'),
    ('float auraProfile = halo * (0.72 + core * 0.28);', 'float auraProfile = halo * (0.82 + core * 0.36);'),
    ('mix(0.96, 0.46, uLayer)', 'mix(0.96, 0.52, uLayer)'),
    ('0.82 + halo * 0.72 + vCore * 0.24', '0.92 + halo * 0.88 + vCore * 0.28'),
    ('pointOpacity * (this.expanded ? 0.68 : 0.32)', 'pointOpacity * (this.expanded ? 0.78 : 0.36)'),
    ('this.expanded ? 0.46 : 0.10', 'this.expanded ? 0.52 : 0.11'),
]
for old, new in replacements:
    if source.count(old) != 1:
        raise SystemExit(f'light tuning target missing or ambiguous: {old!r}')
    source = source.replace(old, new, 1)
path.write_text(source)
