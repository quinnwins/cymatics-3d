from pathlib import Path

field_path = Path('src/visualizer/AnamnesisField.ts')
field_source = field_path.read_text()
field_replacements = [
    ('float layerScale = mix(1.0, 2.15, uLayer);', 'float layerScale = mix(1.0, 2.35, uLayer);'),
    ('mix(18.0, 34.0, uLayer)', 'mix(18.0, 38.0, uLayer)'),
    ('float auraProfile = halo * (0.72 + core * 0.28);', 'float auraProfile = halo * (0.82 + core * 0.36);'),
    ('mix(0.96, 0.46, uLayer)', 'mix(0.96, 0.52, uLayer)'),
    ('0.82 + halo * 0.72 + vCore * 0.24', '0.92 + halo * 0.88 + vCore * 0.28'),
    ('pointOpacity * (this.expanded ? 0.68 : 0.32)', 'pointOpacity * (this.expanded ? 0.78 : 0.36)'),
    ('this.expanded ? 0.46 : 0.10', 'this.expanded ? 0.52 : 0.11'),
]
for old, new in field_replacements:
    if field_source.count(old) != 1:
        raise SystemExit(f'light tuning target missing or ambiguous: {old!r}')
    field_source = field_source.replace(old, new, 1)
field_path.write_text(field_source)

proof_path = Path('scripts/verify-anamnesis.mjs')
proof_source = proof_path.read_text()
gate = (
    '    if (visualProof.outerLit < 900 || visualProof.spanX < 340 || visualProof.spanY < 170) {\n'
    '      throw new Error(`Anamnesis is technically present but not visually legible: ${JSON.stringify(visualProof)}`);\n'
    '    }\n'
)
proof_before_gate = (
    '    // Always preserve visual proof, including on a failed legibility gate, so\n'
    '    // artistic regressions remain inspectable instead of collapsing to numbers.\n'
    '    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });\n\n'
    + gate
)
if proof_source.count(gate) != 1:
    raise SystemExit('visual gate insertion point not found exactly once')
proof_source = proof_source.replace(gate, proof_before_gate, 1)

later_screenshot = (
    '    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });\n'
    "    await page.keyboard.press('Escape');\n"
)
if proof_source.count(later_screenshot) != 1:
    raise SystemExit('later screenshot block not found exactly once')
proof_source = proof_source.replace(
    later_screenshot,
    "    await page.keyboard.press('Escape');\n",
    1,
)
proof_path.write_text(proof_source)
