import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bug,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CreditCard,
  FileImage,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageCircle,
  Send,
  ShieldAlert,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  createSupportTicket,
  fetchSupportTicket,
  fetchSupportTickets,
  replySupportTicket,
  type SupportAttachmentDraft,
  type SupportTicket,
  type SupportTicketDetail,
} from '../services/supportApi';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
};

type SupportView = 'home' | 'topics' | 'questions' | 'review' | 'cases' | 'chat';
type TopicId = 'billing' | 'bug' | 'product_help' | 'feedback' | 'hacked';
type Question = {
  id: string;
  prompt: string;
  type: 'choice' | 'text';
  options?: string[];
  placeholder?: string;
  optional?: boolean;
};
type Flow = {
  id: TopicId;
  label: string;
  subject: string;
  category: string;
  supportType: string;
  description: string;
  icon: any;
  questions: Question[];
  allowScreenshots?: boolean;
};

const LIVE_SUPPORT_KEY = 'scoutly_live_support_ticket_id';
const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em atendimento',
  WAITING_CUSTOMER: 'Aguardando você',
  WAITING_INTERNAL: 'Aguardando suporte',
  RESOLVED: 'Resolvido',
  CLOSED: 'Encerrado',
};

const FLOWS: Record<TopicId, Flow> = {
  billing: {
    id: 'billing',
    label: 'Preciso de ajuda com meu plano e pagamento',
    subject: 'Ajuda com plano ou pagamento',
    category: 'BILLING',
    supportType: 'BILLING_HELP',
    description: 'Cobranças, faturas, alteração de plano, cancelamento ou pagamento recusado.',
    icon: CreditCard,
    questions: [
      {
        id: 'billing_topic',
        prompt: 'Qual assunto descreve melhor o que aconteceu?',
        type: 'choice',
        options: [
          'Cobrança, fatura ou recibo',
          'Quero alterar meu plano',
          'Pagamento recusado ou assinatura pausada',
          'Cancelamento ou reembolso',
          'Outro assunto de pagamento',
        ],
      },
      {
        id: 'billing_details',
        prompt: 'Conte o que aconteceu e o que você esperava que acontecesse.',
        type: 'text',
        placeholder: 'Descreva o problema com o máximo de contexto possível...',
      },
      {
        id: 'billing_reference',
        prompt: 'Existe alguma cobrança, data, valor ou plano específico que devemos verificar?',
        type: 'text',
        placeholder: 'Opcional: valor, data, plano, final do cartão ou outra referência...',
        optional: true,
      },
    ],
  },
  bug: {
    id: 'bug',
    label: 'Preciso de ajuda com um bug',
    subject: 'Problema técnico na Scoutly',
    category: 'BUG',
    supportType: 'BUG_REPORT',
    description: 'Algo não está funcionando como deveria na plataforma.',
    icon: Bug,
    allowScreenshots: true,
    questions: [
      {
        id: 'bug_area',
        prompt: 'Onde o problema acontece?',
        type: 'choice',
        options: [
          'Mapa e busca',
          'Scoutly Agentic',
          'Pipeline e favoritos',
          'Login e conta',
          'Planos e pagamento',
          'Outra parte do produto',
        ],
      },
      {
        id: 'bug_goal',
        prompt: 'O que você estava tentando fazer?',
        type: 'text',
        placeholder: 'Ex.: buscar empresas em outra cidade, adicionar um lead ao pipeline...',
      },
      {
        id: 'bug_result',
        prompt: 'O que aconteceu de fato?',
        type: 'text',
        placeholder: 'Conte o resultado, mensagem de erro ou comportamento inesperado...',
      },
      {
        id: 'bug_frequency',
        prompt: 'Com que frequência isso acontece?',
        type: 'choice',
        options: ['Acontece sempre', 'Acontece às vezes', 'Aconteceu uma vez'],
      },
    ],
  },
  product_help: {
    id: 'product_help',
    label: 'Preciso de ajuda para usar o produto',
    subject: 'Ajuda para usar a Scoutly',
    category: 'OTHER',
    supportType: 'PRODUCT_HELP',
    description: 'Orientação para realizar uma tarefa ou entender um recurso.',
    icon: BookOpen,
    questions: [
      {
        id: 'help_area',
        prompt: 'Em qual parte da Scoutly você precisa de ajuda?',
        type: 'choice',
        options: [
          'Encontrar empresas, mapa e busca',
          'Scoutly Agentic',
          'Pipeline e favoritos',
          'Dados de empresas',
          'Configurações e conta',
          'Outra parte do produto',
        ],
      },
      {
        id: 'help_goal',
        prompt: 'O que você está tentando fazer?',
        type: 'text',
        placeholder: 'Explique o resultado que você quer alcançar...',
      },
      {
        id: 'help_blocker',
        prompt: 'Em qual etapa você ficou travado?',
        type: 'text',
        placeholder: 'Conte até onde conseguiu chegar e o que impediu de continuar...',
      },
    ],
  },
  feedback: {
    id: 'feedback',
    label: 'Quero dar sugestões ao produto',
    subject: 'Sugestão para a Scoutly',
    category: 'OTHER',
    supportType: 'PRODUCT_FEEDBACK',
    description: 'Ideias de melhoria, novos recursos ou mudanças na experiência.',
    icon: Lightbulb,
    questions: [
      {
        id: 'feedback_area',
        prompt: 'Qual parte do produto sua sugestão envolve?',
        type: 'choice',
        options: [
          'Busca e mapa',
          'Scoutly Agentic',
          'Pipeline e favoritos',
          'Dados e enriquecimento',
          'Experiência e interface',
          'Outra área',
        ],
      },
      {
        id: 'feedback_idea',
        prompt: 'O que você gostaria que a Scoutly fizesse?',
        type: 'text',
        placeholder: 'Descreva a ideia de forma prática...',
      },
      {
        id: 'feedback_problem',
        prompt: 'Que problema isso resolveria para você?',
        type: 'text',
        placeholder: 'Conte como isso melhoraria seu trabalho ou processo...',
      },
    ],
  },
  hacked: {
    id: 'hacked',
    label: 'Minha conta foi invadida',
    subject: 'Possível invasão de conta',
    category: 'ACCOUNT',
    supportType: 'HACKED_ASSET',
    description: 'Acesso não reconhecido, alterações inesperadas ou suspeita de comprometimento.',
    icon: ShieldAlert,
    allowScreenshots: true,
    questions: [
      {
        id: 'hacked_reason',
        prompt: 'Por que você acredita que sua conta foi invadida?',
        type: 'text',
        placeholder: 'Ex.: acesso desconhecido, alterações que você não fez, atividade suspeita...',
      },
    ],
  },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fileToAttachment(file: File): Promise<SupportAttachmentDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a captura de tela.'));
    reader.onload = () => resolve({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: String(reader.result || ''),
    });
    reader.readAsDataURL(file);
  });
}

