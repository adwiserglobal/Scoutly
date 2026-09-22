import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appDataRequest, dbValue, writeAudit } from '../server/appData.js';
import { requireInternalStaff, requireRole } from '../server/staffAuth.js';

const STATUSES = new Set(['OPEN','IN_PROGRESS','WAITING_CUSTOMER','WAITING_INTERNAL','RESOLVED','CLOSED']);
const PRIORITIES = new Set(['LOW','NORMAL','HIGH','URGENT']);
const CATEGORIES = new Set(['BILLING','SEARCH','ACCOUNT','AI','PIPELINE','DATA','BUG','OTHER']);

async function getTicket(id: string) {
  const tickets = await appDataRequest<any[]>(
    `support_tickets?id=eq.${dbValue(id)}&select=*&limit=1`
  );
  if (!tickets[0]) throw Object.assign(new Error('Ticket não encontrado.'), { statusCode: 404 });

  const messages = await appDataRequest<any[]>(
    `support_messages?ticket_id=eq.${dbValue(id)}&select=*&order=created_at.asc`
  );

  return { ticket: tickets[0], messages };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { identity, staff } = await requireInternalStaff(req as any);

    if (req.method === 'GET') {
      const id = String(req.query?.id || '').trim();
      if (id) return res.status(200).json(await getTicket(id));

      const status = String(req.query?.status || '').trim();
      const statusFilter = STATUSES.has(status) ? `&status=eq.${status}` : '';
      const tickets = await appDataRequest<any[]>(
        `support_tickets?select=*&order=updated_at.desc&limit=200${statusFilter}`
      );
      return res.status(200).json({ tickets });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    requireRole(staff.role, ['admin', 'support']);
    const action = String(req.body?.action || '');

    if (action === 'create') {
      const subject = String(req.body?.subject || '').trim().slice(0, 240);
      if (!subject) return res.status(400).json({ error: 'Assunto obrigatório.' });

      const category = CATEGORIES.has(String(req.body?.category))
        ? String(req.body.category)
        : 'OTHER';
      const priority = PRIORITIES.has(String(req.body?.priority))
        ? String(req.body.priority)
        : 'NORMAL';

      const created = await appDataRequest<any[]>('support_tickets?select=*', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          user_uid: req.body?.userUid || null,
          requester_email: req.body?.requesterEmail || null,
          requester_name: req.body?.requesterName || null,
          subject,
          category,
          priority,
          status: 'OPEN',
          assigned_to: req.body?.assignedTo || null,
          created_by: identity.uid,
        }),
      });

      const ticket = created[0];
      const initialMessage = String(req.body?.message || '').trim();
      if (ticket?.id && initialMessage) {
        await appDataRequest('support_messages', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            ticket_id: ticket.id,
            author_type: 'staff',
            author_uid: identity.uid,
            author_name: identity.displayName || identity.email,
            body: initialMessage.slice(0, 20000),
            is_internal: Boolean(req.body?.isInternal),
          }),
        });
      }

      await writeAudit({
        actorUid: identity.uid,
        actorEmail: identity.email,
        action: 'ticket.create',
        targetType: 'support_ticket',
        targetId: String(ticket?.id || ''),
        metadata: { subject, category, priority },
      });

      return res.status(201).json(await getTicket(String(ticket.id)));
    }

    const ticketId = String(req.body?.ticketId || '').trim();
    if (!ticketId) return res.status(400).json({ error: 'ticketId obrigatório.' });

    if (action === 'update') {
      const patch: Record<string, unknown> = {};
      if (STATUSES.has(String(req.body?.status))) patch.status = String(req.body.status);
      if (PRIORITIES.has(String(req.body?.priority))) patch.priority = String(req.body.priority);
      if (CATEGORIES.has(String(req.body?.category))) patch.category = String(req.body.category);
      if ('assignedTo' in (req.body || {})) patch.assigned_to = req.body.assignedTo || null;
      if (patch.status === 'RESOLVED' || patch.status === 'CLOSED') {
        patch.resolved_at = new Date().toISOString();
      }

      await appDataRequest(`support_tickets?id=eq.${dbValue(ticketId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });

      await writeAudit({
        actorUid: identity.uid,
        actorEmail: identity.email,
        action: 'ticket.update',
        targetType: 'support_ticket',
        targetId: ticketId,
        metadata: patch,
      });

      return res.status(200).json(await getTicket(ticketId));
    }

    if (action === 'reply') {
      const body = String(req.body?.body || '').trim().slice(0, 20000);
      if (!body) return res.status(400).json({ error: 'Mensagem obrigatória.' });

      const isInternal = Boolean(req.body?.isInternal);
      await appDataRequest('support_messages', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          ticket_id: Number(ticketId),
          author_type: 'staff',
          author_uid: identity.uid,
          author_name: identity.displayName || identity.email,
          body,
          is_internal: isInternal,
        }),
      });

      if (!isInternal) {
        await appDataRequest(`support_tickets?id=eq.${dbValue(ticketId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'WAITING_CUSTOMER' }),
        });
      }

      await writeAudit({
        actorUid: identity.uid,
        actorEmail: identity.email,
        action: isInternal ? 'ticket.internal_note' : 'ticket.reply',
        targetType: 'support_ticket',
        targetId: ticketId,
      });

      return res.status(201).json(await getTicket(ticketId));
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (error: any) {
    const status = Number(error?.statusCode || 500);
    console.error('[Internal tickets]', error?.message || error);
    return res.status(status).json({ error: error?.message || 'Erro ao processar ticket.' });
  }
}
