<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { runScheduler } from '$lib/scheduler';

	let { data } = $props();

	type GameInfo = { id: string; name: string; icon_emoji: string | null };

	const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	type DayDraft = {
		gameIds: string[];
		specialGameId: string | null;
		randomSpecial: boolean;
		dirty: boolean;
		saving: boolean;
		error: string;
	};

	function initDrafts(): DayDraft[] {
		return DAYS.map((_, i) => {
			const row = (
				data.schedule as {
					day_of_week: number;
					game_ids: string[];
					special_game_id: string | null;
					random_special: boolean;
				}[]
			).find((s) => s.day_of_week === i);
			return {
				gameIds: row ? [...row.game_ids] : [],
				specialGameId: row?.special_game_id ?? null,
				randomSpecial: row?.random_special ?? false,
				dirty: false,
				saving: false,
				error: ''
			};
		});
	}

	let drafts = $state<DayDraft[]>(initDrafts());
	let selectedDay = $state(new Date().getDay());
	let scheduling = $state(false);
	let scheduleMsg = $state('');
	let scheduleMsgType = $state<'ok' | 'err'>('ok');

	const gameMap = $derived(new Map((data.games as GameInfo[]).map((g) => [g.id, g])));

	// Games sorted: featured pinned first (when fixed), then A-Z
	const displayOrder = $derived(
		[...d.gameIds].sort((a, b) => {
			if (!d.randomSpecial) {
				if (a === d.specialGameId) return -1;
				if (b === d.specialGameId) return 1;
			}
			return (gameMap.get(a)?.name ?? '').localeCompare(gameMap.get(b)?.name ?? '');
		})
	);

	async function triggerScheduler() {
		scheduling = true;
		scheduleMsg = '';
		try {
			const result = await runScheduler(supabase);
			const parts: string[] = [];
			if (result.finished)
				parts.push(`Finished ${result.finished} stale session${result.finished > 1 ? 's' : ''}`);
			if (result.created) parts.push(`Created "${result.sessionName}"`);
			else if (result.skippedReason === 'session_exists')
				parts.push("Today's session already exists");
			else if (result.skippedReason === 'no_schedule') parts.push('No games configured for today');
			scheduleMsg = parts.join(' · ');
			scheduleMsgType = 'ok';
		} catch {
			scheduleMsg = 'Scheduler error — check console.';
			scheduleMsgType = 'err';
		}
		scheduling = false;
	}

	async function save(i: number) {
		const d = drafts[i];
		d.saving = true;
		d.error = '';
		const { error } = await supabase.from('weekly_schedule').upsert(
			{
				day_of_week: i,
				game_ids: d.gameIds,
				special_game_id: d.randomSpecial ? null : d.specialGameId,
				random_special: d.randomSpecial
			},
			{ onConflict: 'day_of_week' }
		);
		d.saving = false;
		if (error) {
			d.error = error.message;
		} else {
			d.dirty = false;
		}
	}

	function copyToAll(i: number) {
		const src = drafts[i];
		for (let j = 0; j < 7; j++) {
			if (j === i) continue;
			drafts[j].gameIds = [...src.gameIds];
			drafts[j].specialGameId = src.specialGameId;
			drafts[j].randomSpecial = src.randomSpecial;
			drafts[j].dirty = true;
		}
	}

	function addGame(i: number, gameId: string) {
		if (!gameId) return;
		const d = drafts[i];
		if (d.gameIds.includes(gameId)) return;
		d.gameIds = [...d.gameIds, gameId];
		d.dirty = true;
	}

	function removeGame(i: number, gameId: string) {
		const d = drafts[i];
		d.gameIds = d.gameIds.filter((id) => id !== gameId);
		if (d.specialGameId === gameId) d.specialGameId = null;
		d.dirty = true;
	}

	function toggleSpecial(i: number, gameId: string) {
		const d = drafts[i];
		d.specialGameId = d.specialGameId === gameId ? null : gameId;
		d.dirty = true;
	}

	function toggleRandom(i: number) {
		const d = drafts[i];
		d.randomSpecial = !d.randomSpecial;
		if (d.randomSpecial) d.specialGameId = null;
		d.dirty = true;
	}

	function availableGames(i: number): GameInfo[] {
		const added = new Set(drafts[i].gameIds);
		return (data.games as GameInfo[]).filter((g) => !added.has(g.id));
	}

	const anyDirty = $derived(drafts.some((d) => d.dirty));
	const d = $derived(drafts[selectedDay]);
</script>

