<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { parseShareText } from '$lib/parsers';
	import ParseConfirm from './ParseConfirm.svelte';
	import type { Game } from '$lib/database.types';

	let {
		game,
		sessionId,
		playerId,
		myScore = null,
		onscored
	}: {
		game: Game;
		sessionId: string;
		playerId: string;
		myScore?: number | null;
		onscored?: () => void;
	} = $props();

	let expanded = $state(false);
	let shareText = $state('');
	let manualScore = $state('');
	let parsedScore = $state<number | null>(null);
	let showConfirm = $state(false);
	let submitting = $state(false);
	let error = $state('');

	const submitted = $derived(myScore !== null);

	function toggle() {
		if (!submitted) expanded = !expanded;
	}

	function tryParse() {
		error = '';
		const result = parseShareText(shareText.trim(), game.share_parser);
		if (result !== null) { parsedScore = result; showConfirm = true; }
		else error = 'Could not parse — enter manually below.';
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
		const { error: dbError } = await supabase.from('scores').upsert(
			{ session_id: sessionId, game_id: game.id, player_id: playerId, raw_score: score, share_text: text ?? null },
			{ onConflict: 'session_id,game_id,player_id' }
		);
		submitting = false;
		if (dbError) { error = dbError.message; return; }
		expanded = false;
		onscored?.();
	}
</script>

<div
	class="overflow-hidden rounded-xl border transition-all duration-200"
	class:border-ayu-border={!submitted}
	class:bg-ayu-surface={!submitted}
	class:border-ayu-green={submitted}
	class:bg-ayu-green/5={submitted}
>
	<!-- Card header — always visible -->
	<div class="flex items-center gap-3 px-4 py-3">
		<span class="text-3xl">{game.icon_emoji ?? '🎮'}</span>
		<div class="flex-1 min-w-0">
			<p class="font-semibold text-white leading-tight">{game.name}</p>
			{#if game.url}
				<a
					href={game.url}
					target="_blank"
					rel="noopener noreferrer"
					onclick={(e) => e.stopPropagation()}
					class="text-xs text-ayu-muted underline decoration-dotted hover:text-ayu-blue"
				>
					Play {game.name} ↗
				</a>
			{/if}
		</div>

		{#if submitted}
			<div class="flex items-center gap-2 text-ayu-green">
				<span class="text-lg">✓</span>
				<span class="font-mono text-sm font-semibold">{myScore}</span>
			</div>
		{:else}
			<button
				onclick={toggle}
				class="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
				class:bg-ayu-gold={!expanded}
				class:text-ayu-bg={!expanded}
				class:hover:brightness-110={!expanded}
				class:bg-ayu-surface2={expanded}
				class:text-ayu-muted={expanded}
			>
				{expanded ? 'Cancel' : 'Submit'}
			</button>
		{/if}
	</div>

	<!-- Inline score entry — shown when expanded -->
	{#if expanded}
		<div class="border-t border-ayu-border px-4 pb-4 pt-3 space-y-3">
			{#if game.share_parser}
				<div>
					<label for="share-{game.id}" class="mb-1 block text-xs font-medium text-zinc-400">
						Paste your share result
					</label>
					<textarea
						id="share-{game.id}"
						bind:value={shareText}
						rows={3}
						placeholder="Paste the share text from the game…"
						class="w-full resize-none rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-sm text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
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
							class="mt-2 rounded-lg bg-ayu-surface2 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:text-white disabled:opacity-40"
						>
							Parse my result
						</button>
					{/if}
				</div>
				<div class="flex items-center gap-2 text-xs text-ayu-muted">
					<div class="h-px flex-1 bg-ayu-border"></div>
					<span>or enter manually</span>
					<div class="h-px flex-1 bg-ayu-border"></div>
				</div>
			{/if}

			<div class="flex items-center gap-2">
				<div class="flex-1">
					<label for="score-{game.id}" class="mb-1 block text-xs font-medium text-zinc-400">
						Score
						<span class="text-ayu-muted">
							({game.scoring_direction === 'lower_is_better' ? 'lower is better' : 'higher is better'})
						</span>
					</label>
					<input
						id="score-{game.id}"
						type="number"
						bind:value={manualScore}
						placeholder={game.max_score ? `0 – ${game.max_score.toLocaleString()}` : 'Your score'}
						class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
					/>
				</div>
				<button
					onclick={submitManual}
					disabled={submitting || !manualScore}
					class="mt-5 rounded-lg bg-ayu-gold px-4 py-2 font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50"
				>
					{submitting ? '…' : myScore !== null ? 'Update' : 'Submit'}
				</button>
			</div>

			{#if error}
				<p class="text-xs text-ayu-red">{error}</p>
			{/if}
		</div>
	{/if}
</div>
