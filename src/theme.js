// Applies the theme chosen in the settings (spec 12.2) to the page.
// The script in index.html does the same for the page colors before the first
// frame; this module also updates the browser UI color and is used for changes.

// Matching --color-bg in styles.css and the theme-color tags in index.html.
const THEME_COLORS = { light: '#f4f6f9', dark: '#111318' };

// theme: 'light', 'dark' or 'auto' (as returned by loadTheme in storage.js).
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
  updateThemeColor(theme);
}

// index.html has two theme-color tags, one per system theme (their media
// attribute). With "Automatyczny" each keeps its own color, so the browser
// follows the system by itself. A forced theme gives both tags its color,
// so whichever one the browser uses shows the chosen theme.
function updateThemeColor(theme) {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const systemTheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLORS[theme === 'auto' ? systemTheme : theme];
  }
}
