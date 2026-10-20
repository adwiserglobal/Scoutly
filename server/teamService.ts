import { createHash, randomBytes } from 'node:crypto';
import { appDataRequest, DEFAULT_APP_URL, dbValue } from './appDataService.js';
import type { FirebaseIdentity } from './firebaseTokenService.js';
import { getSubscriptionAccess } from './subscriptionAccessService.js';
import { retrieveStripeSubscription, stripeRequestRaw } from './stripeBillingService.js';

/**
 * Agency teams.
 *  - Everyone owns a personal workspace. Joining a team adds a `member` row to the owner's workspace.
 *  - The owner decides whether the pipeline is `shared` (everyone sees/edits the same leads) or `individual`.
 *  - AI messages and favorites are always personal: the owner only sees counts, never content.
 *  - Seats: 5 included in Agency (owner counts as one) + extra seats billed by Stripe.
 */

export const INCLUDED_AGENCY_SEATS = 5;
export const EXTRA_SEAT_PRICE_BRL = 39.9;
const INVITE_TTL_DAYS = 7;
const MAX_EXTRA_SEATS = 200;

export type PipelineMode = 'individual' | 'shared';

export interface TeamContext {
  workspaceId: string;
  workspaceName: string;
  ownerUid: string;
  role: 'owner' | 'member';
  pipelineMode: PipelineMode;
  extraSeats: number;
}

function httpError(message: string, statusCode: number, code: string): never {
  throw Object.assign(new Error(message), { statusCode, code });
}

