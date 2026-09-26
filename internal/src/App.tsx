import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Headphones,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  TicketCheck,
  Users,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import {
  createTicket,
  fetchAudit,
  fetchBootstrap,
  fetchTicket,
  fetchTickets,
  fetchUser,
  fetchUsers,
  replyTicket,
  updateTicket,
} from './api';
import type {
  DashboardData,
  InternalTab,
  Ticket,
  TicketMessage,
  TicketPriority,
  TicketStatus,
  UserDetail,
  UserSummary,
} from './types';

const NAV: Array<{ id: InternalTab; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'tickets', label: 'Suporte', icon: Headphones },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'billing', label: 'Billing', icon: BadgeDollarSign },
  { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em atendimento',
  WAITING_CUSTOMER: 'Aguardando cliente',
  WAITING_INTERNAL: 'Aguardando interno',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

function timeAgo(date?: string | null) {
  if (!date) return '—';
  const value = new Date(date).getTime();
  const diff = Date.now() - value;
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} d`;
}

function statusClass(status: string) {
  if (status === 'URGENT' || status === 'past_due') return 'pill danger';
  if (status === 'HIGH' || status === 'WAITING_INTERNAL') return 'pill warning';
  if (status === 'RESOLVED' || status === 'CLOSED' || status === 'active') return 'pill success';
  if (status === 'IN_PROGRESS' || status === 'WAITING_CUSTOMER') return 'pill info';
  return 'pill';
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: any;
  tone?: 'neutral' | 'orange' | 'green' | 'red';
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={18} />
      </div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function Login({ error, onLogin }: { error: string; onLogin: () => void }) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">S</div>
        <span className="eyebrow">SCOUTLY INTERNAL</span>
        <h1>Backoffice operacional</h1>
        <p>
          Suporte, clientes, billing e auditoria em uma área separada e restrita à equipe Scoutly.
        </p>
        {error && <div className="error-box">{error}</div>}
        <button className="primary-button wide" onClick={onLogin}>
          Entrar com Google
        </button>
        <small>Acesso exclusivo para contas internas autorizadas.</small>
      </section>
    </main>
  );
}

function DashboardView({
  data,
  onOpenTicket,
  onOpenUser,
}: {
  data: DashboardData;
  onOpenTicket: (ticket: Ticket) => void;
  onOpenUser: (user: UserSummary) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERAÇÃO</span>
          <h1>Visão geral</h1>
          <p>O que precisa de atenção agora.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard
          label="Tickets abertos"
          value={data.stats.openTickets}
          detail="fila ativa"
          icon={MessageSquareText}
          tone="orange"
        />
        <MetricCard
          label="Urgentes"
          value={data.stats.urgentTickets}
          detail="prioridade máxima"
          icon={CircleAlert}
          tone="red"
        />
        <MetricCard
          label="Usuários ativos"
          value={data.stats.activeUsers30d}
          detail="últimos 30 dias"
          icon={Users}
        />
        <MetricCard
          label="Assinaturas pagas"
          value={data.stats.paidSubscriptions}
          detail="ativas / trialing"
          icon={BadgeDollarSign}
          tone="green"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Fila de suporte</h2>
              <p>Tickets atualizados recentemente.</p>
            </div>
            <TicketCheck size={18} />
          </div>
          <div className="list">
            {data.tickets.slice(0, 8).map((ticket) => (
              <button key={ticket.id} className="list-row" onClick={() => onOpenTicket(ticket)}>
                <div className="list-main">
                  <strong>#{ticket.id} · {ticket.subject}</strong>
                  <span>{ticket.requester_email || ticket.requester_name || 'Cliente não identificado'}</span>
                </div>
                <div className="list-meta">
                  <span className={statusClass(ticket.priority)}>{PRIORITY_LABELS[ticket.priority]}</span>
                  <small>{timeAgo(ticket.updated_at)}</small>
                  <ChevronRight size={15} />
                </div>
              </button>
            ))}
            {data.tickets.length === 0 && (
              <div className="empty-mini">Nenhum ticket criado ainda.</div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Clientes recentes</h2>
              <p>Última atividade registrada.</p>
            </div>
            <Users size={18} />
          </div>
          <div className="list">
            {data.recentUsers.slice(0, 8).map((user) => (
              <button key={user.firebase_uid} className="list-row" onClick={() => onOpenUser(user)}>
                <div className="avatar">
                  {user.photo_url ? <img src={user.photo_url} alt="" /> : (user.display_name || user.email || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="list-main">
                  <strong>{user.display_name || 'Sem nome'}</strong>
                  <span>{user.email || user.firebase_uid}</span>
                </div>
                <div className="list-meta">
                  <small>{timeAgo(user.last_seen_at)}</small>
                  <ChevronRight size={15} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function TicketsView({
  tickets,
  selected,
  messages,
  loading,
  onReload,
  onSelect,
  onUpdate,
  onReply,
  onCreate,
}: {
  tickets: Ticket[];
  selected: Ticket | null;
  messages: TicketMessage[];
  loading: boolean;
  onReload: () => void;
  onSelect: (ticket: Ticket) => void;
  onUpdate: (ticketId: number, patch: Record<string, unknown>) => void;
  onReply: (ticketId: number, body: string, internal: boolean) => Promise<void>;
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');

  const filtered = statusFilter ? tickets.filter((ticket) => ticket.status === statusFilter) : tickets;

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SUPORTE</span>
          <h1>Tickets</h1>
          <p>Inbox operacional com contexto do cliente.</p>
        </div>
        <div className="page-actions">
          <button className="ghost-button" onClick={onReload}><RefreshCw size={15} /> Atualizar</button>
          <button className="primary-button" onClick={() => setCreating(true)}>Novo ticket</button>
        </div>
      </div>

      {creating && (
        <section className="panel create-ticket">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto do ticket" />
          <button
            className="primary-button"
            disabled={!subject.trim()}
            onClick={async () => {
              await onCreate({ subject, category: 'OTHER', priority: 'NORMAL' });
              setSubject('');
              setCreating(false);
            }}
          >
            Criar
          </button>
          <button className="ghost-button" onClick={() => setCreating(false)}>Cancelar</button>
        </section>
      )}

      <div className="support-layout">
        <section className="panel tickets-list-panel">
          <div className="toolbar">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="ticket-list">
            {filtered.map((ticket) => (
              <button
                key={ticket.id}
                className={`ticket-row ${selected?.id === ticket.id ? 'selected' : ''}`}
                onClick={() => onSelect(ticket)}
              >
                <div className="ticket-topline">
                  <strong>#{ticket.id}</strong>
                  <span className={statusClass(ticket.priority)}>{PRIORITY_LABELS[ticket.priority]}</span>
                </div>
                <h3>{ticket.subject}</h3>
                <p>{ticket.requester_email || ticket.requester_name || 'Sem cliente associado'}</p>
                <div className="ticket-foot">
                  <span>{STATUS_LABELS[ticket.status]}</span>
                  <small>{timeAgo(ticket.updated_at)}</small>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="panel conversation-panel">
          {!selected ? (
            <div className="empty-state">
              <MessageSquareText size={28} />
              <h2>Selecione um ticket</h2>
              <p>A conversa, status e notas internas aparecem aqui.</p>
            </div>
          ) : (
            <>
              <div className="conversation-head">
                <div>
                  <span className="eyebrow">TICKET #{selected.id}</span>
                  <h2>{selected.subject}</h2>
                  <p>{selected.requester_email || selected.requester_name || 'Cliente não associado'}</p>
                </div>
                <div className="conversation-controls">
                  <select
                    value={selected.status}
                    onChange={(e) => onUpdate(selected.id, { status: e.target.value })}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <select
                    value={selected.priority}
                    onChange={(e) => onUpdate(selected.id, { priority: e.target.value })}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="messages">
                {loading && <div className="loading-line">Carregando conversa...</div>}
                {!loading && messages.length === 0 && (
                  <div className="empty-mini">Esse ticket ainda não possui mensagens.</div>
                )}
                {messages.map((message) => (
                  <div key={message.id} className={`message ${message.is_internal ? 'internal' : message.author_type}`}>
                    <div className="message-meta">
                      <strong>{message.author_name || message.author_type}</strong>
                      {message.is_internal && <span className="pill warning">Nota interna</span>}
                      <small>{new Date(message.created_at).toLocaleString('pt-BR')}</small>
                    </div>
                    <p>{message.body}</p>
                  </div>
                ))}
              </div>

              <div className="composer">
                <div className="composer-mode">
                  <button className={!internal ? 'active' : ''} onClick={() => setInternal(false)}>Responder</button>
                  <button className={internal ? 'active' : ''} onClick={() => setInternal(true)}>Nota interna</button>
                </div>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={internal ? 'Escreva uma nota para a equipe...' : 'Escreva a resposta ao cliente...'}
                />
                <button
                  className="primary-button"
                  disabled={!reply.trim()}
                  onClick={async () => {
                    await onReply(selected.id, reply, internal);
                    setReply('');
                  }}
                >
                  {internal ? 'Salvar nota' : 'Enviar resposta'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function CustomersView({
  users,
  detail,
  onSearch,
  onSelect,
  billingOnly = false,
}: {
  users: UserSummary[];
  detail: UserDetail | null;
  onSearch: (query: string) => void;
  onSelect: (user: UserSummary) => void;
  billingOnly?: boolean;
}) {
  const [query, setQuery] = useState('');

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{billingOnly ? 'BILLING' : 'CLIENTES'}</span>
          <h1>{billingOnly ? 'Assinaturas' : 'Clientes'}</h1>
          <p>{billingOnly ? 'Plano, status e ciclo de cobrança.' : 'Contexto operacional de cada usuário.'}</p>
        </div>
      </div>

      <section className="panel customer-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch(e.target.value);
          }}
          placeholder="Buscar por nome, e-mail ou UID"
        />
      </section>

      <div className="customers-layout">
        <section className="panel customer-list">
          {users.map((user) => (
            <button key={user.firebase_uid} className="list-row" onClick={() => onSelect(user)}>
              <div className="avatar">
                {user.photo_url ? <img src={user.photo_url} alt="" /> : (user.display_name || user.email || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="list-main">
                <strong>{user.display_name || 'Sem nome'}</strong>
                <span>{user.email || user.firebase_uid}</span>
              </div>
              <div className="list-meta">
                {user.subscription?.plan && <span className="pill">{user.subscription.plan}</span>}
                <small>{timeAgo(user.last_seen_at)}</small>
                <ChevronRight size={15} />
              </div>
            </button>
          ))}
        </section>

        <section className="panel customer-detail">
          {!detail?.user ? (
            <div className="empty-state">
              <Users size={28} />
              <h2>Selecione um cliente</h2>
              <p>Plano, uso, pipeline e atividade ficam disponíveis aqui.</p>
            </div>
          ) : (
            <>
              <div className="customer-identity">
                <div className="avatar large">
                  {detail.user.photo_url ? <img src={detail.user.photo_url} alt="" /> : (detail.user.display_name || detail.user.email || '?').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2>{detail.user.display_name || 'Sem nome'}</h2>
                  <p>{detail.user.email || detail.user.firebase_uid}</p>
                </div>
              </div>

              <div className="detail-grid">
                <div className="detail-card">
                  <span>Plano</span>
                  <strong>{detail.subscription?.plan || 'trial'}</strong>
                  <small>{detail.subscription?.status || 'sem assinatura'}</small>
                </div>
                <div className="detail-card">
                  <span>Pipeline</span>
                  <strong>{detail.leads.length}</strong>
                  <small>empresas salvas</small>
                </div>
                <div className="detail-card">
                  <span>Favoritos</span>
                  <strong>{detail.favorites.length}</strong>
                  <small>empresas</small>
                </div>
                <div className="detail-card">
                  <span>IA no período</span>
                  <strong>{Array.isArray(detail.usage) ? (detail.usage[0]?.ai_messages ?? 0) : (detail.usage?.ai_messages ?? 0)}</strong>
                  <small>mensagens</small>
                </div>
              </div>

              <div className="activity-block">
                <h3>Onboarding</h3>
                {detail.onboarding?.completedAt ? (
                  <>
                    <div className="activity-row">
                      <span>Perfil</span>
                      <strong>{detail.onboarding.role || 'Não informado'}</strong>
                      <small>{timeAgo(detail.onboarding.completedAt)}</small>
                    </div>
                    <div className="activity-row">
                      <span>Tamanho da equipe</span>
                      <strong>{detail.onboarding.teamSize || 'Não informado'}</strong>
                      <small>onboarding</small>
                    </div>
                    <div className="activity-row">
                      <span>Objetivo no Scoutly</span>
                      <strong>{detail.onboarding.goalOther || detail.onboarding.goal || 'Não informado'}</strong>
                      <small>onboarding</small>
                    </div>
                    <div className="activity-row">
                      <span>Tutorial</span>
                      <strong>{detail.onboarding.tutorialCompleted ? 'Concluído' : 'Pendente'}</strong>
                      <small>{detail.onboarding.tutorialCompletedAt ? timeAgo(detail.onboarding.tutorialCompletedAt) : '—'}</small>
                    </div>
                  </>
                ) : (
                  <div className="empty-mini">Este usuário ainda não concluiu o onboarding.</div>
                )}
              </div>

              <div className="activity-block">
                <h3>Atividade recente</h3>
                {detail.recentEvents.slice(0, 12).map((event, index) => (
                  <div className="activity-row" key={index}>
                    <span>{event.event_type}</span>
                    <strong>{event.query || event.category || event.business_id || '—'}</strong>
                    <small>{timeAgo(event.created_at)}</small>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function AuditView({ rows }: { rows: any[] }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEGURANÇA</span>
          <h1>Auditoria</h1>
          <p>Histórico de ações executadas pela equipe interna.</p>
        </div>
      </div>

      <section className="panel audit-table">
        {rows.map((row) => (
          <div className="audit-row" key={row.id}>
            <div>
              <strong>{row.action}</strong>
              <span>{row.actor_email || row.actor_uid || 'Sistema'}</span>
            </div>
            <div>
              <span>{row.target_type || '—'} {row.target_id ? `#${row.target_id}` : ''}</span>
              <small>{new Date(row.created_at).toLocaleString('pt-BR')}</small>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="empty-mini">Nenhuma ação auditada ainda.</div>}
      </section>
    </>
  );
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState<InternalTab>('dashboard');
  const [bootstrap, setBootstrap] = useState<DashboardData | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [appError, setAppError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() =>
    onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    }),
  []);

  const loadBootstrap = async () => {
    setLoading(true);
    setAppError('');
    try {
      const data = await fetchBootstrap();
      setBootstrap(data);
      setTickets(data.tickets || []);
      setUsers(data.recentUsers || []);
      setAudit(data.audit || []);
    } catch (error: any) {
      setAppError(error?.message || 'Não foi possível carregar o Scoutly Internal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firebaseUser) void loadBootstrap();
    else setBootstrap(null);
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || tab !== 'tickets') return;
    let cancelled = false;

    const syncSupport = async () => {
      try {
        const latestTickets = await fetchTickets();
        if (cancelled) return;
        setTickets(latestTickets);

        if (selectedTicket?.id) {
          const detail = await fetchTicket(selectedTicket.id);
          if (cancelled) return;
          setSelectedTicket(detail.ticket);
          setMessages(detail.messages);
        }
      } catch {
        // Polling is best-effort. Manual refresh and actions remain available.
      }
    };

    void syncSupport();
    const interval = window.setInterval(syncSupport, 2200);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [firebaseUser, tab, selectedTicket?.id]);

  const openTicket = async (ticket: Ticket) => {
    setTab('tickets');
    setSelectedTicket(ticket);
    setTicketLoading(true);
    try {
      const detail = await fetchTicket(ticket.id);
      setSelectedTicket(detail.ticket);
      setMessages(detail.messages);
    } finally {
      setTicketLoading(false);
    }
  };

  const reloadTickets = async () => {
    setTickets(await fetchTickets());
  };

  const openUser = async (user: UserSummary) => {
    if (tab !== 'billing') setTab('customers');
    setUserDetail(await fetchUser(user.firebase_uid));
  };

  const searchUsers = async (q: string) => {
    setUsers(await fetchUsers(q));
  };

  const updateTicketState = async (ticketId: number, patch: Record<string, unknown>) => {
    const detail = await updateTicket(ticketId, patch);
    setSelectedTicket(detail.ticket);
    setMessages(detail.messages);
    await reloadTickets();
  };

  const reply = async (ticketId: number, body: string, internal: boolean) => {
    const detail = await replyTicket(ticketId, body, internal);
    setSelectedTicket(detail.ticket);
    setMessages(detail.messages);
    await reloadTickets();
  };

  const create = async (payload: Record<string, unknown>) => {
    const detail = await createTicket(payload);
    setSelectedTicket(detail.ticket);
    setMessages(detail.messages);
    setTab('tickets');
    await reloadTickets();
  };

  const content = useMemo(() => {
    if (!bootstrap) return null;

    if (tab === 'dashboard') {
      return <DashboardView data={bootstrap} onOpenTicket={openTicket} onOpenUser={openUser} />;
    }
    if (tab === 'tickets') {
      return (
        <TicketsView
          tickets={tickets}
          selected={selectedTicket}
          messages={messages}
          loading={ticketLoading}
          onReload={reloadTickets}
          onSelect={openTicket}
          onUpdate={updateTicketState}
          onReply={reply}
          onCreate={create}
        />
      );
    }
    if (tab === 'customers' || tab === 'billing') {
      return (
        <CustomersView
          users={users}
          detail={userDetail}
          onSearch={searchUsers}
          onSelect={openUser}
          billingOnly={tab === 'billing'}
        />
      );
    }
    return <AuditView rows={audit} />;
  }, [bootstrap, tab, tickets, selectedTicket, messages, ticketLoading, users, userDetail, audit]);

  if (authLoading) {
    return <div className="screen-loader"><RefreshCw className="spin" /> Carregando...</div>;
  }

  if (!firebaseUser) {
    return (
      <Login
        error={authError}
        onLogin={async () => {
          setAuthError('');
          try {
            await signInWithPopup(auth, googleProvider);
          } catch (error: any) {
            setAuthError(error?.message || 'Não foi possível entrar.');
          }
        }}
      />
    );
  }

  if (!bootstrap && appError) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <CircleAlert size={28} className="danger-text" />
          <h1>Acesso não liberado</h1>
          <p>{appError}</p>
          <button className="ghost-button wide" onClick={() => signOut(auth)}>
            Sair da conta
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">S</div>
          <div>
            <strong>Scoutly</strong>
            <span>Internal</span>
          </div>
        </div>

        <nav>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? 'active' : ''}
              onClick={async () => {
                setTab(id);
                if (id === 'tickets' && tickets.length === 0) await reloadTickets();
                if ((id === 'customers' || id === 'billing') && users.length === 0) {
                  setUsers(await fetchUsers());
                }
                if (id === 'audit') setAudit(await fetchAudit());
              }}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="staff-chip">
            <div className="avatar">
              {firebaseUser.photoURL ? <img src={firebaseUser.photoURL} alt="" /> : (firebaseUser.displayName || firebaseUser.email || '?').slice(0, 1)}
            </div>
            <div>
              <strong>{firebaseUser.displayName || 'Equipe Scoutly'}</strong>
              <span>{bootstrap?.staff?.role || 'staff'}</span>
            </div>
          </div>
          <button className="icon-button" onClick={() => signOut(auth)} title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div>
            <span className="status-dot" />
            <span>Operação Scoutly</span>
          </div>
          <div className="topbar-actions">
            <button className="icon-button"><Bell size={16} /></button>
            <button className="icon-button" onClick={loadBootstrap} title="Atualizar">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        <div className="content">
          {appError && <div className="error-box">{appError}</div>}
          {loading && !content ? (
            <div className="screen-loader"><RefreshCw className="spin" /> Carregando operação...</div>
          ) : content}
        </div>
      </main>
    </div>
  );
}
