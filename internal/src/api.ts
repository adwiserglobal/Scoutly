import { auth } from './firebase';
import type { DashboardData, Ticket, TicketMessage, UserDetail, UserSummary } from './types';

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sessão não encontrada.');

  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(input, { ...init, headers });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};

  if (!response.ok) {
    const error = new Error(data?.error || 'Não foi possível concluir a operação.');
    (error as any).status = response.status;
    throw error;
  }

  return data;
}

export async function fetchBootstrap(): Promise<DashboardData> {
  return authenticatedFetch('/api/bootstrap');
}

export async function fetchTickets(status?: string): Promise<Ticket[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const data = await authenticatedFetch(`/api/tickets${query}`);
  return data.tickets || [];
}

export async function fetchTicket(id: number): Promise<{ ticket: Ticket; messages: TicketMessage[] }> {
  return authenticatedFetch(`/api/tickets?id=${id}`);
}

export async function createTicket(payload: Record<string, unknown>) {
  return authenticatedFetch('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...payload }),
  });
}

export async function updateTicket(ticketId: number, patch: Record<string, unknown>) {
  return authenticatedFetch('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({ action: 'update', ticketId, ...patch }),
  });
}

export async function replyTicket(ticketId: number, body: string, isInternal: boolean) {
  return authenticatedFetch('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({ action: 'reply', ticketId, body, isInternal }),
  });
}

export async function fetchUsers(q = ''): Promise<UserSummary[]> {
  const data = await authenticatedFetch(`/api/users?q=${encodeURIComponent(q)}`);
  return data.users || [];
}

export async function fetchUser(uid: string): Promise<UserDetail> {
  return authenticatedFetch(`/api/users?uid=${encodeURIComponent(uid)}`);
}

export async function fetchAudit(): Promise<any[]> {
  const data = await authenticatedFetch('/api/audit');
  return data.audit || [];
}
