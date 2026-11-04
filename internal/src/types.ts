export type InternalTab = 'dashboard' | 'tickets' | 'customers' | 'billing' | 'feedbacks' | 'mail' | 'audit';

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'WAITING_INTERNAL'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Staff {
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  role: 'admin' | 'support' | 'viewer';
  is_active: boolean;
}

export interface Ticket {
  id: number;
  user_uid: string | null;
  requester_email: string | null;
  requester_name: string | null;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  author_type: 'customer' | 'staff' | 'system';
  author_uid: string | null;
  author_name: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface UserSummary {
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  created_at: string;
  last_seen_at: string | null;
  subscription?: {
    plan?: string;
    status?: string;
    current_period_end?: string | null;
  } | null;
}

export interface UserDetail {
  user: UserSummary | null;
  subscription: any;
  usage: any;
  leads: any[];
  favorites: any[];
  recentEvents: any[];
  onboarding?: {
    version: number;
    role: string | null;
    teamSize: string | null;
    goal: string | null;
    goalOther: string | null;
    completedAt: string | null;
    tutorialCompleted: boolean;
    tutorialCompletedAt: string | null;
  } | null;
}

export interface DashboardData {
  staff: Staff;
  stats: {
    openTickets: number;
    urgentTickets: number;
    activeUsers30d: number;
    paidSubscriptions: number;
  };
  tickets: Ticket[];
  recentUsers: UserSummary[];
  audit: any[];
}

export type FeedbackIssue = 'whatsapp' | 'site' | 'redes_sociais' | 'outros';

export interface BusinessFeedback {
  id: number;
  user_uid: string;
  user_email: string | null;
  business_id: string;
  business_name: string;
  business_snapshot: {
    name?: string;
    category?: string;
    address?: string;
    source?: string;
    confidence?: number | null;
    googleMapsUrl?: string | null;
    googlePlaceId?: string | null;
    shown?: {
      website?: string | null;
      phone?: string | null;
      whatsapp?: string | null;
      socials?: string[];
    };
  } | null;
  rating: 'up' | 'down';
  issues: FeedbackIssue[];
  created_at: string;
  updated_at: string;
}

export interface ManagedAccount {
  user: { firebase_uid: string; email: string | null; display_name: string | null };
  subscription: {
    plan?: string;
    status?: string;
    provider?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean;
  } | null;
  effective: {
    plan: string;
    status: string;
    reason: string;
    isDeveloper: boolean;
    viaTeam: boolean;
    periodEnd: string | null;
  };
  origin: 'developer' | 'stripe' | 'manual' | 'none';
  developerPlan: 'pro' | 'agency' | null;
  stripeManaged: boolean;
  features: Array<{ key: string; label: string; enabled: boolean }>;
  overrideNote: string | null;
}

export type MailView = 'inbox' | 'sent' | 'archive' | 'trash';

export interface Mailbox {
  address: string;
  displayName: string;
  unread: number;
}

export interface MailThread {
  id: string;
  mailbox: string;
  counterpart: string;
  counterpart_name: string | null;
  subject: string;
  folder: 'inbox' | 'archive' | 'trash';
  has_outbound: boolean;
  unread_count: number;
  message_count: number;
  last_snippet: string;
  last_direction: 'in' | 'out';
  last_message_at: string;
}

export interface MailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number | null;
}

export interface MailMessage {
  id: string;
  thread_id: string;
  direction: 'in' | 'out';
  from_addr: string;
  from_name: string | null;
  to_addrs: string[];
  cc_addrs: string[];
  subject: string;
  text_body: string;
  html_body: string | null;
  attachments: MailAttachment[];
  sent_by: string | null;
  created_at: string;
}
