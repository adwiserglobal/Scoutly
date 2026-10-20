import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { acceptTeamInvite, clearInviteToken, previewTeamInvite, readInviteToken } from '../../services/teamApi';

type Preview = { workspaceName: string; ownerName: string; inviteEmail: string; emailMatches: boolean };

/** Shown after login when the user arrived through a /convite/<token> link. */
export default function InviteAcceptModal() {
  const [token] = useState(() => readInviteToken());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!token) return;
    previewTeamInvite(token).then(setPreview).catch((e: any) => setError(e?.message || 'Convite inválido ou expirado.'));
  }, [token]);

  if (!token || closed) return null;

  const dismiss = () => { clearInviteToken(); setClosed(true); };
  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      await acceptTeamInvite(token);
      clearInviteToken();
      setDone(true);
      setTimeout(() => window.location.assign('/workspace'), 900);
    } catch (e: any) {
      setError(e?.message || 'Não foi possível entrar na equipe.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/[0.10] bg-[#111418] p-6 text-center shadow-2xl">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF5A12]/10 text-[#FF5A12]"><Users className="h-6 w-6" /></span>
        {!preview && !error ? (
          <Loader2 className="mx-auto mt-5 h-5 w-5 animate-spin text-stone-500" />
        ) : preview ? (
          <>
            <h2 className="mt-4 text-lg font-semibold text-white">Entrar na equipe de {preview.ownerName}?</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-stone-400">
              Você terá acesso ao plano Agency do workspace <b className="text-stone-200">{preview.workspaceName}</b>. Suas mensagens de IA e favoritos continuam só seus.
            </p>
            {!preview.emailMatches && (
              <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">Este convite é para {preview.inviteEmail}. Entre com essa conta para aceitar.</p>
            )}
          </>
        ) : null}
        {error && <p className="mt-3 text-[12px] text-rose-300">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={dismiss} className="flex-1 rounded-xl border border-white/[0.10] py-2.5 text-[12px] text-stone-300 hover:bg-white/[0.05]">{done ? 'Fechar' : preview ? 'Agora não' : 'Fechar'}</button>
          {preview && !done && (
            <button type="button" disabled={busy || !preview.emailMatches} onClick={() => void accept()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF5A12] py-2.5 text-[12px] font-semibold text-white disabled:opacity-40">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Aceitar convite
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
