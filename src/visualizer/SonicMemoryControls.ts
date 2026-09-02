import { TEMPORAL_MEDIA, TEMPORAL_MEMORY_EVENT } from './TemporalMemory';
import type {
  TemporalMediumId,
  TemporalMemoryController,
} from './TemporalMemory';

let mounted = false;

function editable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase()) || target.isContentEditable;
}

/** Compact performance HUD for the center-now / edge-past temporal sculpture. */
export function mountSonicMemoryControls(memory: TemporalMemoryController): void {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;

  const root = document.createElement('div');
  root.id = 'sonic-memory-control';
  root.innerHTML = `
    <button class="sm-pill" type="button" aria-expanded="false" aria-controls="sm-panel" aria-label="Open Sonic Memory controls">
      <i aria-hidden="true"></i><span><b>SONIC MEMORY</b><small>center now · edge past</small></span><em aria-live="polite">LIVE</em>
    </button>
    <section class="sm-panel" id="sm-panel" aria-label="Sonic Memory controls" hidden>
      <header><span><b>Sound becomes space and memory</b><small>Older spectral moments live farther from the emitter.</small></span><button data-close aria-label="Close Sonic Memory controls">×</button></header>
      <div class="sm-actions">
        <button data-action="enabled"></button><button data-action="freeze"></button>
        <button data-action="immersive">Immersive view</button><button data-action="capture">Capture frame</button>
      </div>
      <label>Memory <output data-value="memory"></output><input data-control="memory" aria-label="Memory duration" type="range" min="1" max="10" step="0.25"></label>
      <label>Time lens <output data-value="lookback"></output><input data-control="lookback" aria-label="Look backward through stored sound" type="range" min="0" max="10" step="0.1"></label>
      <label>Propagation <output data-value="propagation"></output><input data-control="propagation" aria-label="Propagation speed" type="range" min="0.35" max="2.5" step="0.05"></label>
      <label>Presence <output data-value="gain"></output><input data-control="gain" aria-label="Sonic Memory presence" type="range" min="0.35" max="2.2" step="0.05"></label>
      <label>Spatial twist <output data-value="warp"></output><input data-control="warp" aria-label="Spatial twist" type="range" min="0" max="2.5" step="0.05"></label>
      <div class="sm-row"><select data-control="medium" aria-label="Propagation medium"></select><button data-action="age"></button></div>
      <footer><span data-value="medium"></span><button data-action="reset">Reset</button></footer>
    </section>
  `;
  document.body.appendChild(root);

  const style = document.createElement('style');
  style.id = 'sonic-memory-styles';
  style.textContent = `
    #sonic-memory-control{position:fixed;z-index:86;left:50%;bottom:86px;transform:translateX(-50%);font:11px Inter,system-ui;color:#e2e8f0;pointer-events:none;filter:drop-shadow(0 18px 40px #0008)}
    #sonic-memory-control *{box-sizing:border-box}#sonic-memory-control button,#sonic-memory-control input,#sonic-memory-control select{font:inherit}
    #sonic-memory-control .sm-pill,#sonic-memory-control .sm-panel{pointer-events:auto;border:1px solid #94a3b833;background:linear-gradient(145deg,#08101eef,#080c18d9);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);box-shadow:inset 0 1px #fff1,0 18px 55px #0006}
    #sonic-memory-control .sm-pill{height:46px;min-width:226px;padding:7px 10px;border-radius:99px;display:flex;align-items:center;gap:10px;color:#f8fafc;cursor:pointer;transition:.2s ease}
    #sonic-memory-control .sm-pill:hover{border-color:#67e8f980!important;transform:translateY(-1px)}
    #sonic-memory-control .sm-pill>i{width:29px;height:29px;border-radius:50%;background:radial-gradient(circle,#fff 0 5%,#60a5fa 7% 10%,#22d3ee22 30%,transparent 64%);box-shadow:0 0 18px #22d3ee55;animation:smPulse 2.4s ease-in-out infinite}
    #sonic-memory-control .sm-pill>span{display:flex;flex-direction:column;text-align:left}#sonic-memory-control .sm-pill b{font-size:9px;letter-spacing:.16em}#sonic-memory-control .sm-pill small{margin-top:3px;color:#94a3b8;font-size:9px}
    #sonic-memory-control .sm-pill em{margin-left:auto;padding:4px 7px;border:1px solid #22d3ee44;border-radius:99px;color:#67e8f9;font-size:8px;font-style:normal;font-weight:800;letter-spacing:.1em}
    #sonic-memory-control .sm-panel{position:absolute;left:50%;bottom:56px;width:min(326px,calc(100vw - 22px));transform:translateX(-50%);padding:15px;border-radius:22px;max-height:min(650px,calc(100vh - 160px));overflow:auto}
    #sonic-memory-control .sm-panel header{display:flex;gap:10px;margin-bottom:12px}#sonic-memory-control .sm-panel header span{display:flex;flex-direction:column;gap:4px}#sonic-memory-control .sm-panel header b{font-size:12px}#sonic-memory-control .sm-panel header small{color:#94a3b8;line-height:1.35}
    #sonic-memory-control .sm-panel header button{margin-left:auto;border:0;background:#fff1;color:#94a3b8;border-radius:8px;width:25px;height:25px;cursor:pointer}
    #sonic-memory-control .sm-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:9px}
    #sonic-memory-control .sm-actions button,#sonic-memory-control .sm-row button{height:33px;border:1px solid #94a3b829;border-radius:10px;background:#0f172acc;color:#cbd5e1;font-weight:650;cursor:pointer}
    #sonic-memory-control .sm-actions button:hover,#sonic-memory-control .sm-row button:hover{border-color:#67e8f966;color:#fff}
    #sonic-memory-control .sm-actions button[aria-pressed=true],#sonic-memory-control .sm-row button[aria-pressed=true]{border-color:#67e8f966;background:linear-gradient(135deg,#06b6d433,#6366f133);color:#cffafe}
    #sonic-memory-control .sm-panel label{display:grid;grid-template-columns:1fr auto;gap:6px;padding:7px 0;color:#cbd5e1}#sonic-memory-control .sm-panel output{color:#67e8f9;font:9px ui-monospace}#sonic-memory-control .sm-panel input{grid-column:1/3;width:100%;accent-color:#22d3ee}
    #sonic-memory-control .sm-row{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px}#sonic-memory-control .sm-row select{height:40px;border:1px solid #94a3b829;border-radius:10px;padding:0 9px;background:#0f172acc;color:#e2e8f0}#sonic-memory-control .sm-row button{height:40px}
    #sonic-memory-control .sm-panel footer{display:flex;justify-content:space-between;gap:8px;margin-top:11px;padding-top:10px;border-top:1px solid #94a3b81f;color:#64748b;font-size:8px}#sonic-memory-control .sm-panel footer button{border:0;background:none;color:#94a3b8;cursor:pointer}
    body.soundform-immersive #header-root,body.soundform-immersive #left-sidebar-root,body.soundform-immersive #right-sidebar-root,body.soundform-immersive #bottom-transport-root,body.soundform-immersive #center-prompt-root{opacity:0!important;pointer-events:none!important;transition:opacity .24s ease}body.soundform-immersive #app{padding:0!important}body.soundform-immersive #sonic-memory-control{bottom:24px}
    #sonic-memory-control.sm-frozen .sm-pill em{color:#f9a8d4;border-color:#f472b644}#sonic-memory-control.sm-off .sm-pill em{color:#94a3b8;border-color:#94a3b833}
    @keyframes smPulse{50%{transform:scale(1.08);box-shadow:0 0 25px #a78bfa66}}
    @media(max-width:760px){#sonic-memory-control{bottom:74px}#sonic-memory-control .sm-pill{min-width:190px}#sonic-memory-control .sm-pill small{display:none}#sonic-memory-control .sm-panel{bottom:53px}}
    @media(prefers-reduced-motion:reduce){#sonic-memory-control .sm-pill>i{animation:none}}
  `;
  document.head.appendChild(style);

  const pill = root.querySelector<HTMLButtonElement>('.sm-pill')!;
  const panel = root.querySelector<HTMLElement>('.sm-panel')!;
  const setOpen = (open: boolean): void => {
    pill.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  };
  pill.onclick = () => setOpen(pill.getAttribute('aria-expanded') !== 'true');
  root.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => setOpen(false);

  let immersive = false;
  let contextVisible = true;
  const setImmersive = (enabled: boolean): void => {
    immersive = enabled;
    document.body.classList.toggle('soundform-immersive', immersive);
  };
  const syncVisibility = (): void => {
    root.style.display = contextVisible ? '' : 'none';
    if (!contextVisible) {
      setOpen(false);
      if (immersive) setImmersive(false);
    }
  };
  const update = (): void => {
    const settings = memory.getSettings();
    root.classList.toggle('sm-frozen', settings.frozen);
    root.classList.toggle('sm-off', !settings.enabled);
    root.querySelector('em')!.textContent = !settings.enabled ? 'OFF' : settings.frozen ? 'FROZEN' : 'LIVE';
    const button = (action: string) => root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
    button('enabled').textContent = settings.enabled ? 'Memory on' : 'Memory off';
    button('enabled').setAttribute('aria-pressed', String(settings.enabled));
    button('freeze').textContent = settings.frozen ? 'Resume time' : 'Freeze sculpture';
    button('freeze').setAttribute('aria-pressed', String(settings.frozen));
    button('age').textContent = settings.colorByAge ? 'Age color on' : 'Spectrum color';
    button('age').setAttribute('aria-pressed', String(settings.colorByAge));
    button('immersive').textContent = immersive ? 'Exit immersive' : 'Immersive view';
    button('immersive').setAttribute('aria-pressed', String(immersive));

    const values: Record<string, number> = {
      memory: settings.memorySeconds,
      lookback: settings.lookbackSeconds,
      propagation: settings.propagation,
      gain: settings.gain,
      warp: settings.warp,
    };
    for (const [name, value] of Object.entries(values)) {
      const input = root.querySelector<HTMLInputElement>(`[data-control="${name}"]`)!;
      if (document.activeElement !== input) input.value = String(value);
      const output = root.querySelector<HTMLOutputElement>(`[data-value="${name}"]`)!;
      if (name === 'memory') output.value = `${value.toFixed(1)} s`;
      else if (name === 'lookback') output.value = value < 0.05 ? 'NOW' : `−${value.toFixed(1)} s`;
      else output.value = `${value.toFixed(2)}×`;
    }

    const medium = TEMPORAL_MEDIA[settings.medium];
    const select = root.querySelector<HTMLSelectElement>('[data-control="medium"]')!;
    if (document.activeElement !== select) select.value = settings.medium;
    root.querySelector<HTMLElement>('[data-value="medium"]')!.textContent = `${medium.name} · ${medium.speedMs.toLocaleString()} m/s · M memory · F freeze · I immersive`;
    syncVisibility();
  };

  const mediumSelect = root.querySelector<HTMLSelectElement>('[data-control="medium"]')!;
  mediumSelect.innerHTML = Object.values(TEMPORAL_MEDIA).map(item => `<option value="${item.id}">${item.name}</option>`).join('');
  root.querySelector<HTMLButtonElement>('[data-action="enabled"]')!.onclick = () => memory.toggleEnabled();
  root.querySelector<HTMLButtonElement>('[data-action="freeze"]')!.onclick = () => memory.toggleFrozen();
  root.querySelector<HTMLButtonElement>('[data-action="age"]')!.onclick = () => memory.setColorByAge(!memory.getSettings().colorByAge);
  root.querySelector<HTMLButtonElement>('[data-action="reset"]')!.onclick = () => memory.reset();
  mediumSelect.onchange = () => memory.setMedium(mediumSelect.value as TemporalMediumId);

  const bind = (name: string, setter: (value: number) => void): void => {
    root.querySelector<HTMLInputElement>(`[data-control="${name}"]`)!.oninput = event => setter(Number((event.currentTarget as HTMLInputElement).value));
  };
  bind('memory', value => memory.setMemorySeconds(value));
  bind('lookback', value => memory.setLookbackSeconds(value));
  bind('propagation', value => memory.setPropagation(value));
  bind('gain', value => memory.setGain(value));
  bind('warp', value => memory.setWarp(value));

  root.querySelector<HTMLButtonElement>('[data-action="immersive"]')!.onclick = () => {
    setImmersive(!immersive);
    update();
  };
  root.querySelector<HTMLButtonElement>('[data-action="capture"]')!.onclick = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#canvas-container canvas');
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `soundform-sonic-memory-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.warn('Sonic Memory frame capture failed', error);
    }
  };

  window.addEventListener(TEMPORAL_MEMORY_EVENT, update);
  window.addEventListener('visual-style-changed', event => {
    const mode = (event as CustomEvent<{ style?: string }>).detail?.style;
    contextVisible = mode === 'cymatics' || mode === 'cymatics-2d';
    syncVisibility();
  });
  window.addEventListener('keydown', event => {
    if (editable(event.target) || !contextVisible) return;
    const key = event.key.toLowerCase();
    if (key === 'm') memory.toggleEnabled();
    else if (key === 'f') memory.toggleFrozen();
    else if (key === 'i') root.querySelector<HTMLButtonElement>('[data-action="immersive"]')!.click();
    else if (key === 'escape') {
      if (immersive) {
        setImmersive(false);
        update();
      } else {
        setOpen(false);
      }
    }
  });
  update();
}
