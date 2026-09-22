import { useState, useRef, useEffect, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  X,
  User,
  Plus,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Copy,
  Info,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Business, LeadStatus } from '../types';
import { sendAIChatMessage, fetchContextualSuggestions, getWhatsAppLink } from '../services/api';
import {
  getRecommendationPromptContext,
  RECOMMENDATION_SIGNAL_EVENT,
} from '../utils/recommendations';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  matchedBusinessIds?: string[];
  timestamp: string;
}

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: Business[];
  currentRegionName: string;
  onSelectBusiness: (business: Business) => void;
  onUpdateLeadStatus: (businessId: string, status: LeadStatus) => void;
  onApplyNewRegion?: (region: {
    name: string;
    center: { lat: number; lng: number };
    businesses?: Business[];
  }) => void;
}

const THINKING_PHRASES = [
  'Pensando...',
  'Explorando o mapa...',
  'Filtrando dados...',
  'Otimizando os resultados...',
  'Buscando informações...',
];

function AIAssistantDrawer({
  isOpen,
  onClose,
  businesses,
  currentRegionName,
  onSelectBusiness,
  onUpdateLeadStatus,
  onApplyNewRegion,
}: AIAssistantDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Olá! Sou a **Scoutly IA**, seu copiloto de inteligência comercial e prospecção de alta conversão.\n\nEm qual **cidade, bairro ou nicho** você deseja prospectar hoje? Basta me dizer onde e o que procura (ex: *'Ache restaurantes sem site em Florianópolis'* ou *'Busque clínicas em Curitiba'*) e eu vou buscar os dados em tempo real para você!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'default' | 'deep'>('default');
  const [isSearchModeOpen, setIsSearchModeOpen] = useState(false);
  const [thinkingPhraseIndex, setThinkingPhraseIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<Business[]>([]);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cycle thinking phrases when isLoading is true
  useEffect(() => {
    if (!isLoading) {
      setThinkingPhraseIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 2200);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Suggestions are derived from the same persisted signals used by Recomendados.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const refreshSuggestions = async () => {
      const local = getRecommendationPromptContext(currentRegionName, businesses);
      let suggestions = local.suggestions;

      if (local.recentSearches.length > 0) {
        const remote = await fetchContextualSuggestions(local.recentSearches, currentRegionName);
        suggestions = [...local.suggestions, ...remote];
      }

      const fallback = [
        `Quais empresas desta área têm os melhores sinais para prospecção?`,
        `Encontre negócios sem site em ${currentRegionName || 'esta região'}`,
        `Mostre prospects com telefone ou WhatsApp em ${currentRegionName || 'esta região'}`,
      ];

      const unique = [...new Set([...suggestions, ...fallback])]
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 4);

      if (!cancelled) setQuickSuggestions(unique);
    };

    void refreshSuggestions();

    const onSignalsUpdated = () => void refreshSuggestions();
    window.addEventListener(RECOMMENDATION_SIGNAL_EVENT, onSignalsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(RECOMMENDATION_SIGNAL_EVENT, onSignalsUpdated);
    };
  }, [isOpen, currentRegionName, businesses]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    const userMsgId = 'usr_' + Date.now();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newHistory: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        role: 'user',
        content: textToSend,
        timestamp: timeNow,
      },
    ];

    setMessages(newHistory);
    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = newHistory
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const allKnownBusinesses = [...businesses, ...discoveredBusinesses];

      const result = await sendAIChatMessage({
        message: textToSend,
        history: historyPayload,
        businesses: allKnownBusinesses,
        currentRegionName,
        searchMode,
      });

      // If AI found a new region or dynamically searched places
      if (result.newRegion) {
        if (result.newRegion.businesses && result.newRegion.businesses.length > 0) {
          setDiscoveredBusinesses((prev) => [
            ...prev,
            ...(result.newRegion!.businesses as Business[]),
          ]);
        }
        if (onApplyNewRegion) {
          onApplyNewRegion(result.newRegion);
        }
      }

      const assistantMsgId = 'ast_' + Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: result.text,
          matchedBusinessIds: result.matchedBusinessIds || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      const errorMsgId = 'err_' + Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: errorMsgId,
          role: 'assistant',
          content: `Desculpe, ocorreu uma oscilação na resposta da IA: ${err.message || 'Tente novamente em instantes.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome_' + Date.now(),
        role: 'assistant',
        content: `Chat reiniciado! Em qual **cidade, bairro ou nicho** você deseja prospectar agora?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Find full business objects from IDs across active and discovered businesses
  const getBusinessesFromIds = (ids?: string[]): Business[] => {
    if (!ids || ids.length === 0) return [];
    const pool = [...businesses, ...discoveredBusinesses];
    return ids
      .map((id) => pool.find((b) => b.id === id))
      .filter((b): b is Business => Boolean(b));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-[5px]"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full max-w-xl flex-col justify-between overflow-hidden border-l border-white/[0.09] bg-[#090c10] shadow-[0_0_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0d1014] p-4 sm:px-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#FF5A12]/20 bg-[#15191e] p-0.5 shadow-lg">
              <img
                src="/ai-icon.png"
                alt="Scoutly AI"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-white">Scoutly AI</h3>
              <p className="text-xs font-medium text-stone-500">
                Copiloto de prospecção e inteligência comercial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleResetChat}
              title="Reiniciar conversa"
              className="cursor-pointer rounded-xl p-2 text-stone-500 transition hover:bg-white/[0.05] hover:text-white"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar"
              className="cursor-pointer rounded-xl p-2 text-stone-500 transition hover:bg-white/[0.05] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 no-scrollbar">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const matchedList = !isUser ? getBusinessesFromIds(msg.matchedBusinessIds) : [];

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#FF5A12]/20 bg-[#15191e] p-0.5">
                    <img
                      src="/ai-icon.png"
                      alt="Scoutly AI"
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                )}

                <div className={`max-w-[88%] space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-4 rounded-2xl text-sm ${
                      isUser
                        ? 'bg-[#FF5A12] text-white rounded-tr-xs shadow-lg'
                        : 'bg-[#15191e] border border-white/[0.08] text-stone-200 rounded-tl-xs shadow-lg'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none prose-invert prose-p:text-stone-200 prose-strong:text-white prose-em:text-stone-300">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>

                    {!isUser && (
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/[0.07] text-[11px] text-stone-600">
                        <span>{msg.timestamp}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="flex cursor-pointer items-center gap-1 text-stone-500 transition hover:text-white"
                        >
                          {copiedIndex === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar texto</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Render matched businesses as rich cards if present */}
                  {matchedList.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-300">
                        <Sparkles className="h-3.5 w-3.5 text-[#FF6A26]" />
                        <span>Empresas Encontradas ({matchedList.length}):</span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {matchedList.map((biz) => {
                          const hasWebsite = Boolean(biz.website);
                          const waLink = getWhatsAppLink(biz.phone || (biz.phones && biz.phones[0]));
                          const isSaved = biz.leadStatus && biz.leadStatus !== 'NOVO';

                          return (
                            <div
                              key={biz.id}
                              className="flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-[#111418] p-3.5 transition hover:border-white/[0.14] hover:bg-[#15191e]"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="text-xs font-bold leading-snug text-white">
                                    {biz.name}
                                  </h4>
                                  <p className="text-[11px] text-stone-500">
                                    {biz.category} • {biz.address}
                                  </p>
                                </div>
                                {hasWebsite ? (
                                  <span className="shrink-0 rounded-md bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                    Com site
                                  </span>
                                ) : (
                                  <span className="shrink-0 rounded-md border border-[#FF5A12]/20 bg-[#FF5A12]/[0.08] px-2 py-0.5 text-[10px] font-bold text-[#FF7A3D]">
                                    Sem site
                                  </span>
                                )}
                              </div>

                              {/* Action Buttons Row */}
                              <div className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-white/[0.07]">
                                {/* Button: WhatsApp */}
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400 hover:bg-emerald-500/[0.13] rounded-xl text-xs font-bold transition shadow-2xs"
                                  >
                                    <img
                                      src="/whatsapp_icone.png"
                                      className="w-3.5 h-3.5 object-contain"
                                      alt="WhatsApp"
                                    />
                                    <span>WhatsApp</span>
                                  </a>
                                )}

                                {/* Button: Website */}
                                {hasWebsite && (
                                  <a
                                    href={biz.website!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-white/[0.08] bg-white/[0.03] text-stone-300 hover:bg-white/[0.06] hover:text-white rounded-xl text-xs font-bold transition shadow-2xs"
                                  >
                                    <span>Site</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}

                                {/* Button: Save to Leads list */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateLeadStatus(
                                      biz.id,
                                      isSaved ? 'NOVO' : 'CONTATADO'
                                    )
                                  }
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
                                    isSaved
                                      ? 'border border-amber-500/20 bg-amber-500/[0.08] text-amber-400'
                                      : 'border border-white/[0.08] bg-white/[0.04] text-stone-300 hover:bg-white/[0.07] hover:text-white'
                                  }`}
                                >
                                  {isSaved ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-amber-800" />
                                      <span>Na lista</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Adicionar à lista</span>
                                    </>
                                  )}
                                </button>

                                {/* Button: View details on map / modal */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const safeBiz: Business = {
                                      id: biz.id,
                                      name: biz.name || 'Empresa',
                                      category: biz.category || 'Comércio',
                                      address: biz.address || '',
                                      latitude: (biz as any).latitude ?? (biz as any).lat ?? (biz.coordinates?.lat || 0),
                                      longitude: (biz as any).longitude ?? (biz as any).lng ?? (biz.coordinates?.lng || 0),
                                      coordinates: biz.coordinates || {
                                        lat: (biz as any).latitude ?? (biz as any).lat ?? 0,
                                        lng: (biz as any).longitude ?? (biz as any).lng ?? 0,
                                      },
                                      operatingStatus: biz.operatingStatus || null,
                                      website: biz.website || null,
                                      websites: Array.isArray(biz.websites) ? biz.websites : biz.website ? [biz.website] : [],
                                      phone: biz.phone || (biz.phones && biz.phones[0]) || null,
                                      phones: Array.isArray(biz.phones) ? biz.phones : biz.phone ? [biz.phone] : [],
                                      email: biz.email || (biz.emails && biz.emails[0]) || null,
                                      emails: Array.isArray(biz.emails) ? biz.emails : biz.email ? [biz.email] : [],
                                      socials: Array.isArray(biz.socials) ? biz.socials : [],
                                      source: biz.source || 'Overture Maps',
                                      confidence: typeof biz.confidence === 'number' ? biz.confidence : 0.85,
                                      leadStatus: biz.leadStatus || 'NOVO',
                                      notes: biz.notes || '',
                                    };
                                    onSelectBusiness(safeBiz);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FF5A12] hover:bg-[#ff6a27] text-white rounded-xl text-xs font-bold transition shadow-2xs ml-auto cursor-pointer"
                                >
                                  <span>Ver detalhes</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#15191e] text-stone-300">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 items-start">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#FF5A12]/20 bg-[#15191e] p-0.5">
                <img
                  src="/ai-icon.png"
                  alt="Scoutly AI"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>

              <div className="flex flex-col gap-1.5 max-w-[88%]">
                {/* ChatGPT style Thinking Header with orange shimmer */}
                <div className="flex items-center gap-1.5 px-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#FF4D00] animate-pulse" />
                  <span className="text-xs font-bold tracking-wide orange-shimmer-text">
                    {THINKING_PHRASES[thinkingPhraseIndex]}
                  </span>
                </div>

                {/* Thinking Box */}
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-white/[0.08] bg-[#15191e] p-3.5 text-xs font-medium text-stone-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF5A12]"></span>
                  <span>Scoutly AI está buscando e analisando os dados em tempo real...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="shrink-0 border-t border-white/[0.08] bg-[#0d1014] px-4 pb-2 pt-3">
          <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-stone-500">
            <Info className="h-3 w-3 text-stone-600" />
            Sugestões rápidas de prospecção:
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {quickSuggestions.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(sug)}
                disabled={isLoading}
                className="shrink-0 cursor-pointer whitespace-nowrap rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-medium text-stone-400 transition hover:border-[#FF5A12]/25 hover:bg-[#FF5A12]/[0.07] hover:text-[#FF7A3D] disabled:opacity-50"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="shrink-0 border-t border-white/[0.08] bg-[#0d1014] p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 relative"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ex: Ache clínicas em Curitiba, restaurantes sem site no Rio..."
              disabled={isLoading}
              className="flex-1 rounded-2xl border border-white/[0.09] bg-[#090c10] px-4 py-3 text-sm text-white outline-none placeholder:text-stone-700 transition focus:border-[#FF5A12]/50 focus:ring-2 focus:ring-[#FF5A12]/10 disabled:opacity-50"
            />

            {/* ChatGPT style mini dropdown for Search Mode */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSearchModeOpen(!isSearchModeOpen)}
                disabled={isLoading}
                className="flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-[#15191e] px-3 py-3 text-xs font-semibold text-stone-300 transition hover:bg-white/[0.06] hover:text-white"
                title="Selecionar modo de busca"
              >
                <span>{searchMode === 'deep' ? 'Deep Search' : 'Busca padrão'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
              </button>

              {isSearchModeOpen && (
                <div className="absolute bottom-full right-0 z-50 mb-2 w-40 rounded-xl border border-white/[0.09] bg-[#15191e] py-1.5 text-xs shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode('default');
                      setIsSearchModeOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-white/[0.05] flex items-center justify-between cursor-pointer font-medium ${
                      searchMode === 'default' ? 'text-[#FF7A3D] font-bold bg-[#FF5A12]/[0.08]' : 'text-stone-400'
                    }`}
                  >
                    <span>Busca padrão</span>
                    {searchMode === 'default' && <Check className="h-3.5 w-3.5 text-[#FF6A26]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode('deep');
                      setIsSearchModeOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-white/[0.05] flex items-center justify-between cursor-pointer font-medium ${
                      searchMode === 'deep' ? 'text-[#FF7A3D] font-bold bg-[#FF5A12]/[0.08]' : 'text-stone-400'
                    }`}
                  >
                    <span>Deep Search</span>
                    {searchMode === 'deep' && <Check className="h-3.5 w-3.5 text-[#FF6A26]" />}
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="px-4 py-3 bg-[#FF5A12] hover:bg-[#ff6a27] text-white rounded-2xl font-bold transition shadow-xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default memo(AIAssistantDrawer);

