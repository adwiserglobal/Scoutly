import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { appDataRequest, dbValue } from './appDataService.js';
import type { InternalStaff } from './internalService.js';

const MAIL_DOMAIN = 'scoutly.pro';
const THREAD_PAGE = 50;

function throwHttp(message: string, statusCode: number, code?: string): never {
  throw Object.assign(new Error(message), { statusCode, ...(code ? { code } : {}) });
}

function migrationError(error: any) {
  if (/internal_mailboxes|mail_threads|mail_messages|PGRST205|42P01/i.test(String(error?.message || ''))) {
    return Object.assign(new Error('O e-mail interno ainda não foi ativado neste ambiente (falta aplicar a migration 024).'), { statusCode: 503, code: 'MAIL_MIGRATION_PENDING' });
  }
  return error;
}

async function db<T>(path: string, init?: Parameters<typeof appDataRequest>[1]): Promise<T> {
  try {
    return await appDataRequest<T>(path, init);
  } catch (error) {
    throw migrationError(error);
  }
}

// ---------- helpers ----------

const EMAIL_RE = /^[^\s@<>,;]{1,64}@[^\s@<>,;]{1,190}\.[^\s@<>,;]{2,}$/;

/** "Name <a@b.com>" or "a@b.com" -> { name, address } */
export function parseAddress(raw: unknown): { name: string; address: string } {
  const text = String(raw ?? '').trim();
  const match = text.match(/^(.*?)<([^<>]+)>\s*$/);
  const address = (match ? match[2] : text).trim().toLowerCase();
  const name = match ? match[1].trim().replace(/^"|"$/g, '') : '';
  return { name, address };
}

function addressList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value ? String(value).split(/[,;]/) : [];
  return Array.from(new Set(list.map((item) => parseAddress(item).address).filter(Boolean)));
}

export function normalizeSubject(subject: string) {
  let value = String(subject || '').trim();
  for (let i = 0; i < 6; i += 1) {
    const next = value.replace(/^\s*(re|res|enc|fw|fwd|rv|aw)\s*:\s*/i, '');
    if (next === value) break;
    value = next;
  }
  return value.trim().toLowerCase().slice(0, 240);
}

function htmlToText(html: string) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

const snippetOf = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 140);
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function resendKey() {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  if (!key) throwHttp('RESEND_API_KEY não configurada.', 503);
  return key;
}

function headerValue(headers: any, name: string): string {
  if (!headers) return '';
  if (Array.isArray(headers)) {
    const found = headers.find((h: any) => String(h?.name || '').toLowerCase() === name);
    return String(found?.value || '');
  }
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? String(headers[key] ?? '') : '';
}

// ---------- mailboxes & access ----------

interface MailboxRow { address: string; display_name: string; member_emails: string[] }

async function allMailboxes(): Promise<MailboxRow[]> {
  return db<MailboxRow[]>('internal_mailboxes?select=address,display_name,member_emails&order=created_at.asc');
}

function canOpen(staff: InternalStaff, mailbox: MailboxRow) {
  const members = mailbox.member_emails.map((m) => m.toLowerCase());
  // Personal mailbox: only its owners, admins included. A mailbox nobody owns yet stays visible to admins
  // so no incoming mail is ever locked away.
  if (members.length) return members.includes(String(staff.email || '').toLowerCase());
  return staff.role === 'admin';
}

async function requireMailbox(staff: InternalStaff, address: unknown): Promise<MailboxRow> {
  const wanted = String(address || '').trim().toLowerCase();
  const mailbox = (await allMailboxes()).find((m) => m.address === wanted);
  if (!mailbox || !canOpen(staff, mailbox)) throwHttp('Caixa de entrada não encontrada.', 404);
  return mailbox;
}

