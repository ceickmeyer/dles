<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Dle Night</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-white">
	<nav class="border-b border-zinc-800 px-4 py-3">
		<div class="mx-auto flex max-w-3xl items-center justify-between">
			<a href="/" class="text-lg font-bold tracking-tight text-amber-400">🎮 Dle Night</a>
			<div class="flex gap-4 text-sm text-zinc-400">
				<a href="/leaderboard" class="transition hover:text-white">All-Time</a>
				<a href="/admin" class="transition hover:text-white">Admin</a>
			</div>
		</div>
	</nav>
	<main class="mx-auto max-w-3xl px-4 py-8">
		{@render children()}
	</main>
</div>
