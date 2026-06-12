<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { sounds } from '$lib/sounds';

	let {
		sessionId,
		playerId = null,
		playerName = null,
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

	type DisplayGroup =
		| { kind: 'msg'; msg: Message }
		| { kind: 'log'; key: string; player: string; msgs: Message[] };

	let messages = $state<Message[]>([]);
	let draft = $state('');
	let open = $state(false);
	let sending = $state(false);
	let sendError = $state('');
	let unread = $state(0);
	let listEl = $state<HTMLElement | null>(null);
	let subscription: ReturnType<typeof supabase.channel> | null = null;
	let expandedKeys = $state(new Set<string>());

	function isLogMsg(m: Message): boolean {
		return m.player_id === null;
	}

	function logPlayer(content: string): string | null {
		const match = content.match(/^(.+?) (?:scored|DNF'd) /);
		return match ? match[1] : null;
	}

	const groups = $derived.by((): DisplayGroup[] => {
		const result: DisplayGroup[] = [];
		let i = 0;
		while (i < messages.length) {
			const m = messages[i];
			if (isLogMsg(m)) {
				const player = logPlayer(m.content);
				if (player) {
					const run: Message[] = [m];
					let j = i + 1;
					while (
						j < messages.length &&
						isLogMsg(messages[j]) &&
						logPlayer(messages[j].content) === player
					) {
						run.push(messages[j]);
						j++;
					}
					if (run.length >= 2) {
						result.push({ kind: 'log', key: run[0].id, player, msgs: run });
						i = j;
						continue;
					}
				}
			}
			result.push({ kind: 'msg', msg: m });
			i++;
		}
		return result;
	});

	function toggleGroup(key: string) {
		const next = new Set(expandedKeys);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expandedKeys = next;
	}

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
			.limit(200);
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
		else sounds.positive();
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
		open = window.innerWidth >= 640;
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
				if (msg.player_id !== playerId && msg.player_id !== null) {
					sounds.positive();
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
		<div class="flex flex-col w-72 sm:w-80 rounded-xl border border-ayu-border bg-zinc-950 shadow-2xl overflow-hidden"
			style="max-height: min(420px, calc(100vh - 5rem))">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-ayu-border bg-ayu-surface px-4 py-3">
				<p class="text-sm font-semibold text-white">💬 Chat</p>
				<button onclick={toggle} class="text-ayu-muted hover:text-white transition text-lg leading-none">×</button>
			</div>

			<!-- Messages -->
			<div bind:this={listEl} class="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style="min-height:140px;max-height:260px">
				{#if messages.length === 0}
					<p class="text-center text-xs text-ayu-muted pt-8">No messages yet. Say something!</p>
				{:else}
					{#each groups as group (group.kind === 'msg' ? group.msg.id : group.key)}
						{#if group.kind === 'msg'}
							{#if group.msg.player_id === null}
								<!-- Single system/log message -->
								<div class="flex items-center gap-2 py-0.5">
									<div class="flex-1 h-px bg-ayu-border"></div>
									<span class="text-xs text-ayu-blue/80 px-1 text-center">{group.msg.content}</span>
									<div class="flex-1 h-px bg-ayu-border"></div>
								</div>
							{:else}
								<!-- Regular chat message -->
								<div class="flex flex-col {group.msg.player_id === playerId ? 'items-end' : 'items-start'}">
									<div class="flex items-baseline gap-1.5 mb-0.5">
										<span class="text-xs font-semibold {group.msg.player_id === playerId ? 'text-zinc-400' : 'text-ayu-gold'}">
											{group.msg.player_id === playerId ? 'You' : group.msg.player_name}
										</span>
										<span class="text-xs text-zinc-600">{formatTime(group.msg.created_at)}</span>
									</div>
									<div class="max-w-[85%] wrap-break-word rounded-2xl px-3 py-2 text-sm {group.msg.player_id === playerId
										? 'bg-ayu-gold text-ayu-bg rounded-br-sm'
										: 'bg-ayu-surface2 text-white rounded-bl-sm'}">
										{group.msg.content}
									</div>
								</div>
							{/if}
						{:else}
							<!-- Grouped log messages -->
							{#if expandedKeys.has(group.key)}
								<!-- Expanded: all messages -->
								{#each group.msgs as msg (msg.id)}
									<div class="flex items-center gap-2 py-0.5">
										<div class="flex-1 h-px bg-ayu-border"></div>
										<span class="text-xs text-ayu-blue/80 px-1 text-center">{msg.content}</span>
										<div class="flex-1 h-px bg-ayu-border"></div>
									</div>
								{/each}
								<button
									onclick={() => toggleGroup(group.key)}
									class="flex w-full items-center gap-2 py-0.5 transition-opacity hover:opacity-70"
								>
									<div class="flex-1 h-px bg-ayu-border"></div>
									<span class="shrink-0 rounded-full bg-ayu-surface2 px-2 py-0.5 text-xs font-semibold text-ayu-blue">▲ collapse</span>
									<div class="flex-1 h-px bg-ayu-border"></div>
								</button>
							{:else}
								<!-- Collapsed: last message + count badge on right -->
								<button
									onclick={() => toggleGroup(group.key)}
									class="flex w-full items-center gap-2 py-0.5 text-left transition-opacity hover:opacity-70"
								>
									<div class="flex-1 h-px bg-ayu-border"></div>
									<span class="text-xs text-ayu-blue/80 text-center">{group.msgs[group.msgs.length - 1].content}</span>
									<span class="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-ayu-surface2 px-1.5 py-px text-[10px] font-semibold text-ayu-blue">
										+{group.msgs.length - 1}
										<svg class="w-2 h-2" viewBox="0 0 10 6" fill="currentColor">
											<path d="M0 0.5L5 5.5L10 0.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									</span>
									<div class="flex-1 h-px bg-ayu-border"></div>
								</button>
							{/if}
						{/if}
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
							autocomplete="off"
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