function migrationError(error: any) {
  if (/workspace_invites|pipeline_mode|extra_seats|PGRST205|42P01|42703/i.test(String(error?.message || ''))) {
    return Object.assign(new Error('Equipes ainda não foram ativadas neste ambiente (falta aplicar a migration 018).'), { statusCode: 503, code: 'TEAM_MIGRATION_PENDING' });
  }
  return error;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizeEmail = (value: unknown) => String(value ?? '').trim().toLowerCase();
const validEmail = (value: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(value) && value.length <= 254;

interface WorkspaceRow { id: string; owner_uid: string; name: string | null; pipeline_mode?: string; extra_seats?: number }

async function workspaceById(workspaceId: string): Promise<WorkspaceRow | null> {
  try {
    const rows = await appDataRequest<WorkspaceRow[]>(
      `workspaces?id=eq.${dbValue(workspaceId)}&select=id,owner_uid,name,pipeline_mode,extra_seats&limit=1`
    );
    return rows[0] || null;
  } catch (error) {
    throw migrationError(error);
  }
}

async function personalWorkspace(userUid: string): Promise<WorkspaceRow | null> {
  try {
    const rows = await appDataRequest<WorkspaceRow[]>(
      `workspaces?owner_uid=eq.${dbValue(userUid)}&select=id,owner_uid,name,pipeline_mode,extra_seats&limit=1`
    );
    return rows[0] || null;
  } catch (error) {
    throw migrationError(error);
  }
}

/** The workspace the user is currently working in: the team they belong to, or their own. */
export async function getTeamContext(userUid: string): Promise<TeamContext | null> {
  let workspace: WorkspaceRow | null = null;
  let role: 'owner' | 'member' = 'owner';
  try {
    const memberships = await appDataRequest<Array<{ workspace_id: string }>>(
      `workspace_members?user_uid=eq.${dbValue(userUid)}&role=eq.member&select=workspace_id&limit=1`
    );
    if (memberships[0]?.workspace_id) {
      workspace = await workspaceById(memberships[0].workspace_id);
      role = 'member';
    }
  } catch (error) {
    throw migrationError(error);
  }
  if (!workspace) workspace = await personalWorkspace(userUid);
  if (!workspace) return null;
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name || 'Meu workspace',
    ownerUid: workspace.owner_uid,
    role,
    pipelineMode: workspace.pipeline_mode === 'shared' ? 'shared' : 'individual',
    extraSeats: Number(workspace.extra_seats || 0),
  };
}

export interface TeamMember {
  uid: string;
  email: string;
  name: string;
  photoUrl: string | null;
  role: 'owner' | 'member';
  joinedAt: string | null;
  lastSeenAt: string | null;
}

export async function listTeamMembers(workspace: { id: string; ownerUid: string }): Promise<TeamMember[]> {
  const rows = await appDataRequest<Array<{ user_uid: string; role: string; created_at: string | null }>>(
    `workspace_members?workspace_id=eq.${dbValue(workspace.id)}&select=user_uid,role,created_at&order=created_at.asc`
  );
  const uids = [...new Set([workspace.ownerUid, ...rows.map((row) => row.user_uid)])];
  const users = uids.length
    ? await appDataRequest<Array<{ firebase_uid: string; email: string | null; display_name: string | null; photo_url: string | null; last_seen_at: string | null }>>(
        `app_users?firebase_uid=in.(${uids.map((uid) => dbValue(uid)).join(',')})&select=firebase_uid,email,display_name,photo_url,last_seen_at`
      )
    : [];
  const byUid = new Map(users.map((user) => [user.firebase_uid, user]));
  const memberRows = new Map(rows.map((row) => [row.user_uid, row]));
  // The owner always appears first, even if the owner row is missing for any reason.
  const ordered = [workspace.ownerUid, ...rows.map((row) => row.user_uid).filter((uid) => uid !== workspace.ownerUid)];
  return ordered.map((uid) => {
    const user = byUid.get(uid);
    const email = user?.email || '';
    return {
      uid,
      email,
      name: user?.display_name || email.split('@')[0] || 'Usuário',
      photoUrl: user?.photo_url || null,
      role: uid === workspace.ownerUid ? 'owner' : 'member',
      joinedAt: memberRows.get(uid)?.created_at || null,
      lastSeenAt: user?.last_seen_at || null,
    };
  });
}

export interface TeamInvite { id: string; email: string; createdAt: string; expiresAt: string }

async function listPendingInvites(workspaceId: string): Promise<TeamInvite[]> {
  try {
    const rows = await appDataRequest<Array<{ id: string; email: string; created_at: string; expires_at: string }>>(
      `workspace_invites?workspace_id=eq.${dbValue(workspaceId)}&status=eq.pending&expires_at=gt.${dbValue(new Date().toISOString())}&select=id,email,created_at,expires_at&order=created_at.desc`
    );
    return rows.map((row) => ({ id: row.id, email: row.email, createdAt: row.created_at, expiresAt: row.expires_at }));
  } catch (error) {
    throw migrationError(error);
  }
}

export interface SeatSummary {
  included: number;
  extra: number;
  capacity: number;
  members: number;
  pendingInvites: number;
  available: number;
  extraSeatPrice: number;
  seatBillingConfigured: boolean;
}

function seatSummary(extraSeats: number, members: number, pending: number): SeatSummary {
  const capacity = INCLUDED_AGENCY_SEATS + extraSeats;
  return {
    included: INCLUDED_AGENCY_SEATS,
    extra: extraSeats,
    capacity,
    members,
    pendingInvites: pending,
    available: Math.max(0, capacity - members - pending),
    extraSeatPrice: EXTRA_SEAT_PRICE_BRL,
    seatBillingConfigured: Boolean(String(process.env.STRIPE_PRICE_AGENCY_EXTRA_SEAT || '').trim()),
  };
}

export async function getTeamOverview(userUid: string) {
  const context = await getTeamContext(userUid);
  if (!context) httpError('Workspace não encontrado.', 404, 'TEAM_NOT_FOUND');
  const access = await getSubscriptionAccess(userUid);
  const members = await listTeamMembers({ id: context.workspaceId, ownerUid: context.ownerUid });
  const isOwner = context.role === 'owner';
  const ownerAccess = isOwner ? access : await getSubscriptionAccess(context.ownerUid);
  const teamEnabled = ownerAccess.plan === 'agency' && ownerAccess.hasAccess;
  const invites = isOwner ? await listPendingInvites(context.workspaceId) : [];
  return {
    role: context.role,
    teamEnabled,
    plan: access.plan,
    workspace: { id: context.workspaceId, name: context.workspaceName, pipelineMode: context.pipelineMode },
    ownerName: members[0]?.name || '',
    seats: seatSummary(context.extraSeats, members.length, invites.length),
    members,
    invites,
  };
}

async function requireOwnerWithAgency(userUid: string) {
  const context = await getTeamContext(userUid);
  if (!context || context.role !== 'owner') httpError('Só o dono do workspace pode fazer isso.', 403, 'TEAM_FORBIDDEN');
  const access = await getSubscriptionAccess(userUid);
  if (access.plan !== 'agency' || !access.hasAccess) {
    httpError('Equipes são um recurso do plano Agency.', 402, 'TEAM_REQUIRES_AGENCY');
  }
  return context;
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

function inviteLink(token: string) {
  return `${String(process.env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, '')}/convite/${token}`;
}

async function sendInviteEmail(options: { to: string; ownerName: string; workspaceName: string; link: string }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return false;
  const from = String(process.env.RESEND_FROM_EMAIL || 'Scoutly <equipe@scoutly.pro>').trim();
  const owner = options.ownerName.replace(/[<>]/g, '');
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#14161a">
<h2 style="margin:0 0 12px;font-size:22px">${owner} convidou você para a equipe no Scoutly</h2>
<p style="margin:0 0 22px;line-height:1.6;color:#4b5260">Você foi convidado para o workspace <b>${options.workspaceName.replace(/[<>]/g, '')}</b>. Entre com este e-mail para aceitar o convite. Ele vale por ${INVITE_TTL_DAYS} dias.</p>
<a href="${options.link}" style="display:inline-block;background:#ff5a12;color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:12px">Aceitar convite</a>
<p style="margin:24px 0 0;font-size:12px;color:#8a909c">Se você não esperava este convite, pode ignorar este e-mail.</p></div>`;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [options.to], subject: `${owner} convidou você para a equipe no Scoutly`, html }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function countMembers(workspaceId: string) {
  const rows = await appDataRequest<Array<{ user_uid: string }>>(`workspace_members?workspace_id=eq.${dbValue(workspaceId)}&select=user_uid`);
  return rows.length;
}

export async function createInvite(identity: FirebaseIdentity, emailInput: unknown) {
  const context = await requireOwnerWithAgency(identity.uid);
  const email = normalizeEmail(emailInput);
  if (!validEmail(email)) httpError('Informe um e-mail válido.', 400, 'TEAM_INVALID_EMAIL');
  if (email === normalizeEmail(identity.email)) httpError('Você já é o dono deste workspace.', 400, 'TEAM_INVALID_EMAIL');

  const [members, pending] = await Promise.all([listTeamMembers({ id: context.workspaceId, ownerUid: context.ownerUid }), listPendingInvites(context.workspaceId)]);
  if (members.some((member) => normalizeEmail(member.email) === email)) httpError('Esta pessoa já está na equipe.', 409, 'TEAM_ALREADY_MEMBER');
  if (pending.some((invite) => normalizeEmail(invite.email) === email)) httpError('Já existe um convite pendente para este e-mail.', 409, 'TEAM_ALREADY_INVITED');
  const summary = seatSummary(context.extraSeats, members.length, pending.length);
  if (summary.available <= 0) {
    httpError(`Sua equipe está completa (${summary.capacity} assentos). Adicione um assento para convidar mais pessoas.`, 402, 'TEAM_SEATS_FULL');
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let rows: Array<{ id: string; created_at: string }>;
  try {
    rows = await appDataRequest<Array<{ id: string; created_at: string }>>('workspace_invites?select=id,created_at', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ workspace_id: context.workspaceId, email, token_hash: sha256(token), invited_by: identity.uid, expires_at: expiresAt }),
    });
  } catch (error) { throw migrationError(error); }

  const link = inviteLink(token);
  const emailed = await sendInviteEmail({
    to: email, ownerName: identity.displayName || identity.email || 'Um colega', workspaceName: context.workspaceName, link,
  });
  return { invite: { id: rows[0].id, email, createdAt: rows[0].created_at, expiresAt }, link, emailed };
}

/** A new link for an existing invite (only a hash is stored, so the old link cannot be shown again). */
export async function renewInvite(identity: FirebaseIdentity, inviteId: string) {
  const context = await requireOwnerWithAgency(identity.uid);
  const rows = await appDataRequest<Array<{ id: string; email: string }>>(
    `workspace_invites?id=eq.${dbValue(inviteId)}&workspace_id=eq.${dbValue(context.workspaceId)}&status=eq.pending&select=id,email&limit=1`
  );
  if (!rows[0]) httpError('Convite não encontrado.', 404, 'TEAM_NOT_FOUND');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await appDataRequest(`workspace_invites?id=eq.${dbValue(inviteId)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ token_hash: sha256(token), expires_at: expiresAt }),
  });
  const link = inviteLink(token);
  const emailed = await sendInviteEmail({ to: rows[0].email, ownerName: identity.displayName || identity.email || 'Um colega', workspaceName: context.workspaceName, link });
  return { link, emailed, expiresAt };
}

