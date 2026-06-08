import { useEffect, useState } from 'react';

// Returns true only once `active` has stayed true for `delayMs`. Used to gate
// loading indicators so they appear only when a load is slow enough to perceive
// — fast responses resolve before the timer fires, so no spinner "flash".
// Resets to false immediately when `active` clears.
export function useDelayedFlag(active: boolean, delayMs = 250): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const id = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(id);
  }, [active, delayMs]);

  return shown;
}
