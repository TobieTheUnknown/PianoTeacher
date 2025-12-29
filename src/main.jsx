import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ThemeEngine from './services/ThemeEngine.js'

// Initialiser le Theme Engine
ThemeEngine.init();

// Initialiser les préférences de typographie
const savedFontSize = localStorage.getItem('piano-teacher-font-size');
const savedFontFamily = localStorage.getItem('piano-teacher-font-family');

if (savedFontSize) {
  document.documentElement.style.fontSize = `${savedFontSize}px`;
}

if (savedFontFamily) {
  document.documentElement.style.setProperty('--font-family', savedFontFamily);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
