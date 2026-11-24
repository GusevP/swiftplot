import { load, mountExample } from '../charts/mount';
import { code, type Defaults } from '../codegen/index';
import type { Token } from '../codegen/tokens';
import { fromQuery, switchKey, type State } from '../examples/define';
import type { Framework } from './preferences';

const nodes = (tokens: readonly Token[]) =>
  tokens.map(t =>
    t.kind === 'plain'
      ? t.text
      : Object.assign(document.createElement('span'), { className: t.kind, textContent: t.text }),
  );

async function start(demo: HTMLElement) {
  const definition = await load(demo.dataset.example!);
  const defaults = JSON.parse(demo.dataset.defaults ?? '{}') as Defaults;
  const scope = demo.closest('[data-scope]') ?? demo;
  const form = demo.querySelector('form');
  for (const [prop, value] of Object.entries(fromQuery(definition, new URLSearchParams(location.search)))) {
    const input = form?.elements.namedItem(prop);
    if (input instanceof HTMLInputElement) input.checked = value as boolean;
    else if (input instanceof HTMLSelectElement) input.value = value as string;
  }
  const state = (): State =>
    Object.fromEntries(
      definition.switches.map(s => {
        const input = form?.elements.namedItem(switchKey(s));
        return [
          switchKey(s),
          input instanceof HTMLInputElement ? input.checked : (input as HTMLSelectElement).value,
        ];
      }),
    );
  const render = (now: State) => {
    for (const el of scope.querySelectorAll<HTMLElement>('code[data-live]'))
      el.replaceChildren(...nodes(code(el.dataset.live as Framework, definition, now, defaults)));
  };
  const mounted = mountExample(demo.querySelector<HTMLElement>('.chart')!, definition, state());
  render(state());
  form?.addEventListener('change', () => {
    const now = state();
    mounted.update(now);
    render(now);
  });
}

for (const demo of document.querySelectorAll<HTMLElement>('[data-example][data-defaults]')) void start(demo);
