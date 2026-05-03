<script lang="ts">
	let { data } = $props();
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
			{#each [
				{ label: 'Nights played', value: String(data.nights) },
				{ label: 'Win rate', value: data.winRate > 0 ? `${data.winRate}%` : '—' },
				{ label: 'Best at', value: data.favGame ? `${data.favGame.emoji} ${data.favGame.name}` : '—' }
			] as stat}
				<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4 text-center">
					<p class="text-lg font-bold text-white">{stat.value}</p>
					<p class="text-xs text-ayu-muted">{stat.label}</p>
				</div>
			{/each}
		</div>

		<!-- Streaks -->
		{#if data.winStreak > 0 || data.podiumStreak > 0 || data.bestWinStreak > 0}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Streaks</h2>
				<div class="flex flex-wrap gap-6">
					{#if data.winStreak > 0}
						<div>
							<p class="text-2xl font-bold text-ayu-gold">🔥 {data.winStreak}</p>
							<p class="text-xs text-ayu-muted">Current win streak</p>
						</div>
					{/if}
					{#if data.podiumStreak > 0}
						<div>
							<p class="text-2xl font-bold text-white">{data.podiumStreak}</p>
							<p class="text-xs text-ayu-muted">Current podium streak</p>
						</div>
					{/if}
					{#if data.bestWinStreak > 1}
						<div>
							<p class="text-2xl font-bold text-zinc-400">{data.bestWinStreak}</p>
							<p class="text-xs text-ayu-muted">Best win streak ever</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Badges -->
		{#if data.badges.length > 0}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Badges</h2>
				<div class="flex flex-wrap gap-2">
					{#each data.badges as badge}
						<div
							class="flex items-center gap-2 rounded-lg border border-ayu-border bg-ayu-surface2 px-3 py-2"
							title={badge.desc}
						>
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

		<!-- Recent sessions -->
		{#if data.recentSessions.length > 0}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Recent Sessions</h2>
				<div class="space-y-1.5">
					{#each data.recentSessions as s}
						<div class="flex items-center justify-between rounded-lg bg-ayu-surface2 px-3 py-2 text-sm">
							<div>
								<span class="text-white">{s.name}</span>
								<span class="ml-2 text-xs text-ayu-muted">
									{new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
								</span>
							</div>
							<div class="flex items-center gap-3">
								<span class="text-xs text-ayu-muted">#{s.rank} of {s.outOf}</span>
								{#if s.total > 0}
									<span class="text-xs">
										{#if s.gold > 0}<span class="text-ayu-gold">🥇×{s.gold}</span>{/if}
										{#if s.silver > 0}<span class="text-zinc-400 ml-1">🥈×{s.silver}</span>{/if}
										{#if s.bronze > 0}<span class="text-amber-700 ml-1">🥉×{s.bronze}</span>{/if}
									</span>
								{:else}
									<span class="text-xs text-ayu-muted">No medals</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
