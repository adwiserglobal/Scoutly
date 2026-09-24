import { appDataRequest, dbValue } from './appDataService.js';
import type { FirebaseIdentity } from './firebaseTokenService.js';

const CATEGORIES = new Set(['BILLING', 'SEARCH', 'ACCOUNT', 'AI', 'PIPELINE', 'DATA', 'BUG', 'OTHER']);
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 1_600_000;

function throwHttp(message: string, statusCode: number): never {
  throw Object.assign(new Error(message), { statusCode });
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_ATTACHMENTS).map((item: any, index) => {
    const fileName = String(item?.name || `captura-${index + 1}.png`).trim().slice(0, 140);
    const mimeType = String(item?.type || '').toLowerCase();
    const dataUrl = String(item?.dataUrl || '').trim();
    const declaredSize = Math.max(0, Number(item?.size || 0));

    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      throwHttp('Envie capturas em PNG, JPG ou WebP.', 400);
    }

    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i);
    if (!match || match[1].toLowerCase() !== mimeType) {
      throwHttp('Uma das capturas de tela é inválida.', 400);
    }

    const estimatedSize = Math.floor(match[2].replace(/\s/g, '').length * 0.75);
    const fileSize = declaredSize || estimatedSize;
    if (fileSize <= 0 || fileSize > MAX_ATTACHMENT_BYTES || estimatedSize > MAX_ATTACHMENT_BYTES + 2048) {
      throwHttp('Cada captura pode ter no máximo 1,5 MB.', 400);
    }

    return {
      file_name: fileName || `captura-${index + 1}.png`,
      mime_type: mimeType,
      file_size: fileSize,
      data_url: dataUrl,
    };
  });
}

async function getOwnedTicket(ticketId: string, userUid: string) {
  if (!/^\d+$/.test(ticketId)) throwHttp('Chamado inválido.', 400);

  const tickets = await appDataRequest<any[]>(
    `support_tickets?id=eq.${dbValue(ticketId)}&user_uid=eq.${dbValue(userUid)}&select=id,user_uid,requester_email,requester_name,subject,category,priority,tags,status,created_at,updated_at,resolved_at&limit=1`
  );
  const ticket = tickets[0];
  if (!ticket) throwHttp('Chamado não encontrado.', 404);

  const [messages, attachments] = await Promise.all([
    appDataRequest<any[]>(
      `support_messages?ticket_id=eq.${dbValue(ticketId)}&is_internal=eq.false&select=id,ticket_id,author_type,author_uid,author_name,body,is_internal,created_at&order=created_at.asc`
    ),
    appDataRequest<any[]>(
      `support_attachments?ticket_id=eq.${dbValue(ticketId)}&select=id,ticket_id,file_name,mime_type,file_size,data_url,created_at&order=created_at.asc`
    ),
  ]);

  return { ticket, messages, attachments };
}

export async function handleCustomerSupportAction(
  action: string,
  payload: any,
  identity: FirebaseIdentity,
): Promise<{ status: number; body: any }> {
  if (action === 'support-list') {
    const tickets = await appDataRequest<any[]>(
      `support_tickets?user_uid=eq.${dbValue(identity.uid)}&select=id,user_uid,requester_email,requester_name,subject,category,priority,tags,status,created_at,updated_at,resolved_at&order=updated_at.desc&limit=100`
    );
    return { status: 200, body: { tickets } };
  }

  if (action === 'support-detail') {
    return {
      status: 200,
      body: await getOwnedTicket(String(payload?.ticketId || ''), identity.uid),
    };
  }

  if (action === 'support-create') {
    const subject = String(payload?.subject || '').trim().slice(0, 180);
    const firstMessage = String(payload?.message || '').trim().slice(0, 12000);
    const supportType = String(payload?.supportType || '').trim().toUpperCase();
    const isHackedAsset = supportType === 'HACKED_ASSET';
    const requestedCategory = isHackedAsset
      ? 'ACCOUNT'
      : String(payload?.category || 'OTHER').toUpperCase();
    const category = CATEGORIES.has(requestedCategory) ? requestedCategory : 'OTHER';
    const priority = isHackedAsset ? 'URGENT' : 'NORMAL';
    const tags = isHackedAsset
      ? ['Hacked Asset {Urgent}']
      : supportType === 'PRODUCT_FEEDBACK'
        ? ['Product Feedback']
        : [];
    const attachments = normalizeAttachments(payload?.attachments);

    if (subject.length < 3) throwHttp('Informe um assunto para o chamado.', 400);
    if (firstMessage.length < 2) throwHttp('Conte como podemos ajudar.', 400);

    const created = await appDataRequest<any[]>('support_tickets?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_uid: identity.uid,
        requester_email: identity.email,
        requester_name: identity.displayName,
        subject,
        category,
        priority,
        tags,
        status: 'OPEN',
        created_by: identity.uid,
      }),
    });

    const ticket = created[0];
    if (!ticket?.id) throwHttp('Não foi possível criar o chamado.', 502);

    await appDataRequest('support_messages', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        ticket_id: ticket.id,
        author_type: 'customer',
        author_uid: identity.uid,
        author_name: identity.displayName || identity.email || 'Cliente',
        body: firstMessage,
        is_internal: false,
      }),
    });

    if (attachments.length > 0) {
      await appDataRequest('support_attachments', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(
          attachments.map((attachment) => ({
            ...attachment,
            ticket_id: ticket.id,
            uploaded_by_uid: identity.uid,
          }))
        ),
      });
    }

    return { status: 201, body: await getOwnedTicket(String(ticket.id), identity.uid) };
  }

  if (action === 'support-reply') {
    const ticketId = String(payload?.ticketId || '').trim();
    const body = String(payload?.body || '').trim().slice(0, 12000);
    if (!body) throwHttp('Digite uma mensagem.', 400);

    const detail = await getOwnedTicket(ticketId, identity.uid);

    await appDataRequest('support_messages', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        ticket_id: Number(ticketId),
        author_type: 'customer',
        author_uid: identity.uid,
        author_name: identity.displayName || identity.email || 'Cliente',
        body,
        is_internal: false,
      }),
    });

    const nextStatus = ['RESOLVED', 'CLOSED'].includes(String(detail.ticket.status)) ? 'OPEN' : 'WAITING_INTERNAL';
    await appDataRequest(`support_tickets?id=eq.${dbValue(ticketId)}&user_uid=eq.${dbValue(identity.uid)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: nextStatus, resolved_at: null }),
    });

    return { status: 201, body: await getOwnedTicket(ticketId, identity.uid) };
  }

  throwHttp('Ação de suporte inválida.', 400);
}