function SupportMark({ className = 'h-14 w-14' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`${className} bg-[#ff6a26]`}
      style={{
        WebkitMaskImage: "url('/support-icon.png')",
        maskImage: "url('/support-icon.png')",
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}

export default function SupportDrawer({ isOpen, onClose, onOpen }: Props) {
  const [view, setView] = useState<SupportView>('home');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [liveDetail, setLiveDetail] = useState<SupportTicketDetail | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicId | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const [reply, setReply] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const flow = selectedTopic ? FLOWS[selectedTopic] : null;
  const currentQuestion = flow?.questions[questionIndex] || null;
  const activeTicket = detail?.ticket || null;
  const liveTicketIsOpen = Boolean(
    liveDetail && !['RESOLVED', 'CLOSED'].includes(liveDetail.ticket.status)
  );

  const loadTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await fetchSupportTickets();
      setTickets(next);
      setError('');
    } catch (err: any) {
      if (!silent) setError(err?.message || 'Não foi possível carregar seus casos de suporte.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openTicket = async (ticketId: number, options?: { silent?: boolean; activate?: boolean }) => {
    const silent = Boolean(options?.silent);
    const activate = options?.activate !== false;
    if (!silent) setLoading(true);
    try {
      const next = await fetchSupportTicket(ticketId);
      if (activate) {
        setDetail(next);
        setLiveDetail(next);
        setView('chat');
        window.localStorage.setItem(LIVE_SUPPORT_KEY, String(ticketId));
      } else {
        if (detail?.ticket.id === ticketId) setDetail(next);
        setLiveDetail(next);
      }
      setError('');
    } catch (err: any) {
      if (!silent) setError(err?.message || 'Não foi possível abrir o caso.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(LIVE_SUPPORT_KEY) || 0);
    if (!stored) return;
    void fetchSupportTicket(stored)
      .then((next) => {
        setLiveDetail(next);
        if (['RESOLVED', 'CLOSED'].includes(next.ticket.status)) {
          window.localStorage.removeItem(LIVE_SUPPORT_KEY);
        }
      })
      .catch(() => window.localStorage.removeItem(LIVE_SUPPORT_KEY));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadTickets();
  }, [isOpen]);

  useEffect(() => {
    const liveId = liveDetail?.ticket.id;
    if (!liveId || !liveTicketIsOpen) return;

    const timer = window.setInterval(() => {
      void openTicket(liveId, { silent: true, activate: false });
      if (isOpen) void loadTickets(true);
    }, isOpen ? 2200 : 8000);

    return () => window.clearInterval(timer);
  }, [liveDetail?.ticket.id, liveTicketIsOpen, isOpen, detail?.ticket.id]);

  useEffect(() => {
    if (!isOpen || view !== 'chat' || !detail) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, view, detail?.messages.length]);

  const closeCenter = () => {
    setView('home');
    setSelectedTopic(null);
    setQuestionIndex(0);
    setAnswers({});
    setScreenshots([]);
    setError('');
    setFileError('');
    onClose();
  };

  const startFlow = (topic: TopicId) => {
    setSelectedTopic(topic);
    setAnswers({});
    setQuestionIndex(0);
    setScreenshots([]);
    setFileError('');
    setError('');
    setView('questions');
  };

  const goBack = () => {
    setError('');
    if (view === 'topics' || view === 'cases') {
      setView('home');
      return;
    }
    if (view === 'questions') {
      if (questionIndex > 0) setQuestionIndex((value) => value - 1);
      else setView('topics');
      return;
    }
    if (view === 'review') {
      setQuestionIndex(Math.max(0, (flow?.questions.length || 1) - 1));
      setView('questions');
      return;
    }
    if (view === 'chat') {
      setView('cases');
      setDetail(null);
    }
  };

  const answerChoice = (value: string) => {
    if (!currentQuestion || !flow) return;
    setAnswers((previous) => ({ ...previous, [currentQuestion.id]: value }));
    if (questionIndex >= flow.questions.length - 1) setView('review');
    else setQuestionIndex((index) => index + 1);
  };

  const advanceTextQuestion = () => {
    if (!currentQuestion || !flow) return;
    const value = String(answers[currentQuestion.id] || '').trim();
    if (!currentQuestion.optional && !value) return;
    if (questionIndex >= flow.questions.length - 1) setView('review');
    else setQuestionIndex((index) => index + 1);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setFileError('');
    const incoming = Array.from(files);
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];

    for (const file of incoming) {
      if (!allowed.includes(file.type)) {
        setFileError('Envie apenas capturas PNG, JPG ou WebP.');
        return;
      }
      if (file.size > 1_600_000) {
        setFileError('Cada captura pode ter no máximo 1,5 MB.');
        return;
      }
    }

    setScreenshots((previous) => [...previous, ...incoming].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const buildInitialMessage = () => {
    if (!flow) return '';
    const lines = [flow.label, ''];
    flow.questions.forEach((question) => {
      const value = String(answers[question.id] || '').trim();
      if (value) lines.push(`${question.prompt}\n${value}`, '');
    });
    return lines.join('\n').trim();
  };

  const startLiveChat = async () => {
    if (!flow || sending) return;
    setSending(true);
    setError('');
    try {
      const attachments = await Promise.all(screenshots.map(fileToAttachment));
      const next = await createSupportTicket({
        subject: flow.subject,
        category: flow.category,
        supportType: flow.supportType,
        message: buildInitialMessage(),
        attachments,
      });
      setDetail(next);
      setLiveDetail(next);
      setView('chat');
      window.localStorage.setItem(LIVE_SUPPORT_KEY, String(next.ticket.id));
      await loadTickets(true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar o chat com o suporte.');
    } finally {
      setSending(false);
    }
  };

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail || !reply.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const next = await replySupportTicket(detail.ticket.id, reply.trim());
      setDetail(next);
      setLiveDetail(next);
      setReply('');
      window.localStorage.setItem(LIVE_SUPPORT_KEY, String(next.ticket.id));
      await loadTickets(true);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  const renderHome = () => (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pb-8 pt-14 sm:px-10 sm:pt-20">
      <div className="flex h-[86px] w-[86px] items-center justify-center rounded-[28px] border border-[#ffb18a]/55 bg-[#fff0e8] shadow-[0_18px_55px_rgba(255,106,38,.12)]">
        <SupportMark className="h-12 w-12" />
      </div>
      <h2 className="mt-7 text-center text-[28px] font-semibold tracking-[-0.035em] text-[#241b17]">
        Central de ajuda Scoutly.
      </h2>
      <p className="mt-3 max-w-[430px] text-center text-[13px] leading-6 text-[#76665e]">
        Encontre ajuda, acompanhe seus casos e converse com a equipe Scoutly quando precisar.
      </p>

      <div className="mt-9 grid w-full max-w-[520px] gap-3">
        <button
          type="button"
          onClick={() => setView('topics')}
          className="group flex min-h-[82px] items-center gap-4 rounded-[20px] border border-[#f2c8b4] bg-white px-5 text-left shadow-[0_7px_24px_rgba(70,35,20,.06)] transition hover:-translate-y-0.5 hover:border-[#ff9c6b] hover:shadow-[0_12px_34px_rgba(255,106,38,.11)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e8] text-[#ef5b18]">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[14px] font-semibold text-[#2a211d]">Falar com o suporte</strong>
            <span className="mt-1 block text-[11px] leading-5 text-[#88766c]">Conte o que aconteceu e inicie um chat ao vivo.</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#b49b8f] transition group-hover:translate-x-0.5 group-hover:text-[#ef5b18]" />
        </button>

        <button
          type="button"
          onClick={() => {
            setView('cases');
            void loadTickets();
          }}
          className="group flex min-h-[82px] items-center gap-4 rounded-[20px] border border-[#f2c8b4] bg-white px-5 text-left shadow-[0_7px_24px_rgba(70,35,20,.06)] transition hover:-translate-y-0.5 hover:border-[#ff9c6b] hover:shadow-[0_12px_34px_rgba(255,106,38,.11)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e8] text-[#ef5b18]">
            <ListChecks className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[14px] font-semibold text-[#2a211d]">Meus casos de suporte</strong>
            <span className="mt-1 block text-[11px] leading-5 text-[#88766c]">Veja conversas abertas e acompanhe respostas anteriores.</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#b49b8f] transition group-hover:translate-x-0.5 group-hover:text-[#ef5b18]" />
        </button>
      </div>
    </div>
  );

  const renderTopics = () => (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-8 sm:px-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d86a37]">Falar com o suporte</p>
      <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.03em] text-[#241b17]">Como podemos te ajudar?</h2>
      <p className="mt-2 text-[12px] leading-5 text-[#806f66]">Escolha a opção mais próxima do que você precisa.</p>

      <div className="mt-7 space-y-2.5">
        {(Object.values(FLOWS) as Flow[]).map((item) => {
          const Icon = item.icon;
          const urgent = item.id === 'hacked';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => startFlow(item.id)}
              className={`group flex w-full items-center gap-4 rounded-[18px] border bg-white px-4 py-4 text-left transition hover:-translate-y-px hover:shadow-[0_10px_28px_rgba(255,106,38,.08)] ${urgent ? 'border-[#efb0a2] hover:border-[#dc725d]' : 'border-[#efd8cc] hover:border-[#ffab80]'}`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${urgent ? 'bg-[#fff0ed] text-[#ce4832]' : 'bg-[#fff2eb] text-[#ef5b18]'}`}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[13px] font-semibold text-[#2d231f]">{item.label}</strong>
                <span className="mt-1 block text-[10px] leading-4 text-[#8a776d]">{item.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#b9a298] transition group-hover:translate-x-0.5 group-hover:text-[#ef5b18]" />
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderQuestions = () => {
    if (!flow || !currentQuestion) return null;
    const currentAnswer = String(answers[currentQuestion.id] || '');
    const canContinue = currentQuestion.optional || Boolean(currentAnswer.trim());
    const progress = ((questionIndex + 1) / flow.questions.length) * 100;

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="h-1 w-full bg-[#f2dfd5]">
          <div className="h-full rounded-r-full bg-[#ff7a3b] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-8 sm:px-10">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-semibold text-[#d86a37]">{flow.label}</p>
            <span className="text-[10px] text-[#a28f85]">{questionIndex + 1} de {flow.questions.length}</span>
          </div>
          <h2 className="mt-5 max-w-[520px] text-[24px] font-semibold leading-[1.22] tracking-[-0.03em] text-[#241b17]">
            {currentQuestion.prompt}
          </h2>

          {currentQuestion.type === 'choice' ? (
            <div className="mt-7 space-y-2.5">
              {currentQuestion.options?.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => answerChoice(option)}
                  className="group flex min-h-[54px] w-full items-center justify-between gap-4 rounded-2xl border border-[#ecd5ca] bg-white px-4 text-left text-[12px] font-medium text-[#3c302a] transition hover:border-[#ff9d6e] hover:bg-[#fffaf7]"
                >
                  <span>{option}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#baa49a] group-hover:text-[#ef5b18]" />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-7">
              <textarea
                autoFocus
                value={currentAnswer}
                onChange={(event) => setAnswers((previous) => ({ ...previous, [currentQuestion.id]: event.target.value }))}
                placeholder={currentQuestion.placeholder}
                maxLength={5000}
                className="min-h-[155px] w-full resize-none rounded-[18px] border border-[#e7d0c4] bg-white p-4 text-[13px] leading-6 text-[#30251f] outline-none placeholder:text-[#b6a59c] focus:border-[#ff9a68] focus:ring-4 focus:ring-[#ffb38d]/15"
              />
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={advanceTextQuestion}
                  className="h-11 rounded-xl bg-[#ff6a26] px-5 text-[12px] font-semibold text-white shadow-[0_8px_20px_rgba(255,106,38,.20)] transition hover:bg-[#f45d19] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderReview = () => {
    if (!flow) return null;
    const isUrgent = flow.id === 'hacked';

    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-8 sm:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d86a37]">Pronto para falar com a equipe</p>
        <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#241b17]">Inicie seu chat ao vivo.</h2>
        <p className="mt-2 max-w-[520px] text-[12px] leading-5 text-[#806f66]">
          Vamos abrir um caso com as respostas que você forneceu para que o agente já receba o contexto da conversa.
        </p>

        {isUrgent && (
          <div className="mt-6 flex items-start gap-3 rounded-[18px] border border-[#e4a69a] bg-[#fff1ed] p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#c94d37]" />
            <div>
              <strong className="text-[12px] font-semibold text-[#8c2f22]">Atendimento urgente</strong>
              <p className="mt-1 text-[10px] leading-5 text-[#9d594d]">Este caso será aberto como prioridade Urgente com a tag Hacked Asset {'{Urgent}'}.</p>
            </div>
          </div>
        )}

        {flow.allowScreenshots && (
          <div className="mt-6 rounded-[20px] border border-[#ecd5ca] bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <strong className="text-[12px] font-semibold text-[#342923]">Capturas de tela</strong>
                <p className="mt-1 text-[10px] leading-4 text-[#8f7b71]">Opcional. Até 3 imagens PNG, JPG ou WebP de 1,5 MB cada.</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-[#eccbbb] bg-[#fff8f4] px-3 text-[10px] font-semibold text-[#d75317] transition hover:border-[#ff9d6e]"
              >
                <UploadCloud className="h-3.5 w-3.5" /> Adicionar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => handleFiles(event.target.files)}
              />
            </div>

            {screenshots.length > 0 && (
              <div className="mt-3 space-y-2">
                {screenshots.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-[#faf6f3] px-3 py-2.5">
                    <FileImage className="h-4 w-4 shrink-0 text-[#ef6a2b]" />
                    <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-[#564840]">{file.name}</span>
                    <span className="text-[9px] text-[#a18d83]">{Math.ceil(file.size / 1024)} KB</span>
                    <button type="button" onClick={() => setScreenshots((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="text-[#ad9589] hover:text-[#bd4d38]" aria-label="Remover captura">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {fileError && <p className="mt-3 text-[10px] text-[#be4534]">{fileError}</p>}
          </div>
        )}

        <button
          type="button"
          onClick={() => void startLiveChat()}
          disabled={sending}
          className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#ff6a26] px-5 text-[12px] font-semibold text-white shadow-[0_10px_28px_rgba(255,106,38,.22)] transition hover:bg-[#f45d19] disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          {sending ? 'Abrindo caso...' : 'Iniciar chat ao vivo'}
        </button>
      </div>
    );
  };

  const renderCases = () => (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-8 sm:px-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d86a37]">Histórico</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#241b17]">Meus casos de suporte</h2>
          <p className="mt-2 text-[11px] text-[#89766c]">As respostas da equipe aparecem automaticamente.</p>
        </div>
        <button type="button" onClick={() => setView('topics')} className="rounded-xl border border-[#eccfc1] bg-white px-3 py-2 text-[10px] font-semibold text-[#d85b20]">Novo caso</button>
      </div>

      <div className="mt-7 space-y-2.5">
        {loading && tickets.length === 0 ? (
          <div className="flex h-40 items-center justify-center gap-2 text-[11px] text-[#9a877d]"><Loader2 className="h-4 w-4 animate-spin" /> Carregando casos...</div>
        ) : tickets.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[#e7d0c5] bg-white/60 px-7 py-12 text-center">
            <MessageCircle className="mx-auto h-6 w-6 text-[#c5a99a]" />
            <h3 className="mt-3 text-[12px] font-semibold text-[#493b34]">Nenhum caso ainda</h3>
            <p className="mt-1 text-[10px] leading-5 text-[#927e74]">Quando você falar com o suporte, seus casos aparecerão aqui.</p>
          </div>
        ) : tickets.map((ticket) => {
          const hacked = ticket.tags?.includes('Hacked Asset {Urgent}');
          return (
            <button
              key={ticket.id}
              type="button"
              onClick={() => void openTicket(ticket.id)}
              className="group w-full rounded-[18px] border border-[#ead5ca] bg-white p-4 text-left transition hover:border-[#ffad85] hover:shadow-[0_9px_26px_rgba(70,35,20,.05)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-semibold text-[#ab968b]">#{ticket.id}</span>
                    <span className="rounded-full bg-[#fff0e8] px-2 py-1 text-[8px] font-semibold text-[#dc5c20]">{STATUS_LABEL[ticket.status] || ticket.status}</span>
                    {hacked && <span className="rounded-full bg-[#fff0ed] px-2 py-1 text-[8px] font-semibold text-[#ba4432]">Hacked Asset {'{Urgent}'}</span>}
                  </div>
                  <h3 className="mt-2 truncate text-[12px] font-semibold text-[#332822]">{ticket.subject}</h3>
                  <p className="mt-1 text-[9px] text-[#9b887e]">Atualizado em {formatDate(ticket.updated_at)}</p>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-[#bba69b] group-hover:text-[#e96122]" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderChat = () => {
    if (!detail || !activeTicket) return null;
    const hacked = activeTicket.tags?.includes('Hacked Asset {Urgent}');
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[#eadbd3] bg-white/75 px-6 py-4 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d3622e]">Caso #{activeTicket.id}</span>
                {hacked && <span className="rounded-full bg-[#fff0ed] px-2 py-1 text-[8px] font-semibold text-[#b94332]">Hacked Asset {'{Urgent}'}</span>}
              </div>
              <h2 className="mt-1 truncate text-[15px] font-semibold text-[#2c211c]">{activeTicket.subject}</h2>
            </div>
            <span className="shrink-0 rounded-full border border-[#efd3c5] bg-[#fff8f4] px-2.5 py-1 text-[8px] font-semibold text-[#b85a2d]">{STATUS_LABEL[activeTicket.status] || activeTicket.status}</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fffaf7] px-5 py-5 sm:px-8">
          {detail.attachments && detail.attachments.length > 0 && (
            <div className="mb-5 rounded-[18px] border border-[#ead5ca] bg-white p-3">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#a87963]">Capturas anexadas</p>
              <div className="grid grid-cols-3 gap-2">
                {detail.attachments.map((attachment) => (
                  <a key={attachment.id} href={attachment.data_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-[#ead8cf] bg-[#faf5f2]">
                    <img src={attachment.data_url} alt={attachment.file_name} className="h-20 w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {detail.messages.map((message) => {
              const fromCustomer = message.author_type === 'customer';
              return (
                <div key={message.id} className={`flex ${fromCustomer ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[84%] rounded-[19px] px-4 py-3 shadow-sm ${fromCustomer ? 'rounded-br-md bg-[#ff7a3b] text-white' : 'rounded-bl-md border border-[#ead9d0] bg-white text-[#40332d]'}`}>
                    {!fromCustomer && <div className="mb-1.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#e56529]">Suporte Scoutly</div>}
                    <p className="whitespace-pre-wrap text-[11px] leading-5">{message.body}</p>
                    <div className={`mt-1.5 text-right text-[8px] ${fromCustomer ? 'text-white/65' : 'text-[#a18c82]'}`}>{formatDate(message.created_at)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={submitReply} className="border-t border-[#eadbd3] bg-white p-4 sm:px-6">
          {['RESOLVED', 'CLOSED'].includes(activeTicket.status) && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#bdddc9] bg-[#f2fbf5] px-3 py-2 text-[9px] text-[#438159]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Se você responder, o caso será reaberto.
            </div>
          )}
          <div className="flex items-end gap-2 rounded-[17px] border border-[#e8d4ca] bg-[#fffaf7] p-2 focus-within:border-[#ff9d6d] focus-within:ring-4 focus-within:ring-[#ffb48f]/12">
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Digite sua mensagem..."
              rows={2}
              className="max-h-32 min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2 text-[11px] leading-5 text-[#30251f] outline-none placeholder:text-[#b5a198]"
            />
            <button
              type="submit"
              disabled={!reply.trim() || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff6a26] text-white transition hover:bg-[#f45d19] disabled:opacity-35"
              aria-label="Enviar mensagem"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <>
      <div className={`fixed inset-0 z-[130] transition ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!isOpen}>
        <button
          type="button"
          aria-label="Fechar Central de ajuda"
          onClick={closeCenter}
          className={`absolute inset-0 bg-black/55 backdrop-blur-[3px] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        />

        <section className={`absolute left-1/2 top-1/2 flex h-[min(790px,92vh)] w-[min(720px,94vw)] -translate-x-1/2 flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[#fffaf6] text-[#2b211c] shadow-[0_35px_110px_rgba(0,0,0,.42)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? '-translate-y-1/2 scale-100 opacity-100' : '-translate-y-[47%] scale-[.985] opacity-0'}`}>
          <header className="flex h-[66px] shrink-0 items-center justify-between border-b border-[#eadbd3] bg-white/65 px-5 backdrop-blur-xl sm:px-7">
            <div className="flex items-center gap-3">
              {view !== 'home' && (
                <button type="button" onClick={goBack} className="flex h-9 w-9 items-center justify-center rounded-xl text-[#816d63] transition hover:bg-[#fff0e8] hover:text-[#d75b20]" aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex items-center gap-2.5">
                <SupportMark className="h-6 w-6" />
                <span className="text-[12px] font-semibold text-[#382b25]">Scoutly Support</span>
              </div>
            </div>
            <button type="button" onClick={closeCenter} className="flex h-9 w-9 items-center justify-center rounded-xl text-[#99847a] transition hover:bg-[#f9eee8] hover:text-[#4d3b32]" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </header>

          {error && (
            <div className="mx-6 mt-4 flex items-start gap-2 rounded-2xl border border-[#e8b2a8] bg-[#fff1ee] px-4 py-3 text-[10px] leading-5 text-[#a13d2e] sm:mx-8">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {view === 'home' && renderHome()}
          {view === 'topics' && renderTopics()}
          {view === 'questions' && renderQuestions()}
          {view === 'review' && renderReview()}
          {view === 'cases' && renderCases()}
          {view === 'chat' && renderChat()}
        </section>
      </div>

      {!isOpen && liveDetail && liveTicketIsOpen && (
        <button
          type="button"
          onClick={() => {
            setDetail(liveDetail);
            setView('chat');
            onOpen();
          }}
          className="fixed bottom-5 right-5 z-[95] flex w-[min(340px,calc(100vw-32px))] items-center gap-3 rounded-[18px] border border-[#ffd1bb] bg-[#fffaf6]/95 p-3.5 text-left shadow-[0_18px_55px_rgba(45,25,16,.20)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#ffab83]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#ffede3] text-[#ef5e1c]">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <strong className="text-[11px] font-semibold text-[#382b25]">Suporte Scoutly</strong>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="mt-1 block truncate text-[10px] text-[#8c786e]">Voltar ao caso #{liveDetail.ticket.id} · {STATUS_LABEL[liveDetail.ticket.status] || liveDetail.ticket.status}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#b69e92]" />
        </button>
      )}
    </>
  );
}
