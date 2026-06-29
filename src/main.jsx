import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

document.addEventListener('touchstart', (e) => {
  if (e.target.closest('button, [role="button"]')) {
    navigator.vibrate?.(8);
  }
}, { passive: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