async function requireThread(staff: InternalStaff, threadId: unknown) {
  const id = String(threadId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throwHttp('Conversa inválida.', 400);
  const rows = await db<any[]>(`mail_threads?id=eq.${dbValue(id)}&select=*&limit=1`);
  if (!rows[0]) throwHttp('Conversa não encontrada.', 404);
  await requireMailbox(staff, rows[0].mailbox);
  return rows[0];
}

// ---------- inbound (Resend webhook) ----------

/** Svix-style signature used by Resend webhooks. */
export function verifyResendWebhook(rawBody: string, headers: { id: string; timestamp: string; signature: string }, secret: string) {
  if (!headers.id || !headers.timestamp || !headers.signature || !secret) return false;
  const age = Math.abs(Date.now() / 1000 - Number(headers.timestamp));
  if (!Number.isFinite(age) || age > 5 * 60) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${rawBody}`, 'utf8').digest('base64');
  const expectedBuf = Buffer.from(expected);
  return headers.signature.split(' ').some((part) => {
    const candidate = Buffer.from(part.split(',')[1] || '');
    return candidate.length === expectedBuf.length && timingSafeEqual(candidate, expectedBuf);
  });
}

async function fetchReceivedEmail(emailId: string) {
  const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${resendKey()}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Resend receiving HTTP ${response.status}`);
  return response.json() as Promise<any>;
}

async function findThread(mailbox: string, counterpart: string, subject: string, inReplyTo: string, refs: string) {
  const ids = Array.from(new Set([inReplyTo, ...refs.split(/\s+/)].map((v) => v.trim()).filter(Boolean)));
  if (ids.length) {
    const list = ids.map((id) => `"${id.replace(/"/g, '')}"`).join(',');
    const hit = await db<Array<{ thread_id: string }>>(
      `mail_messages?mailbox=eq.${dbValue(mailbox)}&message_id=in.(${encodeURIComponent(list)})&select=thread_id&limit=1`,
    ).catch(() => []);
    if (hit[0]) return hit[0].thread_id;
  }
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const rows = await db<Array<{ id: string }>>(
    `mail_threads?mailbox=eq.${dbValue(mailbox)}&counterpart=eq.${dbValue(counterpart)}&norm_subject=eq.${dbValue(normalizeSubject(subject))}&last_message_at=gte.${dbValue(since)}&select=id&order=last_message_at.desc&limit=1`,
  );
  return rows[0]?.id || null;
}

