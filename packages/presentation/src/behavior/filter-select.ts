/** A small select-only combobox; native select owns the form value and provides fallback. */
export function initFilterSelect(root: HTMLElement) {
  const select = root.querySelector('select')!;
  const trigger = root.querySelector<HTMLButtonElement>('[data-filter-trigger]')!;
  const value = root.querySelector<HTMLElement>('[data-filter-value]')!;
  const list = root.querySelector<HTMLElement>('[data-filter-options]')!;
  const options = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  if (typeof list.showPopover !== 'function') return { sync() {}, destroy() {} };
  const abort = new AbortController();
  const { signal } = abort;
  const isOpen = () => list.matches(':popover-open');
  let active = 0,
    typed = '',
    lastTyped = 0;

  function position() {
    if (!isOpen()) return;
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0,
      top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth,
      height = viewport?.height || innerHeight;
    if (rect.bottom < top || rect.top > top + height) {
      close();
      return;
    }
    const popupWidth = Math.min(Math.max(rect.width, 180), width - 24);
    list.style.width = `${popupWidth}px`;
    list.style.left = `${Math.max(left + 12, Math.min(rect.left, left + width - popupWidth - 12))}px`;
    const below = top + height - rect.bottom - 20,
      above = rect.top - top - 20;
    const upward = below < Math.min(220, list.scrollHeight) && above > below;
    list.style.maxHeight = `${Math.max(80, Math.min(320, upward ? above : below))}px`;
    list.style.top = `${Math.max(top + 12, upward ? rect.top - list.getBoundingClientRect().height - 8 : rect.bottom + 8)}px`;
  }
  function highlight(index: number, reveal = false) {
    active = Math.max(0, Math.min(options.length - 1, index));
    options.forEach((option, i) => option.toggleAttribute('data-active', i === active));
    if (isOpen()) trigger.setAttribute('aria-activedescendant', options[active].id);
    if (reveal) {
      const option = options[active];
      if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }
  function sync() {
    active = Math.max(0, select.selectedIndex);
    const label = select.options[active]?.label || '';
    // Preserve the pointer target through editor focus/selection rerenders.
    // Replacing an unchanged text node between down/up cancels WebKit's click.
    if (value.textContent !== label) value.textContent = label;
    trigger.disabled = select.disabled;
    options.forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
    highlight(active);
  }
  function open() {
    if (trigger.disabled || isOpen()) return;
    typed = '';
    trigger.focus({ preventScroll: true });
    // Naming the trigger as the popover's source keeps a press on it from counting as
    // an outside light-dismiss, where supported; `openAtPress` covers other engines.
    list.showPopover({ source: trigger } as ShowPopoverOptions);
    sync();
    position();
    highlight(active, true);
  }
  function close() {
    if (isOpen()) list.hidePopover();
  }
  function choose(index: number) {
    if (options[index]?.getAttribute('aria-disabled') === 'true') return;
    select.value = options[index].dataset.value || '';
    sync();
    close();
    trigger.focus({ preventScroll: true });
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  list.addEventListener(
    'beforetoggle',
    (event) => {
      const opening = (event as ToggleEvent).newState === 'open';
      trigger.setAttribute('aria-expanded', String(opening));
      if (!opening) trigger.removeAttribute('aria-activedescendant');
    },
    { signal },
  );
  // Light dismiss closes an open list as the press on the trigger ends, before its
  // click. Remember the state at press time so that click closes rather than reopens.
  let openAtPress = false;
  // Safari otherwise focuses a tabbable editor ancestor on pointer-down. That
  // can change the editor selection/layout before the subsequent click lands.
  trigger.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      openAtPress = isOpen();
      event.preventDefault();
      trigger.focus({ preventScroll: true });
    },
    { signal },
  );
  trigger.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      const wasOpen = openAtPress || isOpen();
      openAtPress = false;
      if (wasOpen) close();
      else open();
    },
    { signal },
  );
  trigger.addEventListener(
    'keydown',
    (event) => {
      const key = event.key;
      if (key === 'Tab') {
        close();
        return;
      }
      if (key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        if (isOpen()) choose(active);
        else open();
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
        event.preventDefault();
        const expanded = isOpen();
        open();
        let index =
          key === 'Home'
            ? 0
            : key === 'End'
              ? options.length - 1
              : expanded
                ? active + (key === 'ArrowDown' ? 1 : -1)
                : active;
        const direction = key === 'ArrowUp' || key === 'End' ? -1 : 1;
        while (options[index]?.getAttribute('aria-disabled') === 'true') index += direction;
        if (options[index]) highlight(index, true);
        return;
      }
      if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        open();
        typed = Date.now() - lastTyped > 650 ? key : typed + key;
        lastTyped = Date.now();
        const index = options.findIndex(
          (option) =>
            option.getAttribute('aria-disabled') !== 'true' &&
            option.textContent?.toLocaleLowerCase().startsWith(typed.toLocaleLowerCase()),
        );
        if (index >= 0) highlight(index, true);
      }
    },
    { signal },
  );
  list.addEventListener(
    'pointermove',
    (event) => {
      const option = (event.target as Element).closest<HTMLElement>('[role="option"]');
      if (option && option.getAttribute('aria-disabled') !== 'true') highlight(options.indexOf(option));
    },
    { signal },
  );
  list.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      const option = (event.target as Element).closest<HTMLElement>('[role="option"]');
      if (option) choose(options.indexOf(option));
    },
    { signal },
  );
  select.addEventListener('change', sync, { signal });
  window.addEventListener('resize', position, { signal });
  window.addEventListener(
    'scroll',
    (event) => {
      if (event.target !== list) position();
    },
    { signal, capture: true, passive: true },
  );
  window.visualViewport?.addEventListener('resize', position, { signal });
  window.visualViewport?.addEventListener('scroll', position, { signal });
  select.hidden = true;
  trigger.hidden = false;
  sync();
  return {
    sync,
    destroy() {
      close();
      abort.abort();
      select.hidden = false;
      trigger.hidden = true;
    },
  };
}
