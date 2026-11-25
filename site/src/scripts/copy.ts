for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  button.addEventListener('click', async () => {
    const code = button.closest('[data-copy-scope]')?.querySelector('code');
    try {
      await navigator.clipboard.writeText(code?.innerText ?? '');
      button.textContent = 'Copied';
    } catch {
      if (code) getSelection()?.selectAllChildren(code);
      button.textContent = 'Press Ctrl+C or ⌘C';
    }
    setTimeout(() => (button.textContent = 'Copy'), 1500);
  });
}
