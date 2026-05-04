<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { PARSER_OPTIONS, testCustomRegex } from '$lib/parsers';
	import LobbyCard from '$components/LobbyCard.svelte';

	type InputMode = 'auto' | 'buttons' | 'parser' | 'manual';

	let name = $state('');
	let url = $state('');
	let iconEmoji = $state('🎮');
	let scoringDirection = $state<'higher_is_better' | 'lower_is_better'>('lower_is_better');
	let maxScore = $state('');
	let shareParser = $state('');
	let shareRegex = $state('');
	let regexSample = $state('');
	let allowDnf = $state(false);
	let inputMode = $state<InputMode>('auto');
	let saving = $state(false);
	let error = $state('');

	const regexTestResult = $derived.by(() => {
		if (!shareRegex.trim() || !regexSample.trim()) return null;
		return testCustomRegex(shareRegex.trim(), regexSample.trim());
	});

	const maxScoreNum = $derived(maxScore ? parseInt(maxScore, 10) : null);

	const needsParser = $derived(inputMode === 'parser' && !shareParser);
	const needsMaxScore = $derived(inputMode === 'buttons' && (!maxScoreNum || maxScoreNum > 12));

	// Live preview game object — mirrors what will be saved
	const previewGame = $derived({
		id: 'preview',
		name: name || 'Game Name',
		url: url || null,
		icon_emoji: iconEmoji || '🎮',
		scoring_direction: scoringDirection,
		max_score: maxScoreNum,
		share_parser: shareParser || null,
		share_regex: shareParser === 'custom' ? (shareRegex || null) : null,
		allow_dnf: allowDnf,
		input_mode: inputMode,
		created_at: ''
	});

	async function save() {
		if (!name.trim()) { error = 'Name is required.'; return; }
		if (needsParser) { error = 'Select a share parser for "paste & parse" mode.'; return; }
		if (needsMaxScore) { error = 'Set a max score of 1–12 for "buttons" mode.'; return; }
		if (shareParser === 'custom' && !shareRegex.trim()) { error = 'Enter a regex pattern.'; return; }
		saving = true;
		error = '';
		const { error: e } = await supabase.from('games').insert({
			name: name.trim(),
			url: url.trim() || null,
			icon_emoji: iconEmoji.trim() || null,
			scoring_direction: scoringDirection,
			max_score: maxScoreNum,
			share_parser: shareParser || null,
			share_regex: shareParser === 'custom' ? (shareRegex.trim() || null) : null,
			allow_dnf: allowDnf,
			input_mode: inputMode
		});
		if (e) { error = e.message; saving = false; }
		else goto('/admin/games');
	}
</script>

