<script lang="ts">
	let {
		parsedScore,
		onconfirm,
		oncancel
	}: {
		parsedScore: number;
		onconfirm: (score: number) => void;
		oncancel: () => void;
	} = $props();

	let editedScore = $state('');
	$effect(() => { editedScore = parsedScore.toString(); });
</script>

<div class="rounded-xl border border-zinc-700 bg-zinc-800 p-5">
	<p class="mb-3 text-sm text-zinc-300">
		We got <span class="font-bold text-amber-400 text-lg">{parsedScore}</span> from your result — does
		that look right?
	</p>
	<div class="mb-4 flex items-center gap-2">
		<label for="edit-score" class="text-xs text-zinc-400">Edit score:</label>
		<input
			id="edit-score"
			type="number"
			bind:value={editedScore}
			class="w-28 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-white focus:border-amber-400 focus:outline-none"
		/>
	</div>
	<div class="flex gap-2">
		<button
			onclick={() => onconfirm(Number(editedScore))}
			disabled={!editedScore || isNaN(Number(editedScore))}
			class="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
		>
			Confirm
		</button>
		<button
			onclick={oncancel}
			class="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-400"
		>
			Cancel
		</button>
	</div>
</div>