<div class="space-y-5">
	<!-- Header -->
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-white">Weekly Schedule</h1>
			<p class="mt-0.5 text-sm text-ayu-muted">Repeats every week. ⭐ marks the featured game.</p>
		</div>
		<div class="flex flex-col items-end gap-1.5">
			<div class="flex gap-2">
				{#if anyDirty}
					<button
						onclick={() =>
							drafts.forEach((_, i) => {
								if (drafts[i].dirty) save(i);
							})}
						class="rounded-lg border border-ayu-gold px-4 py-2 text-sm font-bold text-ayu-gold transition hover:bg-ayu-gold/10"
					>
						Save all
					</button>
				{/if}
				<button
					onclick={triggerScheduler}
					disabled={scheduling}
					class="rounded-lg bg-ayu-gold px-4 py-2 text-sm font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50"
				>
					{scheduling ? 'Running…' : 'Run Scheduler'}
				</button>
			</div>
			{#if scheduleMsg}
				<p class="text-xs {scheduleMsgType === 'err' ? 'text-ayu-red' : 'text-ayu-green'}">
					{scheduleMsg}
				</p>
			{/if}
		</div>
	</div>

	<!-- Day tabs -->
	<div class="flex gap-1 rounded-xl border border-ayu-border bg-ayu-surface p-1">
		{#each DAYS as dayName, i}
			{@const isDirty = drafts[i].dirty}
			{@const isSelected = selectedDay === i}
			<button
				onclick={() => (selectedDay = i)}
				class="relative flex-1 rounded-lg py-2 text-xs font-semibold transition sm:text-sm
					{isSelected
						? 'bg-ayu-gold text-ayu-bg'
						: 'text-ayu-muted hover:bg-ayu-surface2 hover:text-white'}"
			>
				<span class="hidden sm:inline">{dayName.slice(0, 3)}</span>
				<span class="sm:hidden">{dayName.slice(0, 1)}</span>
				{#if isDirty && !isSelected}
					<span
						class="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-ayu-gold"
						aria-label="unsaved"
					></span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Selected day panel -->
	<div
		class="rounded-xl border bg-ayu-surface transition-colors {d.dirty
			? 'border-ayu-gold/40'
			: 'border-ayu-border'}"
	>
		<!-- Panel header -->
		<div class="flex items-center justify-between gap-3 border-b border-ayu-border px-5 py-3">
			<p class="font-semibold text-white">{DAYS[selectedDay]}</p>
			<div class="flex items-center gap-2">
				{#if d.gameIds.length > 0}
					<button
						onclick={() => copyToAll(selectedDay)}
						title="Copy these games to all other days"
						class="rounded-lg px-2 py-1 text-xs text-ayu-muted transition hover:text-white"
					>
						→ copy to all days
					</button>
				{/if}
				<button
					onclick={() => save(selectedDay)}
					disabled={!d.dirty || d.saving}
					class="rounded-lg px-4 py-1.5 text-sm font-bold transition disabled:opacity-40
						{d.dirty
						? 'bg-ayu-gold text-ayu-bg hover:brightness-110'
						: 'bg-ayu-surface2 text-ayu-muted'}"
				>
					{d.saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>

		<!-- Random featured toggle -->
		{#if d.gameIds.length > 0}
			<div class="flex items-center justify-between border-b border-ayu-border px-5 py-2.5">
				<div>
					<span class="text-sm text-zinc-300">🎲 Random featured game</span>
					<span class="ml-2 text-xs text-ayu-muted">Pick a random ⭐ when the session starts</span>
				</div>
				<button
					onclick={() => toggleRandom(selectedDay)}
					role="switch"
					aria-checked={d.randomSpecial}
					class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors
						{d.randomSpecial ? 'bg-ayu-gold' : 'bg-ayu-border'}"
				>
					<span
						class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
							{d.randomSpecial ? 'translate-x-4.5' : 'translate-x-0.5'}"
					></span>
				</button>
			</div>
		{/if}

		<!-- Game list -->
		<div class="min-h-30 p-4">
			{#if d.gameIds.length === 0}
				<p class="py-8 text-center text-sm text-ayu-muted">No games configured for this day.</p>
			{:else}
				<div class="space-y-1">
					{#each displayOrder as gameId, rowIdx (gameId)}
						{@const game = gameMap.get(gameId)}
						{@const isFeatured = d.specialGameId === gameId}
						{#if game}
							<div
								class="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-ayu-surface2"
							>
								<span class="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-600">{rowIdx + 1}</span>
								<!-- Featured indicator -->
								{#if d.randomSpecial}
									<span class="w-5 shrink-0 text-center text-sm text-zinc-600" title="Any game may be chosen as featured">🎲</span>
								{:else}
									<button
										onclick={() => toggleSpecial(selectedDay, gameId)}
										title={isFeatured ? 'Remove featured' : 'Set as featured game'}
										class="shrink-0 text-base leading-none transition {isFeatured
											? 'text-ayu-gold'
											: 'text-zinc-600 hover:text-zinc-400'}"
									>
										{isFeatured ? '⭐' : '☆'}
									</button>
								{/if}

								<!-- Game identity -->
								<span class="shrink-0 text-lg leading-none">{game.icon_emoji ?? '🎮'}</span>
								<span class="flex-1 text-sm text-white">{game.name}</span>

								<!-- Remove (visible on hover) -->
								<button
									onclick={() => removeGame(selectedDay, gameId)}
									class="flex h-6 w-6 items-center justify-center rounded text-sm text-ayu-muted opacity-0 transition hover:text-ayu-red group-hover:opacity-100"
								>×</button>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Add game -->
		<div class="border-t border-ayu-border px-4 pb-4 pt-3">
			<select
				onchange={(e) => {
					addGame(selectedDay, (e.target as HTMLSelectElement).value);
					(e.target as HTMLSelectElement).value = '';
				}}
				class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-sm text-white focus:border-ayu-gold focus:outline-none sm:w-72"
			>
				<option value="">+ Add game…</option>
				{#each availableGames(selectedDay) as g (g.id)}
					<option value={g.id}>{g.icon_emoji ?? '🎮'} {g.name}</option>
				{/each}
			</select>
			{#if d.error}
				<p class="mt-1 text-xs text-ayu-red">{d.error}</p>
			{/if}
		</div>
	</div>
</div>
