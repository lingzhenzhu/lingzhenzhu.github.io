/** Start the short invitation when the visitor can see it, including prerendered pages. */
export function initOpening(cue: HTMLElement) {
  const abort = new AbortController();
  let ready = false,
    visible = false,
    started = false;
  const start = () => {
    if (
      started ||
      abort.signal.aborted ||
      !ready ||
      !visible ||
      document.hidden ||
      (document as Document & { prerendering?: boolean }).prerendering
    )
      return;
    started = true;
    cue.dataset.inviting = '';
    observer.disconnect();
    abort.abort();
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      start();
    },
    { threshold: 0.5 },
  );
  observer.observe(cue);
  document.addEventListener('visibilitychange', start, { signal: abort.signal });
  document.addEventListener('prerenderingchange', start, { signal: abort.signal });
  void document.fonts.ready.then(() => {
    ready = true;
    start();
  });
  return () => {
    observer.disconnect();
    abort.abort();
    delete cue.dataset.inviting;
  };
}
