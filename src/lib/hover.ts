// Whether the primary pointer can hover (mouse/trackpad) as opposed to touch-only.
// Touch browsers don't reliably synthesize mouseenter/hover from a tap — some fire
// it once, some never, some fire it right before a click and yank the tooltip back
// closed — which is exactly why info tooltips felt inconsistent on mobile. Instead
// of layering hover + click and hoping the events race in our favor, every tooltip
// picks ONE interaction mode based on this check: hover on devices that support it,
// explicit tap-to-toggle (with tap-outside-to-close) everywhere else.
export const canHover =
	typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
