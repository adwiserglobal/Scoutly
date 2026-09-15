import { useState, memo } from 'react';
import {
  Settings,
  Database,
  Sparkles,
  Download,
  Trash2,
  Check,
  ShieldCheck,
  MapPin,
  Cpu,
  Layers,
  Globe,
} from 'lucide-react';
import { Business } from '../types';

interface SettingsViewProps {
  businesses: Business[];
  currentRegionName: string;
  onClearLocalCache: () => void;
}

function SettingsView({
  businesses,
  currentRegionName,
  onClearLocalCache,
}: SettingsViewProps) {
  const [agencyName, setAgencyName] = useState(
    localStorage.getItem('scoutly_agency_name') || 'Minha Agência / Consultoria'
  );
  const [defaultCity, setDefaultCity] = useState(
    localStorage.getItem('scoutly_default_city') || 'Araguari, MG'
  );
  const [autoEnrich, setAutoEnrich] = useState(
    localStorage.getItem('scoutly_auto_enrich') !== 'false'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSavePreferences = () => {
    localStorage.setItem('scoutly_agency_name', agencyName);
    localStorage.setItem('scoutly_default_city', defaultCity);
    localStorage.setItem('scoutly_auto_enrich', String(autoEnrich));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExportAllJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(businesses, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute(
      'download',
      `scoutly-backup-completo-${new Date().toISOString().slice(0, 10)}.json`
    );
    dlAnchorElem.click();
  };

  const handleExportAllCSV = () => {
    if (businesses.length === 0) return;

    const headers = [
      'ID',
      'Nome',
      'Categoria',
      'Latitude',
      'Longitude',
      'Telefone',
      'Website',
      'Redes Sociais',
      'Status do Lead',
      'Endereço',
      'Anotações',
    ];

    const rows = businesses.map((b) => [
      `"${b.id}"`,
      `"${b.name.replace(/"/g, '""')}"`,
      `"${b.category.replace(/"/g, '""')}"`,
      b.latitude,
      b.longitude,
      `"${b.phone || (b.phones && b.phones[0]) || ''}"`,
      `"${b.website || ''}"`,
      `"${(b.socials || []).join(', ')}"`,
      `"${b.leadStatus || 'NOVO'}"`,
      `"${b.address.replace(/"/g, '""')}"`,
      `"${(b.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `scoutly-base-completa-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] overflow-y-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-stone-900 text-white rounded-2xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              Configurações & Preferências
            </h1>
            <p className="text-xs text-stone-500 font-medium">
              Gerencie parâmetros de prospecção, dados de inteligência e exportações.
            </p>
          </div>
        </div>

        {/* Section 1: Preferências do Consultor */}
        <div className="p-6 bg-white rounded-3xl border border-[#EDE8E0] shadow-2xs space-y-5">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-[#FF4D00]" />
            <h2 className="text-sm font-bold text-stone-900">
              Identidade & Região Padrão
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Nome da Agência / Consultoria
              </label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Ex: Minha Empresa B2B"
                className="w-full text-xs p-3 rounded-xl border border-[#EDE8E0] bg-[#FAF7F2] text-stone-900 focus:outline-none focus:border-[#FF4D00]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Cidade / Polo de Prospecção Padrão
              </label>
              <input
                type="text"
                value={defaultCity}
                onChange={(e) => setDefaultCity(e.target.value)}
                placeholder="Ex: Araguari, MG"
                className="w-full text-xs p-3 rounded-xl border border-[#EDE8E0] bg-[#FAF7F2] text-stone-900 focus:outline-none focus:border-[#FF4D00]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoEnrich"
                checked={autoEnrich}
                onChange={(e) => setAutoEnrich(e.target.checked)}
                className="w-4 h-4 rounded text-[#FF4D00] focus:ring-[#FF4D00] border-stone-300"
              />
              <label htmlFor="autoEnrich" className="text-xs font-medium text-stone-700">
                Ativar raspador inteligente de contatos públicos em websites
              </label>
            </div>

            <button
              type="button"
              onClick={handleSavePreferences}
              className="px-4 py-2 bg-stone-900 hover:bg-[#FF4D00] text-white rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvo!</span>
                </>
              ) : (
                <span>Salvar Preferências</span>
              )}
            </button>
          </div>
        </div>

        {/* Section 2: Inteligência Artificial & Status do Motor */}
        <div className="p-6 bg-white rounded-3xl border border-[#EDE8E0] shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <Sparkles className="w-4 h-4 text-[#FF4D00]" />
            <h2 className="text-sm font-bold text-stone-900">
              Motor de IA & Copilot
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Provedor Principal
              </span>
              <span className="text-xs font-bold text-stone-800 block mt-1">
                OpenRouter AI Cascade
              </span>
              <span className="text-[11px] text-emerald-600 font-medium">
                ● Modelos Gratuitos Ativos
              </span>
            </div>

            <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Fallback de Continuidade
              </span>
              <span className="text-xs font-bold text-stone-800 block mt-1">
                Google Gemini + Local Parser
              </span>
              <span className="text-[11px] text-stone-500 font-medium">
                Alta disponibilidade
              </span>
            </div>

            <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EDE8E0]">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Região Atual Carregada
              </span>
              <span className="text-xs font-bold text-stone-800 block mt-1">
                {currentRegionName}
              </span>
              <span className="text-[11px] text-stone-500 font-medium">
                {businesses.length} negócios na memória
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Exportações & Backup de Dados */}
        <div className="p-6 bg-white rounded-3xl border border-[#EDE8E0] shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <Database className="w-4 h-4 text-[#FF4D00]" />
            <h2 className="text-sm font-bold text-stone-900">
              Exportação & Backup de Dados
            </h2>
          </div>

          <p className="text-xs text-stone-600">
            Você pode exportar toda a base de empresas carregadas em formato CSV ou JSON
            para integração com CRM (HubSpot, RD Station, Pipedrive, ActiveCampaign) ou planilhas.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportAllCSV}
              className="px-4 py-2.5 bg-white border border-[#EDE8E0] hover:bg-stone-50 text-stone-800 rounded-2xl text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-stone-600" />
              <span>Exportar Todos em CSV ({businesses.length})</span>
            </button>

            <button
              type="button"
              onClick={handleExportAllJSON}
              className="px-4 py-2.5 bg-white border border-[#EDE8E0] hover:bg-stone-50 text-stone-800 rounded-2xl text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-stone-600" />
              <span>Backup Completo em JSON</span>
            </button>

            <button
              type="button"
              onClick={onClearLocalCache}
              className="px-4 py-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-2xl text-xs font-bold transition shadow-2xs flex items-center gap-2 cursor-pointer ml-auto"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Limpar Cache Local</span>
            </button>
          </div>
        </div>

        {/* Section 4: Fontes de Dados e Licença */}
        <div className="p-5 bg-[#FAF7F2] rounded-3xl border border-[#EDE8E0] text-xs text-stone-500 space-y-2">
          <div className="flex items-center gap-2 font-bold text-stone-700">
            <Globe className="w-4 h-4 text-stone-500" />
            <span>Infraestrutura de Dados Abertos</span>
          </div>
          <p>
            O <strong>Scoutly</strong> utiliza dados oficiais da <strong>Overture Maps Foundation</strong>{' '}
            (Linux Foundation / Meta / Microsoft / AWS) processados via <strong>DuckDB</strong> de alta performance.
          </p>
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsView);
