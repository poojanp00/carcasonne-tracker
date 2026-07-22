import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import BoardPopout from './components/BoardPopout.jsx';

document.addEventListener('touchstart', (e) => {
  if (e.target.closest('button, [role="button"]')) {
    navigator.vibrate?.(8);
  }
}, { passive: true });

const isBoard = new URLSearchParams(window.location.search).get('view') === 'board';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isBoard ? <BoardPopout /> : <App />}
  </StrictMode>
);
