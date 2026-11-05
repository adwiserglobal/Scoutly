import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowLeft, Inbox, Loader2, MailOpen, Paperclip, PenSquare, RefreshCw, Search, Send, Trash2, Undo2 } from 'lucide-react';
import {
  fetchMailAttachmentUrl,
  fetchMailThread,
  fetchMailThreads,
  fetchMailboxes,
  markMailUnread,
  moveMailThread,
  sendMail,
} from './api';
import type { MailMessage, MailThread, MailView as View, Mailbox } from './types';

const VIEWS: Array<{ id: View; label: string; icon: any }> = [
  { id: 'inbox', label: 'Entrada', icon: Inbox },
  { id: 'sent', label: 'Enviados', icon: Send },
  { id: 'archive', label: 'Arquivados', icon: Archive },
  { id: 'trash', label: 'Lixeira', icon: Trash2 },
];

const POLL_MS = 30_000;

function shortDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('pt-BR', sameYear ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** E-mail HTML is untrusted: no scripts (sandbox), and remote images stay blocked until the reader allows them. */
function HtmlBody({ html }: { html: string }) {
  const [images, setImages] = useState(false);
  const [height, setHeight] = useState(120);
  // Plain e-mails (no styling of their own) follow the dark theme; designed ones keep their own colors on white.
  const designed = /bgcolor|background|<table/i.test(html);
  const ref = useRef<HTMLIFrameElement>(null);
  const srcDoc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${images ? 'https: http:' : ''}; style-src 'unsafe-inline'; font-src data:">
<style>body{margin:0;padding:0;font:13.5px/1.6 Arial,Helvetica,sans-serif;color:${designed ? '#14161a' : '#d3d7dd'};background:${designed ? '#fff' : 'transparent'};word-wrap:break-word}a{color:${designed ? '#1a56db' : '#ff8a55'}}img{max-width:100%;height:auto}blockquote{margin:0 0 0 6px;padding-left:10px;border-left:2px solid ${designed ? '#d4d7dd' : '#3a414b'};color:${designed ? '#5b6270' : '#9aa1ab'}}</style></head><body>${html}</body></html>`,
    [html, images, designed],
  );
  const hasRemoteImages = /<img[^>]+src=["']?https?:/i.test(html);
  const measure = () => {
    const doc = ref.current?.contentDocument;
    if (doc?.body) setHeight(Math.min(Math.max(doc.body.scrollHeight + 8, 80), 4000));
  };
  return (
    <div>
      {hasRemoteImages && !images && (
        <button className="ghost-button mail-images-btn" onClick={() => setImages(true)}>Carregar imagens deste e-mail</button>
      )}
      <iframe ref={ref} title="Mensagem" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin" srcDoc={srcDoc} onLoad={measure} style={{ height }} className={`mail-frame ${designed ? 'designed' : ''}`} />
    </div>
  );
}

function Attachment({ messageId, file }: { messageId: string; file: MailMessage['attachments'][number] }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      window.open(await fetchMailAttachmentUrl(messageId, file.id), '_blank', 'noopener');
    } catch (error: any) {
      window.alert(error?.message || 'Não foi possível abrir o anexo.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className="mail-attachment" onClick={open} disabled={busy}>
      {busy ? <Loader2 size={12} className="spin" /> : <Paperclip size={12} />}
      <span>{file.filename}</span>
      <small>{formatSize(file.size)}</small>
    </button>
  );
}

interface Draft {
  to: string;
  cc: string;
  subject: string;
  body: string;
  threadId?: string;
}

export default function MailView({ canSend, onUnread }: { canSend: boolean; onUnread: (total: number) => void }) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailbox, setMailbox] = useState('');
  const [view, setView] = useState<View>('inbox');
  const [query, setQuery] = useState('');
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ thread: MailThread; messages: MailMessage[] } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  const loadBoxes = useCallback(async () => {
    const boxes = await fetchMailboxes();
    setMailboxes(boxes);
    onUnread(boxes.reduce((sum, box) => sum + box.unread, 0));
    setMailbox((current) => current || boxes[0]?.address || '');
    return boxes;
  }, [onUnread]);

  const loadThreads = useCallback(async (silent = false) => {
    if (!mailbox) return;
    if (!silent) setLoading(true);
    try {
      setThreads(await fetchMailThreads(mailbox, view, query));
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os e-mails.');
    } finally {
      setLoading(false);
    }
  }, [mailbox, view, query]);

  const openThread = useCallback(async (id: string, silent = false) => {
    if (!silent) { setSelectedId(id); setDraft(null); }
    try {
      setDetail(await fetchMailThread(id));
      if (!silent) {
        setThreads((rows) => rows.map((row) => (row.id === id ? { ...row, unread_count: 0 } : row)));
        void loadBoxes();
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível abrir a conversa.');
    }
  }, [loadBoxes]);

  useEffect(() => {
    loadBoxes().catch((err: any) => { setError(err?.message || 'Não foi possível carregar as caixas.'); setLoading(false); });
  }, [loadBoxes]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadThreads(), query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadThreads, query]);

  // New mail shows up without a manual refresh.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void loadBoxes().catch(() => undefined);
      void loadThreads(true);
      if (selectedRef.current) void openThread(selectedRef.current, true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadBoxes, loadThreads, openThread]);

  const switchMailbox = (address: string) => { setMailbox(address); setSelectedId(null); setDetail(null); setDraft(null); };
  const switchView = (next: View) => { setView(next); setSelectedId(null); setDetail(null); setDraft(null); };

  const move = async (folder: 'inbox' | 'archive' | 'trash') => {
    if (!selectedId) return;
    await moveMailThread(selectedId, folder);
    setSelectedId(null); setDetail(null);
    await Promise.all([loadThreads(true), loadBoxes()]);
  };

  const startReply = () => {
    if (!detail) return;
    const last = [...detail.messages].reverse().find((m) => m.direction === 'in') || detail.messages[detail.messages.length - 1];
    const to = last.direction === 'in' ? last.from_addr : detail.thread.counterpart;
    const subject = /^re:/i.test(detail.thread.subject) ? detail.thread.subject : `Re: ${detail.thread.subject}`;
    const quoted = last.text_body.split('\n').map((line) => `> ${line}`).join('\n');
    const when = new Date(last.created_at).toLocaleString('pt-BR');
    setDraft({ to, cc: '', subject, threadId: detail.thread.id, body: `\n\n\nEm ${when}, ${last.from_name || last.from_addr} escreveu:\n${quoted.slice(0, 4000)}` });
  };

  const submit = async () => {
    if (!draft || !mailbox) return;
    setSending(true);
    setError('');
    try {
      const result = await sendMail({ mailbox, threadId: draft.threadId, to: draft.to, cc: draft.cc, subject: draft.subject, body: draft.body });
      setDraft(null);
      await loadThreads(true);
      await openThread(result.threadId);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar.');
    } finally {
      setSending(false);
    }
  };

  const current = mailboxes.find((box) => box.address === mailbox);

  if (!loading && mailboxes.length === 0) {
    return (
      <>
        <div className="page-heading"><div><span className="eyebrow">COMUNICAÇÃO</span><h1>E-mail</h1></div></div>
        <div className={error ? 'error-box' : 'panel mail-empty'}>{error || 'Nenhuma caixa de entrada disponível para o seu usuário.'}</div>
      </>
    );
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">COMUNICAÇÃO</span>
          <h1>E-mail</h1>
          <p>Caixas @scoutly.pro, com envio e recebimento pela Resend.</p>
        </div>
        <div className="mail-heading-actions">
          <button className="ghost-button" onClick={() => void loadThreads()} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar</button>
          {canSend && (
            <button className="primary-button" onClick={() => { setSelectedId(null); setDetail(null); setDraft({ to: '', cc: '', subject: '', body: '' }); }}>
              <PenSquare size={14} /> Escrever
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className={`mail-shell ${selectedId || draft ? 'reading' : ''}`}>
        <aside className="mail-side panel">
          <div className="mail-boxes">
            {mailboxes.map((box) => (
              <button key={box.address} className={box.address === mailbox ? 'active' : ''} onClick={() => switchMailbox(box.address)}>
                <span><strong>{box.displayName.split('|')[0].trim()}</strong><small>{box.address}</small></span>
                {box.unread > 0 && <em>{box.unread}</em>}
              </button>
            ))}
          </div>
          <nav className="mail-folders">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button key={id} className={view === id ? 'active' : ''} onClick={() => switchView(id)}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="mail-list panel">
          <label className="mail-search"><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nesta caixa" /></label>
          <div className="mail-threads">
            {loading && threads.length === 0 ? (
              <div className="mail-empty"><Loader2 size={16} className="spin" /></div>
            ) : threads.length === 0 ? (
              <div className="mail-empty">{query ? 'Nada encontrado.' : 'Nenhuma conversa aqui.'}</div>
            ) : threads.map((thread) => (
              <button key={thread.id} className={`mail-thread ${selectedId === thread.id ? 'active' : ''} ${thread.unread_count > 0 ? 'unread' : ''}`} onClick={() => void openThread(thread.id)}>
                <div className="mail-thread-top">
                  <strong>{thread.last_direction === 'out' && view === 'sent' ? `Para: ${thread.counterpart}` : thread.counterpart_name || thread.counterpart}</strong>
                  <time>{shortDate(thread.last_message_at)}</time>
                </div>
                <div className="mail-thread-subject">{thread.subject || '(sem assunto)'}{thread.message_count > 1 && <span> · {thread.message_count}</span>}</div>
                <div className="mail-thread-snippet">{thread.last_direction === 'out' ? 'Você: ' : ''}{thread.last_snippet}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="mail-read panel">
          {draft ? (
            <div className="mail-compose">
              <button className="ghost-button mail-back" onClick={() => setDraft(null)}><ArrowLeft size={14} /> Voltar</button>
              <div className="mail-from">De: <strong>{current?.displayName} &lt;{mailbox}&gt;</strong></div>
              <input placeholder="Para (separe vários com vírgula)" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
              <input placeholder="Cc (opcional)" value={draft.cc} onChange={(e) => setDraft({ ...draft, cc: e.target.value })} />
              <input placeholder="Assunto" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              <textarea placeholder="Escreva sua mensagem…" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={14} autoFocus />
              <div className="mail-compose-foot">
                <button className="ghost-button" onClick={() => setDraft(null)} disabled={sending}>Descartar</button>
                <button className="primary-button" onClick={submit} disabled={sending || !draft.to.trim() || !draft.subject.trim() || !draft.body.trim()}>
                  {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Enviar
                </button>
              </div>
            </div>
          ) : detail ? (
            <div className="mail-thread-view">
              <div className="mail-toolbar">
                <button className="ghost-button mail-back" onClick={() => { setSelectedId(null); setDetail(null); }}><ArrowLeft size={14} /></button>
                <h2>{detail.thread.subject || '(sem assunto)'}</h2>
                <div>
                  {canSend && <button className="ghost-button" onClick={startReply}><Undo2 size={14} /> Responder</button>}
                  <button className="icon-button" title="Marcar como não lida" onClick={async () => { await markMailUnread(detail.thread.id); setSelectedId(null); setDetail(null); await Promise.all([loadThreads(true), loadBoxes()]); }}><MailOpen size={15} /></button>
                  {detail.thread.folder !== 'archive' && <button className="icon-button" title="Arquivar" onClick={() => void move('archive')}><Archive size={15} /></button>}
                  {detail.thread.folder === 'trash'
                    ? <button className="icon-button" title="Mover para a entrada" onClick={() => void move('inbox')}><Inbox size={15} /></button>
                    : <button className="icon-button" title="Excluir" onClick={() => void move('trash')}><Trash2 size={15} /></button>}
                </div>
              </div>
              <div className="mail-messages">
                {detail.messages.map((message) => (
                  <article key={message.id} className={`mail-message ${message.direction}`}>
                    <header>
                      <div>
                        <strong>{message.direction === 'out' ? (message.from_name || message.from_addr) : (message.from_name || message.from_addr)}</strong>
                        <small>{message.direction === 'out' ? `para ${message.to_addrs.join(', ')}` : `${message.from_addr} → ${message.to_addrs.join(', ')}`}{message.cc_addrs.length ? ` · cc ${message.cc_addrs.join(', ')}` : ''}</small>
                      </div>
                      <time>{new Date(message.created_at).toLocaleString('pt-BR')}</time>
                    </header>
                    {message.html_body && message.direction === 'in'
                      ? <HtmlBody html={message.html_body} />
                      : <pre className="mail-text">{message.text_body}</pre>}
                    {message.attachments.length > 0 && (
                      <div className="mail-attachments">{message.attachments.map((file) => <Attachment key={file.id} messageId={message.id} file={file} />)}</div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="mail-empty big"><Inbox size={26} /><span>Selecione uma conversa</span></div>
          )}
        </section>
      </div>
    </>
  );
}
