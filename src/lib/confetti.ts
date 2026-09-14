declare const confetti: (opts: object) => void;

// This is the only feature in the app that uses tsparticles/confetti, so it's
// loaded on demand instead of via a static <script> in app.html — that tag
// was pulling in a 150KB bundle on every route, including every admin page,
// for a script only ever needed on the main session page after a score.
let confettiScriptPromise: Promise<void> | null = null;
function loadConfettiScript(): Promise<void> {
	if (typeof document === 'undefined') return Promise.resolve();
	if (typeof confetti !== 'undefined') return Promise.resolve();
	if (!confettiScriptPromise) {
		confettiScriptPromise = new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = '/tsparticles.confetti.bundle.min.js';
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Failed to load confetti script'));
			document.head.appendChild(script);
		});
	}
	return confettiScriptPromise;
}

export async function fireConfetti() {
	try {
		await loadConfettiScript();
	} catch {
		return;
	}
	if (typeof confetti === 'undefined') return;
	const count = 200;
	const defaults = { origin: { y: 0.7 } };

	function fire(ratio: number, opts: object) {
		confetti(Object.assign({}, defaults, opts, { particleCount: Math.floor(count * ratio) }));
	}

	fire(0.25, { spread: 26, startVelocity: 55 });
	fire(0.2, { spread: 60 });
	fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
	fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
	fire(0.1, { spread: 120, startVelocity: 45 });
}

const MEDAL_IMAGES: Record<'gold' | 'silver' | 'bronze', string> = {
	gold: '/first_place_medal.png',
	silver: '/second_place_medal.png',
	bronze: '/third_place_medal.png'
};

export async function fireMedalConfetti(medal: 'gold' | 'silver' | 'bronze') {
	try {
		await loadConfettiScript();
	} catch {
		return;
	}
	if (typeof confetti === 'undefined') return;
	confetti({
		spread: 360,
		ticks: 200,
		gravity: 1,
		decay: 0.94,
		startVelocity: 30,
		particleCount: 100,
		scalar: 3,
		shapes: ['image'],
		shapeOptions: {
			image: [{ src: MEDAL_IMAGES[medal], width: 32, height: 32 }]
		}
	});
}
