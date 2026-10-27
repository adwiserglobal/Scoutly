import { useEffect, useRef, useState } from 'react';
import { fetchBusinessJobs } from '../services/api';
import type { Business, BusinessJobs } from '../types';

/**
 * Hiring signals for the business open in the side panel.
 * The company's own site and public job boards are checked as soon as the panel opens (free);
 * the Jooble aggregator is only asked once the user expands the jobs section (it has a daily quota).
 */
export function useBusinessJobs(business: Business, expanded: boolean) {
  const [data, setData] = useState<BusinessJobs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aggregatorRequested = useRef<string | null>(null);

  const input = { name: business.name, website: business.website, location: business.municipio || undefined };

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    aggregatorRequested.current = null;
    setLoading(true);
    fetchBusinessJobs(input, { signal: controller.signal })
      .then((result) => setData(result))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err?.message || 'Não foi possível buscar as vagas.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [business.id]);

  useEffect(() => {
    if (!expanded || !data?.aggregatorAvailable || aggregatorRequested.current === business.id) return;
    aggregatorRequested.current = business.id;
    const controller = new AbortController();
    setLoading(true);
    fetchBusinessJobs(input, { aggregator: true, signal: controller.signal })
      .then((result) => setData(result))
      .catch(() => { /* the site result stays visible */ })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [expanded, data?.aggregatorAvailable, business.id]);

  return { data, loading, error };
}
