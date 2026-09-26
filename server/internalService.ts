import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { appDataRequest, dbValue } from './appDataService.js';
import type { FirebaseIdentity } from './firebaseTokenService.js';

type StaffRole = 'admin' | 'support' | 'viewer';

export type InternalStaff = {
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  role: StaffRole;
  is_active: boolean;
};

const STATUSES = new Set(['OPEN','IN_PROGRESS','WAITING_CUSTOMER','WAITING_INTERNAL','RESOLVED','CLOSED']);
const PRIORITIES = new Set(['LOW','NORMAL','HIGH','URGENT']);
const CATEGORIES = new Set(['BILLING','SEARCH','ACCOUNT','AI','PIPELINE','DATA','BUG','OTHER']);

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function header(req: { headers?: any }, name: string) {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function clientFingerprint(req: { headers?: any }) {
  const forwarded = header(req, 'x-forwarded-for').split(',')[0].trim();
  const realIp = header(req, 'x-real-ip').trim();
  const userAgent = header(req, 'user-agent').slice(0, 500);
  return sha256(`${forwarded || realIp || 'unknown'}|${userAgent}`);
}

function throwHttp(message: string, statusCode: number): never {
  throw Object.assign(new Error(message), { statusCode });
}

async function writeAudit(entry: {
  actorUid?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await appDataRequest('internal_audit_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        actor_uid: entry.actorUid || null,
        actor_email: entry.actorEmail || null,
        action: entry.action,
        target_type: entry.targetType || null,
        target_id: entry.targetId || null,
        metadata: entry.metadata || {},
      }),
    });
  } catch (error) {
    console.warn('[Scoutly Internal] audit write failed', error);
  }
}

export async function verifyInternalGateCode(req: { headers?: any }, rawCode: string) {
  const code = String(rawCode || '').trim();
  if (!/^\d{6}$/.test(code)) throwHttp('Informe um código de 6 dígitos.', 400);

  const fingerprint = clientFingerprint(req);
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const recentFailures = await appDataRequest<any[]>(
    `internal_access_attempts?fingerprint_hash=eq.${dbValue(fingerprint)}&success=eq.false&created_at=gte.${dbValue(since)}&select=id&limit=6`
  );

  if (recentFailures.length >= 5) {
    throwHttp('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 429);
  }

  const configRows = await appDataRequest<Array<{ key: string; value: string }>>(
    'internal_security_config?key=like.gate_code_sha256*&select=key,value&limit=20'
  );
  const expectedHashes = configRows
    .map((row) => String(row?.value || '').trim().toLowerCase())
    .filter((value) => /^[a-f0-9]{64}$/.test(value));
  if (!expectedHashes.length) throwHttp('Acesso interno temporariamente indisponível.', 503);

  const actual = sha256(code);
  const actualBuffer = Buffer.from(actual, 'hex');
  const valid = expectedHashes.some((expected) => {
    const expectedBuffer = Buffer.from(expected, 'hex');
    return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
  });

  await appDataRequest('internal_access_attempts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ fingerprint_hash: fingerprint, success: valid }),
  });

  if (!valid) throwHttp('Código inválido.', 401);

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await appDataRequest('internal_gate_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      token_hash: tokenHash,
      stage: 'code_verified',
      expires_at: expiresAt,
    }),
  });

  // Best-effort cleanup keeps this table bounded without adding a cron job.
  void appDataRequest(`internal_gate_sessions?expires_at=lt.${dbValue(new Date().toISOString())}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  }).catch(() => undefined);

  return { success: true, gateToken: rawToken, expiresIn: 600 };
}

export async function requireInternalAccess(
  req: { headers?: any },
  identity: FirebaseIdentity,
): Promise<InternalStaff> {
  const email = String(identity.email || '').trim().toLowerCase();
  if (!email) throwHttp('A conta Google precisa ter um e-mail válido.', 403);

  const rawSession = header(req, 'x-scoutly-internal-session').trim();
  if (!/^[a-f0-9]{64}$/i.test(rawSession)) throwHttp('Valide o código de acesso novamente.', 401);

  const sessionHash = sha256(rawSession);
  const sessions = await appDataRequest<any[]>(
    `internal_gate_sessions?token_hash=eq.${dbValue(sessionHash)}&select=token_hash,stage,firebase_uid,email,role,expires_at&limit=1`
  );
  const session = sessions[0];
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    throwHttp('Sua sessão interna expirou. Valide o código novamente.', 401);
  }

  const allowRows = await appDataRequest<any[]>(
    `internal_access_allowlist?email=eq.${dbValue(email)}&is_active=eq.true&select=email,role,is_active&limit=1`
  );
  const allowed = allowRows[0];
  if (!allowed) {
    await writeAudit({
      actorUid: identity.uid,
      actorEmail: email,
      action: 'internal.login_denied',
      targetType: 'internal_access',
      targetId: email,
    });
    throwHttp('Esta conta não possui acesso ao Scoutly Internal.', 403);
  }

  const role: StaffRole = ['admin', 'support', 'viewer'].includes(String(allowed.role))
    ? allowed.role
    : 'viewer';

  if (session.stage === 'authorized') {
    if (session.firebase_uid !== identity.uid || String(session.email || '').toLowerCase() !== email) {
      throwHttp('Esta sessão pertence a outra conta. Valide o código novamente.', 401);
    }
  } else {
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    await appDataRequest(`internal_gate_sessions?token_hash=eq.${dbValue(sessionHash)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        stage: 'authorized',
        firebase_uid: identity.uid,
        email,
        role,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }),
    });

    await appDataRequest('internal_staff?on_conflict=firebase_uid', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        firebase_uid: identity.uid,
        email,
        display_name: identity.displayName,
        role,
        is_active: true,
        updated_at: new Date().toISOString(),
      }),
    });

    await writeAudit({
      actorUid: identity.uid,
      actorEmail: email,
      action: 'internal.login',
      targetType: 'internal_access',
      targetId: identity.uid,
    });
  }

  return {
    firebase_uid: identity.uid,
    email,
    display_name: identity.displayName,
    role,
    is_active: true,
  };
}

