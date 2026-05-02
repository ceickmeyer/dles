<script lang="ts">
	import { supabase } from '$lib/supabase';

	let email = $state('');
	let sent = $state(false);
	let loading = $state(false);
	let error = $state('');

	async function sendMagicLink() {
		loading = true;
		error = '';
		const { error: authError } = await supabase.auth.signInWithOtp({
			email: email.trim(),
			options: { emailRedirectTo: `${window.location.origin}/admin` }
		});
		if (authError) {
			error = authError.message;
		} else {
			sent = true;
		}
		loading = false;
	}
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	<div class="w-full max-w-sm">
		<h1 class="mb-6 text-2xl font-bold text-white">Admin Login</h1>

		{#if sent}
			<div class="rounded-xl border border-green-700 bg-green-900/20 p-5 text-center">
				<p class="text-green-400 font-semibold">Check your email!</p>
				<p class="mt-1 text-sm text-zinc-400">We sent a magic link to {email}</p>
			</div>
		{:else}
			<form onsubmit={(e) => { e.preventDefault(); sendMagicLink(); }}>
				<label class="mb-1.5 block text-sm text-zinc-400" for="email">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					class="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
					placeholder="you@example.com"
					autofocus
				/>
				{#if error}
					<p class="mb-3 text-sm text-red-400">{error}</p>
				{/if}
				<button
					type="submit"
					disabled={loading || !email.trim()}
					class="w-full rounded-lg bg-amber-400 px-4 py-3 font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
				>
					{loading ? 'Sending…' : 'Send magic link'}
				</button>
			</form>
		{/if}
	</div>
</div>