async function appendMessage(input: {
  mailbox: string; counterpart: string; counterpartName: string; direction: 'in' | 'out';
  subject: string; text: string; message: Record<string, unknown>; inReplyTo: string; refs: string; threadId?: string | null;
}) {
  const threadId = input.threadId || await findThread(input.mailbox, input.counterpart, input.subject, input.inReplyTo, input.refs);
  const now = new Date().toISOString();
  let id = threadId;
  if (!id) {
    const created = await db<Array<{ id: string }>>('mail_threads?select=id', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        mailbox: input.mailbox, counterpart: input.counterpart, counterpart_name: input.counterpartName || null,
        subject: input.subject.slice(0, 300), norm_subject: normalizeSubject(input.subject),
        folder: 'inbox', last_message_at: now,
      }),
    });
    id = created[0].id;
  }
  await db('mail_messages', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...input.message, thread_id: id, mailbox: input.mailbox, direction: input.direction }),
  });
  const current = (await db<any[]>(`mail_threads?id=eq.${dbValue(id!)}&select=unread_count,message_count,has_outbound,folder&limit=1`))[0] || {};
  await db(`mail_threads?id=eq.${dbValue(id!)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      message_count: (current.message_count || 0) + 1,
      unread_count: input.direction === 'in' ? (current.unread_count || 0) + 1 : current.unread_count || 0,
      has_outbound: Boolean(current.has_outbound) || input.direction === 'out',
      last_snippet: snippetOf(input.text),
      last_direction: input.direction,
      last_message_at: now,
      // A new incoming message brings an archived/trashed conversation back to the inbox.
      ...(input.direction === 'in' && current.folder && current.folder !== 'inbox' ? { folder: 'inbox' } : {}),
    }),
  });
  return id!;
}

/** Handles the `email.received` webhook payload. Throws on transient failures so Resend retries. */
export async function ingestReceivedEmail(event: any) {
  const data = event?.data || {};
  const emailId = String(data.email_id || data.id || '').trim();
  if (!emailId) throwHttp('email_id ausente.', 400);

  const full = await fetchReceivedEmail(emailId);
  const from = parseAddress(full.from || data.from);
  if (!from.address) throwHttp('Remetente ausente.', 400);

  const toList = addressList(full.to || data.to);
  const ccList = addressList(full.cc || data.cc);
  const boxes = await allMailboxes();
  const known = new Set(boxes.map((b) => b.address));
  let targets = Array.from(new Set([...toList, ...ccList, ...addressList(data.bcc)].filter((a) => known.has(a))));
  // Nothing matched (e.g. a catch-all address): keep the e-mail instead of losing it, in the first mailbox.
  if (!targets.length && boxes[0]) targets = [boxes[0].address];

  const subject = String(full.subject || data.subject || '(sem assunto)').slice(0, 300);
  const html = typeof full.html === 'string' && full.html ? full.html : null;
  const text = (typeof full.text === 'string' && full.text ? full.text : html ? htmlToText(html) : '').slice(0, 200_000);
  const headers = full.headers || data.headers;
  const messageId = String(full.message_id || data.message_id || headerValue(headers, 'message-id') || '').trim();
  const inReplyTo = headerValue(headers, 'in-reply-to').trim();
  const refs = headerValue(headers, 'references').trim();
  const attachments = (Array.isArray(full.attachments) ? full.attachments : Array.isArray(data.attachments) ? data.attachments : [])
    .map((a: any) => ({ id: String(a.id || ''), filename: String(a.filename || 'arquivo').slice(0, 200), contentType: String(a.content_type || a.contentType || ''), size: Number(a.size || 0) || null }));

  for (const mailbox of targets) {
    const duplicate = await db<any[]>(`mail_messages?mailbox=eq.${dbValue(mailbox)}&resend_email_id=eq.${dbValue(emailId)}&direction=eq.in&select=id&limit=1`);
    if (duplicate[0]) continue;
    await appendMessage({
      mailbox, counterpart: from.address, counterpartName: from.name, direction: 'in', subject, text, inReplyTo, refs,
      message: {
        message_id: messageId || null, in_reply_to: inReplyTo || null, refs: refs || null,
        from_addr: from.address, from_name: from.name || null, to_addrs: toList, cc_addrs: ccList,
        subject, text_body: text, html_body: html, attachments, resend_email_id: emailId,
      },
    });
  }
  return { stored: targets.length };
}

// ---------- internal actions ----------

function senderFor(mailbox: MailboxRow) {
  return `${mailbox.display_name.replace(/[<>"]/g, '')} <${mailbox.address}>`;
}

async function sendMail(staff: InternalStaff, payload: any) {
  if (staff.role === 'viewer') throwHttp('Seu perfil interno não permite enviar e-mails.', 403);
  const mailbox = await requireMailbox(staff, payload?.mailbox);
  const to = addressList(payload?.to);
  const cc = addressList(payload?.cc);
  if (!to.length) throwHttp('Informe pelo menos um destinatário.', 400);
  const invalid = [...to, ...cc].find((address) => !EMAIL_RE.test(address));
  if (invalid) throwHttp(`Endereço inválido: ${invalid}`, 400);
  if (to.length + cc.length > 20) throwHttp('Destinatários demais (máximo 20).', 400);
  const subject = String(payload?.subject || '').trim().slice(0, 300);
  if (!subject) throwHttp('Assunto obrigatório.', 400);
  const text = String(payload?.body || '').trim().slice(0, 100_000);
  if (!text) throwHttp('Escreva a mensagem.', 400);

  let thread: any = null;
  let inReplyTo = '';
  let refs = '';
  if (payload?.threadId) {
    thread = await requireThread(staff, payload.threadId);
    if (thread.mailbox !== mailbox.address) throwHttp('Conversa de outra caixa.', 400);
    const last = (await db<any[]>(`mail_messages?thread_id=eq.${dbValue(thread.id)}&message_id=not.is.null&select=message_id,refs&order=created_at.desc&limit=1`))[0];
    if (last?.message_id) {
      inReplyTo = last.message_id;
      refs = [last.refs, last.message_id].filter(Boolean).join(' ').split(/\s+/).slice(-20).join(' ');
    }
  }

  const messageId = `<${randomUUID()}@${MAIL_DOMAIN}>`;
  const headers: Record<string, string> = { 'Message-ID': messageId };
  if (inReplyTo) { headers['In-Reply-To'] = inReplyTo; headers['References'] = refs; }
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#14161a;white-space:pre-wrap">${escapeHtml(text)}</div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: senderFor(mailbox), to, ...(cc.length ? { cc } : {}), subject, text, html, headers }),
    signal: AbortSignal.timeout(20000),
  });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok) throwHttp(result?.message || `A Resend recusou o envio (HTTP ${response.status}).`, 502);

  const threadId = await appendMessage({
    mailbox: mailbox.address, counterpart: to[0], counterpartName: '', direction: 'out', subject, text, inReplyTo, refs,
    threadId: thread?.id || null,
    message: {
      message_id: messageId, in_reply_to: inReplyTo || null, refs: refs || null,
      from_addr: mailbox.address, from_name: mailbox.display_name, to_addrs: to, cc_addrs: cc,
      subject, text_body: text, html_body: html, resend_email_id: String(result?.id || '') || null,
      sent_by: staff.email,
    },
  });
  return { success: true, threadId };
}