function requireRole(role: StaffRole, allowed: StaffRole[]) {
  if (!allowed.includes(role)) throwHttp('Seu perfil interno não permite esta ação.', 403);
}

async function getTicket(id: string) {
  const tickets = await appDataRequest<any[]>(
    `support_tickets?id=eq.${dbValue(id)}&select=*&limit=1`
  );
  if (!tickets[0]) throwHttp('Ticket não encontrado.', 404);
  const messages = await appDataRequest<any[]>(
    `support_messages?ticket_id=eq.${dbValue(id)}&select=*&order=created_at.asc`
  );
  return { ticket: tickets[0], messages };
}

async function bootstrap(staff: InternalStaff) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [tickets, recentUsers, activeUsers, paidSubscriptions, audit] = await Promise.all([
    appDataRequest<any[]>('support_tickets?select=id,user_uid,requester_email,requester_name,subject,category,priority,status,assigned_to,created_at,updated_at&order=updated_at.desc&limit=50'),
    appDataRequest<any[]>('app_users?select=firebase_uid,email,display_name,photo_url,created_at,last_seen_at&order=last_seen_at.desc.nullslast&limit=25'),
    appDataRequest<any[]>(`app_users?last_seen_at=gte.${dbValue(thirtyDaysAgo)}&select=firebase_uid&limit=1000`),
    appDataRequest<any[]>('subscriptions?plan=in.(go,pro,agency)&status=in.(active,trialing,past_due)&select=user_uid,plan,status,current_period_end&limit=1000'),
    appDataRequest<any[]>('internal_audit_logs?select=id,actor_email,action,target_type,target_id,metadata,created_at&order=created_at.desc&limit=12'),
  ]);

  const openTickets = tickets.filter((ticket) => ['OPEN', 'IN_PROGRESS', 'WAITING_INTERNAL'].includes(ticket.status));
  return {
    staff,
    stats: {
      openTickets: openTickets.length,
      urgentTickets: openTickets.filter((ticket) => ticket.priority === 'URGENT').length,
      activeUsers30d: activeUsers.length,
      paidSubscriptions: paidSubscriptions.length,
    },
    tickets,
    recentUsers,
    audit,
  };
}

async function listUsers(query: string) {
  const users = await appDataRequest<any[]>(
    'app_users?select=firebase_uid,email,display_name,photo_url,created_at,last_seen_at&order=last_seen_at.desc.nullslast&limit=300'
  );
  const subscriptions = await appDataRequest<any[]>(
    'subscriptions?select=user_uid,plan,status,current_period_end&limit=1000'
  );
  const subscriptionsByUser = new Map(subscriptions.map((item) => [item.user_uid, item]));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter((user) => [user.email, user.display_name, user.firebase_uid].some((value) => String(value || '').toLowerCase().includes(q)))
    : users;
  return filtered.slice(0, q ? 50 : 100).map((user) => ({
    ...user,
    subscription: subscriptionsByUser.get(user.firebase_uid) || null,
  }));
}

async function userDetail(uid: string) {
  if (!uid) throwHttp('Usuário inválido.', 400);
  const [users, subscriptions, usage, leads, favorites, recentEvents] = await Promise.all([
    appDataRequest<any[]>(`app_users?firebase_uid=eq.${dbValue(uid)}&select=firebase_uid,email,display_name,photo_url,created_at,last_seen_at&limit=1`),
    appDataRequest<any[]>(`subscriptions?user_uid=eq.${dbValue(uid)}&select=*&limit=1`),
    appDataRequest<any[]>(`usage_counters?user_uid=eq.${dbValue(uid)}&select=*&order=period_start.desc&limit=3`),
    appDataRequest<any[]>(`user_leads?user_uid=eq.${dbValue(uid)}&select=business_id,status,notes,updated_at&order=updated_at.desc&limit=100`),
    appDataRequest<any[]>(`favorites?user_uid=eq.${dbValue(uid)}&select=business_id,created_at&order=created_at.desc&limit=100`),
    appDataRequest<any[]>(`recommendation_events?user_uid=eq.${dbValue(uid)}&select=event_type,business_id,category,query,location,created_at&order=created_at.desc&limit=50`),
  ]);
  return {
    user: users[0] || null,
    subscription: subscriptions[0] || null,
    usage,
    leads,
    favorites,
    recentEvents,
  };
}

