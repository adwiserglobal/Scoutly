import { useCallback, useEffect, useState } from 'react';
import { fetchUserProfile, saveCommercialProfile } from '../services/api';
import type { BrandProfile, OutreachProfile, UserProfile } from '../lib/userProfile';

/** Loads the commercial profile / branding once and exposes a save helper. */
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUserProfile({ force: true })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((error: any) => {
        if (!cancelled) setLoadError(error?.message || 'Não foi possível carregar o perfil.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (input: { outreach?: OutreachProfile; brand?: BrandProfile; logo?: string | null }) => {
      const next = await saveCommercialProfile(input);
      setProfile(next);
      return next;
    },
    []
  );

  return { profile, isLoading, loadError, save };
}
