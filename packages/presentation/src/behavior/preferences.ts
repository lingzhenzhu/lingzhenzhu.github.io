export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  largeText: boolean;
  contrast: boolean;
}
export const preferenceKey = 'lzzhu.preferences.v1';
export function readPreferences(): Preferences {
  try {
    const input = JSON.parse(localStorage.getItem('lzzhu.preferences.v1') || '{}');
    return {
      theme: ['dark', 'light'].includes(input.theme) ? input.theme : 'system',
      largeText: input.largeText === true,
      contrast: input.contrast === true,
    };
  } catch {
    return { theme: 'system', largeText: false, contrast: false };
  }
}
export function applyPreferences(prefs: Preferences) {
  const dark =
    prefs.theme === 'dark' ||
    (prefs.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.classList.toggle('dark-theme', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.classList.toggle('a11y-large-text', prefs.largeText);
  root.classList.toggle('a11y-high-contrast', prefs.contrast);
  return dark;
}
export function savePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(preferenceKey, JSON.stringify(prefs));
  } catch {
    /* Preferences remain usable without storage. */
  }
}
