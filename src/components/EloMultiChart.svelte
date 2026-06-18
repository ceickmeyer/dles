<script lang="ts">
	interface PlayerLine {
		player_id: string;
		name: string;
		points: (number | null)[];
	}

	let { players, dates }: { players: PlayerLine[]; dates: string[] } = $props();

	// Catppuccin Mocha palette — 12 distinct colors
	const COLORS = [
		'#f38ba8', // red
		'#89b4fa', // blue
		'#a6e3a1', // green
		'#cba6f7', // mauve
		'#fab387', // peach
		'#89dceb', // sky
		'#f9e2af', // yellow
		'#74c7ec', // sapphire
		'#f5c2e7', // pink
		'#94e2d5', // teal
		'#eba0ac', // maroon
		'#b4befe', // lavender
	];

	const W = 560, H = 300;
	const PL = 40, PR = 12, PT = 12, PB = 26;
	const pw = W - PL - PR;
	const ph = H - PT - PB;

	const n = $derived(dates.length);

	const allValues = $derived(
		players.flatMap(p => p.points.filter((v): v is number => v !== null))
	);
	const minElo = $derived(allValues.length ? Math.min(...allValues, 1000) - 20 : 950);
	const maxElo = $derived(allValues.length ? Math.max(...allValues, 1000) + 20 : 1050);

	function xAt(i: number): number {
		return PL + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw);
	}

	function yAt(elo: number): number {
		return PT + (1 - (elo - minElo) / Math.max(maxElo - minElo, 1)) * ph;
	}

	interface Seg { x: number; y: number; elo: number; idx: number }

	function buildSegments(points: (number | null)[]): Seg[][] {
		const segs: Seg[][] = [];
		let cur: Seg[] = [];
		for (let i = 0; i < points.length; i++) {
			const v = points[i];
			if (v !== null) {
				cur.push({ x: xAt(i), y: yAt(v), elo: v, idx: i });
			} else {
				if (cur.length) { segs.push(cur); cur = []; }
			}
		}
		if (cur.length) segs.push(cur);
		return segs;
	}

	function smoothPath(pts: Seg[]): string {
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

	const colored = $derived(
		players.map((p, i) => ({
			...p,
			color: COLORS[i % COLORS.length],
			segments: buildSegments(p.points),
		}))
	);

	const yTicks = $derived.by(() => {
		const step = Math.ceil((maxElo - minElo) / 3 / 10) * 10;
		const first = Math.round(minElo / step) * step;
		const ticks = new Set<number>();
		for (let v = first; v <= maxElo; v += step) ticks.add(v);
		ticks.add(1000);
		return [...ticks].filter(t => t >= minElo && t <= maxElo).sort((a, b) => a - b);
	});

	function fmtDate(d: string): string {
		return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	let hoveredPlayer = $state<string | null>(null);
	let hoveredDot = $state<{ player_id: string; elo: number; x: number; y: number } | null>(null);

	const TW = 56, TH = 26, TR = 5;
	function tipX(x: number) { return x + TW + 10 > W ? x - TW - 6 : x + 6; }
	function tipY(y: number) { return y - TH / 2 < PT ? PT : y - TH / 2; }
</script>

<div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<svg
		viewBox="0 0 {W} {H}"
		class="w-full"
		style="overflow: visible; display: block;"
		onmouseleave={() => { hoveredPlayer = null; hoveredDot = null; }}
	>
		<!-- Y-axis grid + labels -->
		{#each yTicks as v}
			<line
				x1={PL} x2={W - PR} y1={yAt(v)} y2={yAt(v)}
				stroke={v === 1000 ? '#2a3f56' : '#1a2e44'}
				stroke-width={v === 1000 ? 1.5 : 1}
				stroke-dasharray={v === 1000 ? '4 3' : undefined}
			/>
			<text
				x={PL - 4} y={yAt(v) + 3.5}
				text-anchor="end" font-size="9"
				fill={v === 1000 ? '#4a7a9b' : '#4a6272'}
				font-family="ui-monospace, monospace"
			>{v}</text>
		{/each}

		<!-- Player lines (render faded players first so highlighted player is on top) -->
		{#each [false, true] as isHovered}
			{#each colored as player}
				{@const active = hoveredPlayer === null || hoveredPlayer === player.player_id}
				{#if isHovered === (hoveredPlayer === player.player_id || hoveredPlayer === null)}
					{#each player.segments as seg}
						{#if seg.length >= 2}
							<path
								d={smoothPath(seg)}
								fill="none"
								stroke={player.color}
								stroke-width={hoveredPlayer === player.player_id ? 2.5 : 2}
								stroke-linecap="round"
								opacity={active ? 1 : 0.1}
								style="transition: opacity 0.12s, stroke-width 0.12s"
							/>
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<path
								d={smoothPath(seg)}
								fill="none"
								stroke="transparent"
								stroke-width="14"
								style="cursor: pointer;"
								onmouseenter={() => hoveredPlayer = player.player_id}
							/>
						{:else if seg.length === 1}
							<circle cx={seg[0].x} cy={seg[0].y} r={3} fill={player.color} opacity={active ? 1 : 0.1} style="transition: opacity 0.12s" />
						{/if}
					{/each}

					<!-- Dots -->
					{#each player.segments.flat() as dot}
						<circle
							cx={dot.x} cy={dot.y} r={3}
							fill={player.color}
							opacity={active ? 1 : 0.1}
							style="transition: opacity 0.12s"
						/>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<circle
							cx={dot.x} cy={dot.y} r={9}
							fill="transparent"
							style="cursor: pointer;"
							onmouseenter={() => {
								hoveredPlayer = player.player_id;
								hoveredDot = { player_id: player.player_id, elo: dot.elo, x: dot.x, y: dot.y };
							}}
							onmouseleave={() => hoveredDot = null}
						/>
					{/each}
				{/if}
			{/each}
		{/each}

		<!-- X-axis date labels -->
		{#each dates as date, i}
			<text
				x={xAt(i)} y={H - 2}
				text-anchor="middle" font-size="9" fill="#b3b1ad"
				font-family="ui-sans-serif, system-ui, sans-serif"
			>{fmtDate(date)}</text>
		{/each}

		<!-- Dot tooltip -->
		{#if hoveredDot}
			{@const tx = tipX(hoveredDot.x)}
			{@const ty = tipY(hoveredDot.y)}
			<g style="pointer-events: none;">
				<rect x={tx} y={ty} width={TW} height={TH} rx={TR} ry={TR} fill="#0d1e30" stroke="#2a3f56" stroke-width="1" />
				<text
					x={tx + TW / 2} y={ty + 17}
					text-anchor="middle" font-size="11" font-weight="600"
					fill="#e6e1cf" font-family="ui-monospace, monospace"
				>{hoveredDot.elo}</text>
			</g>
		{/if}
	</svg>

	<!-- Legend -->
	<div class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
		{#each colored as player}
			<button
				class="flex items-center gap-1.5 text-xs transition-opacity"
				style="opacity: {hoveredPlayer === null || hoveredPlayer === player.player_id ? 1 : 0.35}"
				onmouseenter={() => hoveredPlayer = player.player_id}
				onmouseleave={() => hoveredPlayer = null}
			>
				<span class="inline-block h-2.5 w-2.5 rounded-full shrink-0" style="background: {player.color}"></span>
				<span class="transition-colors {hoveredPlayer === player.player_id ? 'text-white' : 'text-zinc-400'}">{player.name}</span>
			</button>
		{/each}
	</div>
</div>
