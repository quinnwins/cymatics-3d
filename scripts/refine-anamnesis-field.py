from pathlib import Path

field_path = Path('src/visualizer/AnamnesisField.ts')
source = field_path.read_text()

replacements = [
    (
        "uniform float uPointScale;\nuniform float uCurrentIndex;",
        "uniform float uPointScale;\nuniform float uLayer;\nuniform float uCurrentIndex;",
    ),
    (
        "  float perspective = clamp(22.0 / max(2.0, -mvPosition.z), 0.55, 3.0);\n  float pointSize = 1.1\n    + aEnergy * 2.4\n    + aNovelty * 4.0\n    + aEcho * 2.8\n    + familyPulse * 2.4\n    + current * 5.5\n    + hovered * 6.5;\n  gl_PointSize = clamp(pointSize * perspective * uPointScale, 1.1, 14.0);",
        "  float perspective = clamp(22.0 / max(2.0, -mvPosition.z), 0.55, 3.0);\n  float pointSize = 1.65\n    + aEnergy * 3.1\n    + aNovelty * 4.8\n    + aEcho * 3.5\n    + familyPulse * 3.0\n    + current * 6.4\n    + hovered * 7.2;\n  float layerScale = mix(1.0, 2.15, uLayer);\n  gl_PointSize = clamp(\n    pointSize * perspective * uPointScale * layerScale,\n    mix(1.6, 4.2, uLayer),\n    mix(18.0, 34.0, uLayer)\n  );",
    ),
    (
        "  color = mix(color, uCoreGlow, current * 0.56);\n  color = mix(color, vec3(1.0), current * 0.58 + hovered * 0.72 + familyPulse * 0.2);\n\n  vColor = color;\n  vCore = max(max(current, hovered), familyPulse * 0.75);\n  vAlpha = uOpacity * (0.28 + aEnergy * 0.42 + aNovelty * 0.28 + aEcho * 0.3 + vCore * 0.45);",
        "  color = mix(color, uCoreGlow, current * 0.56 + uLayer * 0.22);\n  color = mix(color, vec3(1.0), current * 0.58 + hovered * 0.72 + familyPulse * 0.2 + uLayer * 0.08);\n\n  vColor = color;\n  vCore = max(max(current, hovered), familyPulse * 0.75);\n  float corePresence = 0.42 + aEnergy * 0.46 + aNovelty * 0.34 + aEcho * 0.36 + vCore * 0.48;\n  float auraPresence = 0.24 + aEnergy * 0.24 + aNovelty * 0.18 + aEcho * 0.26 + vCore * 0.26;\n  vAlpha = uOpacity * mix(corePresence, auraPresence, uLayer);",
    ),
    (
        "const POINT_FRAGMENT_SHADER = `\nprecision highp float;\n\nvarying vec3 vColor;",
        "const POINT_FRAGMENT_SHADER = `\nprecision highp float;\n\nuniform float uLayer;\n\nvarying vec3 vColor;",
    ),
    (
        "  float core = exp(-radius * radius * 7.5);\n  float halo = exp(-radius * radius * 2.0) * 0.42;\n  float alpha = clamp(vAlpha * (core + halo * (0.5 + vCore)), 0.0, 0.92);\n  if (alpha < 0.003) discard;\n  gl_FragColor = vec4(vColor * (0.92 + core * 1.25 + vCore * 0.55), alpha);",
        "  float core = exp(-radius * radius * 7.2);\n  float halo = exp(-radius * radius * 1.75);\n  float coreProfile = core + halo * (0.42 + vCore * 0.32);\n  float auraProfile = halo * (0.72 + core * 0.28);\n  float profile = mix(coreProfile, auraProfile, uLayer);\n  float alpha = clamp(vAlpha * profile, 0.0, mix(0.96, 0.46, uLayer));\n  if (alpha < 0.002) discard;\n  float radiance = mix(1.05 + core * 1.42 + vCore * 0.62, 0.82 + halo * 0.72 + vCore * 0.24, uLayer);\n  gl_FragColor = vec4(vColor * radiance, alpha);",
    ),
    (
        "  public readonly group = new THREE.Group();\n  public readonly points: THREE.Points;",
        "  public readonly group = new THREE.Group();\n  public readonly aura: THREE.Points;\n  public readonly points: THREE.Points;",
    ),
    (
        "  private readonly threadGeometry = new THREE.BufferGeometry();\n  private readonly pointMaterial: THREE.ShaderMaterial;",
        "  private readonly threadGeometry = new THREE.BufferGeometry();\n  private readonly auraMaterial: THREE.ShaderMaterial;\n  private readonly pointMaterial: THREE.ShaderMaterial;",
    ),
    (
        "        uPointScale: { value: 1 },\n        uCurrentIndex: { value: -1 },",
        "        uPointScale: { value: 1 },\n        uLayer: { value: 0 },\n        uCurrentIndex: { value: -1 },",
    ),
    (
        "    this.points = new THREE.Points(this.pointGeometry, this.pointMaterial);\n    this.points.frustumCulled = false;\n    this.points.renderOrder = 6;\n    this.group.add(this.points);",
        "    this.auraMaterial = this.pointMaterial.clone();\n    this.auraMaterial.uniforms.uLayer.value = 1;\n    this.auraMaterial.depthTest = false;\n    this.aura = new THREE.Points(this.pointGeometry, this.auraMaterial);\n    this.aura.frustumCulled = false;\n    this.aura.renderOrder = 3;\n    this.group.add(this.aura);\n\n    this.points = new THREE.Points(this.pointGeometry, this.pointMaterial);\n    this.points.frustumCulled = false;\n    this.points.renderOrder = 6;\n    this.group.add(this.points);",
    ),
    (
        "      opacity: 0,\n      depthWrite: false,\n      blending: THREE.AdditiveBlending,\n    });\n    this.chronology",
        "      opacity: 0,\n      depthWrite: false,\n      depthTest: false,\n      blending: THREE.AdditiveBlending,\n    });\n    this.chronology",
    ),
    (
        "      transparent: true,\n      depthWrite: false,\n      depthTest: true,\n      blending: THREE.AdditiveBlending,\n    });\n    this.threads",
        "      transparent: true,\n      depthWrite: false,\n      depthTest: false,\n      blending: THREE.AdditiveBlending,\n    });\n    this.threads",
    ),
    (
        "    const threadCount = Math.min(MAX_THREADS, threads.length);\n    this.renderedThreads = threadCount;\n    for (let index = 0; index < threadCount; index += 1) {\n      const thread = threads[index];\n      const from = points[thread.from];\n      const to = points[thread.to];\n      if (!from || !to) continue;\n      writePoint(this.threadPositions, index * 2, from.position);\n      writePoint(this.threadPositions, index * 2 + 1, to.position);\n      for (let endpoint = 0; endpoint < 2; endpoint += 1) {\n        const attributeIndex = index * 2 + endpoint;\n        this.threadStrength[attributeIndex] = thread.similarity;\n        this.threadFamily[attributeIndex] = thread.familyId;\n        this.threadTransposition[attributeIndex] = thread.transposition;\n        this.threadPhase[attributeIndex] = (index * 0.61803398875) % 1;\n      }\n    }\n    this.threadGeometry.setDrawRange(0, threadCount * 2);",
        "    const candidateThreadCount = Math.min(MAX_THREADS, threads.length);\n    let writtenThreads = 0;\n    for (let index = 0; index < candidateThreadCount; index += 1) {\n      const thread = threads[index];\n      const from = points[thread.from];\n      const to = points[thread.to];\n      if (!from || !to) continue;\n      writePoint(this.threadPositions, writtenThreads * 2, from.position);\n      writePoint(this.threadPositions, writtenThreads * 2 + 1, to.position);\n      for (let endpoint = 0; endpoint < 2; endpoint += 1) {\n        const attributeIndex = writtenThreads * 2 + endpoint;\n        this.threadStrength[attributeIndex] = thread.similarity;\n        this.threadFamily[attributeIndex] = thread.familyId;\n        this.threadTransposition[attributeIndex] = thread.transposition;\n        this.threadPhase[attributeIndex] = (writtenThreads * 0.61803398875) % 1;\n      }\n      writtenThreads += 1;\n    }\n    this.renderedThreads = writtenThreads;\n    this.threadGeometry.setDrawRange(0, writtenThreads * 2);",
    ),
    (
        "    this.pointMaterial.uniforms.uCurrentIndex.value = this.currentPointIndex;",
        "    this.pointMaterial.uniforms.uCurrentIndex.value = this.currentPointIndex;\n    this.auraMaterial.uniforms.uCurrentIndex.value = this.currentPointIndex;",
    ),
    (
        "      this.pointMaterial.uniforms[name].value.copy(value);\n      this.threadMaterial.uniforms[name].value.copy(value);",
        "      this.pointMaterial.uniforms[name].value.copy(value);\n      this.auraMaterial.uniforms[name].value.copy(value);\n      this.threadMaterial.uniforms[name].value.copy(value);",
    ),
    (
        "    this.pointMaterial.uniforms.uCoreGlow.value.set(\n      palette.coreGlow.r,\n      palette.coreGlow.g,\n      palette.coreGlow.b\n    );\n    this.pointMaterial.uniforms.uAccent.value.set(\n      palette.accent.r,\n      palette.accent.g,\n      palette.accent.b\n    );",
        "    for (const material of [this.pointMaterial, this.auraMaterial]) {\n      material.uniforms.uCoreGlow.value.set(\n        palette.coreGlow.r,\n        palette.coreGlow.g,\n        palette.coreGlow.b\n      );\n      material.uniforms.uAccent.value.set(\n        palette.accent.r,\n        palette.accent.g,\n        palette.accent.b\n      );\n    }",
    ),
    (
        "    this.pointMaterial.uniforms.uTime.value = time;\n    this.pointMaterial.uniforms.uOpacity.value = pointOpacity;\n    this.pointMaterial.uniforms.uPointScale.value = Math.max(0.72, Math.min(1.35, viewportHeight / 900));\n    this.pointMaterial.uniforms.uReturnFamily.value = this.returnFamily;\n    this.pointMaterial.uniforms.uReturnPulse.value = this.returnPulse;\n    this.pointMaterial.uniforms.uHoverIndex.value = this.hoverIndex;",
        "    const pointScale = Math.max(0.72, Math.min(1.35, viewportHeight / 900));\n    for (const material of [this.pointMaterial, this.auraMaterial]) {\n      material.uniforms.uTime.value = time;\n      material.uniforms.uReturnFamily.value = this.returnFamily;\n      material.uniforms.uReturnPulse.value = this.returnPulse;\n      material.uniforms.uHoverIndex.value = this.hoverIndex;\n    }\n    this.pointMaterial.uniforms.uOpacity.value = pointOpacity;\n    this.pointMaterial.uniforms.uPointScale.value = pointScale;\n    this.auraMaterial.uniforms.uOpacity.value = pointOpacity * (this.expanded ? 0.68 : 0.32);\n    this.auraMaterial.uniforms.uPointScale.value = pointScale;",
    ),
    (
        "    this.threadMaterial.uniforms.uOpacity.value = this.opacity * (this.expanded ? 0.9 : 0.36);",
        "    this.threadMaterial.uniforms.uOpacity.value = this.opacity * (this.expanded ? 1.2 : 0.44);",
    ),
    (
        "    this.pathMaterial.opacity = this.opacity * (this.expanded ? 0.18 : 0.055);",
        "    this.pathMaterial.opacity = this.opacity * (this.expanded ? 0.46 : 0.10);",
    ),
    (
        "    this.pointMaterial.dispose();\n    this.pathMaterial.dispose();",
        "    this.auraMaterial.dispose();\n    this.pointMaterial.dispose();\n    this.pathMaterial.dispose();",
    ),
]

