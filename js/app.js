import { initRouter } from './router.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initRouter();
  });
} else {
  initRouter();
}
