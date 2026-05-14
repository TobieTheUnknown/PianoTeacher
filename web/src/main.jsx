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
} catch (_) { /* localStorage may be unavailable on first paint */ }

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
} catch (err) {
  // localStorage may not be available yet on some Android WebViews
}

// Dynamic import sans top-level await (compatible es2020)
const appImport = isMobilePlatform
  ? import('./AppMobile.jsx')
  : import('./AppDesktop.jsx');

appImport.then(({ default: AppComponent }) => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <AppComponent />
      </ErrorBoundary>
    </StrictMode>
  );
});
