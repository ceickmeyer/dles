<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { PARSER_OPTIONS } from '$lib/parsers';

	let name = $state('');
	let url = $state('');
	let iconEmoji = $state('');
	let scoringDirection = $state<'higher_is_better' | 'lower_is_better'>('lower_is_better');
	let maxScore = $state('');
	let shareParser = $state('');
	let saving = $state(false);
	let error = $state('');

	async function save() {
		if (!name.trim()) { error = 'Name is required.'; return; }
		saving = true;
		error = '';
		const { error: e } = await supabase.from('games').insert({
			name: name.trim(),
			url: url.trim() || null,
			icon_emoji: iconEmoji.trim() || null,
			scoring_direction: scoringDirection,
			max_score: maxScore ? parseInt(maxScore, 10) : null,
			share_parser: shareParser || null
		});
		if (e) {
			error = e.message;
			saving = false;
		} else {
			goto('/admin/games');
		}
	}
</script>

<div class="max-w-lg space-y-6">
	<div>
		<a href="/admin/games" class="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">← Games</a>
		<h1 class="text-2xl font-bold text-white">Add Game</h1>
	</div>

	<div class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<div class="grid grid-cols-[1fr_80px] gap-3">
			<div>
				<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="name">Name *</label>
				<input
					id="name"
					bind:value={name}
					placeholder="Wordle"
					class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="emoji">Emoji</label>
				<input
					id="emoji"
					bind:value={iconEmoji}
					placeholder="🟩"
					maxlength={2}
					class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-center text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
				/>
			</div>
		</div>

		<div>
			<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="url">URL</label>
			<input
				id="url"
				type="url"
				bind:value={url}
				placeholder="https://..."
				class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
			/>
		</div>

		<div>
			<p class="mb-2 text-sm font-medium text-zinc-300">Scoring direction *</p>
			<div class="flex gap-4">
				<label class="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
					<input type="radio" bind:group={scoringDirection} value="lower_is_better" class="accent-amber-400" />
					Lower is better (Wordle, Framed…)
				</label>
				<label class="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
					<input type="radio" bind:group={scoringDirection} value="higher_is_better" class="accent-amber-400" />
					Higher is better (TimeGuessr…)
				</label>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="max">Max score</label>
				<input
					id="max"
					type="number"
					bind:value={maxScore}
					placeholder="e.g. 25000"
					class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="parser">Share parser</label>
				<select
					id="parser"
					bind:value={shareParser}
					class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
				>
					{#each PARSER_OPTIONS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	{#if error}
		<p class="text-sm text-red-400">{error}</p>
	{/if}

	<button
		onclick={save}
		disabled={saving}
		class="rounded-lg bg-amber-400 px-6 py-3 font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
	>
		{saving ? 'Saving…' : 'Add game'}
	</button>
</div>
