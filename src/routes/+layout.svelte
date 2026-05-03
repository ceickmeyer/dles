<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>The DLES Olympics</title>
</svelte:head>

<div class="min-h-screen bg-ayu-bg text-ayu-text">
	<nav class="border-b border-ayu-border bg-ayu-surface/80 px-4 py-3 backdrop-blur-sm">
		<div class="mx-auto flex max-w-3xl items-center justify-between">
			<a href="/" class="flex items-center gap-2 font-bold tracking-tight text-ayu-gold">
				<span class="text-xl">🏅</span>
				<span class="text-lg">The DLES Olympics</span>
			</a>
			<div class="flex gap-5 text-sm text-zinc-400">
				<a href="/leaderboard" class="transition hover:text-ayu-gold">All-Time</a>
				<a href="/admin" class="transition hover:text-ayu-gold">Admin</a>
			</div>
		</div>
	</nav>
	<main class="mx-auto max-w-3xl px-4 py-8">
		{@render children()}
	</main>
</div>
