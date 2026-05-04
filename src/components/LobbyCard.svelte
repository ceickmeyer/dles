<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { parseShareText } from '$lib/parsers';
	import { playerStore } from '$lib/stores/player';
	import { dnfScore, isDnf, formatScore } from '$lib/utils';
	import { sounds } from '$lib/sounds';
	import ParseConfirm from './ParseConfirm.svelte';
	import ConnectionsForm from './ConnectionsForm.svelte';
	import DecipherForm from './DecipherForm.svelte';
	import type { Game } from '$lib/database.types';

	let {
		game,
		sessionId = '',
		playerId = '',
		myScore = null,
		preview = false,
		onscored
	}: {
		game: Game;
		sessionId?: string;
		playerId?: string;
		myScore?: number | null;
		preview?: boolean;
		onscored?: () => void;
	} = $props();

	let previewScore = $state<number | null>(null);

	let expanded = $state(preview);
	let shareText = $state('');
	let manualScore = $state('');
	let parsedScore = $state<number | null>(null);
	let showConfirm = $state(false);
	let submitting = $state(false);
	let error = $state('');
	let pendingPick = $state<number | null>(null);

	const effectiveScore = $derived(preview ? previewScore : myScore);
	const submitted = $derived(effectiveScore !== null);
	const myDnf = $derived(effectiveScore !== null && isDnf(effectiveScore, game));

	const isSpecialParser = $derived(
		game.share_parser === 'connections' || game.share_parser === 'decipher'
	);
	const mode = $derived(game.input_mode ?? 'auto');
	const showQuickPick = $derived(
		!isSpecialParser && (
			mode === 'buttons'
				? (game.max_score !== null && game.max_score >= 1 && game.max_score <= 12)
				: mode === 'auto'
				? (game.max_score !== null && game.max_score >= 1 && game.max_score <= 12)
				: false
		)
	);
	const showPaste = $derived(
		!isSpecialParser && (
			mode === 'parser'
				? !!game.share_parser
				: mode === 'auto'
				? !!game.share_parser
				: mode === 'buttons' || mode === 'manual'
				? false
				: !!game.share_parser
		)
	);
	const showManual = $derived(
		!isSpecialParser && (
			mode === 'manual' || (mode === 'auto' && !showQuickPick && !game.share_parser)
		)
	);
	const quickPickRange = $derived(
		showQuickPick ? Array.from({ length: game.max_score! }, (_, i) => i + 1) : []
	);
	const gameDnfScore = $derived(dnfScore(game));

	function toggle() {
		expanded = !expanded;
	}

	function tryParse() {
		error = '';
		const result = parseShareText(shareText.trim(), game.share_parser, game.share_regex);
		if (result !== null) { parsedScore = result; showConfirm = true; }
		else error = 'Could not parse — make sure you paste the full share text.';
	}

	async function confirmParsed(score: number) {
		showConfirm = false;
		await doSubmit(score, shareText.trim());
	}

	async function submitManual() {
		const n = Number(manualScore);
		if (isNaN(n) || manualScore === '') { error = 'Enter a valid number.'; return; }
		await doSubmit(n);
	}

	async function doSubmit(score: number, text?: string) {
		submitting = true;
		pendingPick = score;
		error = '';
		if (preview) {
			await new Promise(r => setTimeout(r, 300));
			previewScore = score;
			submitting = false;
			pendingPick = null;
			expanded = false;
			sounds.submit();
			return;
		}
		const { error: dbError } = await supabase.from('scores').upsert(
			{ session_id: sessionId, game_id: game.id, player_id: playerId, raw_score: score, share_text: text ?? null },
			{ onConflict: 'session_id,game_id,player_id' }
		);
		submitting = false;
		if (dbError) {
			pendingPick = null;
			if (dbError.code === '23503') { playerStore.clear(); return; }
			error = dbError.message;
			return;
		}
		pendingPick = null;
		expanded = false;
		sounds.submit();
		onscored?.();
	}

	function quickPickClass(n: number): string {
		const active = pendingPick ?? effectiveScore;
		if (active === null) return 'border-ayu-border bg-ayu-surface2 text-white hover:border-ayu-gold';
		// If DNF is selected, all number buttons dim
		if (gameDnfScore !== null && active === gameDnfScore)
			return 'border-ayu-border bg-ayu-surface2 text-ayu-muted';
		if (game.scoring_direction === 'higher_is_better') {
			return n <= active
				? 'border-ayu-green bg-ayu-green/20 text-ayu-green'
				: 'border-ayu-red/40 bg-ayu-red/10 text-ayu-red/60';
		}
		return n <= active
			? 'border-ayu-gold bg-ayu-gold/20 text-ayu-gold'
			: 'border-ayu-border bg-ayu-surface2 text-ayu-muted';
	}

	function dnfClass(): string {
		const active = pendingPick ?? effectiveScore;
		const selected = gameDnfScore !== null && active === gameDnfScore;
		return selected
			? 'border-ayu-red bg-ayu-red/20 text-ayu-red font-bold'
			: 'border-ayu-red/40 bg-ayu-surface2 text-ayu-red/70 hover:border-ayu-red hover:text-ayu-red';
	}
</script>

<div
	class="overflow-hidden rounded-xl border transition-all duration-200"
	style={submitted
		? myDnf
			? 'border-color:color-mix(in srgb,var(--color-ayu-red) 50%,transparent);background-color:color-mix(in srgb,var(--color-ayu-red) 6%,var(--color-ayu-surface))'
			: 'border-color:color-mix(in srgb,var(--color-ayu-green) 60%,transparent);background-color:color-mix(in srgb,var(--color-ayu-green) 6%,var(--color-ayu-surface))'
		: 'border-color:var(--color-ayu-border);background-color:var(--color-ayu-surface)'}
