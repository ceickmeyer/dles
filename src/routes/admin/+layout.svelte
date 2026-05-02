<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';

	let { children } = $props();
	let checked = $state(false);

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			goto('/admin/login');
		} else {
			checked = true;
		}
	});
</script>

{#if checked}
	<div>
		<div class="mb-6 flex items-center justify-between">
			<nav class="flex gap-4 text-sm">
				<a href="/admin" class="text-zinc-300 hover:text-white">Dashboard</a>
				<a href="/admin/games" class="text-zinc-300 hover:text-white">Games</a>
			</nav>
			<button
				onclick={async () => { await supabase.auth.signOut(); goto('/admin/login'); }}
				class="text-xs text-zinc-500 hover:text-zinc-300"
			>
				Sign out
			</button>
		</div>
		{@render children()}
	</div>
{/if}
