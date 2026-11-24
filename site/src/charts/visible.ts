export function whileVisible(el: Element, step: (now: number) => void): void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let shown = false;
  let frame = 0;
  const loop = (now: number) => {
    step(now);
    frame = requestAnimationFrame(loop);
  };
  const sync = () => {
    const run = shown && !document.hidden && !reduced.matches;
    if (run && !frame) frame = requestAnimationFrame(loop);
    if (!run && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
  new IntersectionObserver(entries => {
    shown = entries.at(-1)?.isIntersecting ?? false;
    sync();
  }).observe(el);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
}

const margin = 200;
const rootMargin = `${margin}px`;

const isNear = (el: Element) => {
  const r = el.getBoundingClientRect();
  return (
    el.getClientRects().length > 0 &&
    r.bottom >= -margin &&
    r.top <= innerHeight + margin &&
    r.right >= -margin &&
    r.left <= innerWidth + margin
  );
};

export function whenNear(el: Element, start: () => void): void {
  const near = new IntersectionObserver(
    entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      near.disconnect();
      start();
    },
    { rootMargin },
  );
  near.observe(el);
}

/** Mounts what `load` brings while `el` is near the viewport, and destroys it once `el` is not. */
export function whileNear<T>(
  el: Element,
  load: () => Promise<T>,
  mount: (value: T) => { destroy(): void },
): void {
  let near = false;
  let pending = 0;
  let mounted: { destroy(): void } | undefined;
  const observer = new IntersectionObserver(
    entries => {
      near = entries.at(-1)?.isIntersecting ?? false;
      if (!near) {
        pending++;
        const gone = mounted;
        mounted = undefined;
        gone?.destroy();
        return;
      }
      if (mounted) return;
      const mine = ++pending;
      void load().then(value => {
        if (!near || mine !== pending) return;
        if (isNear(el)) {
          mounted = mount(value);
          return;
        }
        // The exit may not be delivered yet; re-observing reports the current state, so a card that is back still loads.
        observer.unobserve(el);
        observer.observe(el);
      });
    },
    { rootMargin },
  );
  observer.observe(el);
}
