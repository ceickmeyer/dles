<script lang="ts">
	interface Pt { x: number; y: number; elo: number; delta: number; date: string; }

	let { history }: { history: { date: string; elo: number; delta: number }[] } = $props();

	const W = 560, H = 120;
	const PL = 36, PR = 12, PT = 12, PB = 26;
	const pw = W - PL - PR;
	const ph = H - PT - PB;

	const n = $derived(history.length);

	const minElo = $derived(Math.min(...history.map(h => h.elo), 1000) - 15);
	const maxElo = $derived(Math.max(...history.map(h => h.elo), 1000) + 15);

	function xAt(i: number): number {
		return PL + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw);
	}

	function yAt(elo: number): number {
		return PT + (1 - (elo - minElo) / Math.max(maxElo - minElo, 1)) * ph;
	}

	const points = $derived(
		history.map((h, i) => ({ x: xAt(i), y: yAt(h.elo), elo: h.elo, delta: h.delta, date: h.date }))
	);

	function smoothPath(pts: Pt[]): string {
		if (pts.length < 2) return '';
		const d: string[] = [`M${pts[0].x} ${pts[0].y}`];
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

	function fmtDate(d: string): string {
		return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Y-axis ticks: always include 1000, plus a couple of round values spanning the range
	const yTicks = $derived.by(() => {
		const step = Math.ceil((maxElo - minElo) / 3 / 10) * 10;
		const first = Math.round(minElo / step) * step;
		const ticks = new Set<number>();
		for (let v = first; v <= maxElo; v += step) ticks.add(v);
		ticks.add(1000);
		return [...ticks].filter(t => t >= minElo && t <= maxElo).sort((a, b) => a - b);
	});

	let hoveredPt = $state<Pt | null>(null);

	const TW = 56, TH = 26, TR = 5;

	function tipX(pt: Pt): number {
		return pt.x + TW + 10 > W ? pt.x - TW - 6 : pt.x + 6;
	}

	function tipY(pt: Pt): number {
		return pt.y - TH / 2 < PT ? PT : pt.y - TH / 2;
	}
</script>

<svg viewBox="0 0 {W} {H}" class="w-full" style="overflow: visible; display: block;">
	<!-- Y-axis grid lines + labels -->
	{#each yTicks as v}
		<line
			x1={PL} x2={W - PR} y1={yAt(v)} y2={yAt(v)}
			stroke={v === 1000 ? '#2a3f56' : '#1a2e44'}
			stroke-width={v === 1000 ? 1.5 : 1}
			stroke-dasharray={v === 1000 ? '4 3' : undefined}
		/>
		<text
			x={PL - 4} y={yAt(v) + 3.5}
			text-anchor="end"
			font-size="9"
			fill={v === 1000 ? '#4a7a9b' : '#4a6272'}
			font-family="ui-monospace, monospace"
		>{v}</text>
	{/each}

	<!-- Curve -->
	{#if points.length >= 2}
		<path
			d={smoothPath(points)}
			fill="none"
			stroke="#39bae6"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/if}

	<!-- Dots + hit targets -->
	{#each points as pt}
		<circle
			cx={pt.x} cy={pt.y}
			r={3.5}
			fill="#13203a"
			stroke={hoveredPt === pt ? '#ffffff' : '#39bae6'}
			stroke-width={hoveredPt === pt ? 2 : 1.5}
		/>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<circle
			cx={pt.x} cy={pt.y} r={10}
			fill="transparent"
			style="cursor: pointer;"
			onmouseenter={() => hoveredPt = pt}
			onmouseleave={() => hoveredPt = null}
		/>
	{/each}

	<!-- Single dot if only one point -->
	{#if points.length === 1}
		<circle cx={points[0].x} cy={points[0].y} r={4} fill="#39bae6" />
	{/if}

	<!-- X-axis date labels -->
	{#each history as h, i}
		<text
			x={xAt(i)} y={H - 2}
			text-anchor="middle"
			font-size="9"
			fill="#b3b1ad"
			font-family="ui-sans-serif, system-ui, sans-serif"
		>{fmtDate(h.date)}</text>
	{/each}

	<!-- Tooltip -->
	{#if hoveredPt}
		{@const tx = tipX(hoveredPt)}
		{@const ty = tipY(hoveredPt)}
		<g style="pointer-events: none;">
			<rect
				x={tx} y={ty}
				width={TW} height={TH}
				rx={TR} ry={TR}
				fill="#0d1e30"
				stroke="#2a3f56"
				stroke-width="1"
			/>
			<text
				x={tx + TW / 2} y={ty + 17}
				text-anchor="middle"
				font-size="11"
				font-weight="600"
				fill="#39bae6"
				font-family="ui-monospace, monospace"
			>{hoveredPt.elo}</text>
		</g>
	{/if}
</svg>
