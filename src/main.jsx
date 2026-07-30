import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import BoardPopout from './components/BoardPopout.jsx';
import RankUpPreview from './RankUpPreview.jsx';

document.addEventListener('touchstart', (e) => {
  if (e.target.closest('button, [role="button"]')) {
    navigator.vibrate?.(8);
  }
}, { passive: true });

const view = new URLSearchParams(window.location.search).get('view');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {view === 'board' ? <BoardPopout /> : view === 'rankup-preview' ? <RankUpPreview /> : <App />}
  </StrictMode>
);
