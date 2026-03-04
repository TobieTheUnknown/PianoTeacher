import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import ThemeEngine from './services/ThemeEngine.js'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
