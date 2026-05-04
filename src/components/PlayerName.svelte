<script lang="ts">
	import { playerStore } from '$lib/stores/player';
	import { supabase } from '$lib/supabase';

	type Step = 'name' | 'pin-entry' | 'pin-choose';

	let step = $state<Step>('name');
	let name = $state('');
	let pinInput = $state('');
	let loading = $state(false);
	let error = $state('');

	async function submitName() {
		const trimmed = name.trim();
		if (!trimmed) return;
		loading = true;
		error = '';

		const { data: existing } = await supabase
			.from('players')
			.select('id, name, pin')
			.eq('name', trimmed)
			.maybeSingle();

		loading = false;

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
		const { data } = await supabase
			.from('players')
			.select('id, name')
			.eq('name', trimmed)
			.eq('pin', pinInput.trim())
			.maybeSingle();
		loading = false;
		if (!data) {
			error = 'Wrong PIN. Try again, or go back and use a different name.';
			return;
		}
		playerStore.setPlayer(data.id, data.name);
	}

	async function submitNewPin() {
		if (!/^\d{4}$/.test(pinInput)) { error = 'PIN must be exactly 4 digits.'; return; }
		loading = true;
		error = '';
		const { data, error: dbError } = await supabase
			.from('players')
			.insert({ name: name.trim(), pin: pinInput })
			.select()
			.single();
		loading = false;
		if (dbError) { error = 'Could not save — try again.'; return; }
		playerStore.setPlayer(data.id, data.name);
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
	<div class="w-full max-w-sm rounded-2xl border border-ayu-border bg-ayu-surface p-8 shadow-2xl">

		{#if step === 'name'}
			<h2 class="mb-1 text-2xl font-bold text-white">What's your name?</h2>
			<p class="mb-6 text-sm text-ayu-muted">Used to track your scores. You'll set a PIN to sign in on other devices.</p>
			<form onsubmit={(e) => { e.preventDefault(); submitName(); }}>
				<input
					class="mb-4 w-full rounded-lg border border-ayu-border bg-ayu-bg px-4 py-3 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
					placeholder="Enter your name"
					bind:value={name}
					maxlength={40}
					autofocus
				/>
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
			<button onclick={() => { step = 'name'; error = ''; }} class="mb-4 text-sm text-ayu-muted hover:text-white">← Back</button>
			<h2 class="mb-1 text-2xl font-bold text-white">Choose a PIN</h2>
			<p class="mb-6 text-sm text-ayu-muted">Pick a 4-digit PIN — you'll use it to sign in on other devices.</p>
			<form onsubmit={(e) => { e.preventDefault(); submitNewPin(); }}>
				<input
					class="mb-4 w-full rounded-lg border border-ayu-border bg-ayu-bg px-4 py-3 text-center text-2xl font-mono tracking-widest text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
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
			<button onclick={() => { step = 'name'; error = ''; }} class="mb-4 text-sm text-ayu-muted hover:text-white">← Back</button>
			<h2 class="mb-1 text-2xl font-bold text-white">Welcome back, {name}!</h2>
			<p class="mb-6 text-sm text-ayu-muted">That name already exists. Enter your 4-digit PIN to sign in.</p>
			<form onsubmit={(e) => { e.preventDefault(); submitPin(); }}>
				<input
					class="mb-4 w-full rounded-lg border border-ayu-border bg-ayu-bg px-4 py-3 text-center text-2xl font-mono tracking-widest text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none"
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
