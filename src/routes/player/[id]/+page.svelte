<script lang="ts">
	import RankChart from '$components/RankChart.svelte';
	let { data } = $props();

	type PerGame = typeof data.perGame[number];

	// Medal rate for ranking best/worst — only games played 3+ times
	const qualified = $derived(
		(data.perGame as PerGame[]).filter(g => g.played >= 3)
	);

	const medalRate = (g: PerGame) => g.played > 0 ? g.total / g.played : 0;

	const bestAt  = $derived([...qualified].sort((a, b) => medalRate(b) - medalRate(a)).slice(0, 3));
	const worstAt = $derived([...qualified].sort((a, b) => medalRate(a) - medalRate(b)).slice(0, 3));
</script>

<div class="space-y-8 max-w-2xl">
	<div>
		<a href="/leaderboard" class="mb-4 inline-flex items-center gap-1 text-sm text-ayu-muted hover:text-white">
			← Leaderboard
		</a>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold text-white">{data.player.name}</h1>
				{#if data.player.alias}
					<p class="text-lg text-ayu-gold">{data.player.alias}</p>
				{/if}
				<p class="mt-1 text-sm text-ayu-muted">
					Joined {new Date(data.player.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
				</p>
			</div>
			{#if data.nights === 0}
				<span class="mt-1 rounded-full border border-ayu-border px-3 py-1 text-xs text-ayu-muted">No finished sessions</span>
			{/if}
		</div>
	</div>

	{#if data.nights > 0}
		<!-- Rank history chart -->
		{#if data.rankHistory.length >= 2}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface px-4 py-3">
				<p class="mb-2 text-xs font-semibold uppercase tracking-widest text-ayu-muted">Rank History</p>
				<RankChart sessions={data.rankHistory} />
			</div>
		{/if}

		<!-- Medals overview -->
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each [
				{ label: 'Gold', value: data.medals.gold, color: 'text-ayu-gold', emoji: '🥇' },
				{ label: 'Silver', value: data.medals.silver, color: 'text-zinc-400', emoji: '🥈' },
				{ label: 'Bronze', value: data.medals.bronze, color: 'text-amber-700', emoji: '🥉' },
				{ label: 'Total', value: data.medals.total, color: 'text-white', emoji: '🏅' }
			] as stat}
				<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4 text-center">
					<p class="text-2xl">{stat.emoji}</p>
					<p class="mt-1 text-2xl font-bold {stat.color}">{stat.value}</p>
					<p class="text-xs text-ayu-muted">{stat.label}</p>
				</div>
			{/each}
		</div>

		<!-- Stats row -->
		<div class="grid grid-cols-3 gap-3">
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4 text-center">
				<p class="text-2xl font-bold text-white">{data.nights}</p>
				<p class="text-xs text-ayu-muted">Nights played</p>
			</div>
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4">
				<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Best at</p>
				{#if bestAt.length === 0}
					<p class="text-xs text-ayu-muted">Not enough data</p>
				{:else}
					<div class="space-y-1">
						{#each bestAt as g}
							<p class="text-sm text-white">{g.emoji} {g.name}</p>
						{/each}
					</div>
				{/if}
			</div>
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4">
				<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Worst at</p>
				{#if worstAt.length === 0}
					<p class="text-xs text-ayu-muted">Not enough data</p>
				{:else}
					<div class="space-y-1">
						{#each worstAt as g}
							<p class="text-sm text-white">{g.emoji} {g.name}</p>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Streaks -->
		{#if data.bestWinStreak > 0 || data.bestPodiumStreak > 0 || data.sessionWins > 0}
			<div class="grid grid-cols-3 gap-3">
				<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4 text-center">
					<p class="text-2xl font-bold text-ayu-gold">👑 {data.sessionWins}</p>
					<p class="text-xs text-ayu-muted">Wins</p>
				</div>
				<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4 text-center">
					<p class="text-2xl font-bold text-ayu-gold">
						{data.bestWinStreak > 0 ? `🔥 ${data.bestWinStreak}` : '—'}
					</p>
					<p class="text-xs text-ayu-muted">Longest 1st place streak</p>
				</div>
				<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4 text-center">
					<p class="text-2xl font-bold text-white">
						{data.bestPodiumStreak > 0 ? data.bestPodiumStreak : '—'}
					</p>
					<p class="text-xs text-ayu-muted">Longest podium streak</p>
				</div>
			</div>
		{/if}

		<!-- Game badges (best performances) -->
		{#if data.gameBadges.length > 0}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Game Badges</h2>
				<div class="flex flex-wrap gap-2">
					{#each data.gameBadges as badge (badge.id)}
						<div class="group relative flex items-center gap-2 rounded-lg border border-ayu-border bg-ayu-surface2 px-3 py-2" title={badge.description}>
							<span class="text-xl">{badge.emoji}</span>
							<div>
								<p class="text-sm font-medium text-white leading-tight">{badge.name}</p>
								{#if badge.gameName}
									<p class="text-xs text-ayu-muted">{badge.gameEmoji} {badge.gameName}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Achievement badges -->
		{#if data.achievementBadges.length > 0}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Achievements</h2>
				<div class="flex flex-wrap gap-2">
					{#each data.achievementBadges as badge}
						<div class="flex items-center gap-2 rounded-lg border border-ayu-border bg-ayu-surface2 px-3 py-2" title={badge.desc}>
							<span class="text-xl">{badge.emoji}</span>
							<span class="text-sm font-medium text-white">{badge.label}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Per-game breakdown -->
		{#if data.perGame.length > 0}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Per Game</h2>
				<div class="space-y-1.5">
					{#each data.perGame as g}
						<div class="flex items-center justify-between rounded-lg bg-ayu-surface2 px-3 py-2 text-sm">
							<span class="text-white">{g.emoji} {g.name}</span>
							<div class="flex items-center gap-4 text-xs">
								<span class="text-ayu-gold">🥇 {g.gold}</span>
								<span class="text-zinc-400">🥈 {g.silver}</span>
								<span class="text-amber-700">🥉 {g.bronze}</span>
								<span class="text-ayu-muted">{g.played} played</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

	{/if}
</div>
