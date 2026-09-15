import { useState, useEffect } from 'react';
import { PageSpeedData } from '../types';
import { fetchPageSpeed } from '../services/api';

const memoryCache = new Map<string, PageSpeedData>();
const pendingPromises = new Map<string, Promise<PageSpeedData>>();

export function usePageSpeed(websiteUrl?: string | null) {
  const [data, setData] = useState<PageSpeedData | null>(() => {
    if (!websiteUrl) return null;
    return memoryCache.get(websiteUrl) || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!websiteUrl) return false;
    return !memoryCache.has(websiteUrl);
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!websiteUrl) {
      setData(null);
      setIsLoading(false);
      return;
    }

    // If already in memory
    if (memoryCache.has(websiteUrl)) {
      setData(memoryCache.get(websiteUrl)!);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    // Reuse in-flight promise if multiple cards request the same website
    let fetchPromise = pendingPromises.get(websiteUrl);
    if (!fetchPromise) {
      fetchPromise = fetchPageSpeed(websiteUrl)
        .then((result) => {
          memoryCache.set(websiteUrl, result);
          pendingPromises.delete(websiteUrl);
          return result;
        })
        .catch((err) => {
          pendingPromises.delete(websiteUrl);
          throw err;
        });
      pendingPromises.set(websiteUrl, fetchPromise);
    }

    fetchPromise
      .then((result) => {
        if (isMounted) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Erro ao obter PageSpeed');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [websiteUrl]);

  return { data, isLoading, error };
}
