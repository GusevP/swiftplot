export type Theme = 'light' | 'dark';
export type Framework = 'js' | 'react' | 'vue';

export const frameworks: readonly { id: Framework; label: string }[] = [
  { id: 'js', label: 'JavaScript' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
];

// Serialized into an inline <script> in <head>, so it may use nothing from this module's scope.
function applyPreferences(ids: readonly string[]): void {
  const read = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const theme = read('theme');
  const root = document.documentElement;
  root.dataset.theme =
    theme === 'light' || theme === 'dark'
      ? theme
      : matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  root.dataset.fw =
    [new URLSearchParams(location.search).get('fw'), read('fw')].find(
      id => id !== null && ids.includes(id),
    ) ?? ids[0];
}

export const headScript = `(${applyPreferences.toString()})(${JSON.stringify(frameworks.map(f => f.id))})`;

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  save('theme', theme);
}

export function setFramework(framework: Framework): void {
  document.documentElement.dataset.fw = framework;
  save('fw', framework);
}
