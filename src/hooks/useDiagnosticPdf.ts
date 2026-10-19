import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { downloadDiagnosticPdf, type DiagnosticBrand, type DiagnosticPdfOptions } from '../utils/diagnosticPdf';
import { fetchUserProfile } from '../services/api';

/**
 * After a new deploy, an already-open tab still points at lazy chunks that no longer exist
 * (the host answers with index.html), so the dynamic import fails. A reload fixes it.
 */
function isStaleChunkError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|MIME type/i.test(message);
}

/** Shared state/handler for the "Relatório em PDF" button (business modal and side panel). */
export function useDiagnosticPdf() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);

  const download = useCallback(
    async (input: Omit<DiagnosticPdfOptions, 'preparedBy' | 'brand'>) => {
      setIsGenerating(true);
      setError(null);
      setNeedsReload(false);
      try {
        // Branding is optional: the report still generates with Scoutly defaults if it cannot be loaded.
        let brand: DiagnosticBrand | null = null;
        try {
          const profile = await fetchUserProfile();
          brand = { ...profile.brand, logo: profile.logo };
        } catch (profileError) {
          console.warn('[Diagnostic PDF] Brand profile unavailable, using defaults:', profileError);
        }
        await downloadDiagnosticPdf({ ...input, preparedBy: user?.displayName || null, brand });
      } catch (err) {
        console.error('[Diagnostic PDF]', err);
        if (isStaleChunkError(err)) {
          setNeedsReload(true);
          setError('O Scoutly foi atualizado desde que você abriu esta página. Recarregue para gerar o PDF.');
        } else {
          const reason = String((err as any)?.message || '').slice(0, 90);
          setError(`Não foi possível gerar o PDF.${reason ? ` (${reason})` : ''} Tente novamente.`);
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [user?.displayName]
  );

  const clearError = useCallback(() => {
    setError(null);
    setNeedsReload(false);
  }, []);

  return { download, isGenerating, error, needsReload, clearError };
}
