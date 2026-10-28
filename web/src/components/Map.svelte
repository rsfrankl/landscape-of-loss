<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import {
    easeCubicInOut,
    geoConicEqualArea,
    geoPath,
    pointer,
    select,
    timer,
    zoom,
    zoomIdentity,
    type Timer,
    type ZoomBehavior,
    type ZoomTransform,
  } from 'd3';
  import { feature, mesh } from 'topojson-client';
  import type { StartupData } from '../lib/data';
  import { breakdownHighlight, focus, selectCounty, ui } from '../lib/state.svelte';
  import { dataColor, emphasis, hexToRgb, mix, palettes, type Rgb } from '../lib/colors';
  import { PICK_RADIUS, pickCandidates, pickColor } from '../lib/picking';
  import { mapLabel } from '../lib/describe';
  import Tooltip from './Tooltip.svelte';

  let { data }: { data: StartupData } = $props();
  const { meta, topo, counties } = untrack(() => data);
  const n = counties.length;

  // Project once into a fixed reference space (spec 6.2: no re-projection). Resizing and
  // zooming only change the transform applied on top.
  const W = 975;
  const H = 610;
  const fc = feature(topo, topo.objects.counties);
  // ESRI:102003 (USA Contiguous Albers Equal Area Conic) parameters.
  const projection = geoConicEqualArea()
    .parallels([29.5, 45.5])
    .rotate([96, 0])
    .fitExtent([[8, 8], [W - 8, H - 8]], fc);
  const toPath = geoPath(projection);
  const countyD = fc.features.map((f) => toPath(f) ?? '');
  const countyPaths = countyD.map((d) => new Path2D(d));
  const countyMesh = new Path2D(toPath(mesh(topo, topo.objects.counties, (a, b) => a !== b)) ?? '');
  const stateD = toPath(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? '';
  const pickStyles = counties.map((_, i) => pickColor(i));
  const pal = palettes(meta);

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let svg: SVGSVGElement;
  let width = $state(0);
  let height = $state(0);
  let transform: ZoomTransform = $state.raw(zoomIdentity);
  let zooming = false;
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

  // Fit the reference space inside the container, centred.
  const base = $derived.by(() => {
    const s = Math.min(width / W, height / H) || 1;
    return { s, x: (width - W * s) / 2, y: (height - H * s) / 2 };
  });

  // Interface tokens read from CSS so no hexes live here.
  let borderStyle = '';
  let bgRgb: Rgb = [0, 0, 0];
  let dimRgb: Rgb = [0, 0, 0];

  // The breakdown highlight (spec 6.6), derived so clearing a hidden pin does not recolour.
  const highlight = $derived(breakdownHighlight());

  // ---- Fills and the recolour transition ------------------------------------------------
  const shown = new Float32Array(n * 3);
  const from = new Float32Array(n * 3);
  const target = new Float32Array(n * 3);
  let painted = false;
  let transition: Timer | null = null;
  let lastMode = untrack(() => ui.mode);
  let lastDecade = untrack(() => ui.decade);

  function computeTargets(): void {
    const e = { filter: ui.filter, isolate: ui.isolate, highlight };
    for (let i = 0; i < n; i++) {
      const c = counties[i];
      const look = emphasis(e, ui.mode, c, ui.decade);
      const data = dataColor(pal, ui.mode, c, ui.decade);
      const rgb = look === 'gray' ? dimRgb : look === 'faded' ? mix(bgRgb, data, 0.2) : data;
      target[i * 3] = rgb[0];
      target[i * 3 + 1] = rgb[1];
      target[i * 3 + 2] = rgb[2];
    }
  }

  function recolour(): void {
    computeTargets();
    transition?.stop();
    if (!painted) {
      shown.set(target);
      painted = true;
      draw();
      return;
    }
    // Mode and decade changes take the 300 ms of spec 6.2; legend-hover emphasis is quicker.
    const duration = ui.mode !== lastMode || ui.decade !== lastDecade ? 300 : 120;
    lastMode = ui.mode;
    lastDecade = ui.decade;
    from.set(shown);
    transition = timer((elapsed) => {
      const t = easeCubicInOut(Math.min(1, elapsed / duration));
      for (let j = 0; j < shown.length; j++) shown[j] = from[j] + (target[j] - from[j]) * t;
      draw();
      if (t >= 1) {
        transition?.stop();
        transition = null;
      }
    });
  }

  function applyTransform(ctx: CanvasRenderingContext2D, scale: number): number {
    const k = transform.k * base.s;
    ctx.setTransform(
      scale * k, 0, 0, scale * k,
      scale * (transform.x + transform.k * base.x),
      scale * (transform.y + transform.k * base.y),
    );
    return k;
  }

  function draw(): void {
    const ctx = canvas?.getContext('2d');
    if (!ctx || width === 0) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = applyTransform(ctx, dpr);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `rgb(${shown[i * 3] | 0},${shown[i * 3 + 1] | 0},${shown[i * 3 + 2] | 0})`;
      ctx.fill(countyPaths[i]);
    }
    ctx.strokeStyle = borderStyle;
    ctx.lineWidth = 0.3 / k;
    ctx.stroke(countyMesh);
  }

  // ---- Picking ----------------------------------------------------------------------------
  const pickCanvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const pickCtx = pickCanvas?.getContext('2d', { willReadFrequently: true }) ?? null;

  function drawPick(): void {
    if (!pickCanvas || !pickCtx || width === 0) return;
    pickCanvas.width = width;
    pickCanvas.height = height;
    pickCtx.setTransform(1, 0, 0, 1, 0, 0);
    pickCtx.clearRect(0, 0, width, height);
    applyTransform(pickCtx, 1);
    for (let i = 0; i < n; i++) {
      pickCtx.fillStyle = pickStyles[i];
      pickCtx.fill(countyPaths[i]);
    }
  }

  /**
   * County under a point in CSS pixels, or -1. The pick pixel is only a hint: border pixels are
   * anti-aliased blends that decode to the wrong county, so nearby candidates are confirmed
   * against the exact path. This must not depend on hover state, which a press clears.
   */
  function hit(x: number, y: number): number {
    if (!pickCtx || x < 0 || y < 0 || x >= width || y >= height) return -1;
    const px = x | 0;
    const py = y | 0;
    const x0 = Math.max(0, px - PICK_RADIUS);
    const y0 = Math.max(0, py - PICK_RADIUS);
    const w = Math.min(width, px + PICK_RADIUS + 1) - x0;
    const h = Math.min(height, py + PICK_RADIUS + 1) - y0;
    const { data } = pickCtx.getImageData(x0, y0, w, h);
    for (const i of pickCandidates(data, w, h, px - x0, py - y0, n)) {
      if (pickCtx.isPointInPath(countyPaths[i], x, y)) return i;
    }
    return -1;
  }

  // ---- Hover and tooltip -------------------------------------------------------------------
  let pointerXY = $state<[number, number]>([0, 0]);
  let tooltipFor = $state(-1);
  let tooltipTimer: ReturnType<typeof setTimeout> | undefined;

  function setHovered(i: number): void {
    if (i === ui.hovered) return;
    ui.hovered = i;
    tooltipFor = -1;
    clearTimeout(tooltipTimer);
    if (i >= 0) tooltipTimer = setTimeout(() => (tooltipFor = ui.hovered), 80);
  }

  function onPointerMove(event: PointerEvent): void {
    if (zooming || event.pointerType === 'touch') return;
    const [x, y] = pointer(event, svg);
    pointerXY = [x, y];
    setHovered(hit(x, y));
  }

  function onClick(event: MouseEvent): void {
    const [x, y] = pointer(event, svg);
    const i = hit(x, y);
    if (i >= 0) selectCounty(i);
  }

  // ---- Zoom -------------------------------------------------------------------------------
  let zoomer: ZoomBehavior<SVGSVGElement, unknown>;

  export function resetView(): void {
    select(svg).transition().duration(500).call(zoomer.transform, zoomIdentity);
  }

  /** A county's bounds in the zoomable layer's coordinates (before the zoom transform). */
  function layerBounds(i: number): [[number, number], [number, number]] {
    const [[x0, y0], [x1, y1]] = toPath.bounds(fc.features[i]);
    return [
      [base.x + x0 * base.s, base.y + y0 * base.s],
      [base.x + x1 * base.s, base.y + y1 * base.s],
    ];
  }

  /**
   * Brings a county into view (spec 6.9). Unless forced, only when its centre is off-screen or
   * it is drawn smaller than 12 px; then it zooms to fit the county with room around it.
   */
  function zoomToCounty(i: number, force: boolean): void {
    const [[u0, v0], [u1, v1]] = layerBounds(i);
    if (!force) {
      const [cx, cy] = transform.apply([(u0 + u1) / 2, (v0 + v1) / 2]);
      const size = Math.max(u1 - u0, v1 - v0) * transform.k;
      const onScreen = cx >= 0 && cx <= width && cy >= 0 && cy <= height;
      if (onScreen && size >= 12) return;
    }
    const k = Math.max(1, Math.min(12, 0.3 * Math.min(width / (u1 - u0), height / (v1 - v0))));
    const next = zoomIdentity
      .translate(width / 2 - (k * (u0 + u1)) / 2, height / 2 - (k * (v0 + v1)) / 2)
      .scale(k);
    select(svg).transition().duration(600).call(zoomer.transform, next);
  }

  /** Fits a set of counties (e.g. similar counties and the selected one) to ~80% of the map. */
  function zoomToCounties(list: number[]): void {
    const b = list.map(layerBounds);
    const u0 = Math.min(...b.map((x) => x[0][0]));
    const v0 = Math.min(...b.map((x) => x[0][1]));
    const u1 = Math.max(...b.map((x) => x[1][0]));
    const v1 = Math.max(...b.map((x) => x[1][1]));
    const k = Math.max(1, Math.min(12, 0.8 * Math.min(width / (u1 - u0), height / (v1 - v0))));
    const next = zoomIdentity
      .translate(width / 2 - (k * (u0 + u1)) / 2, height / 2 - (k * (v0 + v1)) / 2)
      .scale(k);
    select(svg).transition().duration(600).call(zoomer.transform, next);
  }

  // Selections from search, location, the URL and map clicks ask for a county to be in view;
  // "Show on map" asks for a set.
  let handledFocus = 0;
  $effect(() => {
    const seq = focus.seq;
    if (!zoomer || width === 0 || height === 0 || seq === handledFocus) return;
    handledFocus = seq;
    untrack(() => (focus.counties.length ? zoomToCounties(focus.counties) : zoomToCounty(focus.county, focus.force)));
  });

  onMount(() => {
    const css = getComputedStyle(container);
    borderStyle = css.getPropertyValue('--bg').trim();
    bgRgb = hexToRgb(css.getPropertyValue('--bg'));
    dimRgb = mix(bgRgb, hexToRgb(css.getPropertyValue('--muted')), 0.25);

    zoomer = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      // A click that moves a few pixels is still a click (the default, 0, drops it).
      .clickDistance(4)
      .on('start', () => {
        zooming = true;
        setHovered(-1);
      })
      .on('zoom', (event) => (transform = event.transform))
      .on('end', () => {
        zooming = false;
        drawPick();
      });
    select(svg).call(zoomer);
  });

  onDestroy(() => {
    transition?.stop();
    clearTimeout(tooltipTimer);
  });

  // Recolour whenever the mode, decade or emphasis changes.
  $effect(() => {
    void [ui.mode, ui.decade, ui.isolate, highlight, ui.filter.length, ...ui.filter];
    untrack(recolour);
  });

  // Resize the backing store here, not with template attributes: setting a canvas's size clears
  // it, and the attribute update is not guaranteed to land before this effect's redraw.
  $effect(() => {
    void [width, height, base];
    untrack(() => {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      zoomer?.extent([[0, 0], [width, height]]).translateExtent([[0, 0], [width, height]]);
      draw();
      drawPick();
    });
  });

  // Redraw fills as the zoom transform changes (picking waits for the gesture to end).
  $effect(() => {
    void transform;
    untrack(draw);
  });
