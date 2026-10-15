import { useEffect, useState } from 'react';

/** Current time, re-rendered every `intervalMs`. Drives marker dead-reckoning frames. */
export function useClock(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
