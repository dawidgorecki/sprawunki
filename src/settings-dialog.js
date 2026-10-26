// The "Ustawienia" dialog (spec 12): the theme switch. Like ui.js it only shows
// what it is given and reports the user's choice through a handler.

// onChangeTheme(theme) runs with 'light', 'dark' or 'auto' as soon as the user
// picks an option; the dialog stays open (spec 12.2).
export function createSettingsDialog(onChangeTheme) {
  const dialog = document.getElementById('settings-dialog');
  const themeOptions = dialog.querySelector('.segmented');

  document.getElementById('open-settings').addEventListener('click', () => dialog.showModal());
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());

  // 'change' fires for clicks, taps and the arrow keys alike.
  themeOptions.addEventListener('change', (event) => onChangeTheme(event.target.value));

  return {
    // Marks the current theme, e.g. the saved one at start.
    showTheme(theme) {
      themeOptions.querySelector(`input[value="${theme}"]`).checked = true;
    },
  };
}
