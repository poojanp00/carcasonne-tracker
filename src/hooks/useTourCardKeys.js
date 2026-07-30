import { useEffect } from 'react';

// Arrow-key / Enter navigation for a multi-step tour card — ArrowRight or
// Enter advances (same as clicking Next/Create/Got it), ArrowLeft goes back
// (same as clicking Back, when it's shown; harmless no-op at the first step
// otherwise, same as every onBack handler this is wired to already treats
// a call there). Mirrors the app's other arrow-key step navigation (see
// PreGameSetup.jsx's Players/Expansions/Begin shortcut) — now that a stray
// click on the card body no longer advances it (see HowToGuide.jsx), this
// keeps keyboard users at parity with a mouse click on the real button.
// Skipped while focus is in a text field or on a button (which already
// handles its own Enter/Space activation natively — without this exclusion,
// Enter on a focused Next button would double-fire: once from the button's
// own click, once from this listener).
export function useTourCardKeys(onNext, onBack) {
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || e.target.isContentEditable) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') onNext?.();
      else if (e.key === 'ArrowLeft') onBack?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onNext, onBack]);
}