export async function revokeInvite(userUid: string, inviteId: string) {
  const context = await requireOwnerWithAgency(userUid);
  await appDataRequest(`workspace_invites?id=eq.${dbValue(inviteId)}&workspace_id=eq.${dbValue(context.workspaceId)}&status=eq.pending`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'revoked' }),
  });
  return { success: true };
}

async function findPendingInvite(token: string) {
  const rows = await appDataRequest<Array<{ id: string; workspace_id: string; email: string; expires_at: string }>>(
    `workspace_invites?token_hash=eq.${dbValue(sha256(String(token || '')))}&status=eq.pending&select=id,workspace_id,email,expires_at&limit=1`
  );
  const invite = rows[0];
  if (!invite) httpError('Este convite não existe ou já foi usado.', 404, 'TEAM_INVITE_INVALID');
  if (new Date(invite.expires_at).getTime() < Date.now()) httpError('Este convite expirou. Peça um novo ao dono da equipe.', 410, 'TEAM_INVITE_EXPIRED');
  return invite;
}

export async function previewInvite(identity: FirebaseIdentity, token: string) {
  let invite;
  try { invite = await findPendingInvite(token); } catch (error) { throw migrationError(error); }
  const workspace = await workspaceById(invite.workspace_id);
  const owner = workspace ? (await listTeamMembers({ id: workspace.id, ownerUid: workspace.owner_uid }))[0] : null;
  return {
    workspaceName: workspace?.name || 'Equipe',
    ownerName: owner?.name || '',
    inviteEmail: invite.email,
    emailMatches: normalizeEmail(identity.email) === normalizeEmail(invite.email),
  };
}

