import { applyPreferences, readPreferences, savePreferences, type Preferences } from './preferences';

export function initAccessibility(): () => void {
  const panel = document.querySelector<HTMLElement>('#a11y-panel');
  const toggle = document.querySelector<HTMLButtonElement>('#a11y-btn');
  const menu = document.querySelector<HTMLElement>('#a11y-menu');
  if (!panel || !toggle || !menu) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  let preferences = readPreferences();
  let speaking = false;
  let speechGeneration = 0;
  const button = (id: string) => panel.querySelector<HTMLButtonElement>('#' + id)!;
  const setActive = (id: string, value: boolean) => {
    button(id).classList.toggle('active', value);
    button(id).setAttribute('aria-pressed', String(value));
  };
  const refresh = () => {
    setActive('toggle-dark', applyPreferences(preferences));
    setActive('toggle-font-size', preferences.largeText);
    setActive('toggle-contrast', preferences.contrast);
    setActive('toggle-read-aloud', speaking);
  };
  const announceSpeech = () => document.dispatchEvent(new CustomEvent('site:speech', { detail: speaking }));
  const stop = () => {
    speechGeneration++;
    speaking = false;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    refresh();
    announceSpeech();
  };
  const setOpen = (open: boolean) => {
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
  };
  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')), { signal });
  document.addEventListener(
    'click',
    (event) => {
      if (!panel.contains(event.target as Node)) setOpen(false);
    },
    { signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && menu.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    },
    { signal },
  );
  function change(update: Partial<Preferences>) {
    preferences = { ...preferences, ...update };
    savePreferences(preferences);
    refresh();
  }
  button('toggle-dark').addEventListener(
    'click',
    () => change({ theme: document.body.classList.contains('dark-theme') ? 'light' : 'dark' }),
    { signal },
  );
  button('toggle-font-size').addEventListener('click', () => change({ largeText: !preferences.largeText }), {
    signal,
  });
  button('toggle-contrast').addEventListener('click', () => change({ contrast: !preferences.contrast }), {
    signal,
  });
  button('reset-a11y').addEventListener(
    'click',
    () => {
      stop();
      preferences = { theme: 'system', largeText: false, contrast: false };
      savePreferences(preferences);
      refresh();
    },
    { signal },
  );
  const read = button('toggle-read-aloud');
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    read.disabled = true;
    read.style.opacity = '.4';
    read.title = 'Text-to-speech is not supported in this browser';
  } else
    read.addEventListener(
      'click',
      () => {
        if (speaking) {
          stop();
          return;
        }
        const text = (document.querySelector<HTMLElement>('.post-content')?.innerText || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!text) return;
        const sentences = text.match(/[^.!?。！？]+[.!?。！？]*/g) || [text];
        const chunks: string[] = [];
        let current = '';
        for (const sentence of sentences) {
          if (current.length + sentence.length > 220 && current) {
            chunks.push(current);
            current = '';
          }
          current += sentence;
        }
        if (current) chunks.push(current);
        const generation = ++speechGeneration;
        speaking = true;
        refresh();
        announceSpeech();
        function next(index: number) {
          if (!speaking || generation !== speechGeneration) return;
          if (index >= chunks.length) {
            speaking = false;
            refresh();
            announceSpeech();
            return;
          }
          const utterance = new SpeechSynthesisUtterance(chunks[index]);
          utterance.lang = document.documentElement.lang || 'en-US';
          utterance.rate = 0.95;
          utterance.pitch = 1;
          utterance.onend = () => next(index + 1);
          utterance.onerror = () => {
            if (generation === speechGeneration) stop();
          };
          speechSynthesis.speak(utterance);
        }
        next(0);
      },
      { signal },
    );
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh, { signal });
  window.addEventListener(
    'storage',
    () => {
      preferences = readPreferences();
      refresh();
    },
    { signal },
  );
  window.addEventListener('pagehide', stop, { signal });
  refresh();
  return () => {
    stop();
    controller.abort();
  };
}