</script>

<div class="map" bind:this={container} bind:clientWidth={width} bind:clientHeight={height}>
  <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role (spec 7: the canvas is an image) -->
  <canvas
    bind:this={canvas}
    style:width="{width}px"
    style:height="{height}px"
    role="img"
    aria-label={mapLabel(meta, ui.mode, ui.decade)}
  ></canvas>
  <svg
    bind:this={svg}
    {width}
    {height}
    aria-hidden="true"
    class:hovering={ui.hovered >= 0}
    onpointermove={onPointerMove}
    onpointerleave={() => setHovered(-1)}
    onclick={onClick}
  >
    <rect {width} {height} fill="transparent" />
    <g transform="translate({transform.x},{transform.y}) scale({transform.k})">
      <g transform="translate({base.x},{base.y}) scale({base.s})">
        <path class="states" d={stateD} />
        <!-- Cased outlines: a background-coloured halo under a dark line (spec 7). Similar
             counties get a dashed line over a solid halo. -->
        {#each ui.matches as m (m)}
          <path class="halo match" d={countyD[m]} />
        {/each}
        {#each ui.matches as m (m)}
          <path class="line match" d={countyD[m]} />
        {/each}
        {#if ui.selected >= 0}
          <path class="halo selected" d={countyD[ui.selected]} />
          <path class="line selected" d={countyD[ui.selected]} />
        {/if}
        {#if ui.hovered >= 0}
          <path class="halo hover" d={countyD[ui.hovered]} />
          <path class="line hover" d={countyD[ui.hovered]} />
        {/if}
      </g>
    </g>
  </svg>
  {#if tooltipFor >= 0}
    <Tooltip {meta} county={counties[tooltipFor]} x={pointerXY[0]} y={pointerXY[1]} bounds={{ width, height }} />
  {/if}
  <button class="reset" type="button" onclick={resetView}>Reset view</button>
</div>

<style>
  .map {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--bg);
  }
  canvas,
  svg {
    position: absolute;
    inset: 0;
  }
  canvas {
    pointer-events: none;
  }
  svg {
    cursor: grab;
    touch-action: none;
  }
  svg.hovering {
    cursor: pointer;
  }
  /* Outlines never take pointer events: the hover outline is removed when a press starts a
     zoom gesture, and a press on a removed element produces no click. The rect below gets them. */
  path {
    pointer-events: none;
    fill: none;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }
  .states {
    stroke: var(--bg);
    stroke-width: 0.9px;
  }
  .halo {
    stroke: var(--bg);
  }
  .line {
    stroke: var(--heading);
  }
  .halo.selected {
    stroke-width: 4px;
  }
  .line.selected {
    stroke-width: 2px;
  }
  .halo.match {
    stroke-width: 4px;
  }
  .line.match {
    stroke-width: 2px;
    stroke-dasharray: 4 3;
  }
  .halo.hover {
    stroke-width: 3.5px;
  }
  .line.hover {
    stroke-width: 1.5px;
  }
  .reset {
    position: absolute;
    right: var(--gutter);
    bottom: var(--gutter);
    min-height: 40px;
    padding: 0 14px;
    background: var(--bg);
    border: 1px solid var(--hairline);
    border-radius: 4px;
    cursor: pointer;
  }
  .reset:hover {
    border-color: var(--muted);
  }
</style>
