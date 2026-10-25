<script lang="ts">
	import { onMount } from 'svelte';
	import { playerStore } from '$lib/stores/player';
	import { supabase } from '$lib/supabase';

	type Step = 'name' | 'pin-entry' | 'pin-choose';

	let step = $state<Step>('name');
	let name = $state('');
	let pinInput = $state('');
	let loading = $state(false);
	let error = $state('');

	// Existing names, fetched once so the "What's your name?" step can offer
	// a pick-from-list dropdown instead of making a returning player retype
	// (and risk misspelling) a name that already exists.
	let allPlayers = $state<{ id: string; name: string }[]>([]);
	let suggestionsOpen = $state(false);
	let highlightedIndex = $state(-1);

	// The signed-in player lives in localStorage, which the server can't see,
	// so SSR always renders as "nobody signed in". Showing the modal only
	// once mounted in the browser avoids flashing it at players who are
	// signed in, before hydration catches up.
	let mounted = $state(false);

	onMount(async () => {
		mounted = true;
		const { data } = await supabase.from('players').select('id, name').order('name');
		allPlayers = data ?? [];
	});

	const suggestions = $derived.by(() => {
		const q = name.trim().toLowerCase();
		const pool = q ? allPlayers.filter((p) => p.name.toLowerCase().includes(q)) : allPlayers;
		return pool.slice(0, 8);
	});

	// Using a `use:` action instead of the native `autofocus` attribute: with
	// autofocus, the browser focuses the element before Svelte has attached
	// this input's `onfocus` listener, so that first focus is silently
	// dropped and the suggestions dropdown never opens on page load. Calling
	// `.focus()` ourselves after mount fires focus the normal way instead.
	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}

	function closeSuggestions() {
		// Delayed so a click on a suggestion registers before blur hides the list.
		setTimeout(() => (suggestionsOpen = false), 150);
	}

	function pickSuggestion(p: { id: string; name: string }) {
		name = p.name;
		suggestionsOpen = false;
		submitName();
	}

	function onNameKeydown(e: KeyboardEvent) {
		if (!suggestionsOpen || suggestions.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightedIndex = (highlightedIndex + 1) % suggestions.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex = (highlightedIndex - 1 + suggestions.length) % suggestions.length;
		} else if (e.key === 'Enter' && highlightedIndex >= 0) {
			e.preventDefault();
			pickSuggestion(suggestions[highlightedIndex]);
		} else if (e.key === 'Escape') {
			suggestionsOpen = false;
		}
	}

	$effect(() => {
		void suggestions;
		highlightedIndex = -1;
	});

	async function submitName() {
		const trimmed = name.trim();
		if (!trimmed) return;
		loading = true;
		error = '';

		const { data: existing, error: dbError } = await supabase
			.from('players')
			.select('id, name')
			.ilike('name', trimmed)
			.maybeSingle();

		loading = false;

		if (dbError) {
			error = 'Something went wrong — try again.';
			return;
		}
		if (existing) {
			step = 'pin-entry';
		} else {
			pinInput = '';
			step = 'pin-choose';
		}
	}

	async function submitPin() {
		const trimmed = name.trim();
		loading = true;
		error = '';
		const { data, error: dbError } = await supabase
			.from('players')
			.select('id, name')
			.ilike('name', trimmed)
			.eq('pin', pinInput.trim())
			.maybeSingle();
		loading = false;
		if (dbError) {
			error = 'Something went wrong — try again.';
			return;
		}
		if (!data) {
			error = 'Wrong PIN. Try again, or go back and use a different name.';
			return;
		}
		playerStore.setPlayer(data.id, data.name);
	}

	async function submitNewPin() {
		if (!/^\d{4}$/.test(pinInput)) {
			error = 'PIN must be exactly 4 digits.';
			return;
		}
		loading = true;
		error = '';
		const { data, error: dbError } = await supabase
			.from('players')
			.insert({ name: name.trim(), pin: pinInput })
			.select()
			.single();
		loading = false;
		if (dbError) {
			error = 'Could not save — try again.';
			return;
		}
		playerStore.setPlayer(data.id, data.name);
	}
</script>