for old, new in replacements:
    if source.count(old) != 1:
        raise SystemExit(f'field replacement target not found exactly once: {old[:90]!r}')
    source = source.replace(old, new, 1)

field_path.write_text(source)

test_path = Path('src/visualizer/AnamnesisField.test.ts')
test = test_path.read_text()

old_expectations = "    expect(field.points.geometry.drawRange.count).toBe(3);\n    expect(field.threads.geometry.drawRange.count).toBe(2);"
new_expectations = "    expect(field.points.geometry.drawRange.count).toBe(3);\n    expect(field.aura.geometry).toBe(field.points.geometry);\n    expect(field.threads.geometry.drawRange.count).toBe(2);"
if test.count(old_expectations) != 1:
    raise SystemExit('field aura expectation insertion point missing')
test = test.replace(old_expectations, new_expectations, 1)

invalid_thread_test = '''
  it('compacts invalid echo references instead of drawing stale thread segments', () => {
    const field = new AnamnesisField(ColorPalettes.getPalette('cosmic-nebula'));
    const points = [
      point(0, [4, 0, 0], 0),
      point(1, [0, 0.5, 4], 0),
    ];
    const threads: EchoThread[] = [
      {
        id: 0,
        from: 99,
        to: 0,
        similarity: 0.99,
        harmonicSimilarity: 0.99,
        timbralSimilarity: 0.99,
        transposition: 0,
        familyId: 0,
        timeGapSeconds: 8,
      },
      {
        id: 1,
        from: 1,
        to: 0,
        similarity: 0.93,
        harmonicSimilarity: 0.94,
        timbralSimilarity: 0.9,
        transposition: 2,
        familyId: 0,
        timeGapSeconds: 4,
      },
    ];

    field.setData(points, threads);

    expect(field.getRenderedThreadCount()).toBe(1);
    expect(field.threads.geometry.drawRange.count).toBe(2);
    const positions = field.threads.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect([positions.getX(0), positions.getY(0), positions.getZ(0)]).toEqual(points[1].position);
    expect([positions.getX(1), positions.getY(1), positions.getZ(1)]).toEqual(points[0].position);

    field.dispose();
  });
'''
needle = "\n  it('accepts palette changes and empty data without reallocating its core geometry', () => {"
if test.count(needle) != 1:
    raise SystemExit('invalid-thread test insertion point missing')
test = test.replace(needle, invalid_thread_test + needle, 1)
test_path.write_text(test)
