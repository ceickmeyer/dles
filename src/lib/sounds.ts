function play(path: string) {
	try {
		const audio = new Audio(path);
		audio.play().catch(() => {});
	} catch { /* ignore */ }
}

function debounced(path: string, ms: number) {
	let blocked = false;
	return () => {
		if (blocked) return;
		play(path);
		blocked = true;
		setTimeout(() => { blocked = false; }, ms);
	};
}

export const sounds = {
	submit:   () => play('/sounds/submit.mp3'),
	others:   () => play('/sounds/others.mp3'),
	finished: () => play('/sounds/finished.mp3'),
	uptempo:  debounced('/sounds/uptempo.mp3', 2000),
	positive: () => play('/sounds/positive.mp3'),
	gold:     () => play('/sounds/gold.mp3'),
	silver:   () => play('/sounds/silver.mp3'),
	bronze:   () => play('/sounds/bronze.mp3'),
};
