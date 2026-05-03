function play(path: string) {
	try {
		const audio = new Audio(path);
		audio.play().catch(() => {});
	} catch { /* ignore */ }
}

export const sounds = {
	submit:   () => play('/sounds/submit.mp3'),
	others:   () => play('/sounds/others.mp3'),
	finished: () => play('/sounds/finished.mp3'),
};
