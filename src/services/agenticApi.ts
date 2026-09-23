import { auth } from '../lib/firebase';

const RUNS_ENDPOINT = '/api/agent-runs';
const WORKER_ENDPOINT = '/api/agent-worker';

export type AgentRunStatus =
  | 'queued'
  | 'planning'
  | 'searching'
  | 'qualifying'
  | 'saving'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentRunStep {
  id: string;
  step_key: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  attempt: number;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface AgentRunLead {
  id: string;
  business_id: string;
  status: string;
  score: number;
  reasons: string[];
  business_snapshot: any;
  enrichment?: any;
}

export interface AgentRunEvent {
  id: number;
  level: string;
  event_type: string;
  message: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface AgentRun {
  id: string;
  objective: string;
  current_region_name: string;
  status: AgentRunStatus;
  stage: string;
  target_count: number;
  found_count: number;
  processed_count: number;
  qualified_count: number;
  saved_count: number;
  progress: number;
  current_message: string;
  plan: any;
  result_summary: Record<string, any>;
  error?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  steps?: AgentRunStep[];
  leads?: AgentRunLead[];
  events?: AgentRunEvent[];
}

async function authenticatedAgentFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Faça login para usar o Scoutly Agentic.');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');

  return fetch(input, { ...init, headers });
}

async function readJson(response: Response) {
  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('O Scoutly Agentic recebeu uma resposta inválida do servidor.');
  }
  if (!response.ok) throw new Error(data?.error || 'Falha no Scoutly Agentic.');
  return data;
}

export async function createAgentRun(input: {
  objective: string;
  currentRegionName: string;
  targetCount: number;
}): Promise<AgentRun> {
  const response = await authenticatedAgentFetch(RUNS_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...input }),
  });
  const data = await readJson(response);
  return data.run as AgentRun;
}

export async function listAgentRuns(): Promise<AgentRun[]> {
  const response = await authenticatedAgentFetch(RUNS_ENDPOINT);
  const data = await readJson(response);
  return Array.isArray(data?.runs) ? data.runs : [];
}

export async function getAgentRun(id: string): Promise<AgentRun> {
  const response = await authenticatedAgentFetch(`${RUNS_ENDPOINT}?id=${encodeURIComponent(id)}`);
  const data = await readJson(response);
  return data.run as AgentRun;
}

export async function cancelAgentRun(id: string): Promise<AgentRun> {
  const response = await authenticatedAgentFetch(RUNS_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ action: 'cancel', runId: id }),
  });
  const data = await readJson(response);
  return data.run as AgentRun;
}

export async function kickAgentWorker(): Promise<void> {
  try {
    await authenticatedAgentFetch(WORKER_ENDPOINT, { method: 'POST' });
  } catch {
    // The durable database queue remains intact. The periodic fallback worker can
    // resume the run even if this optimistic UI kick is interrupted.
  }
}

export function isAgentRunActive(status: AgentRunStatus) {
  return ['queued', 'planning', 'searching', 'qualifying', 'saving'].includes(status);
}
