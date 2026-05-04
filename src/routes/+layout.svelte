<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props();

	const ogTitle = $derived(
		data.ogSession ? `${data.ogSession.name} — The DLES Olympics` : 'The DLES Olympics'
	);

	const ogDescription = $derived(() => {
		if (!data.ogSession) return 'Track scores across your daily word game nights.';
		const games = data.ogSession.session_games
			.map((sg: { game: { icon_emoji: string | null; name: string } }) =>
				`${sg.game.icon_emoji ?? '🎮'} ${sg.game.name}`)
			.join('  ·  ');
		return games || 'Game night in progress!';
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{ogTitle}</title>
	<meta property="og:site_name" content="The DLES Olympics" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={ogTitle} />
	<meta property="og:description" content={ogDescription()} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={ogTitle} />
	<meta name="twitter:description" content={ogDescription()} />
</svelte:head>

<div class="min-h-screen bg-ayu-bg text-ayu-text">
	<nav class="border-b border-ayu-border bg-ayu-surface/80 px-4 py-3 backdrop-blur-sm">
		<div class="mx-auto flex max-w-3xl items-center justify-between">
			<a href="/" class="flex items-center gap-2 font-bold tracking-tight text-ayu-gold">
				<span class="text-xl">🍕</span>
				<span class="text-lg">The DLES Olympics</span>
			</a>
			<div class="flex gap-5 text-sm text-zinc-400">
				<a href="/leaderboard" class="transition hover:text-ayu-gold">Leaderboard</a>
				<a href="/admin" class="transition hover:text-ayu-gold">Admin</a>
			</div>
		</div>
	</nav>
	<main class="mx-auto max-w-3xl px-4 py-8">
		{@render children()}
	</main>
</div>
