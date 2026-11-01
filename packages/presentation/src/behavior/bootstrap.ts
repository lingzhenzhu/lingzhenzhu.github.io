import { applyPreferences, readPreferences } from './preferences';
// Head bootstrap and runtime share the same implementation. Apply before body parsing.
export const preferencesBootstrap = `(${applyPreferences.toString()}) ((${readPreferences.toString()})());`;
