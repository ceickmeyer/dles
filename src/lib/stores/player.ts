import { browser } from '$app/environment';
import { writable } from 'svelte/store';

interface PlayerState {
	id: string | null;
	name: string | null;
}

function createPlayerStore() {
	const initial: PlayerState = browser
		? { id: localStorage.getItem('playerId'), name: localStorage.getItem('playerName') }
		: { id: null, name: null };

	const { subscribe, set, update } = writable<PlayerState>(initial);

	return {
		subscribe,
		setPlayer(id: string, name: string) {
			if (browser) {
				localStorage.setItem('playerId', id);
				localStorage.setItem('playerName', name);
			}
			set({ id, name });
		},
		clear() {
			if (browser) {
				localStorage.removeItem('playerId');
				localStorage.removeItem('playerName');
			}
			set({ id: null, name: null });
		}
	};
}

export const playerStore = createPlayerStore();
