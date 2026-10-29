import 'react';
declare module 'react' {
  interface IframeHTMLAttributes<T> {
    /** HTML credentialless iframe: browsers without support keep the normal embed. */
    credentialless?: '';
  }
}