>
	<!-- Always-visible header -->
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
					Play ↗
				</a>
			{/if}
		</div>

		{#if submitted}
			<div class="flex items-center gap-2">
				<div class="flex items-center gap-1.5 {myDnf ? 'text-ayu-red' : 'text-ayu-green'}">
					<span>{myDnf ? '✗' : '✓'}</span>
					<span class="font-mono text-sm font-semibold">
						{effectiveScore !== null ? formatScore(effectiveScore, game) : ''}
					</span>
				</div>
				<button
					onclick={toggle}
					class="rounded-lg px-2.5 py-1 text-xs font-medium transition
						{expanded ? 'bg-ayu-surface2 text-ayu-muted' : 'bg-ayu-surface2 text-zinc-400 hover:text-white'}"
				>
					{expanded ? 'Cancel' : 'Edit'}
				</button>
			</div>
		{:else}
			<button
				onclick={toggle}
				class="rounded-lg px-3 py-1.5 text-sm font-semibold transition hover:brightness-110 {expanded
					? 'bg-ayu-surface2 text-ayu-muted'
					: 'bg-ayu-gold text-ayu-bg'}"
			>
				{expanded ? 'Cancel' : 'Submit'}
			</button>
		{/if}
	</div>

	{#if expanded}
		<div class="border-t border-ayu-border px-4 pb-4 pt-3 space-y-4">

		{#if game.share_parser === 'connections'}
			<ConnectionsForm onsubmit={doSubmit} myScore={submitted ? effectiveScore : null} />
		{:else if game.share_parser === 'decipher'}
			<DecipherForm onsubmit={doSubmit} myScore={submitted ? effectiveScore : null} dnfScore={gameDnfScore} />
		{:else}

			<!-- Quick-pick buttons -->
			{#if showQuickPick}
				<div>
					<p class="mb-2 text-xs font-medium text-zinc-400">
						{game.scoring_direction === 'higher_is_better' ? 'How many did you get right?' : 'How many guesses?'}
					</p>
					<div class="flex flex-wrap gap-1.5">
						{#each quickPickRange as n}
							<button
								onclick={() => doSubmit(n)}
								disabled={submitting}
								class="h-9 w-9 rounded-lg border text-sm font-bold transition disabled:cursor-not-allowed {quickPickClass(n)}"
							>
								{n}
							</button>
						{/each}
						{#if game.allow_dnf && gameDnfScore !== null}
							<button
								onclick={() => doSubmit(gameDnfScore)}
								disabled={submitting}
								class="h-9 rounded-lg border px-2.5 text-sm transition disabled:cursor-not-allowed {dnfClass()}"
								title="Did not solve"
							>
								✗
							</button>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Paste & parse -->
			{#if showPaste}
				{#if showQuickPick}
					<div class="flex items-center gap-2 text-xs text-ayu-muted">
						<div class="h-px flex-1 bg-ayu-border"></div>
						<span>or paste your Share result</span>
						<div class="h-px flex-1 bg-ayu-border"></div>
					</div>
				{/if}
				<div>
					<textarea
						id="share-{game.id}"
						bind:value={shareText}
						rows={3}
						placeholder="Paste your 'Share' result from the game…"
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
							Parse result
						</button>
					{/if}
				</div>
			{/if}

			<!-- Manual entry -->
			{#if showManual}
				<div class="flex items-end gap-2">
					<div class="flex-1">
						<label for="score-{game.id}" class="mb-1 block text-xs font-medium text-zinc-400">
							Your score
							<span class="text-ayu-muted">
								({game.scoring_direction === 'lower_is_better' ? 'lower is better' : 'higher is better'})
							</span>
						</label>
						<input
							id="score-{game.id}"
							type="number"
							bind:value={manualScore}
							placeholder={game.max_score ? `1–${game.max_score}` : 'Score'}
							class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
						/>
					</div>
					<div class="flex flex-col gap-1.5">
						<button
							onclick={submitManual}
							disabled={submitting || manualScore === ''}
							class="rounded-lg bg-ayu-gold px-4 py-2 font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50"
						>
							{submitting ? '…' : 'Submit'}
						</button>
						{#if game.allow_dnf && gameDnfScore !== null}
							<button
								onclick={() => doSubmit(gameDnfScore)}
								disabled={submitting}
								class="rounded-lg border border-ayu-red/50 px-4 py-1.5 text-xs font-semibold text-ayu-red transition hover:bg-ayu-red/10 disabled:opacity-50"
							>
								Did not solve
							</button>
						{/if}
					</div>
				</div>
			{/if}

			{#if effectiveScore !== null}
				<p class="text-xs text-ayu-muted">
					{#if preview}
						Got: <span class="font-semibold text-white">{formatScore(effectiveScore, game)}</span> — <button onclick={() => { previewScore = null; expanded = true; shareText = ''; manualScore = ''; }} class="text-ayu-gold hover:underline">test again</button>
					{:else}
						Current: <span class="font-semibold text-white">{formatScore(effectiveScore, game)}</span> — submitting again will overwrite it.
					{/if}
				</p>
			{/if}

			{#if error}
				<p class="text-xs text-ayu-red">{error}</p>
			{/if}

		{/if}<!-- end connections/decipher else -->
		</div>
	{/if}
</div>
