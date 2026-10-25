<script lang="ts">
	import { onMount } from 'svelte';
	import { canHover } from '$lib/hover';

	interface Bin {
		x0: number;
		x1: number;
		mid: number;
		count: number;
	}

	interface Mark {
		value: number;
		label: string;
		color: string;
	}

	let {
		scores,
		marks = [],
		dnfCount = 0,
		higherIsBetter = true,
		formatValue
	}: {
		scores: number[];
		marks?: Mark[];
		dnfCount?: number;
		higherIsBetter?: boolean;
		formatValue: (n: number) => string;
	} = $props();

	const W = 560,
		H = 180;
	const PL = 30,
		PR = 10,
		PT = 14,
		PB = 22;
	const pw = W - PL - PR;
	const ph = H - PT - PB;

	// Discrete games (Wordle's 1–6, Metazooa's 1–20, ...) get one bin per
	// integer value so the curve isn't smeared across invented buckets.
	// Wide/continuous games (Decipher's seconds, TimeGuessr's points) get a
	// fixed number of equal-width buckets instead.
	const BIN_COUNT = 14;
	const bins = $derived.by<Bin[]>(() => {
		if (scores.length === 0) return [];
		const min = Math.min(...scores);
		const max = Math.max(...scores);
		const distinct = new Set(scores);
		const allIntegers = scores.every((s) => Number.isInteger(s));

		if (allIntegers && distinct.size <= 12) {
			const lo = Math.floor(min),
				hi = Math.ceil(max);
			const out: Bin[] = [];
			for (let v = lo; v <= hi; v++) {
				out.push({ x0: v - 0.5, x1: v + 0.5, mid: v, count: 0 });
			}
			for (const s of scores) out[s - lo].count++;
			return out;
		}

		const span = Math.max(max - min, 1e-9);
		const width = span / BIN_COUNT;
		const out: Bin[] = Array.from({ length: BIN_COUNT }, (_, i) => ({
			x0: min + i * width,
			x1: min + (i + 1) * width,
			mid: min + (i + 0.5) * width,
			count: 0
		}));
		for (const s of scores) {
			const idx = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor((s - min) / width)));
			out[idx].count++;
		}
		return out;
	});

	const allIntegers = $derived(scores.length > 0 && scores.every((s) => Number.isInteger(s)));
	const maxCount = $derived(Math.max(1, ...bins.map((b) => b.count)));
	const rangeLo = $derived(bins[0]?.x0 ?? 0);
	const rangeHi = $derived(bins[bins.length - 1]?.x1 ?? 1);

	function xAt(v: number): number {
		return PL + ((v - rangeLo) / Math.max(rangeHi - rangeLo, 1e-9)) * pw;
	}
	function yAt(count: number): number {
		return PT + (1 - count / maxCount) * ph;
	}

	// Bin midpoints, plus a flat anchor at each edge of the range so the curve
	// spans the whole x-axis — otherwise a score in the outer half of the
	// first/last bin lands past the end of the drawn line.
	const points = $derived.by(() => {
		const mids = bins.map((b) => ({ x: xAt(b.mid), y: yAt(b.count) }));
		if (mids.length === 0) return mids;
		return [
			{ x: xAt(rangeLo), y: mids[0].y },
			...mids,
			{ x: xAt(rangeHi), y: mids[mids.length - 1].y }
		];
	});

	interface Segment {
		x0: number;
		y0: number;
		c1x: number;
		c1y: number;
		c2x: number;
		c2y: number;
		x1: number;
		y1: number;
	}

	// Monotone cubic (Steffen) → Bezier. Unlike Catmull-Rom it never
	// overshoots a data point, so the peak stays at its bin's true height
	// instead of bulging past the top gridline. Computed once and used both
	// to draw the path and to place dots, so a dot always sits on the line.
	const segments = $derived.by<Segment[]>(() => {
		const pts = points;
		const n = pts.length;
		if (n < 2) return [];
		const d: number[] = [];
		for (let i = 0; i < n - 1; i++) {
			d.push((pts[i + 1].y - pts[i].y) / Math.max(pts[i + 1].x - pts[i].x, 1e-9));
		}
		const m: number[] = [d[0]];
		for (let i = 1; i < n - 1; i++) {
			const h0 = pts[i].x - pts[i - 1].x;
			const h1 = pts[i + 1].x - pts[i].x;
			const p = (d[i - 1] * h1 + d[i] * h0) / Math.max(h0 + h1, 1e-9);
			m.push(
				(Math.sign(d[i - 1]) + Math.sign(d[i])) *
					Math.min(Math.abs(d[i - 1]), Math.abs(d[i]), 0.5 * Math.abs(p))
			);
		}
		m.push(d[n - 2]);
		const out: Segment[] = [];
		for (let i = 0; i < n - 1; i++) {
			const h = pts[i + 1].x - pts[i].x;
			out.push({
				x0: pts[i].x,
				y0: pts[i].y,
				c1x: pts[i].x + h / 3,
				c1y: pts[i].y + (m[i] * h) / 3,
				c2x: pts[i + 1].x - h / 3,
				c2y: pts[i + 1].y - (m[i + 1] * h) / 3,
				x1: pts[i + 1].x,
				y1: pts[i + 1].y
			});
		}
		return out;
	});

	const linePath = $derived(
		segments.length === 0
			? ''
			: `M${segments[0].x0} ${segments[0].y0} ` +
					segments
						.map(
							(s) =>
								`C${s.c1x.toFixed(1)} ${s.c1y.toFixed(1)} ${s.c2x.toFixed(1)} ${s.c2y.toFixed(1)} ${s.x1} ${s.y1}`
						)
						.join(' ')
	);
	const areaPath = $derived(
		points.length < 2
			? ''
			: `${linePath} L${points[points.length - 1].x} ${PT + ph} L${points[0].x} ${PT + ph} Z`
	);

	function bez(a: number, b: number, c: number, d: number, t: number): number {
		const u = 1 - t;
		return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
	}

	// Height of the drawn curve at x. Control points sit at thirds of each
	// segment, so the bezier's x is linear in t and t falls out directly.
	function curveYAt(x: number): number {
		if (segments.length === 0) return PT + ph;
		if (x <= segments[0].x0) return segments[0].y0;
		const last = segments[segments.length - 1];
		if (x >= last.x1) return last.y1;
		const s = segments.find((seg) => x >= seg.x0 && x <= seg.x1) ?? last;
		const t = (x - s.x0) / Math.max(s.x1 - s.x0, 1e-9);
		return bez(s.y0, s.c1y, s.c2y, s.y1, t);
	}

	function clampX(v: number): number {
		return xAt(Math.min(rangeHi, Math.max(rangeLo, v)));
	}

	// What share of every recorded score this value beats — ties split evenly,
	// direction-aware so "higher percentile" always means "did better."
	function percentileOf(v: number): number {
		const total = scores.length;
		if (total === 0) return 0;
		let worse = 0,
			equal = 0;
		for (const s of scores) {
			if (s === v) equal++;
			else if (higherIsBetter ? s < v : s > v) worse++;
		}
		return ((worse + equal / 2) / total) * 100;
	}

	function ordinal(n: number): string {
		const mod100 = n % 100;
		if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
		switch (n % 10) {
			case 1:
				return `${n}st`;
			case 2:
				return `${n}nd`;
			case 3:
				return `${n}rd`;
			default:
				return `${n}th`;
		}
	}

	// Bin midpoints land on clean integers in the one-bin-per-value case, but
	// can fall mid-bucket (23.5) in the fixed-width case — round those for
	// display when the underlying scores are integer-valued, so the label
	// doesn't show precision the data never had.
	function tickLabel(v: number): string {
		return formatValue(allIntegers ? Math.round(v) : v);
	}

	const xTicks = $derived.by(() => {
		if (bins.length === 0) return [];
		if (bins.length <= 12) return bins.map((b) => ({ x: xAt(b.mid), label: tickLabel(b.mid) }));
		const mid = bins[Math.floor(bins.length / 2)];
		// The outer two ticks are labeled with the true min/max (rangeLo/
		// rangeHi), so they must sit at xAt(rangeLo/rangeHi) too — not at
		// the outer bins' midpoints, which are half a bin-width inward and
		// would draw the label in the wrong place relative to marks near
		// the edges.
		return [
			{ x: xAt(rangeLo), label: tickLabel(rangeLo) },
			{ x: xAt(mid.mid), label: tickLabel(mid.mid) },
			{ x: xAt(rangeHi), label: tickLabel(rangeHi) }
		];
	});

	// Y-axis reads in share of nights (density), not raw counts — comparable
	// across games regardless of how many sessions they've been played.
	const yTicks = $derived.by(() => {
		const total = scores.length;
		if (total === 0) return [];
		return [0, maxCount / 2, maxCount].map((c) => ({
			y: yAt(c),
			label: `${Math.round((c / total) * 100)}%`
		}));
	});

	let hoveredBin = $state<number | null>(null);
	let hoveredMark = $state<number | null>(null);

	onMount(() => {
		if (canHover) return;
		function closeAll() {
			hoveredBin = null;
			hoveredMark = null;
		}
		document.addEventListener('click', closeAll);
		return () => document.removeEventListener('click', closeAll);
	});
