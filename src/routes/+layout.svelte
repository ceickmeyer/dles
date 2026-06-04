<script lang="ts">
	import './layout.css';
	import { onDestroy } from 'svelte';
	import { playerStore } from '$lib/stores/player';
	import { supabase } from '$lib/supabase';

	let { data, children } = $props();

	const player = $derived($playerStore);

	let dropdownOpen = $state(false);
	let confirmLogout = $state(false);
	let pin = $state<string | null>(null);
	let alias = $state('');
	let loading = $state(false);
	let savingAlias = $state(false);
	let aliasError = $state('');

	async function openDropdown() {
		dropdownOpen = true;
		confirmLogout = false;
		pin = null;
		alias = '';
		aliasError = '';
		if (player.id) {
			loading = true;
			const { data: row } = await supabase.from('players').select('pin, alias').eq('id', player.id).maybeSingle();
			pin = row?.pin ?? null;
			alias = row?.alias ?? '';
			loading = false;
		}
	}

	function closeDropdown() {
		dropdownOpen = false;
		confirmLogout = false;
		pin = null;
		aliasError = '';
	}

	async function saveAlias() {
		if (!player.id) return;
		savingAlias = true;
		aliasError = '';
		const { error } = await supabase.from('players').update({ alias: alias.trim() || null }).eq('id', player.id);
		savingAlias = false;
		if (error) { aliasError = 'Failed to save.'; return; }
	}

	function doLogout() {
		playerStore.clear();
		closeDropdown();
	}

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
			<div class="flex items-center gap-2 shrink-0">
				<a href="/leaderboard" class="rounded-full border border-ayu-blue/30 bg-ayu-blue/10 px-3 py-1 text-xs font-medium text-ayu-blue transition hover:bg-ayu-blue/20">
					Leaderboard
				</a>
				{#if player.id}
					<div class="relative">
						<button onclick={() => dropdownOpen ? closeDropdown() : openDropdown()} class="rounded-full border border-ayu-gold/30 bg-ayu-gold/10 px-3 py-1 text-xs font-medium text-ayu-gold transition hover:bg-ayu-gold/20">
							{player.name}
						</button>
						{#if dropdownOpen}
							<div class="absolute right-0 top-full mt-2 w-56 rounded-xl border border-ayu-border bg-ayu-surface shadow-2xl z-50 overflow-hidden">
								{#if !confirmLogout}
									<div class="p-3 space-y-3">
										<!-- Alias -->
										{#if loading}
											<p class="text-xs text-ayu-muted">Loading…</p>
										{:else}
											<div class="flex items-center gap-2">
												<input
													bind:value={alias}
													placeholder="Alias…"
													maxlength={32}
													class="flex-1 min-w-0 rounded-lg border border-ayu-border bg-ayu-bg px-2.5 py-1.5 text-xs text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
												/>
												<button
													onclick={saveAlias}
													disabled={savingAlias}
													class="shrink-0 rounded-lg border border-ayu-border px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-ayu-gold hover:text-white disabled:opacity-50"
												>
													{savingAlias ? '…' : 'Save'}
												</button>
											</div>
											{#if aliasError}
												<p class="text-xs text-ayu-red">{aliasError}</p>
											{/if}
										{/if}
										<!-- PIN -->
										{#if pin}
											<div class="flex items-center justify-between">
												<span class="text-xs text-ayu-muted">Your PIN</span>
												<span class="font-mono font-bold text-ayu-gold">{pin}</span>
											</div>
										{/if}
									</div>
									<div class="border-t border-ayu-border">
										<button
											onclick={() => confirmLogout = true}
											class="w-full py-2.5 text-xs text-ayu-muted transition hover:bg-ayu-surface2 hover:text-ayu-red"
										>
											Log out…
										</button>
									</div>
								{:else}
									<div class="p-3 space-y-3">
										<p class="text-xs text-zinc-300 leading-relaxed">
											Log out of <span class="font-semibold text-white">{player.name}</span>?
											{#if pin}
												Your PIN is <span class="font-mono font-bold text-ayu-gold">{pin}</span>.
											{/if}
										</p>
										<div class="flex gap-2">
											<button onclick={doLogout} class="flex-1 rounded-lg bg-ayu-red/20 py-1.5 text-xs font-semibold text-ayu-red transition hover:bg-ayu-red/30">
												Log out
											</button>
											<button onclick={() => confirmLogout = false} class="flex-1 rounded-lg border border-ayu-border py-1.5 text-xs text-zinc-400 transition hover:text-white">
												Cancel
											</button>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
				<a href="/admin" aria-label="Admin" class="flex h-7 w-7 items-center justify-center rounded-full border border-ayu-border bg-ayu-surface2 text-zinc-400 transition hover:border-zinc-500 hover:text-white">
					<svg width="14" height="14" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
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
