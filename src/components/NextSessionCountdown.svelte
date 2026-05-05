<script lang="ts">
	import { onDestroy } from 'svelte';

	let { next }: {
		next: { isToday: boolean; daysAhead: number; label: string } | null
	} = $props();

	let timeLeft = $state('');
	let interval: ReturnType<typeof setInterval> | null = null;

	function targetMidnight(): Date {
		const now = new Date();
		const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (next?.daysAhead ?? 1) + 1);
		return d;
	}

	function tick() {
		if (!next) { timeLeft = ''; return; }
		const diff = targetMidnight().getTime() - Date.now();
		if (diff <= 0) { timeLeft = 'any moment now'; return; }
		const h = Math.floor(diff / 3600000);
		const m = Math.floor((diff % 3600000) / 60000);
		const s = Math.floor((diff % 60000) / 1000);
		if (h >= 24) {
			const days = Math.floor(h / 24);
			timeLeft = `${days}d ${h % 24}h`;
		} else if (h > 0) {
			timeLeft = `${h}h ${m}m`;
		} else {
			timeLeft = `${m}m ${String(s).padStart(2, '0')}s`;
		}
	}

	$effect(() => {
		if (!next) return;
		tick();
		interval = setInterval(tick, 1000);
		return () => { if (interval) clearInterval(interval); };
	});

	onDestroy(() => { if (interval) clearInterval(interval); });
</script>

<div class="py-20 text-center">
	<p class="mb-4 text-6xl">🏅</p>
	<h1 class="mb-2 text-2xl font-bold text-white">No active session</h1>

	{#if next}
		<p class="text-lg text-zinc-300">{next.label}</p>

		{#if next.isToday}
			<p class="mt-2 text-sm text-ayu-muted">Scheduled for today — check back soon!</p>
		{:else if timeLeft}
			<p class="mt-3 text-ayu-muted">Starts in</p>
			<p class="mt-1 font-mono text-3xl font-bold text-ayu-gold">{timeLeft}</p>
		{/if}
	{:else}
		<p class="text-ayu-muted">Ask the host to start a new game night!</p>
	{/if}
</div>
