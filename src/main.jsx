import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import ThemeEngine from './services/ThemeEngine.js'

const isMobilePlatform = import.meta.env.VITE_PLATFORM === 'mobile';

// Initialiser le Theme Engine (deferred to avoid Android WebView crash)
try {
  ThemeEngine.init();
} catch (err) {
  console.warn('ThemeEngine init deferred:', err.message);
}

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
