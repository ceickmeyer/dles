<script lang="ts">
	interface Bin {
		x0: number;
		x1: number;
		mid: number;
		count: number;
	}

	let {
		scores,
		markValue = null,
		markLabel = 'You',
		dnfCount = 0,
		formatValue
	}: {
		scores: number[];
		markValue?: number | null;
		markLabel?: string;
		dnfCount?: number;
		formatValue: (n: number) => string;
	} = $props();

	const W = 560,
		H = 180;
	const PL = 10,
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

	const points = $derived(bins.map((b) => ({ x: xAt(b.mid), y: yAt(b.count) })));

	function smoothLine(pts: { x: number; y: number }[]): string {
		if (pts.length < 2) return '';
		const d = [`M${pts[0].x} ${pts[0].y}`];
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[Math.max(0, i - 1)];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[Math.min(pts.length - 1, i + 2)];
			const cp1x = (p1.x + (p2.x - p0.x) / 6).toFixed(1);
			const cp1y = (p1.y + (p2.y - p0.y) / 6).toFixed(1);
			const cp2x = (p2.x - (p3.x - p1.x) / 6).toFixed(1);
			const cp2y = (p2.y - (p3.y - p1.y) / 6).toFixed(1);
			d.push(`C${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`);
		}
		return d.join(' ');
	}

	const linePath = $derived(smoothLine(points));
	const areaPath = $derived(
		points.length < 2
			? ''
			: `${linePath} L${points[points.length - 1].x} ${PT + ph} L${points[0].x} ${PT + ph} Z`
	);

	// Height of the curve under the mark, by linear interpolation between the
	// two nearest plotted points — close enough for a dot, no need to solve
	// the bezier.
	function curveYAt(x: number): number {
		if (points.length === 0) return PT + ph;
		if (x <= points[0].x) return points[0].y;
		if (x >= points[points.length - 1].x) return points[points.length - 1].y;
		for (let i = 0; i < points.length - 1; i++) {
			const a = points[i],
				b = points[i + 1];
			if (x >= a.x && x <= b.x) {
				const t = (x - a.x) / Math.max(b.x - a.x, 1e-9);
				return a.y + (b.y - a.y) * t;
			}
		}
		return PT + ph;
	}

	const markX = $derived(
		markValue === null ? null : xAt(Math.min(rangeHi, Math.max(rangeLo, markValue)))
	);
	const markY = $derived(markX === null ? null : curveYAt(markX));

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
		return [
			{ x: xAt(bins[0].mid), label: tickLabel(rangeLo) },
			{ x: xAt(mid.mid), label: tickLabel(mid.mid) },
			{ x: xAt(bins[bins.length - 1].mid), label: tickLabel(rangeHi) }
		];
	});
</script>

{#if bins.length > 0}
	<div>
		<svg viewBox="0 0 {W} {H}" class="w-full" style="overflow: visible; display: block;">
			<!-- Baseline -->
			<line x1={PL} x2={W - PR} y1={PT + ph} y2={PT + ph} stroke="#1a2e44" stroke-width="1" />

			<!-- Distribution curve -->
			<path d={areaPath} fill="#4a7a9b" opacity="0.18" />
			<path d={linePath} fill="none" stroke="#4a7a9b" stroke-width="2" stroke-linecap="round" />

			<!-- Mark: where the viewer's score falls -->
			{#if markX !== null && markY !== null}
				<line
					x1={markX}
					x2={markX}
					y1={PT}
					y2={PT + ph}
					stroke="#e6b450"
					stroke-width="1.5"
					stroke-dasharray="3 3"
				/>
				<circle cx={markX} cy={markY} r="4" fill="#e6b450" />
				<text
					x={Math.min(W - PR - 2, Math.max(PL + 2, markX))}
					y={PT - 4}
					text-anchor={markX > W - 70 ? 'end' : markX < 70 ? 'start' : 'middle'}
					font-size="10"
					font-weight="600"
					fill="#e6b450"
					font-family="ui-sans-serif, system-ui, sans-serif"
				>
					{markLabel}: {formatValue(markValue ?? 0)}
				</text>
			{/if}

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
		</svg>

		{#if dnfCount > 0}
			<p class="mt-1 text-right text-[10px] text-ayu-muted">
				+{dnfCount} DNF{dnfCount === 1 ? '' : 's'} not shown
			</p>
		{/if}
	</div>
{/if}
