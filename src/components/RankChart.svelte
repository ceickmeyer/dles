<script lang="ts">
	interface Session {
		name: string;
		date: string;
		rank: number | null;
		outOf: number | null;
	}

	interface Pt { x: number; y: number; rank: number; outOf: number; name: string; date: string; }

	let { sessions }: { sessions: Session[] } = $props();

	const W = 560, H = 120;
	const PL = 30, PR = 12, PT = 12, PB = 26;
	const pw = W - PL - PR;
	const ph = H - PT - PB;

	const n = $derived(sessions.length);

	const maxRank = $derived(
		Math.max(...sessions.filter(s => s.outOf != null).map(s => s.outOf as number), 2)
	);

	function xAt(i: number): number {
		return PL + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw);
	}

	function yAt(rank: number): number {
		return PT + ((rank - 1) / Math.max(maxRank - 1, 1)) * ph;
	}

	const segments = $derived.by(() => {
		const segs: Pt[][] = [];
		let cur: Pt[] = [];
		for (let i = 0; i < n; i++) {
			const s = sessions[i];
			if (s.rank != null) {
				cur.push({ x: xAt(i), y: yAt(s.rank), rank: s.rank, outOf: s.outOf ?? 0, name: s.name, date: s.date });
			} else {
				if (cur.length) { segs.push(cur); cur = []; }
			}
		}
		if (cur.length) segs.push(cur);
		return segs;
	});

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

	const allPoints = $derived(segments.flat());
	const yTicks = $derived(Array.from({ length: maxRank }, (_, i) => i + 1));

	function ordinal(r: number): string {
		return r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : `${r}th`;
	}

	function fmtDate(d: string): string {
		return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	let hoveredPt = $state<Pt | null>(null);

	// Tooltip dimensions
	const TW = 72, TH = 26, TR = 5;

	function tipX(pt: Pt): number {
		// Flip to left side if near right edge
		return pt.x + TW + 10 > W ? pt.x - TW - 6 : pt.x + 6;
	}

	function tipY(pt: Pt): number {
		// Flip below if near top
		return pt.y - TH / 2 < PT ? PT : pt.y - TH / 2;
	}
</script>

<svg viewBox="0 0 {W} {H}" class="w-full" style="overflow: visible; display: block;">
	<!-- Y-axis grid lines + labels -->
	{#each yTicks as r}
		<line x1={PL} x2={W - PR} y1={yAt(r)} y2={yAt(r)} stroke="#1a2e44" stroke-width="1" />
		<text
			x={PL - 5} y={yAt(r) + 3.5}
			text-anchor="end"
			font-size="9"
			fill="#4a6272"
			font-family="ui-monospace, monospace"
		>{ordinal(r)}</text>
	{/each}

	<!-- Curves -->
	{#each segments as seg}
		{#if seg.length >= 2}
			<path
				d={smoothPath(seg)}
				fill="none"
				stroke="#e6b450"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		{/if}
	{/each}

	<!-- Dots + invisible hit targets -->
	{#each allPoints as pt}
		<circle
			cx={pt.x}
			cy={pt.y}
			r={pt.rank === 1 ? 5 : 3.5}
			fill={pt.rank === 1 ? '#e6b450' : '#13203a'}
			stroke={hoveredPt === pt ? '#ffffff' : pt.rank === 1 ? '#e6b450' : '#39bae6'}
			stroke-width={hoveredPt === pt ? 2 : 1.5}
		/>
		<!-- Transparent larger hit area -->
		<circle
			cx={pt.x}
			cy={pt.y}
			r={10}
			fill="transparent"
			style="cursor: pointer;"
			onmouseenter={() => hoveredPt = pt}
			onmouseleave={() => hoveredPt = null}
		/>
	{/each}

	<!-- X-axis date labels -->
	{#each sessions as s, i}
		<text
			x={xAt(i)}
			y={H - 2}
			text-anchor="middle"
			font-size="9"
			fill={s.rank != null ? '#b3b1ad' : '#4a6272'}
			font-family="ui-sans-serif, system-ui, sans-serif"
		>{fmtDate(s.date)}</text>
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
				fill="#e6b450"
				font-family="ui-monospace, monospace"
			>#{hoveredPt.rank} of {hoveredPt.outOf}</text>
		</g>
	{/if}
</svg>
