<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { runScheduler } from '$lib/scheduler';

	let { data } = $props();

	type GameInfo = { id: string; name: string; icon_emoji: string | null };

	const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	type DayDraft = {
		gameIds: string[];
		specialGameId: string | null;
		dirty: boolean;
		saving: boolean;
		error: string;
	};

	function initDrafts(): DayDraft[] {
		return DAYS.map((_, i) => {
			const row = (data.schedule as { day_of_week: number; game_ids: string[]; special_game_id: string | null }[])
				.find(s => s.day_of_week === i);
			return {
				gameIds: row ? [...row.game_ids] : [],
				specialGameId: row?.special_game_id ?? null,
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

	const gameMap = $derived(new Map((data.games as GameInfo[]).map(g => [g.id, g])));

	async function triggerScheduler() {
		scheduling = true;
		scheduleMsg = '';
		try {
			const result = await runScheduler(supabase);
			const parts: string[] = [];
			if (result.finished) parts.push(`Finished ${result.finished} stale session${result.finished > 1 ? 's' : ''}`);
			if (result.created) parts.push(`Created "${result.sessionName}"`);
			else if (result.skippedReason === 'session_exists') parts.push('Today\'s session already exists');
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
		const { error } = await supabase
			.from('weekly_schedule')
			.upsert(
				{ day_of_week: i, game_ids: d.gameIds, special_game_id: d.specialGameId },
				{ onConflict: 'day_of_week' }
			);
		d.saving = false;
		if (error) { d.error = error.message; }
		else { d.dirty = false; }
	}

	function copyToAll(i: number) {
		const src = drafts[i];
		for (let j = 0; j < 7; j++) {
			if (j === i) continue;
			drafts[j].gameIds = [...src.gameIds];
			drafts[j].specialGameId = src.specialGameId;
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
		d.gameIds = d.gameIds.filter(id => id !== gameId);
		if (d.specialGameId === gameId) d.specialGameId = null;
		d.dirty = true;
	}

	function toggleSpecial(i: number, gameId: string) {
		const d = drafts[i];
		d.specialGameId = d.specialGameId === gameId ? null : gameId;
		d.dirty = true;
	}

	function moveUp(i: number, gi: number) {
		if (gi === 0) return;
		const d = drafts[i];
		const ids = [...d.gameIds];
		[ids[gi - 1], ids[gi]] = [ids[gi], ids[gi - 1]];
		d.gameIds = ids;
		d.dirty = true;
	}

	function moveDown(i: number, gi: number) {
		const d = drafts[i];
		if (gi >= d.gameIds.length - 1) return;
		const ids = [...d.gameIds];
		[ids[gi], ids[gi + 1]] = [ids[gi + 1], ids[gi]];
		d.gameIds = ids;
		d.dirty = true;
	}

	function availableGames(i: number): GameInfo[] {
		const added = new Set(drafts[i].gameIds);
		return (data.games as GameInfo[]).filter(g => !added.has(g.id));
	}
</script>

<div class="space-y-6">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-white">Weekly Schedule</h1>
			<p class="mt-0.5 text-sm text-ayu-muted">Repeats every week. ⭐ = featured game of the day.</p>
		</div>
		<div class="flex shrink-0 flex-col items-end gap-1.5">
			<div class="flex gap-2">
				{#if drafts.some(d => d.dirty)}
					<button
						onclick={() => drafts.forEach((_, i) => { if (drafts[i].dirty) save(i); })}
						class="rounded-lg border border-ayu-gold px-4 py-2 text-sm font-bold text-ayu-gold transition hover:bg-ayu-gold/10"
					>Save all</button>
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
				<p class="text-xs {scheduleMsgType === 'err' ? 'text-ayu-red' : 'text-ayu-green'}">{scheduleMsg}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each DAYS as dayName, i}
			{@const d = drafts[i]}
			<div class="flex flex-col overflow-hidden rounded-xl border transition-colors {d.dirty ? 'border-ayu-gold/60' : 'border-ayu-border'} bg-ayu-surface">

				<!-- Day header -->
				<div class="flex items-center justify-between gap-2 border-b border-ayu-border px-4 py-3">
					<p class="font-semibold text-white">{dayName}</p>
					<div class="flex items-center gap-1.5">
						{#if d.gameIds.length > 0}
							<button
								onclick={() => copyToAll(i)}
								title="Copy these games to all other days"
								class="rounded-lg px-2 py-1 text-xs text-ayu-muted transition hover:text-white"
							>→ all</button>
						{/if}
						<button
							onclick={() => save(i)}
							disabled={!d.dirty || d.saving}
							class="rounded-lg px-3 py-1 text-xs font-bold transition disabled:opacity-40
								{d.dirty ? 'bg-ayu-gold text-ayu-bg hover:brightness-110' : 'bg-ayu-surface2 text-ayu-muted'}"
						>
							{d.saving ? '…' : 'Save'}
						</button>
					</div>
				</div>

				<!-- Game list -->
				<div class="flex-1 p-3 space-y-0.5">
					{#if d.gameIds.length === 0}
						<p class="py-4 text-center text-xs text-ayu-muted">No games configured.</p>
					{:else}
						{#each d.gameIds as gameId, gi}
							{@const game = gameMap.get(gameId)}
							{#if game}
								<div class="group flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-ayu-surface2">
									<button
										onclick={() => toggleSpecial(i, gameId)}
										title="Set as featured game"
										class="shrink-0 text-sm leading-none transition {d.specialGameId === gameId ? 'text-ayu-gold' : 'text-zinc-600 hover:text-zinc-400'}"
									>
										{d.specialGameId === gameId ? '⭐' : '☆'}
									</button>
									<span class="shrink-0 text-base leading-none">{game.icon_emoji ?? '🎮'}</span>
									<span class="flex-1 truncate text-sm text-white">{game.name}</span>
									<div class="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
										<button
											onclick={() => moveUp(i, gi)}
											disabled={gi === 0}
											class="flex h-5 w-5 items-center justify-center rounded text-xs text-ayu-muted hover:text-white disabled:opacity-20"
										>↑</button>
										<button
											onclick={() => moveDown(i, gi)}
											disabled={gi === d.gameIds.length - 1}
											class="flex h-5 w-5 items-center justify-center rounded text-xs text-ayu-muted hover:text-white disabled:opacity-20"
										>↓</button>
										<button
											onclick={() => removeGame(i, gameId)}
											class="flex h-5 w-5 items-center justify-center rounded text-xs text-ayu-muted hover:text-ayu-red"
										>×</button>
									</div>
								</div>
							{/if}
						{/each}
					{/if}
				</div>

				<!-- Add game -->
				<div class="border-t border-ayu-border px-3 pb-3 pt-2">
					<select
						onchange={(e) => {
							addGame(i, (e.target as HTMLSelectElement).value);
							(e.target as HTMLSelectElement).value = '';
						}}
						class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-2 py-1.5 text-sm text-white focus:border-ayu-gold focus:outline-none"
					>
						<option value="">+ Add game…</option>
						{#each availableGames(i) as g (g.id)}
							<option value={g.id}>{g.icon_emoji ?? '🎮'} {g.name}</option>
						{/each}
					</select>
					{#if d.error}
						<p class="mt-1 text-xs text-ayu-red">{d.error}</p>
					{/if}
				</div>

			</div>
		{/each}
	</div>
</div>
