<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { PARSER_OPTIONS, testCustomRegex } from '$lib/parsers';

	let { data } = $props();

	let name = $state(data.game.name);
	let url = $state(data.game.url ?? '');
	let iconEmoji = $state(data.game.icon_emoji ?? '');
	let scoringDirection = $state<'higher_is_better' | 'lower_is_better'>(data.game.scoring_direction);
	let maxScore = $state(data.game.max_score?.toString() ?? '');
	let shareParser = $state(data.game.share_parser ?? '');
	let shareRegex = $state(data.game.share_regex ?? '');
	let regexSample = $state('');
	let allowDnf = $state(data.game.allow_dnf);
	let saving = $state(false);
	let deleting = $state(false);
	let confirmDelete = $state(false);
	let error = $state('');

	const regexTestResult = $derived.by(() => {
		if (!shareRegex.trim() || !regexSample.trim()) return null;
		return testCustomRegex(shareRegex.trim(), regexSample.trim());
	});

	async function save() {
		if (!name.trim()) { error = 'Name is required.'; return; }
		if (shareParser === 'custom' && !shareRegex.trim()) { error = 'Enter a regex pattern for the custom parser.'; return; }
		saving = true;
		error = '';
		const { error: e } = await supabase.from('games').update({
			name: name.trim(),
			url: url.trim() || null,
			icon_emoji: iconEmoji.trim() || null,
			scoring_direction: scoringDirection,
			max_score: maxScore ? parseInt(maxScore, 10) : null,
			share_parser: shareParser || null,
			share_regex: shareParser === 'custom' ? (shareRegex.trim() || null) : null,
			allow_dnf: allowDnf
		}).eq('id', data.game.id);
		saving = false;
		if (e) error = e.message;
		else goto('/admin/games');
	}

	async function deleteGame() {
		deleting = true;
		const { error: e } = await supabase.from('games').delete().eq('id', data.game.id);
		if (e) {
			error = e.code === '23503'
				? 'This game has scores or session history — remove those first.'
				: e.message;
			deleting = false;
			confirmDelete = false;
		} else {
			goto('/admin/games');
		}
	}
</script>

<div class="max-w-lg space-y-6">
	<div>
		<a href="/admin/games" class="mb-4 inline-flex items-center gap-1 text-sm text-ayu-muted hover:text-white">← Games</a>
		<h1 class="text-2xl font-bold text-white">Edit Game</h1>
	</div>

	<div class="space-y-4 rounded-xl border border-ayu-border bg-ayu-surface p-5">
		<div class="grid grid-cols-[1fr_80px] gap-3">
			<div>
				<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="name">Name *</label>
				<input
					id="name"
					bind:value={name}
					class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="emoji">Emoji</label>
				<input
					id="emoji"
					bind:value={iconEmoji}
					maxlength={2}
					class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-center text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
				/>
			</div>
		</div>

		<div>
			<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="url">URL</label>
			<input
				id="url"
				type="url"
				bind:value={url}
				class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
			/>
		</div>

		<div>
			<p class="mb-2 text-sm font-medium text-zinc-300">Scoring direction *</p>
			<div class="flex flex-wrap gap-4">
				<label class="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
					<input type="radio" bind:group={scoringDirection} value="lower_is_better" class="accent-ayu-gold" />
					Lower is better (Wordle, Framed…)
				</label>
				<label class="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
					<input type="radio" bind:group={scoringDirection} value="higher_is_better" class="accent-ayu-gold" />
					Higher is better (TimeGuessr…)
				</label>
			</div>
		</div>

		<label class="flex cursor-pointer items-center gap-3">
			<input type="checkbox" bind:checked={allowDnf} class="accent-ayu-gold h-4 w-4" />
			<span class="text-sm text-zinc-300">Allow "Did not solve" option</span>
		</label>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="max">Max score</label>
				<input
					id="max"
					type="number"
					bind:value={maxScore}
					placeholder="e.g. 25000"
					class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="parser">Share parser</label>
				<select
					id="parser"
					bind:value={shareParser}
					class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white focus:border-ayu-gold focus:outline-none"
				>
					{#each PARSER_OPTIONS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
		</div>

		{#if shareParser === 'custom'}
			<div class="rounded-lg border border-ayu-border bg-ayu-bg p-4 space-y-3">
				<p class="text-xs font-semibold uppercase tracking-wider text-ayu-muted">Custom Regex Builder</p>
				<div>
					<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="regex">Regex pattern</label>
					<input
						id="regex"
						bind:value={shareRegex}
						placeholder="e.g. Score:\s*(\d+)"
						class="w-full rounded-lg border border-ayu-border bg-ayu-surface px-3 py-2 font-mono text-sm text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
					/>
					<p class="mt-1 text-xs text-ayu-muted">Use a capture group <code class="text-ayu-gold">(\d+)</code> to extract the number. Case-insensitive.</p>
				</div>
				<div>
					<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="sample">Test with sample text</label>
					<textarea
						id="sample"
						bind:value={regexSample}
						rows={3}
						placeholder="Paste share text from the game to test your regex…"
						class="w-full resize-none rounded-lg border border-ayu-border bg-ayu-surface px-3 py-2 text-sm text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
					></textarea>
				</div>
				{#if regexSample.trim() && shareRegex.trim()}
					<div class="rounded-lg px-3 py-2 text-sm {regexTestResult !== null ? 'bg-green-900/30 text-green-400' : 'bg-ayu-red/10 text-ayu-red'}">
						{#if regexTestResult !== null}
							Parsed: <strong>{regexTestResult}</strong>
						{:else}
							No match — check your regex.
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if error}
		<p class="text-sm text-ayu-red">{error}</p>
	{/if}

	<div class="flex gap-3">
		<button
			onclick={save}
			disabled={saving}
			class="rounded-lg bg-ayu-gold px-6 py-2.5 font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50"
		>
			{saving ? 'Saving…' : 'Save changes'}
		</button>
		<a href="/admin/games" class="rounded-lg border border-ayu-border px-4 py-2.5 text-sm text-ayu-muted hover:text-white">
			Cancel
		</a>
	</div>

	<!-- Danger zone -->
	<div class="rounded-xl border border-ayu-red/30 bg-ayu-surface p-5">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ayu-red">Danger Zone</h2>
		{#if !confirmDelete}
			<button
				onclick={() => (confirmDelete = true)}
				class="rounded-lg border border-ayu-red/50 px-4 py-2 text-sm text-ayu-red transition hover:bg-ayu-red/10"
			>
				Delete game
			</button>
		{:else}
			<p class="mb-3 text-sm text-zinc-300">This cannot be undone. The game will be removed from all sessions.</p>
			<div class="flex gap-2">
				<button
					onclick={deleteGame}
					disabled={deleting}
					class="rounded-lg bg-ayu-red px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
				>
					{deleting ? 'Deleting…' : 'Yes, delete'}
				</button>
				<button onclick={() => (confirmDelete = false)} class="rounded-lg border border-ayu-border px-4 py-2 text-sm text-ayu-muted hover:text-white">
					Cancel
				</button>
			</div>
		{/if}
	</div>
</div>
