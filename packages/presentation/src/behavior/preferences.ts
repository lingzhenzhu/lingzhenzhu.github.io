export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  largeText: boolean;
  contrast: boolean;
}
export const preferenceKey = 'lzzhu.preferences.v1';
export function readPreferences(): Preferences {
  try {
    const input = JSON.parse(localStorage.getItem(preferenceKey) || '{}');
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
  document.body.classList.toggle('dark-theme', dark);
  document.body.classList.toggle('a11y-large-text', prefs.largeText);
  document.body.classList.toggle('a11y-high-contrast', prefs.contrast);
  return dark;
}
export function savePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(preferenceKey, JSON.stringify(prefs));
  } catch {
    /* Preferences remain usable without storage. */
  }
}