export async function handleMailAction(action: string, payload: any, staff: InternalStaff): Promise<{ status: number; body: any } | null> {
  if (action === 'internal-mail-boxes') {
    const boxes = (await allMailboxes()).filter((box) => canOpen(staff, box));
    const unread = await db<Array<{ mailbox: string; unread_count: number }>>(
      `mail_threads?folder=eq.inbox&unread_count=gt.0&select=mailbox,unread_count&limit=2000`,
    );
    return {
      status: 200,
      body: {
        mailboxes: boxes.map((box) => ({
          address: box.address,
          displayName: box.display_name,
          unread: unread.filter((row) => row.mailbox === box.address).length,
        })),
      },
    };
  }

  if (action === 'internal-mail-threads') {
    const mailbox = await requireMailbox(staff, payload?.mailbox);
    const view = String(payload?.view || 'inbox');
    const q = String(payload?.q || '').trim().replace(/[%*(),]/g, ' ').slice(0, 80);
    let filter = `mailbox=eq.${dbValue(mailbox.address)}`;
    if (view === 'sent') filter += '&has_outbound=eq.true&folder=neq.trash';
    else filter += `&folder=eq.${['inbox', 'archive', 'trash'].includes(view) ? view : 'inbox'}`;
    if (q) filter += `&or=(subject.ilike.*${q}*,counterpart.ilike.*${q}*,counterpart_name.ilike.*${q}*,last_snippet.ilike.*${q}*)`;
    const threads = await db<any[]>(`mail_threads?${filter}&select=*&order=last_message_at.desc&limit=${THREAD_PAGE}`);
    return { status: 200, body: { threads } };
  }

  if (action === 'internal-mail-thread') {
    const thread = await requireThread(staff, payload?.threadId);
    const messages = await db<any[]>(`mail_messages?thread_id=eq.${dbValue(thread.id)}&select=*&order=created_at.asc`);
    if (thread.unread_count > 0) {
      await db(`mail_threads?id=eq.${dbValue(thread.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ unread_count: 0 }) });
      thread.unread_count = 0;
    }
    return { status: 200, body: { thread, messages } };
  }

  if (action === 'internal-mail-mark-unread') {
    const thread = await requireThread(staff, payload?.threadId);
    await db(`mail_threads?id=eq.${dbValue(thread.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ unread_count: Math.max(1, thread.unread_count || 0) }) });
    return { status: 200, body: { success: true } };
  }

  if (action === 'internal-mail-move') {
    const folder = String(payload?.folder || '');
    if (!['inbox', 'archive', 'trash'].includes(folder)) throwHttp('Pasta inválida.', 400);
    const thread = await requireThread(staff, payload?.threadId);
    await db(`mail_threads?id=eq.${dbValue(thread.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ folder }) });
    return { status: 200, body: { success: true } };
  }

  if (action === 'internal-mail-send') {
    return { status: 201, body: await sendMail(staff, payload) };
  }

  if (action === 'internal-mail-attachment') {
    const message = (await db<any[]>(`mail_messages?id=eq.${dbValue(String(payload?.messageId || ''))}&select=mailbox,resend_email_id,attachments,direction&limit=1`))[0];
    if (!message) throwHttp('Mensagem não encontrada.', 404);
    await requireMailbox(staff, message.mailbox);
    const attachmentId = String(payload?.attachmentId || '');
    if (message.direction !== 'in' || !message.resend_email_id || !attachmentId) throwHttp('Anexo indisponível.', 404);
    const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(message.resend_email_id)}/attachments/${encodeURIComponent(attachmentId)}`, {
      headers: { Authorization: `Bearer ${resendKey()}` },
      signal: AbortSignal.timeout(15000),
    });
    const data: any = await response.json().catch(() => ({}));
    const url = data?.download_url || data?.url;
    if (!response.ok || !url) throwHttp('Não foi possível obter o anexo.', 502);
    return { status: 200, body: { url } };
  }

  return null;
}
