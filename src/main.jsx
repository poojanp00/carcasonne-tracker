import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Play from './play/Play.jsx';
import BoardPopout from './components/BoardPopout.jsx';

document.addEventListener('touchstart', (e) => {
  if (e.target.closest('button, [role="button"]')) {
    navigator.vibrate?.(8);
  }
}, { passive: true });

const isPlay  = window.location.pathname.startsWith('/play');
const isBoard = new URLSearchParams(window.location.search).get('view') === 'board';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPlay ? <Play /> : isBoard ? <BoardPopout /> : <App />}
  </StrictMode>
);