</script>

{#if bins.length > 0}
	<div>
		<svg viewBox="0 0 {W} {H}" class="w-full" style="overflow: visible; display: block;">
			<!-- Y-axis gridlines (share of nights) -->
			{#each yTicks as tick}
				<line x1={PL} x2={W - PR} y1={tick.y} y2={tick.y} stroke="#1a2e44" stroke-width="1" />
				<text
					x={PL - 4}
					y={tick.y + 3}
					text-anchor="end"
					font-size="9"
					fill="#4a6272"
					font-family="ui-monospace, monospace">{tick.label}</text
				>
			{/each}

			<!-- Distribution curve -->
			<path d={areaPath} fill="#4a7a9b" opacity="0.18" />
			<path d={linePath} fill="none" stroke="#4a7a9b" stroke-width="2" stroke-linecap="round" />

			<!-- Marks: where the viewer's score(s) fall -->
			{#each marks as mark, i (mark.label)}
				{@const mx = clampX(mark.value)}
				{@const my = curveYAt(mx)}
				<line
					x1={mx}
					x2={mx}
					y1={PT}
					y2={PT + ph}
					stroke={mark.color}
					stroke-width="1.5"
					stroke-dasharray="3 3"
				/>
				<circle cx={mx} cy={my} r="4" fill={mark.color} />
				<text
					x={Math.min(W - PR - 2, Math.max(PL + 2, mx))}
					y={PT - 4 - i * 12}
					text-anchor={mx > W - 70 ? 'end' : mx < 70 ? 'start' : 'middle'}
					font-size="10"
					font-weight="600"
					fill={mark.color}
					font-family="ui-sans-serif, system-ui, sans-serif"
				>
					{mark.label}: {formatValue(mark.value)}{hoveredMark === i
						? ` · ${ordinal(Math.round(percentileOf(mark.value)))} percentile`
						: ''}
				</text>
			{/each}

			<!-- X-axis labels -->
			{#each xTicks as tick}
				<text
					x={tick.x}
					y={H - 4}
					text-anchor="middle"
					font-size="9"
					fill="#4a6272"
					font-family="ui-monospace, monospace">{tick.label}</text
				>
			{/each}

			<!-- Per-bin hover/tap targets -->
			{#each bins as bin, i}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<rect
					x={xAt(bin.x0)}
					y={PT}
					width={Math.max(0, xAt(bin.x1) - xAt(bin.x0))}
					height={ph}
					fill="transparent"
					style="cursor: pointer;"
					onmouseenter={canHover ? () => (hoveredBin = i) : undefined}
					onmouseleave={canHover ? () => (hoveredBin = null) : undefined}
					onclick={!canHover
						? (e) => {
								e.stopPropagation();
								hoveredBin = hoveredBin === i ? null : i;
								hoveredMark = null;
							}
						: undefined}
				/>
			{/each}

			<!-- Mark hover/tap targets — drawn after the bin rects so a mark
			     sitting on top of the curve wins the hit test at that point. -->
			{#each marks as mark, i (mark.label)}
				{@const mx = clampX(mark.value)}
				{@const my = curveYAt(mx)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<circle
					cx={mx}
					cy={my}
					r="9"
					fill="transparent"
					style="cursor: pointer;"
					onmouseenter={canHover
						? () => {
								hoveredMark = i;
								hoveredBin = null;
							}
						: undefined}
					onmouseleave={canHover ? () => (hoveredMark = null) : undefined}
					onclick={!canHover
						? (e) => {
								e.stopPropagation();
								hoveredMark = hoveredMark === i ? null : i;
								hoveredBin = null;
							}
						: undefined}
				/>
			{/each}

			<!-- Hover tooltip: count + percentile for the bin under the cursor -->
			{#if hoveredBin !== null}
				{@const bin = bins[hoveredBin]}
				{@const hx = xAt(bin.mid)}
				{@const hy = curveYAt(hx)}
				{@const pct = Math.round(percentileOf(bin.mid))}
				{@const tw = 104}
				{@const th = 34}
				{@const tx = Math.min(W - PR - tw, Math.max(PL, hx - tw / 2))}
				{@const ty = Math.max(0, hy - th - 8)}
				<line
					x1={hx}
					x2={hx}
					y1={PT}
					y2={PT + ph}
					stroke="#2a3f56"
					stroke-width="1"
					stroke-dasharray="2 2"
				/>
				<circle cx={hx} cy={hy} r="3.5" fill="#b3b1ad" />
				<g style="pointer-events: none;">
					<rect
						x={tx}
						y={ty}
						width={tw}
						height={th}
						rx="5"
						fill="#0d1e30"
						stroke="#2a3f56"
						stroke-width="1"
					/>
					<text
						x={tx + tw / 2}
						y={ty + 14}
						text-anchor="middle"
						font-size="10"
						font-weight="600"
						fill="#e6e1cf"
						font-family="ui-sans-serif, system-ui, sans-serif"
						>{tickLabel(bin.mid)} · {bin.count} night{bin.count === 1 ? '' : 's'}</text
					>
					<text
						x={tx + tw / 2}
						y={ty + 27}
						text-anchor="middle"
						font-size="9"
						fill="#4a7a9b"
						font-family="ui-sans-serif, system-ui, sans-serif">{ordinal(pct)} percentile</text
					>
				</g>
			{/if}
		</svg>

		{#if dnfCount > 0}
			<p class="mt-1 text-right text-[10px] text-ayu-muted">
				+{dnfCount} DNF{dnfCount === 1 ? '' : 's'} not shown
			</p>
		{/if}
	</div>
{/if}
