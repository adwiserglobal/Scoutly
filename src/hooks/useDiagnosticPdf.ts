import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { downloadDiagnosticPdf, type DiagnosticBrand, type DiagnosticPdfOptions } from '../utils/diagnosticPdf';
import { fetchUserProfile } from '../services/api';

/** Shared state/handler for the "Diagnóstico em PDF" button (business modal and side panel). */
export function useDiagnosticPdf() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(
    async (input: Omit<DiagnosticPdfOptions, 'preparedBy' | 'brand'>) => {
      setIsGenerating(true);
      setError(null);
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
        setError('Não foi possível gerar o PDF. Tente novamente.');
      } finally {
        setIsGenerating(false);
      }
    },
    [user?.displayName]
  );

  const clearError = useCallback(() => setError(null), []);

  return { download, isGenerating, error, clearError };
}
