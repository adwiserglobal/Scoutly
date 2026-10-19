import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { downloadDiagnosticPdf, type DiagnosticPdfOptions } from '../utils/diagnosticPdf';

/** Shared state/handler for the "Diagnóstico em PDF" button (business modal and side panel). */
export function useDiagnosticPdf() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(
    async (input: Omit<DiagnosticPdfOptions, 'preparedBy'>) => {
      setIsGenerating(true);
      setError(null);
      try {
        await downloadDiagnosticPdf({ ...input, preparedBy: user?.displayName || null });
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
