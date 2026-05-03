<script lang="ts">
	import { parseShareText } from '$lib/parsers';
	import ParseConfirm from './ParseConfirm.svelte';
	import type { Game } from '$lib/database.types';

	let {
		game,
		onsubmit,
		existingScore = null
	}: {
		game: Game;
		onsubmit: (score: number, shareText?: string) => Promise<void>;
		existingScore?: number | null;
	} = $props();

	let shareText = $state('');
	let manualScore = $state('');
	let parsedScore = $state<number | null>(null);
	let showConfirm = $state(false);
	let submitting = $state(false);
	let submitted = $state(false);
	let error = $state('');

	function tryParse() {
		error = '';
		const result = parseShareText(shareText.trim(), game.share_parser, game.share_regex);
		if (result !== null) {
			parsedScore = result;
			showConfirm = true;
		} else {
			error = 'Could not parse that result — try entering your score manually below.';
		}
	}

	async function confirmParsed(score: number) {
		showConfirm = false;
		await doSubmit(score, shareText.trim());
	}

	async function submitManual() {
		const n = Number(manualScore);
		if (isNaN(n)) { error = 'Enter a valid number.'; return; }
		await doSubmit(n);
	}

	async function doSubmit(score: number, text?: string) {
		submitting = true;
		error = '';
		try {
			await onsubmit(score, text);
			submitted = true;
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Submit failed. Try again.';
		} finally {
			submitting = false;
		}
	}
</script>

{#if submitted}
	<div class="rounded-xl border border-green-700 bg-green-900/20 p-5 text-center">
		<p class="text-xl font-bold text-green-400">Score submitted! ✓</p>
	</div>
{:else}
	<div class="space-y-4">
		{#if game.share_parser}
			<div>
				<label for="share-text" class="mb-1.5 block text-sm font-medium text-zinc-300">
					Paste your result
				</label>
				<textarea
					id="share-text"
					bind:value={shareText}
					rows={3}
					placeholder="Paste the share text from the game…"
					class="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
				></textarea>
				{#if showConfirm && parsedScore !== null}
					<div class="mt-2">
						<ParseConfirm
							{parsedScore}
							onconfirm={confirmParsed}
							oncancel={() => { showConfirm = false; }}
						/>
					</div>
				{:else}
					<button
						onclick={tryParse}
						disabled={!shareText.trim()}
						class="mt-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:opacity-50"
					>
						Parse my result
					</button>
				{/if}
			</div>
			<div class="flex items-center gap-3 text-zinc-500 text-xs">
				<div class="h-px flex-1 bg-zinc-700"></div>
				<span>or enter manually</span>
				<div class="h-px flex-1 bg-zinc-700"></div>
			</div>
		{/if}

		<div>
			<label for="manual-score" class="mb-1.5 block text-sm font-medium text-zinc-300">
				{game.share_parser ? 'Your score' : 'Enter your score'}
				{#if game.scoring_direction === 'lower_is_better'}
					<span class="ml-1 text-xs text-zinc-500">(lower is better)</span>
				{:else}
					<span class="ml-1 text-xs text-zinc-500">(higher is better)</span>
				{/if}
			</label>
			<div class="flex gap-2">
				<input
					id="manual-score"
					type="number"
					bind:value={manualScore}
					placeholder={game.max_score ? `0–${game.max_score}` : 'Score'}
					class="w-36 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
				/>
				<button
					onclick={submitManual}
					disabled={submitting || !manualScore}
					class="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
				>
					{submitting ? 'Submitting…' : existingScore !== null ? 'Update' : 'Submit'}
				</button>
			</div>
		</div>

		{#if existingScore !== null}
			<p class="text-xs text-zinc-400">
				You already submitted <strong class="text-white">{existingScore}</strong> — submitting again
				will overwrite it.
			</p>
		{/if}

		{#if error}
			<p class="text-sm text-red-400">{error}</p>
		{/if}
	</div>
{/if}
