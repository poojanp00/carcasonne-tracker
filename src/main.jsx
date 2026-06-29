import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ProjectorView from './components/ProjectorView.jsx';

document.addEventListener('touchstart', (e) => {
  if (e.target.closest('button, [role="button"]')) {
    navigator.vibrate?.(8);
  }
}, { passive: true });

const isProjector = new URLSearchParams(window.location.search).has('projector');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isProjector ? <ProjectorView /> : <App />}
  </StrictMode>
);
