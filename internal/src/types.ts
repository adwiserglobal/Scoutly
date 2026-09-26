export type InternalTab = 'dashboard' | 'tickets' | 'customers' | 'billing' | 'audit';

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
