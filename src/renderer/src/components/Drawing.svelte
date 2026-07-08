<script>
  import { createEventDispatcher } from 'svelte'

  export let active = false
  export let shapes = []
  export let onExit = () => {}

  const dispatch = createEventDispatcher()

  let tool = 'pen' // pen | line | rect | ellipse | arrow | eraser
  let color = '#e5484d'
  let width = 4
  let svg
  let current = null
  let start = null

  const WIDTHS = [2, 4, 8]

  function pos(e) {
    const r = svg.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function down(e) {
    if (!active) return
    e.preventDefault()
    svg.setPointerCapture(e.pointerId)
    const p = pos(e)
    start = p
    if (tool === 'eraser') { eraseAt(p.x, p.y); return }
    if (tool === 'pen') current = { type: 'path', points: [p], color, width }
    else if (tool === 'rect') current = { type: 'rect', x: p.x, y: p.y, w: 0, h: 0, color, width }
    else if (tool === 'ellipse') current = { type: 'ellipse', cx: p.x, cy: p.y, rx: 0, ry: 0, color, width }
    else current = { type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color, width } // line | arrow
  }

  function move(e) {
    if (!active || !start) return
    const p = pos(e)
    if (tool === 'eraser') { eraseAt(p.x, p.y); return }
    if (!current) return
    if (current.type === 'path') current.points = [...current.points, p]
    else if (current.type === 'rect') { current.x = Math.min(start.x, p.x); current.y = Math.min(start.y, p.y); current.w = Math.abs(p.x - start.x); current.h = Math.abs(p.y - start.y) }
    else if (current.type === 'ellipse') { current.cx = (start.x + p.x) / 2; current.cy = (start.y + p.y) / 2; current.rx = Math.abs(p.x - start.x) / 2; current.ry = Math.abs(p.y - start.y) / 2 }
    else { current.x2 = p.x; current.y2 = p.y }
    current = current
  }

  function up() {
    start = null
    if (current) { shapes = [...shapes, current]; current = null; dispatch('change') }
  }

  function bbox(s) {
    if (s.type === 'path') { const xs = s.points.map(p => p.x), ys = s.points.map(p => p.y); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
    if (s.type === 'rect') return [s.x, s.y, s.x + s.w, s.y + s.h]
    if (s.type === 'ellipse') return [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry]
    return [Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.max(s.x1, s.x2), Math.max(s.y1, s.y2)]
  }
  function eraseAt(x, y) {
    const pad = 10
    const next = shapes.filter(s => { const [x1, y1, x2, y2] = bbox(s); return !(x >= x1 - pad && x <= x2 + pad && y >= y1 - pad && y <= y2 + pad) })
    if (next.length !== shapes.length) { shapes = next; dispatch('change') }
  }

  const pathD = (s) => 'M ' + s.points.map(p => `${p.x} ${p.y}`).join(' L ')
  function arrowHead(s) {
    const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1), L = 10 + s.width * 1.6, w = 0.5
    return `${s.x2},${s.y2} ${s.x2 - L * Math.cos(a - w)},${s.y2 - L * Math.sin(a - w)} ${s.x2 - L * Math.cos(a + w)},${s.y2 - L * Math.sin(a + w)}`
  }

  function undo() { if (shapes.length) { shapes = shapes.slice(0, -1); dispatch('change') } }
  function clearAll() { if (shapes.length) { shapes = []; dispatch('change') } }
</script>

<svg class="draw-layer" class:active bind:this={svg}
  on:pointerdown={down} on:pointermove={move} on:pointerup={up}>
  {#each [...shapes, ...(current ? [current] : [])] as s}
    {#if s.type === 'path'}
      <path d={pathD(s)} stroke={s.color} stroke-width={s.width} fill="none" stroke-linecap="round" stroke-linejoin="round" />
    {:else if s.type === 'line'}
      <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} stroke-width={s.width} stroke-linecap="round" />
    {:else if s.type === 'arrow'}
      <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} stroke-width={s.width} stroke-linecap="round" />
      <polygon points={arrowHead(s)} fill={s.color} />
    {:else if s.type === 'rect'}
      <rect x={s.x} y={s.y} width={s.w} height={s.h} stroke={s.color} stroke-width={s.width} fill="none" />
    {:else if s.type === 'ellipse'}
      <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} stroke={s.color} stroke-width={s.width} fill="none" />
    {/if}
  {/each}
</svg>

{#if active}
  <div class="drawbar">
    <button class:on={tool === 'pen'} on:click={() => tool = 'pen'} title="Freehand"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg></button>
    <button class:on={tool === 'line'} on:click={() => tool = 'line'} title="Line"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="19" x2="19" y2="5"/></svg></button>
    <button class:on={tool === 'arrow'} on:click={() => tool = 'arrow'} title="Arrow"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="10 5 19 5 19 14"/></svg></button>
    <button class:on={tool === 'rect'} on:click={() => tool = 'rect'} title="Rectangle"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/></svg></button>
    <button class:on={tool === 'ellipse'} on:click={() => tool = 'ellipse'} title="Ellipse"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="9" ry="6"/></svg></button>
    <button class:on={tool === 'eraser'} on:click={() => tool = 'eraser'} title="Eraser"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16a2 2 0 0 1 0-3l9-9a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8"/></svg></button>
    <span class="dsep"></span>
    <label class="dcolor" title="Colour"><span style="background:{color}"></span><input type="color" bind:value={color} /></label>
    {#each WIDTHS as w}
      <button class="dwidth" class:on={width === w} on:click={() => width = w} title="{w}px"><span style="width:{w + 4}px;height:{w + 4}px;background:{width === w ? 'var(--bg)' : 'var(--text)'}"></span></button>
    {/each}
    <span class="dsep"></span>
    <button on:click={undo} title="Undo last">UNDO</button>
    <button on:click={clearAll} title="Clear all">CLEAR</button>
    <button class="ddone" on:click={onExit} title="Exit drawing">DONE</button>
  </div>
{/if}

<style>
  .draw-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
  .draw-layer.active { pointer-events: auto; cursor: crosshair; }

  .drawbar {
    position: fixed; z-index: 360; top: 6.6rem; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 0.25rem; padding: 0.35rem 0.5rem;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 999px;
    box-shadow: 0 12px 34px rgba(0,0,0,0.4);
  }
  .drawbar button {
    display: inline-flex; align-items: center; justify-content: center; min-width: 2rem; height: 2rem;
    background: transparent; color: var(--text); border: 1px solid transparent; border-radius: 999px;
    cursor: pointer; font-family: var(--font-ui); font-size: 0.72rem; letter-spacing: 0.05em; padding: 0 0.55rem;
  }
  .drawbar button:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .drawbar button.on { background: var(--accent); color: var(--bg); }
  .ddone { background: var(--accent) !important; color: var(--bg) !important; font-weight: 700; }
  .dsep { width: 1px; height: 20px; background: var(--rule); margin: 0 0.2rem; }
  .dcolor { position: relative; width: 2rem; height: 2rem; display: grid; place-items: center; cursor: pointer; }
  .dcolor span { width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--rule); }
  .dcolor input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .dwidth span { border-radius: 50%; display: block; }
</style>
