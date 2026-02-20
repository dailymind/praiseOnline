/**
 * Theme Manager - Handles theme switching and persistence
 */
class ThemeManager {
  constructor() {
    this.themes = ['light', 'dark', 'win11', 'mac', 'ios', 'code-dark'];
    this.storageKey = 'praise-player-theme';
    this.currentTheme = this.getSavedTheme() || 'light';
    this.init();
  }

  /**
   * Get saved theme from localStorage
   */
  getSavedTheme() {
    return localStorage.getItem(this.storageKey);
  }

  /**
   * Initialize theme manager
   */
  init() {
    this.applyTheme(this.currentTheme);
    this.setupEventListeners();
  }

  /**
   * Apply theme to document
   */
  applyTheme(theme) {
    if (!this.themes.includes(theme)) {
      console.warn(`Theme "${theme}" not found. Using default theme.`);
      theme = 'light';
    }

    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    localStorage.setItem(this.storageKey, theme);

    // Update active state in menu
    this.updateMenuActiveState(theme);

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  /**
   * Update active state in theme menu
   */
  updateMenuActiveState(theme) {
    document.querySelectorAll('.theme-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  /**
   * Cycle to next theme (for simple toggle buttons)
   */
  cycleTheme() {
    const simpleThemes = ['light', 'dark', 'code-dark'];
    const currentIndex = simpleThemes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % simpleThemes.length;
    this.applyTheme(simpleThemes[nextIndex]);
  }

  /**
   * Setup event listeners for theme switching
   */
  setupEventListeners() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeMenu = document.getElementById('themeMenu');

    // Setup main theme toggle with menu (if exists)
    if (themeToggleBtn && themeMenu) {
      // Toggle menu visibility
      themeToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        themeMenu.classList.toggle('open');
        themeMenu.setAttribute('aria-hidden', !themeMenu.classList.contains('open'));
        themeToggleBtn.setAttribute('aria-expanded', themeMenu.classList.contains('open'));
      });

      // Theme selection
      document.querySelectorAll('.theme-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const selectedTheme = btn.dataset.theme;
          this.applyTheme(selectedTheme);

          // Close menu after selection
          themeMenu.classList.remove('open');
          themeMenu.setAttribute('aria-hidden', 'true');
          themeToggleBtn.setAttribute('aria-expanded', 'false');
        });
      });

      // Close menu on outside click
      document.addEventListener('click', (e) => {
        if (themeMenu.classList.contains('open') &&
            !themeMenu.contains(e.target) &&
            !themeToggleBtn.contains(e.target)) {
          themeMenu.classList.remove('open');
          themeMenu.setAttribute('aria-hidden', 'true');
          themeToggleBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Close menu on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && themeMenu.classList.contains('open')) {
          themeMenu.classList.remove('open');
          themeMenu.setAttribute('aria-hidden', 'true');
          themeToggleBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Setup all theme toggle buttons (simple cycle mode)
    document.querySelectorAll('.theme-toggle-header').forEach(btn => {
      // Skip the main toggle button if it has a menu
      if (btn.id === 'themeToggleBtn' && themeMenu) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cycleTheme();
      });
    });
  }

  /**
   * Get current active theme
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Get all available themes
   */
  getAvailableThemes() {
    return [...this.themes];
  }
}

// Initialize theme manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
  });
} else {
  window.themeManager = new ThemeManager();
}