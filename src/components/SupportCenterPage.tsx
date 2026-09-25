import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
  MessageCircle,
  Paperclip,
  Send,
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

type View = 'home' | 'topics' | 'questions' | 'review' | 'cases' | 'chat';
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
    description: 'Cobrança, fatura, alteração de plano, cancelamento ou pagamento.',
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
        placeholder: 'Descreva o problema com o máximo de contexto possível.',
      },
      {
        id: 'billing_reference',
        prompt: 'Existe alguma cobrança, data, valor ou plano específico que devemos verificar?',
        type: 'text',
        placeholder: 'Opcional: valor, data, plano ou outra referência.',
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
    description: 'Algo na plataforma não está funcionando como deveria.',
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
        placeholder: 'Explique a ação que estava tentando concluir.',
      },
      {
        id: 'bug_result',
        prompt: 'O que aconteceu de fato?',
        type: 'text',
        placeholder: 'Conte o resultado, erro ou comportamento inesperado.',
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
    description: 'Orientação para concluir uma tarefa ou entender um recurso.',
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
        placeholder: 'Explique o resultado que você quer alcançar.',
      },
      {
        id: 'help_blocker',
        prompt: 'Em qual etapa você ficou travado?',
        type: 'text',
        placeholder: 'Conte até onde conseguiu chegar e o que impediu de continuar.',
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
        placeholder: 'Descreva a ideia de forma prática.',
      },
      {
        id: 'feedback_problem',
        prompt: 'Que problema isso resolveria para você?',
        type: 'text',
        placeholder: 'Conte como isso melhoraria seu trabalho.',
      },
    ],
  },
  hacked: {
    id: 'hacked',
    label: 'Minha conta foi invadida',
    subject: 'Possível invasão de conta',
    category: 'ACCOUNT',
    supportType: 'HACKED_ASSET',
    description: 'Acesso não reconhecido, alterações inesperadas ou atividade suspeita.',
    allowScreenshots: true,
    questions: [
      {
        id: 'hacked_reason',
        prompt: 'Por que você acredita que sua conta foi invadida?',
        type: 'text',
        placeholder: 'Descreva o acesso desconhecido, alteração ou atividade suspeita.',
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

export default function SupportCenterPage({ isOpen, onClose, onOpen }: Props) {
  const [view, setView] = useState<View>('home');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [liveDetail, setLiveDetail] = useState<SupportTicketDetail | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicId | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
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

  const goBack = () => {
    setError('');
    if (view === 'home') {
      closeCenter();
      return;
    }
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

  const startFlow = (topic: TopicId) => {
    setSelectedTopic(topic);
    setQuestionIndex(0);
    setAnswers({});
    setScreenshots([]);
    setFileError('');
    setError('');
    setView('questions');
  };

  const answerChoice = (value: string) => {
    if (!currentQuestion || !flow) return;
    setAnswers((previous) => ({ ...previous, [currentQuestion.id]: value }));
    if (questionIndex >= flow.questions.length - 1) setView('review');
    else setQuestionIndex((value) => value + 1);
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
        setFileError('Envie apenas PNG, JPG ou WebP.');
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

  const pageTitle =
    view === 'home' ? 'Central de ajuda' :
    view === 'topics' ? 'Preciso de ajuda' :
    view === 'cases' ? 'Meus casos de suporte' :
    view === 'chat' ? `Caso #${activeTicket?.id || ''}` :
    flow?.subject || 'Suporte';

  const renderHome = () => (
    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-6 pb-20 pt-20 sm:px-10 sm:pt-28 lg:px-12">
      <div className="max-w-[760px]">
        <div className="mb-5 h-1 w-9 bg-[#ff6a26]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c7f83]">Scoutly Support</p>
        <h1 className="mt-4 text-[38px] font-semibold tracking-[-0.045em] text-[#202124] sm:text-[46px]">
          Central de ajuda
        </h1>
        <p className="mt-4 max-w-[560px] text-[14px] leading-6 text-[#6f7377]">
          Fale com a equipe Scoutly ou acompanhe um atendimento que já está em andamento.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setView('topics')}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#242629] px-4 text-[12px] font-semibold text-white transition hover:bg-[#161718]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a26]" />
            Preciso de ajuda
          </button>
          <button
            type="button"
            onClick={() => {
              setView('cases');
              void loadTickets();
            }}
            className="inline-flex h-11 items-center rounded-lg border border-[#d7d9dc] bg-white px-4 text-[12px] font-semibold text-[#34373a] transition hover:border-[#bfc2c6] hover:bg-[#f7f7f7]"
          >
            Meus casos de suporte
          </button>
        </div>
      </div>
    </main>
  );

  const renderTopics = () => (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pb-20 pt-14 sm:px-10 sm:pt-20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b8e92]">Novo atendimento</p>
      <h1 className="mt-3 text-[31px] font-semibold tracking-[-0.035em] text-[#232527]">Como podemos te ajudar?</h1>
      <p className="mt-2 text-[13px] text-[#777b7f]">Selecione o assunto mais próximo do que você precisa.</p>

      <div className="mt-8 overflow-hidden rounded-xl border border-[#e1e3e5] bg-white">
        {(Object.values(FLOWS) as Flow[]).map((item, index) => {
          const urgent = item.id === 'hacked';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => startFlow(item.id)}
              className={`group flex w-full items-center gap-5 px-5 py-4 text-left transition hover:bg-[#f7f7f6] ${index > 0 ? 'border-t border-[#eceeef]' : ''}`}
            >
              <span className="w-6 shrink-0 text-[11px] font-medium tabular-nums text-[#9a9da1]">{String(index + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <strong className="text-[13px] font-semibold text-[#2f3235]">{item.label}</strong>
                  {urgent && <span className="rounded bg-[#fff1ea] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#d85b21]">Urgente</span>}
                </span>
                <span className="mt-1 block text-[11px] leading-5 text-[#818589]">{item.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#a7aaad] transition group-hover:translate-x-0.5 group-hover:text-[#ff6a26]" />
            </button>
          );
        })}
      </div>
    </main>
  );

  const renderQuestions = () => {
    if (!flow || !currentQuestion) return null;
    const currentAnswer = String(answers[currentQuestion.id] || '');
    const canContinue = currentQuestion.optional || Boolean(currentAnswer.trim());
    const progress = ((questionIndex + 1) / flow.questions.length) * 100;

    return (
      <main className="mx-auto w-full max-w-[760px] flex-1 px-6 pb-20 pt-12 sm:px-10 sm:pt-16">
        <div className="h-1 w-full bg-[#e5e7e9]">
          <div className="h-full bg-[#ff6a26] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-7 flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold text-[#6f7377]">{flow.label}</p>
          <span className="text-[10px] text-[#9a9da1]">{questionIndex + 1} de {flow.questions.length}</span>
        </div>
        <h1 className="mt-5 text-[28px] font-semibold leading-[1.25] tracking-[-0.035em] text-[#242628]">{currentQuestion.prompt}</h1>

        {currentQuestion.type === 'choice' ? (
          <div className="mt-8 overflow-hidden rounded-xl border border-[#dfe1e3] bg-white">
            {currentQuestion.options?.map((option, index) => (
              <button
                key={option}
                type="button"
                onClick={() => answerChoice(option)}
                className={`group flex min-h-[54px] w-full items-center justify-between gap-4 px-4 text-left text-[12px] font-medium text-[#333639] transition hover:bg-[#f6f7f7] ${index > 0 ? 'border-t border-[#eceeef]' : ''}`}
              >
                <span>{option}</span>
                <ChevronRight className="h-4 w-4 text-[#a4a7aa] group-hover:text-[#ff6a26]" />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <textarea
              autoFocus
              value={currentAnswer}
              onChange={(event) => setAnswers((previous) => ({ ...previous, [currentQuestion.id]: event.target.value }))}
              placeholder={currentQuestion.placeholder}
              maxLength={5000}
              className="min-h-[180px] w-full resize-y rounded-xl border border-[#d9dcde] bg-white p-4 text-[13px] leading-6 text-[#2f3235] outline-none placeholder:text-[#a4a7aa] focus:border-[#ff9a6b] focus:ring-4 focus:ring-[#ff6a26]/[0.07]"
            />
            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-[10px] text-[#96999d]">{currentQuestion.optional ? 'Opcional' : 'Obrigatório'}</span>
              <button
                type="button"
                disabled={!canContinue}
                onClick={advanceTextQuestion}
                className="h-10 rounded-lg bg-[#242629] px-4 text-[11px] font-semibold text-white transition hover:bg-[#161718] disabled:cursor-not-allowed disabled:opacity-35"
              >
                Continuar
              </button>
            </div>
          </div>
        )}
      </main>
    );
  };

  const renderReview = () => {
    if (!flow) return null;
    return (
      <main className="mx-auto w-full max-w-[820px] flex-1 px-6 pb-20 pt-12 sm:px-10 sm:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b8e92]">Revisão do caso</p>
        <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.035em] text-[#252729]">Tudo certo para falar com o suporte?</h1>
        <p className="mt-2 text-[13px] text-[#777b7f]">Estas informações serão enviadas ao agente antes do chat começar.</p>

        <div className="mt-8 rounded-xl border border-[#dfe1e3] bg-white p-5">
          <div className="border-b border-[#eceeef] pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#919498]">Assunto</p>
            <p className="mt-2 text-[14px] font-semibold text-[#2e3134]">{flow.subject}</p>
          </div>
          <div className="divide-y divide-[#eceeef]">
            {flow.questions.map((question) => {
              const value = String(answers[question.id] || '').trim();
              if (!value) return null;
              return (
                <div key={question.id} className="py-4">
                  <p className="text-[10px] font-semibold text-[#83878b]">{question.prompt}</p>
                  <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-[#35383b]">{value}</p>
                </div>
              );
            })}
          </div>
        </div>

        {flow.allowScreenshots && (
          <div className="mt-5 rounded-xl border border-[#dfe1e3] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold text-[#34373a]">Capturas de tela</p>
                <p className="mt-1 text-[10px] text-[#8b8e92]">Opcional · até 3 imagens, 1,5 MB cada.</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d7d9dc] bg-white px-3 text-[10px] font-semibold text-[#44474a] hover:bg-[#f6f6f6]"
              >
                <Paperclip className="h-3.5 w-3.5" /> Adicionar
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
            </div>
            {fileError && <p className="mt-3 text-[10px] text-[#cb4c2d]">{fileError}</p>}
            {screenshots.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {screenshots.map((file, index) => (
                  <span key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded-md bg-[#f1f2f3] px-2.5 py-1.5 text-[10px] text-[#55595c]">
                    <span className="max-w-[180px] truncate">{file.name}</span>
                    <button type="button" onClick={() => setScreenshots((current) => current.filter((_, i) => i !== index))} className="text-[#8d9094] hover:text-[#333639]" aria-label="Remover captura"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void startLiveChat()}
            disabled={sending}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#242629] px-5 text-[12px] font-semibold text-white transition hover:bg-[#161718] disabled:opacity-40"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Iniciar chat ao vivo
          </button>
        </div>
      </main>
    );
  };

  const renderCases = () => (
    <main className="mx-auto w-full max-w-[980px] flex-1 px-6 pb-20 pt-14 sm:px-10 sm:pt-20">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b8e92]">Histórico</p>
          <h1 className="mt-3 text-[31px] font-semibold tracking-[-0.035em] text-[#232527]">Meus casos de suporte</h1>
        </div>
        <button type="button" onClick={() => setView('topics')} className="h-10 rounded-lg bg-[#242629] px-4 text-[11px] font-semibold text-white hover:bg-[#161718]">Novo caso</button>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-[#dfe1e3] bg-white">
        {loading && tickets.length === 0 ? (
          <div className="flex h-36 items-center justify-center gap-2 text-[11px] text-[#8c9094]"><Loader2 className="h-4 w-4 animate-spin" /> Carregando casos...</div>
        ) : tickets.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[13px] font-semibold text-[#3a3d40]">Nenhum caso de suporte</p>
            <p className="mt-2 text-[11px] text-[#8a8e92]">Quando você iniciar um atendimento, ele aparecerá aqui.</p>
          </div>
        ) : tickets.map((ticket, index) => {
          const hacked = ticket.tags?.includes('Hacked Asset {Urgent}');
          return (
            <button
              key={ticket.id}
              type="button"
              onClick={() => void openTicket(ticket.id)}
              className={`group flex w-full items-center gap-5 px-5 py-4 text-left transition hover:bg-[#f7f7f6] ${index > 0 ? 'border-t border-[#eceeef]' : ''}`}
            >
              <span className="w-12 shrink-0 text-[11px] font-semibold tabular-nums text-[#8f9397]">#{ticket.id}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="truncate text-[13px] font-semibold text-[#313437]">{ticket.subject}</strong>
                  {hacked && <span className="rounded bg-[#fff1ea] px-1.5 py-0.5 text-[8px] font-bold text-[#d85b21]">Hacked Asset {'{Urgent}'}</span>}
                </span>
                <span className="mt-1 block text-[10px] text-[#8d9195]">Atualizado em {formatDate(ticket.updated_at)}</span>
              </span>
              <span className="shrink-0 rounded-md bg-[#f1f2f3] px-2 py-1 text-[9px] font-semibold text-[#64686c]">{STATUS_LABEL[ticket.status] || ticket.status}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#aaaeb1] group-hover:text-[#ff6a26]" />
            </button>
          );
        })}
      </div>
    </main>
  );

  const renderChat = () => {
    if (!detail || !activeTicket) return null;
    const hacked = activeTicket.tags?.includes('Hacked Asset {Urgent}');
    return (
      <main className="mx-auto flex w-full max-w-[1060px] flex-1 flex-col px-4 pb-5 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
        <div className="flex items-start justify-between gap-6 border-b border-[#dfe1e3] pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b8e92]">Caso #{activeTicket.id}</span>
              {hacked && <span className="rounded bg-[#fff1ea] px-1.5 py-0.5 text-[8px] font-bold text-[#d85b21]">Hacked Asset {'{Urgent}'}</span>}
            </div>
            <h1 className="mt-2 truncate text-[23px] font-semibold tracking-[-0.025em] text-[#26282a]">{activeTicket.subject}</h1>
          </div>
          <span className="shrink-0 rounded-md border border-[#d9dcde] bg-white px-2.5 py-1.5 text-[9px] font-semibold text-[#666a6e]">{STATUS_LABEL[activeTicket.status] || activeTicket.status}</span>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#dfe1e3] bg-white">
          {detail.attachments && detail.attachments.length > 0 && (
            <div className="border-b border-[#eceeef] p-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8b8e92]">Anexos do caso</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.attachments.map((attachment) => (
                  <a key={attachment.id} href={attachment.data_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-[#dfe1e3] bg-[#f7f7f7]">
                    <img src={attachment.data_url} alt={attachment.file_name} className="h-16 w-24 object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-5 p-5 sm:p-6">
            {detail.messages.map((message) => {
              const fromCustomer = message.author_type === 'customer';
              return (
                <div key={message.id} className={`flex ${fromCustomer ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-xl px-4 py-3 ${fromCustomer ? 'bg-[#2b2d30] text-white' : 'border border-[#e0e2e4] bg-[#f7f7f6] text-[#34373a]'}`}>
                    {!fromCustomer && <div className="mb-2 text-[8px] font-bold uppercase tracking-[0.12em] text-[#ff6a26]">Suporte Scoutly</div>}
                    <p className="whitespace-pre-wrap text-[12px] leading-5">{message.body}</p>
                    <div className={`mt-2 text-right text-[8px] ${fromCustomer ? 'text-white/55' : 'text-[#93979b]'}`}>{formatDate(message.created_at)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={submitReply} className="mt-4">
          <div className="flex items-end gap-2 rounded-xl border border-[#d9dcde] bg-white p-2 focus-within:border-[#ff9c70] focus-within:ring-4 focus-within:ring-[#ff6a26]/[0.06]">
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Digite sua mensagem..."
              rows={2}
              className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-[12px] leading-5 text-[#303336] outline-none placeholder:text-[#a1a5a9]"
            />
            <button type="submit" disabled={!reply.trim() || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#242629] text-white transition hover:bg-[#161718] disabled:opacity-35" aria-label="Enviar mensagem">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </main>
    );
  };

  return (
    <>
      <div className={`fixed inset-0 z-[130] flex flex-col bg-[#f5f6f6] text-[#2d3033] transition-opacity duration-200 ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={!isOpen}>
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#dfe1e3] bg-white px-4 sm:px-7">
          <div className="flex items-center gap-3">
            <button type="button" onClick={goBack} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6e7276] transition hover:bg-[#f1f2f3] hover:text-[#2f3235]" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-5 w-[3px] bg-[#ff6a26]" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#94979b]">Scoutly</p>
              <p className="mt-0.5 text-[12px] font-semibold text-[#333639]">{pageTitle}</p>
            </div>
          </div>
          <button type="button" onClick={closeCenter} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#777b7f] transition hover:bg-[#f1f2f3] hover:text-[#2f3235]" aria-label="Fechar suporte">
            <X className="h-4 w-4" />
          </button>
        </header>

        {error && (
          <div className="mx-auto mt-5 flex w-[calc(100%-32px)] max-w-[900px] items-start gap-2 rounded-lg border border-[#efb9a3] bg-[#fff5f0] px-4 py-3 text-[10px] leading-5 text-[#9d4425]">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {view === 'home' && renderHome()}
          {view === 'topics' && renderTopics()}
          {view === 'questions' && renderQuestions()}
          {view === 'review' && renderReview()}
          {view === 'cases' && renderCases()}
          {view === 'chat' && renderChat()}
        </div>
      </div>

      {!isOpen && liveDetail && liveTicketIsOpen && (
        <button
          type="button"
          onClick={() => {
            setDetail(liveDetail);
            setView('chat');
            onOpen();
          }}
          className="fixed bottom-5 right-5 z-[95] flex w-[min(310px,calc(100vw-32px))] items-center gap-3 rounded-xl border border-[#d9dcde] bg-white p-3 text-left shadow-[0_14px_38px_rgba(0,0,0,.16)] transition hover:-translate-y-0.5 hover:border-[#c7cace]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f1f2f3] text-[#ff6a26]">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <strong className="text-[10px] font-semibold text-[#34373a]">Suporte Scoutly</strong>
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a26]" />
            </span>
            <span className="mt-1 block truncate text-[9px] text-[#85898d]">Caso #{liveDetail.ticket.id} · {STATUS_LABEL[liveDetail.ticket.status] || liveDetail.ticket.status}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#a3a6aa]" />
        </button>
      )}
    </>
  );
}
