import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/tokens.css'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

const isMobilePlatform = import.meta.env.VITE_PLATFORM === 'mobile';

// Apply design preset attributes (theme / accent / hands) from localStorage.
// Defaults: dark, blue, classic. tokens.css resolves the actual CSS vars
// from these attributes — no JS theme service needed.
try {
  const theme = localStorage.getItem('piano-teacher-design-theme') || 'dark';
  const accent = localStorage.getItem('piano-teacher-design-accent') || 'blue';
  const hands = localStorage.getItem('piano-teacher-design-hands') || 'classic';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-accent', accent);
  document.documentElement.setAttribute('data-hands', hands);
} catch { /* localStorage may be unavailable on first paint */ }

// Initialiser les préférences de typographie
try {
  const savedFontSize = localStorage.getItem('piano-teacher-font-size');
  const savedFontFamily = localStorage.getItem('piano-teacher-font-family');
  if (savedFontSize) {
    document.documentElement.style.fontSize = `${savedFontSize}px`;
  }
  if (savedFontFamily) {
    document.documentElement.style.setProperty('--font-family', savedFontFamily);
  }
} catch { /* localStorage not available yet on some Android WebViews */ }

// Dynamic import sans top-level await (compatible es2020)
const appImport = isMobilePlatform
  ? import('./AppMobile.jsx')
  : import('./AppDesktop.jsx');

// First visit with an empty library → preload the bundled demo songs so the
// hosted web version isn't a blank page. One-shot (flag), resolves before the
// app renders; the pre-React splash covers the wait.
const demosReady = import('./services/DemoSongs')
  .then((m) => m.preloadDemoSongsIfEmpty())
  .catch(() => false);

// Fade out and remove the pre-React splash once the app has mounted.
// Runs after first paint of the React tree so there is no white flash.
function removeSplash() {
  const splash = document.getElementById('__splash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  const cleanup = () => splash.remove();
  splash.addEventListener('transitionend', cleanup, { once: true });
  // Fallback in case transitionend never fires (e.g. reduced-motion).
  setTimeout(cleanup, 600);
}

Promise.all([appImport, demosReady]).then(([module]) => {
  const App = module.default;
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
  // Defer to the next frame so the first React paint has landed.
  requestAnimationFrame(() => requestAnimationFrame(removeSplash));
});
