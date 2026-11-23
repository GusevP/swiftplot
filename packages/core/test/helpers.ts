export function host() {
  return document.body.appendChild(document.createElement('div'));
}

/** RGBA of the CSS pixel (x, y) of the nth canvas. A WebGL canvas must be read in the task that drew it. */
export function pixel(el: HTMLElement, x: number, y: number, nth = 0) {
  const source = el.querySelectorAll('canvas')[nth]!;
  const copy = document.createElement('canvas').getContext('2d')!;
  copy.drawImage(source, x * devicePixelRatio, y * devicePixelRatio, 1, 1, 0, 0, 1, 1);
  return [...copy.getImageData(0, 0, 1, 1).data];
}

export function hover(el: HTMLElement, x: number, y: number) {
  const root = el.firstElementChild as HTMLElement;
  const box = root.getBoundingClientRect();
  root.dispatchEvent(
    new PointerEvent('pointermove', { pointerType: 'mouse', clientX: box.left + x, clientY: box.top + y }),
  );
  return root;
}

/** What a finger lifted from target sends: the leave reaches every element it was over. */
export function touch(target: Element, clientX = 0, clientY = 0, pointerType = 'touch') {
  const init = { bubbles: true, composed: true, pointerType, clientX, clientY };
  target.dispatchEvent(new PointerEvent('pointerdown', init));
  target.dispatchEvent(new PointerEvent('pointerup', init));
  for (let e: Element | null = target; e; e = e.parentElement) {
    e.dispatchEvent(new PointerEvent('pointerleave', { ...init, bubbles: false }));
  }
}

/** Event fields for the CSS pixel (x, y) of the chart in el. */
export function at(el: HTMLElement, x: number, y: number) {
  const box = el.firstElementChild!.getBoundingClientRect();
  return { bubbles: true, composed: true, cancelable: true, clientX: box.left + x, clientY: box.top + y };
}

export function wheel(el: HTMLElement, x: number, y: number, deltaY: number, init: WheelEventInit = {}) {
  const e = new WheelEvent('wheel', { ...at(el, x, y), deltaY, ...init });
  el.firstElementChild!.dispatchEvent(e);
  return e;
}

export function press(el: HTMLElement, type: string, x: number, y: number, init: PointerEventInit = {}) {
  el.firstElementChild!.dispatchEvent(
    new PointerEvent(type, { ...at(el, x, y), pointerType: 'mouse', pointerId: 1, ...init }),
  );
}

/** A release, and the click a browser sends after it to what is under the pointer. */
export function release(el: HTMLElement, x: number, y: number, init: PointerEventInit = {}) {
  press(el, 'pointerup', x, y, init);
  clickUnder(el, x, y, init);
}

export function clickUnder(el: HTMLElement, x: number, y: number, init: MouseEventInit = {}) {
  const e = at(el, x, y);
  const under = document.elementFromPoint(e.clientX, e.clientY) ?? el.firstElementChild!;
  under.dispatchEvent(new MouseEvent('click', { ...e, ...init }));
}

export function drag(el: HTMLElement, [x0, y0]: number[], [x1, y1]: number[], init: PointerEventInit = {}) {
  press(el, 'pointerdown', x0!, y0!, init);
  press(el, 'pointermove', (x0! + x1!) / 2, (y0! + y1!) / 2, init);
  press(el, 'pointermove', x1!, y1!, init);
  release(el, x1!, y1!, init);
}

export function click(el: HTMLElement, x: number, y: number) {
  press(el, 'pointerdown', x, y);
  release(el, x, y);
}

export function doubleClick(el: HTMLElement, x: number, y: number) {
  click(el, x, y);
  click(el, x, y);
  el.firstElementChild!.dispatchEvent(new MouseEvent('dblclick', { ...at(el, x, y), detail: 2 }));
}

/** Two fingers landing at a0 and b0, moving to a1 and b1, and lifting. */
export function pinch(el: HTMLElement, a0: number[], b0: number[], a1: number[], b1: number[]) {
  const finger = (pointerId: number) => ({ pointerType: 'touch', pointerId });
  press(el, 'pointerdown', a0[0]!, a0[1]!, finger(1));
  press(el, 'pointerdown', b0[0]!, b0[1]!, finger(2));
  press(el, 'pointermove', a1[0]!, a1[1]!, finger(1));
  press(el, 'pointermove', b1[0]!, b1[1]!, finger(2));
  press(el, 'pointerup', a1[0]!, a1[1]!, finger(1));
  press(el, 'pointerup', b1[0]!, b1[1]!, finger(2));
}

export function tap(el: HTMLElement, x: number, y: number) {
  const { clientX, clientY } = at(el, x, y);
  touch(el.firstElementChild!, clientX, clientY);
  clickUnder(el, x, y);
}

export const entriesOf = (el: HTMLElement) => [...el.querySelectorAll('span')].filter(s => s.children.length);
export const middleOf = (e: Element) => {
  const spot = e.getBoundingClientRect();
  return {
    bubbles: true,
    composed: true,
    pointerType: 'mouse',
    clientX: spot.left + spot.width / 2,
    clientY: spot.top + spot.height / 2,
  };
};

export const nextFrame = () => new Promise(requestAnimationFrame);

export const tipOf = (el: HTMLElement) => {
  const tip = [...el.querySelectorAll('div')].find(d => d.style.zIndex === '100')!;
  return () => tip.style.display !== 'none';
};
