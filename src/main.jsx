import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ProjectorView from './components/ProjectorView.jsx';
import Play from './play/Play.jsx';

document.addEventListener('touchstart', (e) => {
  if (e.target.closest('button, [role="button"]')) {
    navigator.vibrate?.(8);
  }
}, { passive: true });

const isProjector = new URLSearchParams(window.location.search).has('projector');
const isPlay = window.location.pathname.startsWith('/play');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPlay ? <Play /> : isProjector ? <ProjectorView /> : <App />}
  </StrictMode>
);
