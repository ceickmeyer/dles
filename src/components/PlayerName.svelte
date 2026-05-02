<script lang="ts">
	import { playerStore } from '$lib/stores/player';
	import { supabase } from '$lib/supabase';

	let name = $state('');
	let loading = $state(false);
	let error = $state('');

	async function submit() {
		const trimmed = name.trim();
		if (!trimmed) return;
		loading = true;
		error = '';
		try {
			const { data, error: dbError } = await supabase
				.from('players')
				.upsert({ name: trimmed }, { onConflict: 'name' })
				.select()
				.single();
			if (dbError) throw dbError;
			playerStore.setPlayer(data.id, data.name);
		} catch (e) {
			error = 'Could not save name — try again.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
	<div class="w-full max-w-sm rounded-2xl bg-zinc-900 p-8 shadow-2xl">
		<h2 class="mb-2 text-2xl font-bold text-white">What's your name?</h2>
		<p class="mb-6 text-sm text-zinc-400">You'll use this to track your scores all night.</p>
		<form onsubmit={(e) => { e.preventDefault(); submit(); }}>
			<input
				class="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
				placeholder="Enter your name"
				bind:value={name}
				maxlength={40}
				autofocus
			/>
			{#if error}
				<p class="mb-3 text-sm text-red-400">{error}</p>
			{/if}
			<button
				type="submit"
				disabled={loading || !name.trim()}
				class="w-full rounded-lg bg-amber-400 px-4 py-3 font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
			>
				{loading ? 'Saving…' : "Let's go!"}
			</button>
		</form>
	</div>
</div>
