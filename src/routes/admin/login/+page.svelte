<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function signIn() {
		loading = true;
		error = '';
		const { error: authError } = await supabase.auth.signInWithPassword({
			email: email.trim(),
			password
		});
		if (authError) {
			error = authError.message;
			loading = false;
		} else {
			goto('/admin');
		}
	}
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="w-full max-w-sm">
		<h1 class="mb-6 text-2xl font-bold text-white">Admin Login</h1>
		<form onsubmit={(e) => { e.preventDefault(); signIn(); }}>
			<label class="mb-1.5 block text-sm text-zinc-400" for="email">Email</label>
			<input
				id="email"
				type="email"
				bind:value={email}
				class="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
				placeholder="you@example.com"
				autofocus
			/>
			<label class="mb-1.5 block text-sm text-zinc-400" for="password">Password</label>
			<input
				id="password"
				type="password"
				bind:value={password}
				class="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
				placeholder="••••••••"
			/>
			{#if error}
				<p class="mb-3 text-sm text-red-400">{error}</p>
			{/if}
			<button
				type="submit"
				disabled={loading || !email.trim() || !password}
				class="w-full rounded-lg bg-amber-400 px-4 py-3 font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
			>
				{loading ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
	</div>
</div>
