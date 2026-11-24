const chips = [...document.querySelectorAll<HTMLButtonElement>('.chips button')];
for (const chip of chips)
  chip.addEventListener('click', () => {
    const tag = chip.dataset.tag;
    for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
    for (const card of document.querySelectorAll<HTMLElement>('.cards a'))
      card.hidden = tag !== undefined && !card.dataset.tags!.split(' ').includes(tag);
    for (const group of document.querySelectorAll<HTMLElement>('.group')) {
      group.hidden = !group.querySelector('.cards a:not([hidden])');
      document.querySelector<HTMLElement>(`.side a[href="#${group.id}"]`)!.hidden = group.hidden;
    }
  });