async function moveUserDataToWorkspace(userUid: string, workspaceId: string) {
  // Leads, favorites and generated messages carry the workspace id so counts roll up to the team.
  for (const table of ['user_leads', 'favorites', 'generated_messages']) {
    await appDataRequest(`${table}?user_uid=eq.${dbValue(userUid)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id: workspaceId }),
    }).catch(() => undefined);
  }
}

export async function acceptInvite(identity: FirebaseIdentity, token: string) {
  let invite;
  try { invite = await findPendingInvite(token); } catch (error) { throw migrationError(error); }
  if (normalizeEmail(identity.email) !== normalizeEmail(invite.email)) {
    httpError(`Este convite foi enviado para ${invite.email}. Entre com esse e-mail para aceitar.`, 403, 'TEAM_INVITE_EMAIL_MISMATCH');
  }
  const existing = await appDataRequest<Array<{ workspace_id: string }>>(
    `workspace_members?user_uid=eq.${dbValue(identity.uid)}&role=eq.member&select=workspace_id&limit=1`
  );
  if (existing[0]) {
    if (existing[0].workspace_id === invite.workspace_id) return { joined: true, already: true };
    httpError('Você já faz parte de outra equipe. Saia dela antes de aceitar este convite.', 409, 'TEAM_ALREADY_MEMBER');
  }
  const workspace = await workspaceById(invite.workspace_id);
  if (!workspace) httpError('Equipe não encontrada.', 404, 'TEAM_NOT_FOUND');
  if (workspace.owner_uid === identity.uid) httpError('Você é o dono deste workspace.', 400, 'TEAM_INVALID_EMAIL');
  const ownerAccess = await getSubscriptionAccess(workspace.owner_uid);
  if (ownerAccess.plan !== 'agency' || !ownerAccess.hasAccess) {
    httpError('A assinatura Agency desta equipe não está ativa. Fale com o dono da equipe.', 402, 'TEAM_REQUIRES_AGENCY');
  }
  const members = await countMembers(workspace.id);
  if (members + 1 > INCLUDED_AGENCY_SEATS + Number(workspace.extra_seats || 0)) {
    httpError('A equipe está completa. Peça ao dono para adicionar um assento.', 402, 'TEAM_SEATS_FULL');
  }

  await appDataRequest('workspace_members?on_conflict=workspace_id,user_uid', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ workspace_id: workspace.id, user_uid: identity.uid, role: 'member', invited_by: workspace.owner_uid }),
  });
  await appDataRequest(`workspace_invites?id=eq.${dbValue(invite.id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'accepted', accepted_by: identity.uid, accepted_at: new Date().toISOString() }),
  });
  await moveUserDataToWorkspace(identity.uid, workspace.id);
  return { joined: true, workspaceName: workspace.name || 'Equipe' };
}

