/**
 * Accessibility panel for lingzhenzhu.github.io
 * Features: dark mode (system-aware), larger text, high contrast, read aloud
 */
(function () {
    'use strict';

    const body = document.body;
    const btn = document.getElementById('a11y-btn');
    const menu = document.getElementById('a11y-menu');
    const panel = document.getElementById('a11y-panel');

    if (!btn || !menu) return;

    // ── State ────────────────────────────────────────────────────────────────
    const state = {
        dark: null,          // null = follow system, 'dark' | 'light' = manual
        fontSize: false,
        contrast: false,
        speaking: false,     // TTS active
    };

    // ── Load persisted preferences ───────────────────────────────────────────
    function loadPrefs() {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark' || stored === 'light') {
            state.dark = stored;
        }
        // null means follow system (already handled in inline script)

        state.fontSize = localStorage.getItem('a11y-fontSize') === 'true';
        state.contrast = localStorage.getItem('a11y-contrast') === 'true';
    }

    // ── Apply all states to DOM ──────────────────────────────────────────────
    function applyAll() {
        // Dark mode
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = state.dark === 'dark' || (state.dark === null && prefersDark);
        body.classList.toggle('dark-theme', isDark);

        // Font size
        body.classList.toggle('a11y-large-text', state.fontSize);

        // High contrast
        body.classList.toggle('a11y-high-contrast', state.contrast);

        // Update button active states
        updateButtonStates();
    }

    function updateButtonStates() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = state.dark === 'dark' || (state.dark === null && prefersDark);

        setActive('toggle-dark',       isDark);
        setActive('toggle-font-size',  state.fontSize);
        setActive('toggle-contrast',   state.contrast);
        setActive('toggle-read-aloud', state.speaking);
    }

    function setActive(id, active) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', active);
    }

    // ── Toggle panel open/close ──────────────────────────────────────────────
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = menu.classList.toggle('open');
        btn.setAttribute('aria-expanded', isOpen);
        menu.setAttribute('aria-hidden', !isOpen);
    });

    // Close when clicking outside
    document.addEventListener('click', function (e) {
        if (!panel.contains(e.target)) {
            menu.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
        }
    });

    // Keyboard: Escape closes
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            menu.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
            btn.focus();
        }
    });

    // ── Feature buttons ──────────────────────────────────────────────────────
    document.getElementById('toggle-dark').addEventListener('click', function () {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const currentlyDark = state.dark === 'dark' || (state.dark === null && prefersDark);
        if (currentlyDark) {
            state.dark = 'light';
            localStorage.setItem('theme', 'light');
        } else {
            state.dark = 'dark';
            localStorage.setItem('theme', 'dark');
        }
        applyAll();
    });

    document.getElementById('toggle-font-size').addEventListener('click', function () {
        state.fontSize = !state.fontSize;
        localStorage.setItem('a11y-fontSize', state.fontSize);
        applyAll();
    });

    document.getElementById('toggle-contrast').addEventListener('click', function () {
        state.contrast = !state.contrast;
        localStorage.setItem('a11y-contrast', state.contrast);
        applyAll();
    });

    // ── Feature: Read page aloud (Web Speech API) ────────────────────────────
    const readBtn = document.getElementById('toggle-read-aloud');
    if (readBtn) {
        const speechSupported = 'speechSynthesis' in window;
        if (!speechSupported) {
            readBtn.style.opacity = '0.4';
            readBtn.title = 'Text-to-speech is not supported in this browser';
            readBtn.disabled = true;
        } else {
            readBtn.addEventListener('click', function () {
                if (state.speaking) {
                    window.speechSynthesis.cancel();
                    state.speaking = false;
                    updateButtonStates();
                } else {
                    const contentEl = document.querySelector('.post-content') ||
                                      document.querySelector('article') ||
                                      document.body;
                    const rawText = (contentEl.innerText || contentEl.textContent || '').replace(/\s+/g, ' ').trim();
                    if (!rawText) return;

                    // Split into sentence-aware chunks
                    const sentences = rawText.match(/[^.!?]+[.!?]*/g) || [rawText];
                    const chunks = [];
                    let current = '';
                    for (const s of sentences) {
                        if ((current + s).length > 220 && current.length > 0) {
                            chunks.push(current.trim());
                            current = s;
                        } else {
                            current += s;
                        }
                    }
                    if (current.trim()) chunks.push(current.trim());

                    state.speaking = true;
                    updateButtonStates();

                    let idx = 0;
                    function speakNext() {
                        if (!state.speaking || idx >= chunks.length) {
                            state.speaking = false;
                            updateButtonStates();
                            return;
                        }
                        const utt = new SpeechSynthesisUtterance(chunks[idx]);
                        utt.lang = document.documentElement.lang || 'en-US';
                        utt.rate = 0.95;
                        utt.pitch = 1;
                        utt.onend = () => { idx++; speakNext(); };
                        utt.onerror = () => { state.speaking = false; updateButtonStates(); };
                        window.speechSynthesis.speak(utt);
                    }
                    speakNext();
                }
            });
        }
    }

    document.getElementById('reset-a11y').addEventListener('click', function () {
        if (state.speaking) { window.speechSynthesis.cancel(); state.speaking = false; }
        state.dark     = null;
        state.fontSize = false;
        state.contrast = false;
        localStorage.removeItem('theme');
        localStorage.removeItem('a11y-fontSize');
        localStorage.removeItem('a11y-contrast');
        applyAll();
    });

    // ── System theme change listener ─────────────────────────────────────────
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            if (state.dark === null) {
                // Only auto-follow if user hasn't manually overridden
                applyAll();
            }
        });
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    loadPrefs();
    applyAll();

})();