{#if mounted}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
		<div
			class="w-full max-w-sm rounded-2xl border border-ayu-border bg-ayu-surface p-8 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="player-modal-title"
		>
			{#if step === 'name'}
				<h2 id="player-modal-title" class="mb-1 text-2xl font-bold text-white">
					What's your name?
				</h2>
				<p class="mb-6 text-sm text-ayu-muted">
					Used to track your scores. You'll set a PIN to sign in on other devices.
				</p>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						submitName();
					}}
				>
					<div class="relative mb-4">
						<input
							class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-4 py-3 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
							placeholder="Enter your name"
							bind:value={name}
							maxlength={40}
							autocomplete="off"
							role="combobox"
							aria-expanded={suggestionsOpen && suggestions.length > 0}
							aria-controls="name-suggestions"
							use:focusOnMount
							onfocus={() => (suggestionsOpen = true)}
							onblur={closeSuggestions}
							onkeydown={onNameKeydown}
						/>
						{#if suggestionsOpen && suggestions.length > 0}
							<ul
								id="name-suggestions"
								role="listbox"
								class="absolute top-full right-0 left-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-ayu-border bg-zinc-900 py-1 shadow-xl"
							>
								{#each suggestions as p, i (p.id)}
									<li role="option" aria-selected={i === highlightedIndex}>
										<button
											type="button"
											onmousedown={(e) => e.preventDefault()}
											onclick={() => pickSuggestion(p)}
											class="w-full px-4 py-2 text-left text-sm transition {i === highlightedIndex
												? 'bg-ayu-surface2 text-white'
												: 'text-zinc-300 hover:bg-ayu-surface2 hover:text-white'}"
										>
											{p.name}
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
					{#if error}<p class="mb-3 text-sm text-ayu-red">{error}</p>{/if}
					<button
						type="submit"
						disabled={loading || !name.trim()}
						class="w-full rounded-lg bg-ayu-gold px-4 py-3 font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50"
					>
						{loading ? 'Checking…' : 'Continue'}
					</button>
				</form>
			{:else if step === 'pin-choose'}
				<button
					onclick={() => {
						step = 'name';
						error = '';
					}}
					class="mb-4 text-sm text-ayu-muted hover:text-white">← Back</button
				>
				<h2 id="player-modal-title" class="mb-1 text-2xl font-bold text-white">Choose a PIN</h2>
				<p class="mb-6 text-sm text-ayu-muted">
					Pick a 4-digit PIN — you'll use it to sign in on other devices.
				</p>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						submitNewPin();
					}}
				>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						class="mb-4 w-full rounded-lg border border-ayu-border bg-ayu-bg px-4 py-3 text-center font-mono text-2xl tracking-widest text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
						placeholder="• • • •"
						bind:value={pinInput}
						maxlength={4}
						inputmode="numeric"
						autofocus
					/>
					{#if error}<p class="mb-3 text-sm text-ayu-red">{error}</p>{/if}
					<button
						type="submit"
						disabled={loading || pinInput.length < 4}
						class="w-full rounded-lg bg-ayu-gold px-4 py-3 font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50"
					>
						{loading ? 'Creating account…' : 'Create account'}
					</button>
				</form>
			{:else if step === 'pin-entry'}
				<button
					onclick={() => {
						step = 'name';
						error = '';
					}}
					class="mb-4 text-sm text-ayu-muted hover:text-white">← Back</button
				>
				<h2 id="player-modal-title" class="mb-1 text-2xl font-bold text-white">
					Welcome back, {name}!
				</h2>
				<p class="mb-6 text-sm text-ayu-muted">
					That name already exists. Enter your 4-digit PIN to sign in.
				</p>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						submitPin();
					}}
				>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						class="mb-4 w-full rounded-lg border border-ayu-border bg-ayu-bg px-4 py-3 text-center font-mono text-2xl tracking-widest text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
						placeholder="• • • •"
						bind:value={pinInput}
						maxlength={4}
						inputmode="numeric"
						autofocus
					/>
					{#if error}<p class="mb-3 text-sm text-ayu-red">{error}</p>{/if}
					<button
						type="submit"
						disabled={loading || pinInput.length < 4}
						class="w-full rounded-lg bg-ayu-gold px-4 py-3 font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50"
					>
						{loading ? 'Verifying…' : 'Sign in'}
					</button>
				</form>
			{/if}
		</div>
	</div>
{/if}
