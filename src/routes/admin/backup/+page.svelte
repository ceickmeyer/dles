<script lang="ts">
	import { supabase } from '$lib/supabase';

	let exporting = $state(false);
	let exportError = $state('');

	let importing = $state(false);
	let importResult = $state<{ success: boolean; message: string } | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	async function exportBackup() {
		exporting = true;
		exportError = '';
		try {
			const [players, games, sessions, session_games, scores, schedules] = await Promise.all([
				supabase.from('players').select('*').order('created_at'),
				supabase.from('games').select('*').order('created_at'),
				supabase.from('sessions').select('*').order('created_at'),
				supabase.from('session_games').select('*'),
				supabase.from('scores').select('*').order('submitted_at'),
				supabase.from('schedules').select('*').order('created_at'),
			]);

			const errors = [players, games, sessions, session_games, scores, schedules]
				.map(r => r.error?.message).filter(Boolean);
			if (errors.length) throw new Error(errors.join('; '));

			const backup = {
				version: 1,
				exported_at: new Date().toISOString(),
				players: players.data,
				games: games.data,
				sessions: sessions.data,
				session_games: session_games.data,
				scores: scores.data,
				schedules: schedules.data,
			};

			const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			const date = new Date().toISOString().slice(0, 10);
			a.href = url;
			a.download = `dles-backup-${date}.json`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e: unknown) {
			exportError = e instanceof Error ? e.message : String(e);
		} finally {
			exporting = false;
		}
	}

	async function importBackup(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		importing = true;
		importResult = null;
		try {
			const text = await file.text();
			const backup = JSON.parse(text);
			if (backup.version !== 1) throw new Error('Unknown backup version');

			const tables: Array<{ name: string; key: keyof typeof backup; conflict: string }> = [
				{ name: 'players',      key: 'players',      conflict: 'id' },
				{ name: 'games',        key: 'games',        conflict: 'id' },
				{ name: 'sessions',     key: 'sessions',     conflict: 'id' },
				{ name: 'schedules',    key: 'schedules',    conflict: 'id' },
				{ name: 'session_games',key: 'session_games',conflict: 'id' },
				{ name: 'scores',       key: 'scores',       conflict: 'id' },
			];

			const counts: string[] = [];
			for (const { name, key, conflict } of tables) {
				const rows = backup[key];
				if (!Array.isArray(rows) || rows.length === 0) continue;
				const { error } = await supabase.from(name).upsert(rows, { onConflict: conflict });
				if (error) throw new Error(`${name}: ${error.message}`);
				counts.push(`${rows.length} ${name}`);
			}

			importResult = { success: true, message: `Restored: ${counts.join(', ')}` };
		} catch (e: unknown) {
			importResult = { success: false, message: e instanceof Error ? e.message : String(e) };
		} finally {
			importing = false;
			if (fileInput) fileInput.value = '';
		}
	}
</script>

<div class="space-y-8 max-w-lg">
	<h1 class="text-2xl font-bold text-white">Backup</h1>

	<!-- Export -->
	<div class="rounded-xl border border-ayu-border bg-ayu-surface p-6 space-y-3">
		<h2 class="text-sm font-semibold uppercase tracking-wider text-ayu-muted">Export</h2>
		<p class="text-sm text-zinc-400">Download all players, games, sessions, scores, and schedules as a JSON file.</p>
		{#if exportError}
			<p class="text-sm text-red-400">{exportError}</p>
		{/if}
		<button
			onclick={exportBackup}
			disabled={exporting}
			class="rounded-lg bg-ayu-gold px-4 py-2 text-sm font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50"
		>
			{exporting ? 'Exporting…' : '↓ Download Backup'}
		</button>
	</div>

	<!-- Import -->
	<div class="rounded-xl border border-ayu-border bg-ayu-surface p-6 space-y-3">
		<h2 class="text-sm font-semibold uppercase tracking-wider text-ayu-muted">Import</h2>
		<p class="text-sm text-zinc-400">
			Restore from a backup file. Existing records with matching IDs will be updated; new records will be inserted.
		</p>
		{#if importResult}
			<p class="text-sm {importResult.success ? 'text-ayu-green' : 'text-red-400'}">
				{importResult.success ? '✓' : '✗'} {importResult.message}
			</p>
		{/if}
		<label class="block">
			<span class="sr-only">Choose backup file</span>
			<input
				bind:this={fileInput}
				type="file"
				accept=".json,application/json"
				disabled={importing}
				onchange={importBackup}
				class="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-600 disabled:opacity-50"
			/>
		</label>
		{#if importing}
			<p class="text-sm text-ayu-muted">Importing…</p>
		{/if}
	</div>
</div>
