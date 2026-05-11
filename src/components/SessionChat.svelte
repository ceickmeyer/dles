<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { sounds } from '$lib/sounds';

	let {
		sessionId,
		playerId = null,
		playerName = null
	}: {
		sessionId: string;
		playerId?: string | null;
		playerName?: string | null;
	} = $props();

	interface Message {
		id: string;
		player_id: string;
		player_name: string;
		content: string;
		created_at: string;
	}

	let messages = $state<Message[]>([]);
	let draft = $state('');
	let open = $state(true);
	let sending = $state(false);
	let sendError = $state('');
	let unread = $state(0);
	let listEl = $state<HTMLElement | null>(null);
	let subscription: ReturnType<typeof supabase.channel> | null = null;

	function formatTime(ts: string): string {
		return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
	}

	async function scrollToBottom() {
		await tick();
		if (listEl) listEl.scrollTop = listEl.scrollHeight;
	}

	async function load() {
		const { data } = await supabase
			.from('messages')
			.select('id, player_id, player_name, content, created_at')
			.eq('session_id', sessionId)
			.order('created_at', { ascending: true })
			.limit(100);
		messages = (data ?? []) as Message[];
		scrollToBottom();
	}

	async function send() {
		const content = draft.trim();
		if (!content || !playerId || !playerName || sending) return;
		sending = true;
		sendError = '';
		draft = '';
		const { error } = await supabase.from('messages').insert({
			session_id: sessionId,
			player_id: playerId,
			player_name: playerName,
			content
		});
		if (error) { sendError = 'Failed to send.'; draft = content; }
		sending = false;
	}

	function toggle() {
		open = !open;
		if (open) {
			unread = 0;
			scrollToBottom();
		}
	}

	onMount(async () => {
		await load();
		subscription = supabase
			.channel(`chat:${sessionId}`)
			.on('postgres_changes', {
				event: 'INSERT',
				schema: 'public',
				table: 'messages',
				filter: `session_id=eq.${sessionId}`
			}, (payload) => {
				const msg = payload.new as Message;
				messages = [...messages, msg];
				if (msg.player_id !== playerId) {
					sounds.others();
					if (!open) unread++;
				}
				scrollToBottom();
			})
			.subscribe();
	});

	onDestroy(() => { subscription?.unsubscribe(); });
</script>

<!-- Floating chat button -->
<div class="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
	{#if open}
		<div class="flex flex-col w-80 sm:w-96 rounded-xl border border-ayu-border bg-zinc-950 shadow-2xl overflow-hidden"
			style="max-height: min(500px, calc(100vh - 5rem))">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-ayu-border bg-ayu-surface px-4 py-3">
				<p class="text-sm font-semibold text-white">💬 Chat</p>
				<button onclick={toggle} class="text-ayu-muted hover:text-white transition text-lg leading-none">×</button>
			</div>

			<!-- Messages -->
			<div bind:this={listEl} class="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style="height: 320px">
				{#if messages.length === 0}
					<p class="text-center text-xs text-ayu-muted pt-8">No messages yet. Say something!</p>
				{:else}
					{#each messages as msg (msg.id)}
						<div class="flex flex-col {msg.player_id === playerId ? 'items-end' : 'items-start'}">
							<div class="flex items-baseline gap-1.5 mb-0.5">
								<span class="text-xs font-semibold {msg.player_id === playerId ? 'text-zinc-400' : 'text-ayu-gold'}">
									{msg.player_id === playerId ? 'You' : msg.player_name}
								</span>
								<span class="text-xs text-zinc-600">{formatTime(msg.created_at)}</span>
							</div>
							<div class="max-w-[85%] rounded-2xl px-3 py-2 text-sm {msg.player_id === playerId
								? 'bg-ayu-gold text-ayu-bg rounded-br-sm'
								: 'bg-ayu-surface2 text-white rounded-bl-sm'}">
								{msg.content}
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Input -->
			<div class="border-t border-ayu-border bg-ayu-surface px-3 py-2">
				{#if sendError}
					<p class="mb-1 text-xs text-ayu-red">{sendError}</p>
				{/if}
				{#if playerId && playerName}
					<form onsubmit={(e) => { e.preventDefault(); send(); }} class="flex gap-2">
						<input
							bind:value={draft}
							placeholder="Say something…"
							maxlength={500}
							disabled={sending}
							class="flex-1 rounded-lg border border-ayu-border bg-ayu-bg px-3 py-1.5 text-sm text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none disabled:opacity-50"
						/>
						<button
							type="submit"
							disabled={!draft.trim() || sending}
							class="rounded-lg bg-ayu-gold px-3 py-1.5 text-sm font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-40"
						>
							↑
						</button>
					</form>
				{:else}
					<p class="text-center text-xs text-ayu-muted py-1">Sign in to chat</p>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Toggle button -->
	<button
		onclick={toggle}
		class="flex h-12 w-12 items-center justify-center rounded-full bg-ayu-gold text-ayu-bg shadow-lg transition hover:brightness-110 relative"
		aria-label="Toggle chat"
	>
		<span class="text-xl">{open ? '×' : '💬'}</span>
		{#if !open && unread > 0}
			<span class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ayu-red text-xs font-bold text-white">
				{unread > 9 ? '9+' : unread}
			</span>
		{/if}
	</button>
</div>
