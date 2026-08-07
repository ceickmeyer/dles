<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { runScheduler } from '$lib/scheduler';

	let { data } = $props();

	type GameInfo = { id: string; name: string; icon_emoji: string | null };

	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
	let scheduling = $state(false);
	let scheduleMsg = $state('');
	let scheduleMsgType = $state<'ok' | 'err'>('ok');
	let sortDay = $state<number | null>(null);

	const anyDirty = $derived(drafts.some((d) => d.dirty));

	const sortedGames = $derived(
		[...(data.games as GameInfo[])].sort((a, b) => {
			if (sortDay !== null) {
				const aIn = drafts[sortDay].gameIds.includes(a.id);
				const bIn = drafts[sortDay].gameIds.includes(b.id);
				if (aIn && !bIn) return -1;
				if (!aIn && bIn) return 1;
			}
			return a.name.localeCompare(b.name);
		})
	);

	// 0 = not scheduled, 1 = scheduled, 2 = featured (gold)
	function cellState(gameId: string, dayIdx: number): 0 | 1 | 2 {
		const d = drafts[dayIdx];
		if (!d.gameIds.includes(gameId)) return 0;
		if (!d.randomSpecial && d.specialGameId === gameId) return 2;
		return 1;
	}

	function cycleCell(gameId: string, dayIdx: number) {
		const d = drafts[dayIdx];
		const state = cellState(gameId, dayIdx);
		if (state === 0) {
			d.gameIds = [...d.gameIds, gameId];
		} else if (state === 1) {
			if (d.randomSpecial) {
				d.gameIds = d.gameIds.filter((id) => id !== gameId);
			} else {
				d.specialGameId = gameId;
			}
		} else {
			d.gameIds = d.gameIds.filter((id) => id !== gameId);
			d.specialGameId = null;
		}
		d.dirty = true;
	}

	function toggleRandom(dayIdx: number) {
		const d = drafts[dayIdx];
		d.randomSpecial = !d.randomSpecial;
		if (d.randomSpecial) d.specialGameId = null;
		d.dirty = true;
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
		if (error) d.error = error.message;
		else d.dirty = false;
	}

	async function saveAll() {
		await Promise.all(drafts.map((d, i) => (d.dirty ? save(i) : Promise.resolve())));
	}

	async function triggerScheduler() {
		scheduling = true;
		scheduleMsg = '';
		try {
			const result = await runScheduler(supabase);
			const parts: string[] = [];
			if (result.finished)
				parts.push(`Finished ${result.finished} session${result.finished > 1 ? 's' : ''}`);
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
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-white">Array Scheduler</h1>
			<p class="mt-0.5 text-xs text-ayu-muted">
				○ → ● scheduled → ⭐ featured → ○. Click a column header to sort. 🎲 picks a random
				featured at session start.
			</p>
		</div>
		<div class="flex flex-col items-end gap-1.5">
			<div class="flex gap-2">
				{#if anyDirty}
					<button
						onclick={saveAll}
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

	<!-- Grid -->
	<div class="overflow-x-auto rounded-xl border border-ayu-border">
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr class="border-b border-ayu-border bg-ayu-surface">
					<!-- Game column header -->
					<th class="sticky left-0 z-10 bg-ayu-surface px-4 py-3 text-left">
						<button
							onclick={() => (sortDay = null)}
							class="text-xs font-semibold tracking-wider uppercase transition {sortDay === null
								? 'text-ayu-gold'
								: 'text-ayu-muted hover:text-white'}"
						>
							Game {sortDay === null ? '↑' : ''}
						</button>
					</th>
					<!-- Day column headers -->
					{#each DAYS as day, i}
						{@const d = drafts[i]}
						<th class="w-16 px-1 py-2">
							<div class="flex flex-col items-center gap-1">
								<button
									onclick={() => (sortDay = sortDay === i ? null : i)}
									class="flex items-center gap-1 text-xs font-semibold tracking-wider uppercase transition {sortDay ===
									i
										? 'text-ayu-gold'
										: 'text-ayu-muted hover:text-white'}"
								>
									{day}{#if sortDay === i}&nbsp;↑{/if}
									{#if d.dirty}
										<span class="inline-block h-1.5 w-1.5 rounded-full bg-ayu-gold"></span>
									{/if}
								</button>
								<button
									onclick={() => toggleRandom(i)}
									title={d.randomSpecial
										? 'Random featured on — click to disable'
										: 'Click to enable random featured'}
									class="rounded px-1 py-0.5 text-xs leading-none transition {d.randomSpecial
										? 'text-ayu-gold'
										: 'text-zinc-700 hover:text-zinc-500'}"
								>
									🎲
								</button>
								<span class="text-[10px] tabular-nums leading-none text-zinc-600"
									>{d.gameIds.length}</span
								>
								{#if d.saving}
									<span class="text-[10px] text-ayu-muted">saving…</span>
								{:else if d.error}
									<span class="text-[10px] text-ayu-red" title={d.error}>err</span>
								{/if}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each sortedGames as game, rowIdx (game.id)}
					<tr class="group border-b border-ayu-border/40 last:border-0">
						<td
							class="sticky left-0 z-10 bg-ayu-bg px-4 py-2 transition-colors group-hover:bg-ayu-surface/70"
						>
							<div class="flex min-w-0 items-center gap-2">
								<span class="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-600">{rowIdx + 1}</span>
								<span class="shrink-0 text-base leading-none">{game.icon_emoji ?? '🎮'}</span>
								<span class="truncate font-medium text-white">{game.name}</span>
							</div>
						</td>
						{#each DAYS as _, dayIdx}
							{@const state = cellState(game.id, dayIdx)}
							{@const rnd = drafts[dayIdx].randomSpecial}
							<td class="px-1 py-2 transition-colors group-hover:bg-ayu-surface/30">
								<div class="flex justify-center">
									<button
										onclick={() => cycleCell(game.id, dayIdx)}
										title={state === 0
											? `Add to ${DAYS[dayIdx]}`
											: state === 1
												? rnd
													? `Remove from ${DAYS[dayIdx]}`
													: `Set as featured for ${DAYS[dayIdx]}`
												: `Remove from ${DAYS[dayIdx]}`}
										class="h-7 w-7 rounded-full transition-all duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ayu-gold
											{state === 0
											? 'border border-zinc-700 hover:border-zinc-400 hover:bg-zinc-800'
											: state === 1
												? rnd
													? 'bg-ayu-blue/60 hover:bg-ayu-blue/40'
													: 'bg-zinc-300 hover:bg-ayu-gold/50'
												: 'bg-ayu-gold hover:bg-ayu-gold/70'}"
									></button>
								</div>
							</td>
						{/each}
					</tr>
				{/each}
				{#if (data.games as GameInfo[]).length === 0}
					<tr>
						<td colspan="8" class="px-4 py-8 text-center text-sm text-ayu-muted">
							No games yet. <a href="/admin/games/new" class="text-ayu-gold hover:underline"
								>Add one →</a
							>
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>

	<!-- Legend -->
	<div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-zinc-500">
		<span class="flex items-center gap-1.5"
			><span class="inline-block h-3 w-3 rounded-full border border-zinc-700"></span>Not scheduled</span
		>
		<span class="flex items-center gap-1.5"
			><span class="inline-block h-3 w-3 rounded-full bg-zinc-300"></span>Scheduled</span
		>
		<span class="flex items-center gap-1.5"
			><span class="inline-block h-3 w-3 rounded-full bg-ayu-gold"></span>Featured ⭐</span
		>
		<span class="flex items-center gap-1.5"
			><span class="inline-block h-3 w-3 rounded-full bg-ayu-blue/60"></span>Scheduled (random
			featured 🎲)</span
		>
	</div>
</div>
