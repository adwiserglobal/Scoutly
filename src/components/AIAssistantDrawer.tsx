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

const QUICK_SUGGESTIONS = [
  'Ache restaurantes sem site em Florianópolis',
  'Busque clínicas e consultórios em Curitiba',
  'Quais as melhores oportunidades no Rio de Janeiro?',
  'Gere um roteiro de abordagem comercial para WhatsApp',
];

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
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl h-full bg-[#FAF7F2] border-l border-[#EDE8E0] shadow-2xl flex flex-col justify-between overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:px-6 bg-white border-b border-[#EDE8E0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 shadow-xs border border-stone-200 bg-white p-0.5 flex items-center justify-center">
              <img
                src="/ai-icon.png"
                alt="Scoutly AI"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 tracking-tight">Scoutly AI</h3>
              <p className="text-xs text-stone-500 font-medium">
                Copiloto de prospecção e inteligência comercial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleResetChat}
              title="Reiniciar conversa"
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar"
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition cursor-pointer"
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
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-2xs mt-1 border border-stone-200 bg-white p-0.5 flex items-center justify-center">
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
                        ? 'bg-[#FF4D00] text-white rounded-tr-xs shadow-xs'
                        : 'bg-white border border-[#EDE8E0] text-stone-800 rounded-tl-xs shadow-xs'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none prose-stone dark:prose-invert">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>

                    {!isUser && (
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-stone-100 text-[11px] text-stone-400">
                        <span>{msg.timestamp}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="flex items-center gap-1 text-stone-500 hover:text-stone-800 transition cursor-pointer"
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
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF4D00]" />
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
                              className="p-3.5 bg-white rounded-2xl border border-[#EDE8E0] shadow-xs hover:border-stone-400 transition flex flex-col gap-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="text-xs font-bold text-stone-900 leading-snug">
                                    {biz.name}
                                  </h4>
                                  <p className="text-[11px] text-stone-500">
                                    {biz.category} • {biz.address}
                                  </p>
                                </div>
                                {hasWebsite ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 shrink-0">
                                    Com site
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FFF0E6] text-[#FF4D00] border border-[#FF4D00]/20 shrink-0">
                                    Sem site
                                  </span>
                                )}
                              </div>

                              {/* Action Buttons Row */}
                              <div className="flex items-center flex-wrap gap-1.5 pt-2 border-t border-stone-100">
                                {/* Button: WhatsApp */}
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-bold transition shadow-2xs"
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
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold transition shadow-2xs"
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
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200'
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
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FF4D00] hover:bg-[#E04400] text-white rounded-xl text-xs font-bold transition shadow-2xs ml-auto cursor-pointer"
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
                  <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 items-start">
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-2xs mt-1 border border-stone-200 bg-white p-0.5 flex items-center justify-center">
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
                <div className="p-3.5 bg-white border border-[#EDE8E0] rounded-2xl rounded-tl-xs text-xs text-stone-700 flex items-center gap-2 shadow-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#FF4D00] animate-pulse"></span>
                  <span>Scoutly AI está buscando e analisando os dados em tempo real...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 pt-2 pb-1 bg-white border-t border-[#EDE8E0] shrink-0">
          <p className="text-[11px] font-semibold text-stone-500 mb-1.5 flex items-center gap-1">
            <Info className="w-3 h-3 text-stone-400" />
            Sugestões rápidas de prospecção:
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {QUICK_SUGGESTIONS.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(sug)}
                disabled={isLoading}
                className="text-[11px] font-medium px-3 py-1 bg-stone-50 hover:bg-stone-100 hover:text-stone-900 text-stone-600 border border-[#EDE8E0] rounded-xl whitespace-nowrap transition cursor-pointer shrink-0 disabled:opacity-50"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-[#EDE8E0] shrink-0">
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
              className="flex-1 px-4 py-3 bg-[#FAF7F2] border border-[#EDE8E0] rounded-2xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/30 focus:border-[#FF4D00] transition disabled:opacity-50"
            />

            {/* ChatGPT style mini dropdown for Search Mode */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSearchModeOpen(!isSearchModeOpen)}
                disabled={isLoading}
                className="px-3 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer select-none shrink-0 border border-stone-200"
                title="Selecionar modo de busca"
              >
                <span>{searchMode === 'deep' ? 'Deep Search' : 'Busca padrão'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
              </button>

              {isSearchModeOpen && (
                <div className="absolute bottom-full mb-2 right-0 w-40 bg-white border border-stone-200 rounded-xl shadow-lg py-1.5 z-50 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode('default');
                      setIsSearchModeOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-stone-50 flex items-center justify-between cursor-pointer font-medium ${
                      searchMode === 'default' ? 'text-[#FF4D00] font-bold bg-orange-50/50' : 'text-stone-700'
                    }`}
                  >
                    <span>Busca padrão</span>
                    {searchMode === 'default' && <Check className="w-3.5 h-3.5 text-[#FF4D00]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode('deep');
                      setIsSearchModeOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-stone-50 flex items-center justify-between cursor-pointer font-medium ${
                      searchMode === 'deep' ? 'text-[#FF4D00] font-bold bg-orange-50/50' : 'text-stone-700'
                    }`}
                  >
                    <span>Deep Search</span>
                    {searchMode === 'deep' && <Check className="w-3.5 h-3.5 text-[#FF4D00]" />}
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="px-4 py-3 bg-[#FF4D00] hover:bg-[#E04400] text-white rounded-2xl font-bold transition shadow-xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
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

