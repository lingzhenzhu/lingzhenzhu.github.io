/**
 * Accessibility panel for lingzhenzhu.github.io
 * Features: dark mode (system-aware), larger text, high contrast, reduce motion
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
        reduceMotion: false,
    };

    // ── Load persisted preferences ───────────────────────────────────────────
    function loadPrefs() {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark' || stored === 'light') {
            state.dark = stored;
        }
        // null means follow system (already handled in inline script)

        state.fontSize    = localStorage.getItem('a11y-fontSize')    === 'true';
        state.contrast    = localStorage.getItem('a11y-contrast')    === 'true';
        state.reduceMotion = localStorage.getItem('a11y-reduceMotion') === 'true';
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

        // Reduce motion
        body.classList.toggle('a11y-reduce-motion', state.reduceMotion);

        // Update button active states
        updateButtonStates();
    }

    function updateButtonStates() {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = state.dark === 'dark' || (state.dark === null && prefersDark);

        setActive('toggle-dark',         isDark);
        setActive('toggle-font-size',    state.fontSize);
        setActive('toggle-contrast',     state.contrast);
        setActive('toggle-reduce-motion', state.reduceMotion);
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

    document.getElementById('toggle-reduce-motion').addEventListener('click', function () {
        state.reduceMotion = !state.reduceMotion;
        localStorage.setItem('a11y-reduceMotion', state.reduceMotion);
        applyAll();
    });

    document.getElementById('reset-a11y').addEventListener('click', function () {
        state.dark = null;
        state.fontSize = false;
        state.contrast = false;
        state.reduceMotion = false;
        localStorage.removeItem('theme');
        localStorage.removeItem('a11y-fontSize');
        localStorage.removeItem('a11y-contrast');
        localStorage.removeItem('a11y-reduceMotion');
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
