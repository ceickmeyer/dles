<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="py-20 text-center">
	<p class="mb-2 text-5xl">{$page.status === 404 ? '🔍' : '⚠️'}</p>
	<h1 class="mb-2 text-2xl font-bold text-white">{$page.status}</h1>
	<p class="text-ayu-muted">{$page.error?.message ?? 'Something went wrong'}</p>
	<a href="/" class="mt-6 inline-block text-sm text-ayu-gold underline hover:brightness-110">← Back to lobby</a>
</div>
