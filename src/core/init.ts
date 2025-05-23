import {
  backButton,
  viewport,
  themeParams,
  miniApp,
  initData,
  $debug,
  init as initSDK,
} from '@telegram-apps/sdk-react';

/**
 * Initializes the application and configures its dependencies.
 */
export function init(debug: boolean): void {
  // Set @telegram-apps/sdk-react debug mode.
  $debug.set(debug);

  // Initialize special event handlers for Telegram Desktop, Android, iOS, etc.
  // Also, configure the package.
  initSDK();

  // Mount all components used in the project.
  backButton.isSupported() && backButton.mount();
  miniApp.mount();
  themeParams.mount();
  initData.restore();
  
  // Проверяем, не были ли уже привязаны переменные
  const cssVarsAlreadyBound = document.documentElement.classList.contains('tg-viewport-stable');
  
  if (!cssVarsAlreadyBound) {
    void viewport.mount().then(() => {
      viewport.bindCssVars();
    }).catch(e => {
      console.error('Something went wrong mounting the viewport', e);
    });
  
    // Define components-related CSS variables.
    miniApp.bindCssVars();
    themeParams.bindCssVars();
  } else {
    console.log('CSS variables are already bound, skipping');
  }

  // Add Eruda if needed.
  debug && import('eruda')
    .then((lib) => lib.default.init())
    .catch(console.error);
}