<div class="space-y-6">
	<div>
		<a href="/admin/games" class="mb-4 inline-flex items-center gap-1 text-sm text-ayu-muted hover:text-white">← Games</a>
		<h1 class="text-2xl font-bold text-white">Add Game</h1>
	</div>

	<div class="flex items-start gap-6">

		<!-- Form -->
		<div class="min-w-0 flex-1 space-y-5">

			<!-- Basic info -->
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5 space-y-4">
				<p class="text-xs font-semibold uppercase tracking-wider text-ayu-muted">Basics</p>

				<div class="grid grid-cols-[1fr_72px] gap-3">
					<div>
						<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="name">Name *</label>
						<input id="name" bind:value={name} placeholder="My Game"
							class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none" />
					</div>
					<div>
						<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="emoji">Emoji</label>
						<input id="emoji" bind:value={iconEmoji} maxlength={2}
							class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-center text-xl text-white focus:border-ayu-gold focus:outline-none" />
					</div>
				</div>

				<div>
					<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="url">Game URL</label>
					<input id="url" type="url" bind:value={url} placeholder="https://…"
						class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none" />
				</div>

				<div>
					<p class="mb-2 text-sm font-medium text-zinc-300">Scoring direction *</p>
					<div class="flex flex-wrap gap-4">
						<label class="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
							<input type="radio" bind:group={scoringDirection} value="lower_is_better" class="accent-ayu-gold" />
							Lower is better
						</label>
						<label class="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
							<input type="radio" bind:group={scoringDirection} value="higher_is_better" class="accent-ayu-gold" />
							Higher is better
						</label>
					</div>
				</div>
			</div>

			<!-- Entry mode -->
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5 space-y-4">
				<p class="text-xs font-semibold uppercase tracking-wider text-ayu-muted">How players submit their score</p>

				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each [
						{ value: 'auto',    label: 'Auto',          desc: 'Smart defaults' },
						{ value: 'buttons', label: 'Buttons only',  desc: '1–N quick pick' },
						{ value: 'parser',  label: 'Paste & parse', desc: 'Share text only' },
						{ value: 'manual',  label: 'Manual entry',  desc: 'Type a number' }
					] as opt}
						<label class="cursor-pointer rounded-lg border p-3 transition
							{inputMode === opt.value
								? 'border-ayu-gold bg-ayu-gold/10'
								: 'border-ayu-border hover:border-zinc-500'}">
							<input type="radio" bind:group={inputMode} value={opt.value} class="sr-only" />
							<p class="text-sm font-semibold {inputMode === opt.value ? 'text-ayu-gold' : 'text-white'}">{opt.label}</p>
							<p class="text-xs text-ayu-muted mt-0.5">{opt.desc}</p>
						</label>
					{/each}
				</div>

				<!-- Buttons config -->
				{#if inputMode === 'buttons' || inputMode === 'auto'}
					<div>
						<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="max">
							Max score
							{#if inputMode === 'buttons'}<span class="text-ayu-red">*</span>{/if}
							<span class="ml-1 text-xs text-ayu-muted">(1–12 enables the button grid)</span>
						</label>
						<input id="max" type="number" bind:value={maxScore} placeholder="e.g. 6"
							class="w-32 rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none
								{needsMaxScore ? 'border-ayu-red' : ''}" />
					</div>
				{/if}

				<!-- Parser config -->
				{#if inputMode === 'parser' || inputMode === 'auto'}
					<div>
						<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="parser">
							Share parser
							{#if inputMode === 'parser'}<span class="text-ayu-red">*</span>{/if}
						</label>
						<select id="parser" bind:value={shareParser}
							class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white focus:border-ayu-gold focus:outline-none
								{needsParser ? 'border-ayu-red' : ''}">
							{#each PARSER_OPTIONS as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>

					{#if shareParser === 'custom'}
						<div class="rounded-lg border border-ayu-border bg-ayu-bg p-4 space-y-3">
							<p class="text-xs font-semibold uppercase tracking-wider text-ayu-muted">Custom Regex</p>
							<div>
								<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="regex">Pattern</label>
								<input id="regex" bind:value={shareRegex} placeholder="e.g. Score:\s*(\d+)"
									class="w-full rounded-lg border border-ayu-border bg-ayu-surface px-3 py-2 font-mono text-sm text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none" />
								<p class="mt-1 text-xs text-ayu-muted">Use a capture group <code class="text-ayu-gold">(\d+)</code> to extract the number.</p>
							</div>
							<div>
								<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="sample">Test sample</label>
								<textarea id="sample" bind:value={regexSample} rows={3}
									placeholder="Paste share text to test…"
									class="w-full resize-none rounded-lg border border-ayu-border bg-ayu-surface px-3 py-2 text-sm text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"></textarea>
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

					<!-- Max score for display (parser mode) -->
					{#if inputMode === 'parser'}
						<div>
							<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="max-display">
								Max score <span class="text-xs text-ayu-muted">(optional — used in share text as "X/max")</span>
							</label>
							<input id="max-display" type="number" bind:value={maxScore} placeholder="e.g. 6"
								class="w-32 rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none" />
						</div>
					{/if}
				{/if}

				<!-- Manual: just needs max score for display -->
				{#if inputMode === 'manual'}
					<div>
						<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="max-manual">
							Max score <span class="text-xs text-ayu-muted">(optional — shown in share text)</span>
						</label>
						<input id="max-manual" type="number" bind:value={maxScore} placeholder="e.g. 50000"
							class="w-40 rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none" />
					</div>
				{/if}
			</div>

			<!-- Options -->
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
				<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Options</p>
				<label class="flex cursor-pointer items-center gap-3">
					<input type="checkbox" bind:checked={allowDnf} class="accent-ayu-gold h-4 w-4" />
					<div>
						<p class="text-sm text-zinc-300">Allow "Did not solve" (DNF)</p>
						<p class="text-xs text-ayu-muted">Adds an ✗ button; stored as max_score + 1</p>
					</div>
				</label>
			</div>

			{#if error}
				<p class="text-sm text-ayu-red">{error}</p>
			{/if}

			<div class="flex gap-3">
				<button onclick={save} disabled={saving}
					class="rounded-lg bg-ayu-gold px-6 py-2.5 font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50">
					{saving ? 'Saving…' : 'Add game'}
				</button>
				<a href="/admin/games" class="rounded-lg border border-ayu-border px-4 py-2.5 text-sm text-ayu-muted hover:text-white">
					Cancel
				</a>
			</div>
		</div>

		<!-- Live Preview -->
		<div class="w-72 shrink-0 sticky top-6 space-y-2">
			<p class="text-xs font-semibold uppercase tracking-wider text-ayu-muted">Preview — fully interactive</p>
			<LobbyCard game={previewGame} preview={true} />
			<p class="text-xs text-ayu-muted">Nothing is saved. Use "test again" after submitting to reset.</p>
		</div>

	</div>
</div>