export async function handleInternalAction(
  action: string,
  payload: any,
  identity: FirebaseIdentity,
  staff: InternalStaff,
): Promise<{ status: number; body: any }> {
  if (action === 'internal-authorize') {
    return { status: 200, body: { success: true, staff } };
  }

  if (action === 'internal-bootstrap') {
    return { status: 200, body: await bootstrap(staff) };
  }

  if (action === 'internal-tickets-list') {
    const status = String(payload?.status || '').trim();
    const filter = STATUSES.has(status) ? `&status=eq.${status}` : '';
    const tickets = await appDataRequest<any[]>(`support_tickets?select=*&order=updated_at.desc&limit=200${filter}`);
    return { status: 200, body: { tickets } };
  }

  if (action === 'internal-ticket-detail') {
    return { status: 200, body: await getTicket(String(payload?.ticketId || '')) };
  }

  if (action === 'internal-ticket-create') {
    requireRole(staff.role, ['admin', 'support']);
    const subject = String(payload?.subject || '').trim().slice(0, 240);
    if (!subject) throwHttp('Assunto obrigatório.', 400);
    const category = CATEGORIES.has(String(payload?.category)) ? String(payload.category) : 'OTHER';
    const priority = PRIORITIES.has(String(payload?.priority)) ? String(payload.priority) : 'NORMAL';
    const created = await appDataRequest<any[]>('support_tickets?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_uid: payload?.userUid || null,
        requester_email: payload?.requesterEmail || null,
        requester_name: payload?.requesterName || null,
        subject,
        category,
        priority,
        status: 'OPEN',
        assigned_to: payload?.assignedTo || null,
        created_by: identity.uid,
      }),
    });
    const ticket = created[0];
    const initialMessage = String(payload?.message || '').trim();
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
          is_internal: Boolean(payload?.isInternal),
        }),
      });
    }
    await writeAudit({ actorUid: identity.uid, actorEmail: identity.email, action: 'ticket.create', targetType: 'support_ticket', targetId: String(ticket?.id || ''), metadata: { subject, category, priority } });
    return { status: 201, body: await getTicket(String(ticket.id)) };
  }

  if (action === 'internal-ticket-update') {
    requireRole(staff.role, ['admin', 'support']);
    const ticketId = String(payload?.ticketId || '').trim();
    if (!ticketId) throwHttp('ticketId obrigatório.', 400);
    const patch: Record<string, unknown> = {};
    if (STATUSES.has(String(payload?.status))) patch.status = String(payload.status);
    if (PRIORITIES.has(String(payload?.priority))) patch.priority = String(payload.priority);
    if (CATEGORIES.has(String(payload?.category))) patch.category = String(payload.category);
    if ('assignedTo' in (payload || {})) patch.assigned_to = payload.assignedTo || null;
    if (patch.status === 'RESOLVED' || patch.status === 'CLOSED') patch.resolved_at = new Date().toISOString();
    await appDataRequest(`support_tickets?id=eq.${dbValue(ticketId)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch),
    });
    await writeAudit({ actorUid: identity.uid, actorEmail: identity.email, action: 'ticket.update', targetType: 'support_ticket', targetId: ticketId, metadata: patch });
    return { status: 200, body: await getTicket(ticketId) };
  }

  if (action === 'internal-ticket-reply') {
    requireRole(staff.role, ['admin', 'support']);
    const ticketId = String(payload?.ticketId || '').trim();
    const body = String(payload?.body || '').trim().slice(0, 20000);
    if (!ticketId) throwHttp('ticketId obrigatório.', 400);
    if (!body) throwHttp('Mensagem obrigatória.', 400);
    const isInternal = Boolean(payload?.isInternal);
    await appDataRequest('support_messages', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ticket_id: Number(ticketId), author_type: 'staff', author_uid: identity.uid, author_name: identity.displayName || identity.email, body, is_internal: isInternal }),
    });
    if (!isInternal) {
      await appDataRequest(`support_tickets?id=eq.${dbValue(ticketId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'WAITING_CUSTOMER' }),
      });
    }
    await writeAudit({ actorUid: identity.uid, actorEmail: identity.email, action: isInternal ? 'ticket.internal_note' : 'ticket.reply', targetType: 'support_ticket', targetId: ticketId });
    return { status: 201, body: await getTicket(ticketId) };
  }

  if (action === 'internal-users-list') {
    return { status: 200, body: { users: await listUsers(String(payload?.q || '')) } };
  }

  if (action === 'internal-user-detail') {
    return { status: 200, body: await userDetail(String(payload?.uid || '')) };
  }

  if (action === 'internal-audit') {
    const audit = await appDataRequest<any[]>('internal_audit_logs?select=id,actor_uid,actor_email,action,target_type,target_id,metadata,created_at&order=created_at.desc&limit=250');
    return { status: 200, body: { audit } };
  }

  throwHttp('Ação interna inválida.', 400);
}
