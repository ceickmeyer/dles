<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { Player } from '$lib/database.types';

	let { data } = $props();
	const players = $derived(data.players as Player[]);

	let showPins = $state(false);
	let editingAlias = $state<Record<string, string>>({});
	let savingAlias = $state<Record<string, boolean>>({});
	let editingPin = $state<Record<string, string>>({});
	let savingPin = $state<Record<string, boolean>>({});
	let pinError = $state<Record<string, string>>({});
	let copied = $state<string | null>(null);
	let confirmDeleteId = $state<string | null>(null);
	let deleting = $state(false);

	function startEdit(p: Player) {
		editingAlias[p.id] = p.alias ?? '';
	}

	async function saveAlias(p: Player) {
		const alias = editingAlias[p.id]?.trim() || null;
		if (alias === (p.alias ?? null)) return;
		savingAlias[p.id] = true;
		await supabase.from('players').update({ alias }).eq('id', p.id);
		savingAlias[p.id] = false;
		await invalidateAll();
	}

	async function deletePlayer(id: string) {
		deleting = true;
		await supabase.from('players').delete().eq('id', id);
		deleting = false;
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
		await supabase.from('players').update({ pin: val }).eq('id', p.id);
		savingPin[p.id] = false;
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
						<th class="px-4 py-3 text-right">Joined</th>
						<th class="px-4 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each players as p}
						<tr class="border-b border-ayu-border bg-ayu-surface last:border-0">
							<td class="px-4 py-3 font-medium text-white">{p.name}</td>
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
								{:else}
									<button
										onclick={() => (confirmDeleteId = p.id)}
										class="text-xs text-ayu-muted transition hover:text-ayu-red"
									>
										Delete
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-xs text-ayu-muted">Deleting a player removes all their scores across all sessions. Alias is shown in parentheses in standings.</p>
	{/if}
</div>