// ---------------------------------------------------------------------------
// Leaving / removing members
// ---------------------------------------------------------------------------

async function detachMember(context: TeamContext, memberUid: string, keepLeadsInTeam: boolean) {
  const personal = await personalWorkspace(memberUid);
  if (keepLeadsInTeam) {
    // Copy the member's leads to the owner (ignoring businesses the owner already has) so the team keeps its history.
    const leads = await appDataRequest<Array<Record<string, any>>>(
      `user_leads?user_uid=eq.${dbValue(memberUid)}&workspace_id=eq.${dbValue(context.workspaceId)}&select=business_id,status,notes,business_snapshot&limit=2000`
    ).catch(() => [] as Array<Record<string, any>>);
    if (leads.length) {
      await appDataRequest('user_leads?on_conflict=user_uid,business_id', {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(leads.map((lead) => ({ ...lead, user_uid: context.ownerUid, workspace_id: context.workspaceId }))),
      }).catch(() => undefined);
    }
  }
  await appDataRequest(`workspace_members?workspace_id=eq.${dbValue(context.workspaceId)}&user_uid=eq.${dbValue(memberUid)}&role=eq.member`, {
    method: 'DELETE', headers: { Prefer: 'return=minimal' },
  });
  if (personal) await moveUserDataToWorkspace(memberUid, personal.id);
}

export async function removeMember(ownerUid: string, memberUid: string, keepLeads = true) {
  const context = await requireOwnerWithAgency(ownerUid);
  if (memberUid === context.ownerUid) httpError('O dono não pode ser removido.', 400, 'TEAM_FORBIDDEN');
  const members = await listTeamMembers({ id: context.workspaceId, ownerUid: context.ownerUid });
  if (!members.some((member) => member.uid === memberUid)) httpError('Membro não encontrado.', 404, 'TEAM_NOT_FOUND');
  await detachMember(context, memberUid, keepLeads);
  return { success: true };
}

