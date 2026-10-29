/** Separate pause reasons prevent visibility, hover and speech events from undoing a user's choice. */
export class NewsController {
  private abort = new AbortController();
  private observer: ResizeObserver;
  private timer?: ReturnType<typeof setTimeout>;
  private frame = 0;
  private paused = new Set<string>();
  private manual = false;
  private overflowing = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private scroller: HTMLElement;
  private toggle: HTMLButtonElement;
  constructor(private root: HTMLElement) {
    this.scroller = root.querySelector<HTMLElement>('.news-feed-inner')!;
    this.toggle = root.querySelector<HTMLButtonElement>('.news-toggle')!;
    this.manual = this.toggle.getAttribute('aria-pressed') === 'true';
    const { signal } = this.abort;
    const listen = (target: EventTarget, event: string, listener: EventListener) =>
      target.addEventListener(event, listener, { signal });
    listen(this.toggle, 'click', () => {
      this.manual = !this.manual;
      this.update();
    });
    listen(root, 'pointerenter', (event) => {
      if ((event as PointerEvent).pointerType !== 'touch') this.pause('hover', true);
    });
    listen(root, 'pointerleave', () => this.pause('hover', false));
    listen(root, 'focusin', () => this.pause('focus', true));
    listen(root, 'focusout', () =>
      queueMicrotask(() => this.pause('focus', root.contains(document.activeElement))),
    );
    listen(this.scroller, 'pointerdown', () => {
      this.manual = true;
      this.update();
    });
    listen(this.scroller, 'wheel', () => {
      this.manual = true;
      this.update();
    });
    listen(this.scroller, 'keydown', (event) => {
      if (
        ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes((event as KeyboardEvent).key)
      ) {
        this.manual = true;
        this.update();
      }
    });
    listen(document, 'visibilitychange', () => this.pause('hidden', document.hidden));
    listen(document, 'site:speech', (event) => this.pause('speech', (event as CustomEvent<boolean>).detail));
    listen(this.reduced, 'change', () => this.pause('motion', this.reduced.matches));
    this.observer = new ResizeObserver(() => this.measure());
    this.observer.observe(this.scroller);
    this.observer.observe(this.scroller.querySelector('ul')!);
    this.pause('motion', this.reduced.matches);
    this.pause('hidden', document.hidden);
    this.measure();
  }
  private measure() {
    this.overflowing =
      this.scroller.scrollHeight > this.scroller.clientHeight + 1 &&
      this.scroller.querySelectorAll('li').length > 1;
    this.toggle.disabled = !this.overflowing;
    this.update();
  }
  private pause(reason: string, value: boolean) {
    value ? this.paused.add(reason) : this.paused.delete(reason);
    this.update();
  }
  private update() {
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame);
    this.toggle.setAttribute('aria-pressed', String(this.manual));
    this.toggle.setAttribute(
      'aria-label',
      'News: ' + (this.manual ? 'resume' : 'pause') + ' automatic scrolling',
    );
    this.root.dataset.state = this.manual ? 'paused' : this.paused.size ? 'suspended' : 'playing';
    if (!this.manual && !this.paused.size && this.overflowing && this.root.dataset.autoplay === 'true')
      this.timer = setTimeout(() => this.advance(), Number(this.root.dataset.interval) || 7000);
  }
  private advance() {
    const start = this.scroller.scrollTop;
    const max = this.scroller.scrollHeight - this.scroller.clientHeight;
    const items = Array.from(this.scroller.querySelectorAll<HTMLElement>('li'));
    const origin = items[0]?.offsetTop || 0;
    const next = items.map((item) => item.offsetTop - origin).find((top) => top > start + 1);
    const end = start >= max - 1 ? 0 : Math.min(next ?? max, max);
    const begin = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - begin) / 650, 1);
      this.scroller.scrollTop = start + (end - start) * (1 - Math.pow(1 - progress, 3));
      if (progress < 1) this.frame = requestAnimationFrame(step);
      else this.update();
    };
    this.frame = requestAnimationFrame(step);
  }
  destroy() {
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.abort.abort();
  }
}
