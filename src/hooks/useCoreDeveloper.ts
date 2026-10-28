import { useEffect, useState } from 'react';
import { CreditAccessStatus, fetchAccessStatus } from '../services/api';

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;

function load() {
  if (cached !== null) return Promise.resolve(cached);
  pending ||= fetchAccessStatus()
    .then((access) => (cached = Boolean(access.isCoreDeveloper)))
    .catch(() => false)
    .finally(() => { pending = null; });
  return pending;
}

/** True only for the Scoutly core developers; the server decides (never inferred from the email on the client). */
export function useCoreDeveloper() {
  const [value, setValue] = useState(Boolean(cached));
  useEffect(() => {
    let alive = true;
    void load().then((next) => { if (alive) setValue(next); });
    const onAccess = (event: Event) => {
      const detail = (event as CustomEvent<CreditAccessStatus>).detail;
      if (detail?.plan) {
        cached = Boolean(detail.isCoreDeveloper);
        setValue(cached);
      }
    };
    window.addEventListener('scoutly-access-updated', onAccess);
    return () => {
      alive = false;
      window.removeEventListener('scoutly-access-updated', onAccess);
    };
  }, []);
  return value;
}
