import { getActiveLanguage } from '../i18n/language';
import { auth } from '../lib/firebase';

/** Team and Workspace (Agency) API. All calls are authenticated and go through /api/leads. */

async function call<T>(action: string, payload: Record<string, unknown> = {}, timeoutMs = 25000): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado');
  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error || 'Não foi possível concluir esta ação.'), { code: data?.code, status: response.status });
  return data as T;
}

export type PipelineMode = 'individual' | 'shared';

export interface TeamMember {
  uid: string; email: string; name: string; photoUrl: string | null; role: 'owner' | 'admin' | 'member';
  joinedAt: string | null; lastSeenAt: string | null;
}
export interface TeamInvite { id: string; email: string; createdAt: string; expiresAt: string }
export interface SeatSummary {
  included: number; extra: number; capacity: number; members: number; pendingInvites: number; available: number;
  extraSeatPrice: number; seatBillingConfigured: boolean;
}
export interface TeamOverview {
  role: 'owner' | 'admin' | 'member';
  teamEnabled: boolean;
  plan: string;
  workspace: { id: string; name: string; pipelineMode: PipelineMode };
  ownerName: string;
  seats: SeatSummary;
  members: TeamMember[];
  invites: TeamInvite[];
}

export interface Delta { value: number; previous: number; change: number | null }
export interface Insight { id: string; tone: 'good' | 'warn' | 'info'; title: string; text: string }
export interface MemberStats {
  uid: string; name: string; email: string; photoUrl: string | null; role: 'owner' | 'admin' | 'member';
  lastSeenAt: string | null; lastActivityAt: string | null;
  unlocks: number; aiConversations: number; aiMessages: number; searches: number; newLeads: number; favorites: number; demoSites: number;
}
export interface WorkspaceInsights {
  period: { days: number; start: string; end: string };
  pipelineMode: PipelineMode;
  summary: Record<'unlocks' | 'uniqueBusinesses' | 'newLeads' | 'won' | 'aiMessages' | 'aiConversations' | 'searches' | 'favorites' | 'agentRuns', Delta>;
  series: Array<{ date: string; unlocks: number; leads: number; aiMessages: number; searches: number }>;
  funnel: Record<string, number>;
  totals: { leads: number; worked: number; withoutSite: number; stalled: number; demoViews: number; demoSites: number };
  categories: Array<{ name: string; count: number; won: number }>;
  members: MemberStats[];
  topSearches: Array<{ term: string; count: number }>;
  topLocations: Array<{ term: string; count: number }>;
  weekday: number[];
  insights: Insight[];
  limits: Array<{ id: string; label: string; used: number; limit: number | null; unit: string; note: string }>;
  recentLeads: Array<{ name: string; status: string; category: string | null; updatedAt: string; by: string }>;
}

export const getTeamOverview = () => call<TeamOverview>('team-overview');
export const getWorkspaceInsights = (days: number) => call<WorkspaceInsights>('workspace-insights', { days, language: getActiveLanguage() }, 40000);
export const inviteTeamMember = (email: string) => call<{ invite: TeamInvite; link: string; emailed: boolean }>('team-invite', { email });
export const renewTeamInvite = (inviteId: string) => call<{ link: string; emailed: boolean; expiresAt: string }>('team-invite-renew', { inviteId });
export const revokeTeamInvite = (inviteId: string) => call<{ success: boolean }>('team-invite-revoke', { inviteId });
export const removeTeamMember = (memberUid: string, keepLeads: boolean) => call<{ success: boolean }>('team-member-remove', { memberUid, keepLeads });
export const setMemberAdmin = (memberUid: string, admin: boolean) => call<{ success: boolean; role: string }>('team-member-admin', { memberUid, admin });
export const leaveTeam = () => call<{ success: boolean }>('team-leave');
export const setPipelineMode = (pipelineMode: PipelineMode) => call<{ pipelineMode: PipelineMode }>('team-settings', { pipelineMode });
export const setExtraSeats = (extraSeats: number) => call<{ extraSeats: number; seats: SeatSummary }>('team-seats', { extraSeats });
export const previewTeamInvite = (token: string) =>
  call<{ workspaceName: string; ownerName: string; inviteEmail: string; emailMatches: boolean }>('team-invite-preview', { token });
export const acceptTeamInvite = (token: string) => call<{ joined: boolean; already?: boolean; workspaceName?: string }>('team-invite-accept', { token });

const INVITE_KEY = 'scoutly-invite-token';
export const rememberInviteToken = (token: string) => { try { localStorage.setItem(INVITE_KEY, token); } catch { /* ignore */ } };
export const readInviteToken = () => { try { return localStorage.getItem(INVITE_KEY); } catch { return null; } };
export const clearInviteToken = () => { try { localStorage.removeItem(INVITE_KEY); } catch { /* ignore */ } };
