<script lang="ts">
	import { parseConnectionsGrid, type ConnectionsResult } from '$lib/parsers/connections';

	let {
		myScore = null,
		onsubmit
	}: {
		myScore?: number | null;
		onsubmit: (score: number) => Promise<void>;
	} = $props();

	let shareText = $state('');
	let parsed = $state<ConnectionsResult | null>(null);
	let parseError = $state('');
	let submitting = $state(false);
	let error = $state('');

	function tryParse() {
		parseError = '';
		parsed = null;
		const result = parseConnectionsGrid(shareText.trim());
		if (result) parsed = result;
		else parseError = 'Could not parse that result — make sure you paste the full share text.';
	}

	async function submit(score: number) {
		submitting = true;
		error = '';
		try {
			await onsubmit(score);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Submit failed.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="space-y-3">
	<textarea
		bind:value={shareText}
		rows={7}
		placeholder="Paste your Connections result…"
		class="w-full resize-none rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-sm text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
	></textarea>

	{#if parsed}
		<div class="rounded-lg bg-ayu-surface2 px-4 py-3">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-semibold text-white">{parsed.solved ? '✅ Solved' : '❌ Failed'}</p>
					<p class="text-xs text-ayu-muted mt-0.5">
						{parsed.groups}/4 groups · {parsed.mistakes} mistake{parsed.mistakes !== 1 ? 's' : ''}
					</p>
				</div>
				<p class="text-2xl font-bold text-ayu-gold">{parsed.score}</p>
			</div>
			<div class="mt-3 flex gap-2">
				<button
					onclick={() => submit(parsed!.score)}
					disabled={submitting}
					class="flex-1 rounded-lg bg-ayu-gold py-2 font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50"
				>
					{submitting ? 'Submitting…' : 'Submit'}
				</button>
				<button
					onclick={() => { parsed = null; shareText = ''; }}
					class="rounded-lg border border-ayu-border px-3 py-2 text-sm text-ayu-muted hover:text-white"
				>
					Re-paste
				</button>
			</div>
		</div>
	{:else}
		<button
			onclick={tryParse}
			disabled={!shareText.trim()}
			class="rounded-lg bg-ayu-surface2 px-4 py-2 text-sm font-medium text-white transition hover:bg-ayu-border disabled:opacity-40"
		>
			Parse result
		</button>
		{#if parseError}
			<p class="text-xs text-ayu-red">{parseError}</p>
		{/if}
	{/if}

	{#if myScore !== null}
		<p class="text-xs text-ayu-muted">
			Current: <span class="font-semibold text-white">{myScore} pts</span> — submitting again will overwrite it.
		</p>
	{/if}

	{#if error}
		<p class="text-xs text-ayu-red">{error}</p>
	{/if}
</div>
