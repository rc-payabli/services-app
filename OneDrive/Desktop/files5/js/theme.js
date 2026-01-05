/* =============================================================================
   DASHIO - Theme & Color Switcher
   ============================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initColorSwitcher();
  initSidebarToggle();
});

/* =============================================================================
   Theme Toggle (Dark/Light Mode)
   ============================================================================= */

function initThemeToggle() {
  const themeToggle = document.querySelector('[data-toggle="theme"]');
  if (!themeToggle) return;

  // Check for saved theme preference or system preference
  const savedTheme = localStorage.getItem('dashio-theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

  setTheme(initialTheme);
  updateThemeIcon(initialTheme);

  // Toggle theme on click
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    setTheme(newTheme);
    updateThemeIcon(newTheme);
    localStorage.setItem('dashio-theme', newTheme);
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('dashio-theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      setTheme(newTheme);
      updateThemeIcon(newTheme);
    }
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme);
}

function updateThemeIcon(theme) {
  const themeToggle = document.querySelector('[data-toggle="theme"] i');
  if (!themeToggle) return;

  themeToggle.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
}

/* =============================================================================
   Color Switcher (Runtime Primary Color Changer)
   ============================================================================= */

function initColorSwitcher() {
  const colorSwitcher = document.getElementById('colorSwitcher');
  if (!colorSwitcher) return;

  // Apply saved color on load
  const savedColor = localStorage.getItem('dashio-primary-color');
  if (savedColor) {
    setPrimaryColor(savedColor);
  }

  // Handle color swatch clicks
  colorSwitcher.addEventListener('click', (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;

    const color = swatch.dataset.color;
    setPrimaryColor(color);
    updateActiveColorSwatch(colorSwitcher, color);
    localStorage.setItem('dashio-primary-color', color);
  });

  // Update active swatch on load
  if (savedColor) {
    updateActiveColorSwatch(colorSwitcher, savedColor);
  }
}

function setPrimaryColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;

  const root = document.documentElement;

  // Set primary color
  root.style.setProperty('--primary', hex);
  root.style.setProperty('--bs-primary', hex);
  root.style.setProperty('--bs-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

  // Update all elements with primary color binding
  updatePrimaryColorElements(hex);
}

function updatePrimaryColorElements(hex) {
  // This ensures all dynamically generated elements use the new primary color
  // Bootstrap CSS variables handle most of this automatically
  // This is here for any custom implementations

  // Reinitialize charts if they exist
  if (typeof window.DashboardManager !== 'undefined' && 
      typeof window.DashboardManager.updateCharts === 'function') {
    setTimeout(() => {
      window.DashboardManager.updateCharts();
    }, 100);
  }
}

function updateActiveColorSwatch(container, activeColor) {
  container.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.classList.toggle('active', swatch.dataset.color === activeColor);
  });
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/* =============================================================================
   Sidebar Toggle (Mobile)
   ============================================================================= */

function initSidebarToggle() {
  const sidebarToggle = document.querySelector('[data-toggle="sidebar"]');
  const sidebarDismiss = document.querySelector('[data-dismiss="sidebar"]');
  const sidebar = document.querySelector('.sidebar');

  if (!sidebar || !sidebarToggle) return;

  // Create backdrop if it doesn't exist
  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  // Show sidebar
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.add('show');
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
  });

  // Hide sidebar
  const closeSidebar = () => {
    sidebar.classList.remove('show');
    backdrop.classList.remove('show');
    document.body.style.overflow = '';
  };

  sidebarDismiss?.addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('show')) {
      closeSidebar();
    }
  });

  // Close on window resize (if going to large screen)
  window.addEventListener('resize', () => {
    if (window.innerWidth > 991.98 && sidebar.classList.contains('show')) {
      closeSidebar();
    }
  });
}

/* =============================================================================
   Utility: Get CSS Variable
   ============================================================================= */

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* =============================================================================
   Export to window
   ============================================================================= */

window.Dashio = {
  setTheme,
  setPrimaryColor,
  getCssVar,
  initThemeToggle,
  initColorSwitcher,
  initSidebarToggle
};
