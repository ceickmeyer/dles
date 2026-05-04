<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';

	let { children } = $props();
	let status = $state<'loading' | 'ready' | 'redirecting'>('loading');

	onMount(async () => {
		// Login page lives inside this layout — don't guard it
		if (window.location.pathname === '/admin/login') {
			status = 'ready';
			return;
		}
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			status = 'redirecting';
			goto('/admin/login');
		} else {
			status = 'ready';
		}
	});
</script>

{#if status === 'loading' || status === 'redirecting'}
	<div class="flex h-40 items-center justify-center text-ayu-muted text-sm">
		{status === 'redirecting' ? 'Redirecting to login…' : 'Checking auth…'}
	</div>
{:else}
	{#if !(typeof window !== 'undefined' && window.location.pathname === '/admin/login')}
		<div class="mb-6 flex items-center justify-between border-b border-ayu-border pb-4">
			<nav class="flex gap-4 text-sm">
				<a href="/admin" class="text-zinc-300 hover:text-ayu-gold transition">Sessions</a>
				<a href="/admin/games" class="text-zinc-300 hover:text-ayu-gold transition">Games</a>
				<a href="/admin/players" class="text-zinc-300 hover:text-ayu-gold transition">Players</a>
				<a href="/admin/scheduler" class="text-zinc-300 hover:text-ayu-gold transition">Scheduler</a>
				<a href="/admin/backup" class="text-zinc-300 hover:text-ayu-gold transition">Backup</a>
			</nav>
			<button
				onclick={async () => { await supabase.auth.signOut(); goto('/admin/login'); }}
				class="text-xs text-ayu-muted hover:text-zinc-300 transition"
			>
				Sign out
			</button>
		</div>
	{/if}
	{@render children()}
{/if}