export async function leaveTeam(userUid: string) {
  const context = await getTeamContext(userUid);
  if (!context || context.role !== 'member') httpError('Você não faz parte de uma equipe.', 400, 'TEAM_FORBIDDEN');
  await detachMember(context, userUid, true);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Settings and seats
// ---------------------------------------------------------------------------

export async function setPipelineMode(ownerUid: string, mode: unknown) {
  const context = await requireOwnerWithAgency(ownerUid);
  if (mode !== 'shared' && mode !== 'individual') httpError('Modo de pipeline inválido.', 400, 'TEAM_INVALID');
  try {
    await appDataRequest(`workspaces?id=eq.${dbValue(context.workspaceId)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ pipeline_mode: mode, updated_at: new Date().toISOString() }),
    });
  } catch (error) { throw migrationError(error); }
  return { pipelineMode: mode as PipelineMode };
}

/** Buys or releases extra seats: the Stripe subscription gets a second line item for the seat price. */
export async function setExtraSeats(ownerUid: string, quantityInput: unknown) {
  const context = await requireOwnerWithAgency(ownerUid);
  const quantity = Math.round(Number(quantityInput));
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > MAX_EXTRA_SEATS) httpError('Quantidade de assentos inválida.', 400, 'TEAM_INVALID');

  const [members, pending] = await Promise.all([countMembers(context.workspaceId), listPendingInvites(context.workspaceId)]);
  if (INCLUDED_AGENCY_SEATS + quantity < members + pending.length) {
    httpError('Você tem mais pessoas (ou convites pendentes) do que assentos. Remova alguém ou revogue um convite primeiro.', 409, 'TEAM_SEATS_IN_USE');
  }

  const seatPrice = String(process.env.STRIPE_PRICE_AGENCY_EXTRA_SEAT || '').trim();
  if (!seatPrice) httpError('A cobrança de assentos adicionais ainda não está configurada.', 503, 'TEAM_SEAT_BILLING_PENDING');

  const subs = await appDataRequest<Array<{ provider_subscription_id: string | null }>>(
    `subscriptions?user_uid=eq.${dbValue(ownerUid)}&select=provider_subscription_id&limit=1`
  );
  const subscriptionId = subs[0]?.provider_subscription_id;
  if (!subscriptionId) httpError('Não encontramos a sua assinatura Agency na Stripe. Fale com o suporte.', 409, 'TEAM_SEAT_BILLING_PENDING');

  const subscription = await retrieveStripeSubscription(subscriptionId);
  const items: any[] = subscription?.items?.data || [];
  const seatItem = items.find((item) => (item?.price?.id || item?.plan?.id) === seatPrice);

  if (quantity === 0) {
    if (seatItem) {
      await stripeRequestRaw(`subscription_items/${encodeURIComponent(seatItem.id)}?proration_behavior=create_prorations`, { method: 'DELETE' });
    }
  } else if (seatItem) {
    await stripeRequestRaw(`subscription_items/${encodeURIComponent(seatItem.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ quantity: String(quantity), proration_behavior: 'create_prorations' }).toString(),
    });
  } else {
    await stripeRequestRaw('subscription_items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        subscription: subscriptionId, price: seatPrice, quantity: String(quantity), proration_behavior: 'create_prorations',
      }).toString(),
    });
  }

  await appDataRequest(`workspaces?id=eq.${dbValue(context.workspaceId)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ extra_seats: quantity, updated_at: new Date().toISOString() }),
  });
  return { extraSeats: quantity, seats: seatSummary(quantity, members, pending.length) };
}

/** Keeps workspaces.extra_seats in sync with Stripe (called from the subscription sync). */
export async function syncExtraSeatsFromSubscription(ownerUid: string, stripeSubscription: any) {
  const seatPrice = String(process.env.STRIPE_PRICE_AGENCY_EXTRA_SEAT || '').trim();
  if (!seatPrice) return;
  const items: any[] = stripeSubscription?.items?.data || [];
  const quantity = items
    .filter((item) => (item?.price?.id || item?.plan?.id) === seatPrice)
    .reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
  const active = ['active', 'trialing', 'past_due'].includes(String(stripeSubscription?.status || ''));
  await appDataRequest(`workspaces?owner_uid=eq.${dbValue(ownerUid)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ extra_seats: active ? Math.min(MAX_EXTRA_SEATS, quantity) : 0 }),
  }).catch(() => undefined);
}
