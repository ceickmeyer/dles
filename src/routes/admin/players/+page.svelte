<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { Player } from '$lib/database.types';

	let { data } = $props();
	type PlayerWithStats = Player & { sessions_played: number };
	const players = $derived(data.players as PlayerWithStats[]);

	let showPins = $state(false);
	let globalError = $state('');
	let editingAlias = $state<Record<string, string>>({});
	let savingAlias = $state<Record<string, boolean>>({});
	let editingPin = $state<Record<string, string>>({});
	let savingPin = $state<Record<string, boolean>>({});
	let pinError = $state<Record<string, string>>({});
	let copied = $state<string | null>(null);
	let confirmDeleteId = $state<string | null>(null);
	let deleting = $state(false);

	let mergeSourceId = $state<string | null>(null);
	let mergeTargetId = $state('');
	let mergeConfirm = $state(false);
	let merging = $state(false);

	function startEdit(p: Player) {
		editingAlias[p.id] = p.alias ?? '';
	}

	async function saveAlias(p: Player) {
		const alias = editingAlias[p.id]?.trim() || null;
		if (alias === (p.alias ?? null)) return;
		savingAlias[p.id] = true;
		const { error: e } = await supabase.from('players').update({ alias }).eq('id', p.id);
		savingAlias[p.id] = false;
		if (e) { globalError = e.message; return; }
		await invalidateAll();
	}

	async function deletePlayer(id: string) {
		deleting = true;
		const { error: e } = await supabase.from('players').delete().eq('id', id);
		deleting = false;
		if (e) { globalError = e.message; return; }
		confirmDeleteId = null;
		await invalidateAll();
	}

	function startEditPin(p: Player) {
		editingPin[p.id] = p.pin;
		pinError[p.id] = '';
	}

	async function savePin(p: Player) {
		const val = (editingPin[p.id] ?? '').trim();
		if (val === p.pin) return;
		if (!/^\d{4}$/.test(val)) { pinError[p.id] = 'Must be 4 digits'; return; }
		pinError[p.id] = '';
		savingPin[p.id] = true;
		const { error: e } = await supabase.from('players').update({ pin: val }).eq('id', p.id);
		savingPin[p.id] = false;
		if (e) { globalError = e.message; return; }
		delete editingPin[p.id];
		await invalidateAll();
	}

	async function copyPin(p: Player) {
		await navigator.clipboard.writeText(p.pin);
		copied = p.id;
		setTimeout(() => { copied = null; }, 1500);
	}

	async function copyAll() {
		const text = players
			.map((p) => `${p.name}${p.alias ? ` (${p.alias})` : ''}: PIN ${p.pin}`)
			.join('\n');
		await navigator.clipboard.writeText(text);
		copied = 'all';
		setTimeout(() => { copied = null; }, 1500);
	}

	function startMerge(p: PlayerWithStats) {
		mergeSourceId = p.id;
		mergeTargetId = '';
		mergeConfirm = false;
		confirmDeleteId = null;
		globalError = '';
	}

	function cancelMerge() {
		mergeSourceId = null;
		mergeTargetId = '';
		mergeConfirm = false;
	}

	async function executeMerge() {
		if (!mergeSourceId || !mergeTargetId) return;
		merging = true;
		globalError = '';

		const [{ data: sourceScores }, { data: targetScores }] = await Promise.all([
			supabase.from('scores').select('id, session_id, game_id').eq('player_id', mergeSourceId),
			supabase.from('scores').select('session_id, game_id').eq('player_id', mergeTargetId),
		]);

		const targetCombos = new Set((targetScores ?? []).map(s => `${s.session_id}:${s.game_id}`));
		const toMove = (sourceScores ?? []).filter(s => !targetCombos.has(`${s.session_id}:${s.game_id}`));
		const toDelete = (sourceScores ?? []).filter(s => targetCombos.has(`${s.session_id}:${s.game_id}`));

		if (toMove.length > 0) {
			const { error: e } = await supabase
				.from('scores')
				.update({ player_id: mergeTargetId })
				.in('id', toMove.map(s => s.id));
			if (e) { globalError = e.message; merging = false; return; }
		}

		if (toDelete.length > 0) {
			const { error: e } = await supabase
				.from('scores')
				.delete()
				.in('id', toDelete.map(s => s.id));
			if (e) { globalError = e.message; merging = false; return; }
		}

		await supabase
			.from('session_logs')
			.update({ player_id: mergeTargetId })
			.eq('player_id', mergeSourceId);

		const { error: e3 } = await supabase.from('players').delete().eq('id', mergeSourceId);
		if (e3) { globalError = e3.message; merging = false; return; }

		merging = false;
		cancelMerge();
		await invalidateAll();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-white">Players</h1>
			<p class="mt-0.5 text-sm text-ayu-muted">{players.length} registered</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={copyAll}
				class="rounded-lg border border-ayu-border px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:text-white"
			>
				{copied === 'all' ? 'Copied!' : 'Copy all PINs'}
			</button>
			<button
				onclick={() => (showPins = !showPins)}
				class="rounded-lg border border-ayu-border px-3 py-1.5 text-xs font-medium transition
					{showPins ? 'border-ayu-gold text-ayu-gold' : 'text-zinc-300 hover:text-white'}"
			>
				{showPins ? 'Hide PINs' : 'Reveal PINs'}
			</button>
		</div>
	</div>

	{#if players.length === 0}
		<p class="text-ayu-muted">No players have registered yet.</p>
	{:else}
		<div class="overflow-hidden rounded-xl border border-ayu-border">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-ayu-border bg-ayu-surface2 text-left text-xs font-semibold uppercase tracking-wider text-ayu-muted">
						<th class="px-4 py-3">Name</th>
						<th class="px-4 py-3">PIN</th>
						<th class="px-4 py-3">Alias</th>
						<th class="px-4 py-3 text-right">Sessions</th>
						<th class="px-4 py-3 text-right">Joined</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each players as p}
						<tr class="border-b border-ayu-border bg-ayu-surface {mergeSourceId !== p.id ? 'last:border-0' : ''}">
							<td class="px-4 py-3 font-medium text-white">
								<a href="/player/{p.id}" class="hover:text-ayu-gold transition">{p.name}</a>
							</td>
							<td class="px-4 py-3">
								<div class="flex flex-col gap-0.5">
									<div class="flex items-center gap-2">
										<input
											type={showPins ? 'text' : 'password'}
											value={editingPin[p.id] ?? p.pin}
											onfocus={() => startEditPin(p)}
											oninput={(e) => { editingPin[p.id] = (e.target as HTMLInputElement).value; pinError[p.id] = ''; }}
											onblur={() => savePin(p)}
											onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { delete editingPin[p.id]; (e.target as HTMLInputElement).blur(); } }}
											maxlength={4}
											inputmode="numeric"
											disabled={savingPin[p.id]}
											class="w-16 rounded border border-transparent bg-transparent px-1 py-0.5 text-center font-mono text-xs text-ayu-gold placeholder-ayu-muted transition
												focus:border-ayu-gold focus:bg-ayu-bg focus:outline-none hover:border-ayu-border disabled:opacity-50"
										/>
										<button
											onclick={() => copyPin(p)}
											class="text-xs text-ayu-muted transition hover:text-white"
										>
											{copied === p.id ? '✓' : 'copy'}
										</button>
									</div>
									{#if pinError[p.id]}
										<p class="text-xs text-ayu-red">{pinError[p.id]}</p>
									{/if}
								</div>
							</td>
							<td class="px-4 py-3">
								<input
									type="text"
									value={editingAlias[p.id] ?? p.alias ?? ''}
									placeholder="Set alias…"
									onfocus={() => startEdit(p)}
									oninput={(e) => { editingAlias[p.id] = (e.target as HTMLInputElement).value; }}
									onblur={() => saveAlias(p)}
									onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
									class="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-300 placeholder-ayu-muted/50 transition
										focus:border-ayu-gold focus:bg-ayu-bg focus:outline-none hover:border-ayu-border"
									disabled={savingAlias[p.id]}
								/>
							</td>
							<td class="px-4 py-3 text-right text-xs text-ayu-muted">
								{p.sessions_played}
							</td>
							<td class="px-4 py-3 text-right text-xs text-ayu-muted">
								{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
							</td>
							<td class="px-4 py-3 text-right">
								{#if confirmDeleteId === p.id}
									<span class="text-xs text-zinc-400">Sure?</span>
									<button
										onclick={() => deletePlayer(p.id)}
										disabled={deleting}
										class="ml-2 text-xs font-semibold text-ayu-red hover:brightness-125 disabled:opacity-50"
									>
										{deleting ? '…' : 'Yes'}
									</button>
									<button
										onclick={() => (confirmDeleteId = null)}
										class="ml-2 text-xs text-ayu-muted hover:text-white"
									>
										No
									</button>
								{:else if mergeSourceId === p.id}
									<!-- handled in expansion row below -->
								{:else}
									<button
										onclick={() => startMerge(p)}
										class="text-xs text-ayu-muted transition hover:text-ayu-blue mr-3"
									>
										Merge
									</button>
									<button
										onclick={() => (confirmDeleteId = p.id)}
										class="text-xs text-ayu-muted transition hover:text-ayu-red"
									>
										Delete
									</button>
								{/if}
							</td>
						</tr>
						{#if mergeSourceId === p.id}
							<tr class="border-b border-ayu-border bg-ayu-surface2 last:border-0">
								<td colspan="6" class="px-4 py-3">
									{#if mergeConfirm}
										<div class="flex flex-wrap items-center gap-3 text-sm">
											<span class="text-zinc-300">
												Move all scores from
												<span class="font-medium text-white">{p.name}</span>
												into
												<span class="font-medium text-ayu-gold">{players.find(x => x.id === mergeTargetId)?.name}</span>,
												then delete
												<span class="font-medium text-white">{p.name}</span>.
												This cannot be undone.
											</span>
											<button
												onclick={executeMerge}
												disabled={merging}
												class="rounded-lg bg-ayu-red/20 px-3 py-1 text-xs font-semibold text-ayu-red hover:bg-ayu-red/30 disabled:opacity-50 transition"
											>
												{merging ? 'Merging…' : 'Confirm merge'}
											</button>
											<button
												onclick={() => (mergeConfirm = false)}
												class="text-xs text-ayu-muted hover:text-white transition"
											>
												Back
											</button>
											<button
												onclick={cancelMerge}
												class="text-xs text-ayu-muted hover:text-white transition"
											>
												Cancel
											</button>
										</div>
									{:else}
										<div class="flex flex-wrap items-center gap-3 text-sm">
											<span class="text-zinc-300">Merge <span class="font-medium text-white">{p.name}</span> into:</span>
											<select
												bind:value={mergeTargetId}
												class="rounded-lg border border-ayu-border bg-ayu-bg px-2 py-1 text-sm text-zinc-300 focus:border-ayu-gold focus:outline-none"
											>
												<option value="">Select player…</option>
												{#each players.filter(x => x.id !== p.id) as target}
													<option value={target.id}>
														{target.name}{target.alias ? ` (${target.alias})` : ''} — {target.sessions_played} sessions
													</option>
												{/each}
											</select>
											<button
												onclick={() => { if (mergeTargetId) mergeConfirm = true; }}
												disabled={!mergeTargetId}
												class="rounded-lg border border-ayu-border px-3 py-1 text-xs font-medium text-zinc-300 hover:text-white disabled:opacity-40 transition"
											>
												Next →
											</button>
											<button
												onclick={cancelMerge}
												class="text-xs text-ayu-muted hover:text-white transition"
											>
												Cancel
											</button>
										</div>
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-xs text-ayu-muted">
			Deleting a player removes all their scores. Merging moves their scores to another player and deletes the duplicate.
			Alias is shown in parentheses in standings.
		</p>
	{/if}

	{#if globalError}
		<p class="text-sm text-ayu-red">{globalError}</p>
	{/if}
</div>
