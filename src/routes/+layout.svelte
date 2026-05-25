<script lang="ts">
	import './layout.css';
	import { onDestroy } from 'svelte';

	let { data, children } = $props();

	const ogSession = $derived(data.ogSession);

	const ogTitle = $derived(
		ogSession ? `${ogSession.name} — The DLES Olympics` : 'The DLES Olympics'
	);

	const ogDescription = $derived(() => {
		if (!ogSession) return 'Track scores across your daily word game nights.';
		const games = ogSession.session_games
			.map((sg: { game: { icon_emoji: string | null; name: string } }) =>
				`${sg.game.icon_emoji ?? '🎮'} ${sg.game.name}`)
			.join('  ·  ');
		return games || 'Game night in progress!';
	});

	// Countdown in nav
	let timeLeft = $state('');
	let timer: ReturnType<typeof setInterval> | null = null;

	function tick() {
		if (!ogSession) { timeLeft = ''; return; }
		const end = ogSession.expires_at
			? new Date(ogSession.expires_at)
			: (() => {
				const [y, m, d] = ogSession.date.split('-').map(Number);
				return new Date(y, m - 1, d + 1);
			})();
		const diff = Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000));
		if (diff === 0) { timeLeft = ''; return; }
		const h = Math.floor(diff / 3600);
		const m = Math.floor((diff % 3600) / 60);
		const s = diff % 60;
		timeLeft = h > 0
			? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
			: `${m}:${String(s).padStart(2, '0')}`;
	}

	$effect(() => {
		tick();
		timer = setInterval(tick, 1000);
		return () => { if (timer) clearInterval(timer); };
	});

	onDestroy(() => { if (timer) clearInterval(timer); });
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<link rel="shortcut icon" href="/favicon.ico" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-title" content="DLES" />
	<link rel="manifest" href="/site.webmanifest" />
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
		<div class="mx-auto flex max-w-3xl items-center gap-4">
			<!-- Logo -->
			<a href="/" class="text-xl shrink-0">🍕</a>

			<!-- Session info -->
			<div class="flex-1 min-w-0">
				{#if ogSession}
					<div class="flex items-center gap-2 min-w-0">
						<span class="truncate text-sm font-semibold text-white">{ogSession.name}</span>
						<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider {
							ogSession.status === 'active' ? 'bg-ayu-green text-ayu-bg' :
							ogSession.status === 'paused' ? 'bg-amber-700 text-white' :
							'bg-ayu-surface2 text-ayu-muted'
						}">
							{ogSession.status === 'active' ? '● Live' : ogSession.status === 'paused' ? '⏸ Paused' : 'Lobby'}
						</span>
						{#if timeLeft}
							<span class="shrink-0 font-mono text-xs text-ayu-muted">{timeLeft}</span>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Nav links -->
			<div class="flex items-center gap-4 shrink-0 text-sm text-zinc-400">
				<a href="/leaderboard" class="transition hover:text-ayu-gold">Leaderboard</a>
				<a href="/admin" class="transition hover:text-ayu-gold" aria-label="Admin">
					<svg width="16" height="16" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
						<path d="M18 12h-2.18c-.17.7-.44 1.35-.81 1.93l1.54 1.54-2.1 2.1-1.54-1.54c-.58.36-1.23.63-1.91.79V19H8v-2.18c-.68-.16-1.33-.43-1.91-.79l-1.54 1.54-2.12-2.12 1.54-1.54c-.36-.58-.63-1.23-.79-1.91H1V9.03h2.17c.16-.7.44-1.35.8-1.94L2.43 5.55l2.1-2.1 1.54 1.54c.58-.37 1.24-.64 1.93-.81V2h3v2.18c.68.16 1.33.43 1.91.79l1.54-1.54 2.12 2.12-1.54 1.54c.36.59.64 1.24.8 1.94H18V12zm-8.5 1.5c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z"/>
					</svg>
				</a>
			</div>
		</div>
	</nav>
	<main class="mx-auto max-w-3xl px-4 py-8">
		{@render children()}
	</main>
</div>
