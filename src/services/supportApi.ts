import { auth } from '../lib/firebase';

export type SupportTicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'WAITING_INTERNAL'
  | 'RESOLVED'
  | 'CLOSED';

export type SupportAttachmentDraft = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

export type SupportAttachment = {
  id: number;
  ticket_id: number;
  file_name: string;
  mime_type: string;
  file_size: number;
  data_url: string;
  created_at: string;
};

export type SupportTicket = {
  id: number;
  user_uid: string;
  requester_email: string | null;
  requester_name: string | null;
  subject: string;
  category: string;
  priority: string;
  tags?: string[];
  status: SupportTicketStatus;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
};

export type SupportMessage = {
  id: number;
  ticket_id: number;
  author_type: 'customer' | 'staff' | 'system';
  author_uid: string | null;
  author_name: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

export type SupportTicketDetail = {
  ticket: SupportTicket;
  messages: SupportMessage[];
  attachments?: SupportAttachment[];
};

async function supportAction<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para acessar o suporte.');

  const token = await user.getIdToken();
  const response = await fetch('/api/ai/suggestions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('O suporte respondeu de forma inválida.');
  }

  if (!response.ok) throw new Error(data?.error || 'Não foi possível concluir a operação de suporte.');
  return data as T;
}

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  const data = await supportAction<{ tickets: SupportTicket[] }>('support-list');
  return Array.isArray(data.tickets) ? data.tickets : [];
}

export async function fetchSupportTicket(ticketId: number): Promise<SupportTicketDetail> {
  return supportAction<SupportTicketDetail>('support-detail', { ticketId });
}

export async function createSupportTicket(payload: {
  subject: string;
  category: string;
  message: string;
  supportType?: string;
  attachments?: SupportAttachmentDraft[];
}): Promise<SupportTicketDetail> {
  return supportAction<SupportTicketDetail>('support-create', payload);
}

export async function replySupportTicket(ticketId: number, body: string): Promise<SupportTicketDetail> {
  return supportAction<SupportTicketDetail>('support-reply', { ticketId, body });
}
