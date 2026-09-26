import { auth } from './firebase';
import type { DashboardData, Ticket, TicketMessage, UserDetail, UserSummary } from './types';

const ENDPOINT = '/api/ai/suggestions';
const GATE_STORAGE_KEY = 'scoutly_internal_gate_session';

async function readResponse(response: Response) {
  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('O servidor interno retornou uma resposta inválida.');
  }

  if (!response.ok) {
    const error = new Error(data?.error || 'Não foi possível concluir a operação.');
    (error as any).status = response.status;
    throw error;
  }
  return data;
}

export function getInternalGateSession() {
  return sessionStorage.getItem(GATE_STORAGE_KEY) || '';
}

export function hasInternalGateSession() {
  return Boolean(getInternalGateSession());
}

export function clearInternalGateSession() {
  sessionStorage.removeItem(GATE_STORAGE_KEY);
}

export async function verifyInternalCode(code: string) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action: 'internal-verify-code', code }),
  });
  const data = await readResponse(response);
  if (!data?.gateToken) throw new Error('Não foi possível iniciar a sessão interna.');
  sessionStorage.setItem(GATE_STORAGE_KEY, String(data.gateToken));
  return data;
}

async function internalAction(action: string, payload: Record<string, unknown> = {}) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Faça login com uma conta interna.'), { status: 401 });

  const gateToken = getInternalGateSession();
  if (!gateToken) throw Object.assign(new Error('Valide o código interno novamente.'), { status: 401 });

  const token = await user.getIdToken();
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Scoutly-Internal-Session': gateToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  });

  try {
    return await readResponse(response);
  } catch (error: any) {
    if (error?.status === 401) clearInternalGateSession();
    throw error;
  }
}

export async function authorizeInternalSession() {
  return internalAction('internal-authorize');
}

export async function fetchBootstrap(): Promise<DashboardData> {
  return internalAction('internal-bootstrap');
}

export async function fetchTickets(status?: string): Promise<Ticket[]> {
  const data = await internalAction('internal-tickets-list', status ? { status } : {});
  return data.tickets || [];
}

export async function fetchTicket(id: number): Promise<{ ticket: Ticket; messages: TicketMessage[] }> {
  return internalAction('internal-ticket-detail', { ticketId: id });
}

export async function createTicket(payload: Record<string, unknown>) {
  return internalAction('internal-ticket-create', payload);
}

export async function updateTicket(ticketId: number, patch: Record<string, unknown>) {
  return internalAction('internal-ticket-update', { ticketId, ...patch });
}

export async function replyTicket(ticketId: number, body: string, isInternal: boolean) {
  return internalAction('internal-ticket-reply', { ticketId, body, isInternal });
}

export async function fetchUsers(q = ''): Promise<UserSummary[]> {
  const data = await internalAction('internal-users-list', { q });
  return data.users || [];
}

export async function fetchUser(uid: string): Promise<UserDetail> {
  return internalAction('internal-user-detail', { uid });
}

export async function fetchAudit(): Promise<any[]> {
  const data = await internalAction('internal-audit');
  return data.audit || [];
}
