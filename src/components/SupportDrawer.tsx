import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Headphones,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  X,
} from 'lucide-react';
import {
  createSupportTicket,
  fetchSupportTicket,
  fetchSupportTickets,
  replySupportTicket,
  type SupportTicket,
  type SupportTicketDetail,
} from '../services/supportApi';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em atendimento',
  WAITING_CUSTOMER: 'Aguardando você',
  WAITING_INTERNAL: 'Aguardando suporte',
  RESOLVED: 'Resolvido',
  CLOSED: 'Encerrado',
};

const CATEGORY_OPTIONS = [
  ['OTHER', 'Dúvida geral'],
  ['ACCOUNT', 'Conta e acesso'],
  ['BILLING', 'Planos e cobrança'],
  ['SEARCH', 'Busca e dados'],
  ['AI', 'Scoutly AI'],
  ['PIPELINE', 'Pipeline'],
  ['BUG', 'Problema técnico'],
];

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportDrawer({ isOpen, onClose }: Props) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [firstMessage, setFirstMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeTicketId = detail?.ticket.id || null;
  const activeTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === activeTicketId) || detail?.ticket || null,
    [tickets, activeTicketId, detail?.ticket]
  );

  const loadTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await fetchSupportTickets();
      setTickets(next);
    } catch (err: any) {
      if (!silent) setError(err?.message || 'Não foi possível carregar seus chamados.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openTicket = async (ticketId: number, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await fetchSupportTicket(ticketId);
      setDetail(next);
      setError('');
    } catch (err: any) {
      if (!silent) setError(err?.message || 'Não foi possível abrir o chamado.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void loadTickets();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(() => {
      void loadTickets(true);
      if (activeTicketId) void openTicket(activeTicketId, true);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [isOpen, activeTicketId]);

  useEffect(() => {
    if (!isOpen || !detail) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, detail?.messages.length]);

  const submitNewTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !firstMessage.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const next = await createSupportTicket({
        subject: subject.trim(),
        category,
        message: firstMessage.trim(),
      });
      setDetail(next);
      setCreating(false);
      setSubject('');
      setFirstMessage('');
      setCategory('OTHER');
      await loadTickets(true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível abrir o chamado.');
    } finally {
      setSending(false);
    }
  };

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !reply.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const next = await replySupportTicket(detail.ticket.id, reply.trim());
      setDetail(next);
      setReply('');
      await loadTickets(true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[130] transition ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Fechar suporte"
        onClick={onClose}
        className={`absolute inset-0 bg-black/55 backdrop-blur-[3px] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      />

      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-[470px] flex-col border-l border-white/[0.09] bg-[#0b0e12]/[0.99] text-white shadow-[-28px_0_90px_rgba(0,0,0,.45)] backdrop-blur-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-3">
            {detail && (
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-stone-300 transition hover:bg-white/[0.07]"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.09] text-[#FF6A26]">
              <Headphones className="h-[18px] w-[18px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Ajuda e suporte</h2>
                <span className="flex items-center gap-1 text-[9px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ao vivo
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-stone-500">
                {detail ? `Chamado #${detail.ticket.id}` : 'Converse com a equipe Scoutly'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-500 transition hover:bg-white/[0.05] hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {error && (
          <div className="mx-5 mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-[11px] leading-relaxed text-rose-300">
            {error}
          </div>
        )}

        {!detail ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <h3 className="text-xs font-semibold text-stone-200">Seus chamados</h3>
                <p className="mt-1 text-[10px] text-stone-600">As respostas aparecem automaticamente.</p>
              </div>
              <button
                type="button"
                onClick={() => setCreating((value) => !value)}
                className="flex h-9 items-center gap-2 rounded-xl bg-[#FF5A12] px-3 text-[10px] font-semibold text-white transition hover:bg-[#ff6a26]"
              >
                <Plus className="h-3.5 w-3.5" /> Novo chamado
              </button>
            </div>

            {creating && (
              <form onSubmit={submitNewTicket} className="mx-5 mb-4 space-y-3 rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-4">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#090c10] px-3 text-[11px] text-stone-300 outline-none focus:border-[#FF5A12]/40"
                >
                  {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={180}
                  placeholder="Assunto"
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#090c10] px-3 text-[11px] text-white outline-none placeholder:text-stone-700 focus:border-[#FF5A12]/40"
                />
                <textarea
                  value={firstMessage}
                  onChange={(event) => setFirstMessage(event.target.value)}
                  maxLength={12000}
                  placeholder="Descreva como podemos ajudar..."
                  className="min-h-[110px] w-full resize-none rounded-xl border border-white/[0.08] bg-[#090c10] p-3 text-[11px] leading-relaxed text-white outline-none placeholder:text-stone-700 focus:border-[#FF5A12]/40"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setCreating(false)} className="h-9 rounded-xl px-3 text-[10px] font-semibold text-stone-500 hover:text-white">Cancelar</button>
                  <button
                    type="submit"
                    disabled={!subject.trim() || !firstMessage.trim() || sending}
                    className="flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-[10px] font-semibold text-black disabled:opacity-40"
                  >
                    {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Abrir chamado
                  </button>
                </div>
              </form>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              {loading && tickets.length === 0 ? (
                <div className="flex h-40 items-center justify-center gap-2 text-[11px] text-stone-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando chamados...
                </div>
              ) : tickets.length === 0 ? (
                <div className="mt-4 flex min-h-[250px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/[0.08] bg-white/[0.018] px-8 text-center">
                  <MessageCircle className="mb-4 h-7 w-7 text-stone-700" />
                  <h3 className="text-xs font-semibold text-stone-300">Nenhum chamado aberto</h3>
                  <p className="mt-2 max-w-[280px] text-[10px] leading-relaxed text-stone-600">Quando precisar de ajuda, abra um chamado e converse diretamente com a equipe Scoutly.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => void openTicket(ticket.id)}
                      className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition hover:border-white/[0.13] hover:bg-white/[0.04]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-[9px] font-medium text-stone-600">#{ticket.id}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${ticket.status === 'WAITING_CUSTOMER' ? 'bg-amber-500/10 text-amber-300' : ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#FF5A12]/10 text-[#FF8A52]'}`}>
                              {STATUS_LABEL[ticket.status] || ticket.status}
                            </span>
                          </div>
                          <h4 className="truncate text-[11px] font-semibold text-stone-200">{ticket.subject}</h4>
                        </div>
                        <span className="shrink-0 text-[9px] text-stone-700">{formatDate(ticket.updated_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">{activeTicket?.subject}</h3>
                  <p className="mt-1 text-[9px] text-stone-600">Atualização automática a cada poucos segundos</p>
                </div>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[8px] font-semibold text-stone-400">
                  {STATUS_LABEL[activeTicket?.status || ''] || activeTicket?.status}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-3">
                {detail.messages.map((message) => {
                  const fromCustomer = message.author_type === 'customer';
                  return (
                    <div key={message.id} className={`flex ${fromCustomer ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[84%] rounded-[18px] px-3.5 py-3 ${fromCustomer ? 'rounded-br-md bg-[#FF5A12] text-white' : 'rounded-bl-md border border-white/[0.08] bg-white/[0.045] text-stone-200'}`}>
                        {!fromCustomer && <div className="mb-1.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#FF8A52]">Suporte Scoutly</div>}
                        <p className="whitespace-pre-wrap text-[11px] leading-relaxed">{message.body}</p>
                        <div className={`mt-1.5 text-right text-[8px] ${fromCustomer ? 'text-white/55' : 'text-stone-600'}`}>{formatDate(message.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                {detail.messages.length === 0 && (
                  <div className="flex h-40 items-center justify-center text-[10px] text-stone-600">Nenhuma mensagem neste chamado.</div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <form onSubmit={submitReply} className="border-t border-white/[0.08] bg-[#0d1014] p-4">
              {['RESOLVED', 'CLOSED'].includes(detail.ticket.status) && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] px-3 py-2 text-[9px] text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Se você responder, o chamado será reaberto.
                </div>
              )}
              <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-[#090c10] p-2 focus-within:border-[#FF5A12]/35">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Digite sua mensagem..."
                  rows={2}
                  className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2 text-[11px] leading-relaxed text-white outline-none placeholder:text-stone-700"
                />
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5A12] text-white transition hover:bg-[#ff6a26] disabled:opacity-35"
                  aria-label="Enviar mensagem"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </form>
          </div>
        )}
      </aside>
    </div>
  );
}
