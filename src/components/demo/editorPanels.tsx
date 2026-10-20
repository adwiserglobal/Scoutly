import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Plus, Trash2, Upload } from 'lucide-react';
import {
  CORE_SECTIONS, FONT_NAMES, ICON_IDS, LAYOUT_IDS, STYLE_IDS,
  type DemoImage, type DemoSiteData, type ExtraType, type FontName, type IconId, type LayoutId, type SectionRef, type StyleId,
} from '../../../shared/demoSite/types';
import { defaultSections } from '../../../shared/demoSite/render';
import { AddButton, Field, Group, ItemCard, inputClass } from './editorUi';
import { prepareLogo, preparePhoto } from './imageTools';
import SiteAddressField from './SiteAddressField';
import type { DemoSiteSummary } from '../../services/api';

export type Updater = (mutate: (draft: DemoSiteData) => void) => void;

interface PanelProps {
  data: DemoSiteData;
  update: Updater;
  focusSection: (id: string) => void;
  notify: (message: string, tone?: 'ok' | 'error') => void;
  address?: { businessId: string; site: DemoSiteSummary | null; onRenamed: (site: DemoSiteSummary) => void };
}

const STYLE_LABEL: Record<StyleId, { label: string; swatch: string }> = {
  clean: { label: 'Clean', swatch: 'linear-gradient(135deg,#fff 50%,#0b78d6 50%)' },
  warm: { label: 'Quente', swatch: 'linear-gradient(135deg,#fbf6ee 50%,#c8501a 50%)' },
  bold: { label: 'Forte', swatch: 'linear-gradient(135deg,#0d0e11 50%,#ff5a12 50%)' },
  elegant: { label: 'Elegante', swatch: 'linear-gradient(135deg,#faf8f4 50%,#9b7142 50%)' },
  fresh: { label: 'Fresco', swatch: 'linear-gradient(135deg,#f5fbf7 50%,#1b9a52 50%)' },
  noir: { label: 'Noturno', swatch: 'linear-gradient(135deg,#0a0f1f 50%,#6d8dff 50%)' },
};

const LAYOUT_LABEL: Record<LayoutId, string> = {
  classic: 'Clássico', editorial: 'Editorial', immersive: 'Imersivo', centered: 'Centrado', magazine: 'Revista', bento: 'Bento',
};

const ICON_LABEL: Record<IconId, string> = {
  check: 'Check', star: 'Estrela', heart: 'Coração', tool: 'Ferramenta', scissors: 'Tesoura', tooth: 'Dente', cutlery: 'Talheres',
  car: 'Carro', home: 'Casa', shield: 'Escudo', clock: 'Relógio', phone: 'Telefone', pin: 'Local', sparkle: 'Brilho', leaf: 'Folha',
  dumbbell: 'Halter', book: 'Livro', camera: 'Câmera', key: 'Chave', bag: 'Sacola',
};

const ACCENTS = ['#0b78d6', '#0f9d8a', '#1b9a52', '#e08a06', '#ff5a12', '#e11d48', '#7c3aed', '#c8501a', '#9b7142', '#111827'];

const SECTION_NAMES: Record<string, string> = {
  servicos: 'Serviços', sobre: 'Sobre', galeria: 'Galeria', 'como-funciona': 'Como funciona', perguntas: 'Perguntas frequentes', cta: 'Chamada final', contato: 'Contato',
  text: 'Texto livre', stats: 'Números', testimonials: 'Depoimentos', pricing: 'Planos e preços', banner: 'Faixa promocional',
};

const PREFAB: Array<{ type: ExtraType; title: string; text: string }> = [
  { type: 'text', title: 'Texto livre', text: 'Título e parágrafos para contar a história do negócio.' },
  { type: 'stats', title: 'Números', text: 'Destaques como anos de atuação ou clientes atendidos.' },
  { type: 'testimonials', title: 'Depoimentos', text: 'Frases de clientes reais, com autorização.' },
  { type: 'pricing', title: 'Planos e preços', text: 'Cartões com valores e o que está incluso.' },
  { type: 'banner', title: 'Faixa promocional', text: 'Destaque uma oferta ou aviso com botão.' },
];

function prefabProps(type: ExtraType): NonNullable<SectionRef['props']> {
  switch (type) {
    case 'text': return { title: 'Título da seção', body: 'Escreva aqui o seu texto. Use uma linha em branco para separar parágrafos.' };
    case 'stats': return { title: 'Em números', items: [{ a: '00', b: 'Descreva este número' }, { a: '00', b: 'Descreva este número' }, { a: '00', b: 'Descreva este número' }] };
    case 'testimonials': return { title: 'O que dizem os clientes', items: [{ a: 'Escreva aqui o depoimento de um cliente real.', b: 'Nome do cliente' }] };
    case 'pricing': return { title: 'Planos', items: [{ a: 'Plano 1', b: 'R$ 0', c: 'Descreva o plano', d: 'Item incluso\nOutro item' }, { a: 'Plano 2', b: 'R$ 0', c: 'Descreva o plano', d: 'Item incluso\nOutro item' }] };
    default: return { body: 'Escreva aqui a sua promoção ou aviso.', button: 'Saiba mais' };
  }
}

const randomId = () => `x-${Math.random().toString(36).slice(2, 9)}`;

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------
export function ContentPanel({ data, update, focusSection, notify, address }: PanelProps) {
  const [open, setOpen] = useState<string>('identity');
  const logoInput = useRef<HTMLInputElement>(null);
  const toggle = (id: string, section?: string) => {
    setOpen((current) => (current === id ? '' : id));
    if (section) focusSection(section);
  };
  const { business: b, copy } = data;

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const prepared = await prepareLogo(file);
      update((draft) => { draft.logo = prepared.dataUrl; });
    } catch (error: any) { notify(error?.message || 'Não foi possível usar esta imagem.'); }
  };

  const extras = (data.sections || []).filter((section) => section.type !== 'core');
  const setProps = (id: string, mutate: (props: NonNullable<SectionRef['props']>) => void) =>
    update((draft) => {
      const section = draft.sections?.find((item) => item.id === id);
      if (!section) return;
      section.props = section.props || {};
      mutate(section.props);
    });

  return (
    <div>
      <Group title="Identidade e logo" open={open === 'identity'} onToggle={() => toggle('identity', 'hero')}>
        <Field label="Nome do negócio" value={b.name} max={90} onChange={(v) => update((d) => { d.business.name = v; })} />
        <Field label="Segmento" value={b.category} max={80} onChange={(v) => update((d) => { d.business.category = v; })} />
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-[#c3c8d0]">Logo do cliente</p>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-24 items-center justify-center overflow-hidden rounded-lg border border-white/[0.1] bg-[#0b0d11]">
              {data.logo ? <img src={data.logo} alt="Logo" className="max-h-full max-w-full object-contain" /> : <ImagePlus className="h-5 w-5 text-[#6f7682]" />}
            </div>
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={() => logoInput.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 text-[12px] font-semibold text-white hover:bg-white/[0.14]">
                <Upload className="h-3.5 w-3.5" /> {data.logo ? 'Trocar logo' : 'Enviar logo'}
              </button>
              {data.logo && <button type="button" onClick={() => update((d) => { d.logo = null; })} className="text-left text-[11px] text-[#ff8b8b] hover:underline">Remover</button>}
            </div>
            <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(event) => { void uploadLogo(event.target.files?.[0]); event.target.value = ''; }} />
          </div>
          <p className="text-[10.5px] text-[#8b929e]">PNG, JPG, WebP ou SVG. Fundo transparente funciona melhor.</p>
        </div>
      </Group>

      {address && (
        <Group title="Endereço do site" open={open === 'address'} onToggle={() => toggle('address')}>
          <SiteAddressField businessId={address.businessId} site={address.site} onRenamed={address.onRenamed} notify={notify} />
        </Group>
      )}

      <Group title="Topo da página" open={open === 'hero'} onToggle={() => toggle('hero', 'hero')}>
        <Field label="Texto acima do título" value={copy.eyebrow} max={60} onChange={(v) => update((d) => { d.copy.eyebrow = v; })} onFocus={() => focusSection('hero')} />
        <Field label="Título principal" value={copy.headline} max={120} multiline rows={2} onChange={(v) => update((d) => { d.copy.headline = v; })} onFocus={() => focusSection('hero')} />
        <Field label="Subtítulo" value={copy.subheadline} max={300} multiline rows={3} onChange={(v) => update((d) => { d.copy.subheadline = v; })} onFocus={() => focusSection('hero')} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Botão principal" value={copy.primaryCta} max={32} onChange={(v) => update((d) => { d.copy.primaryCta = v; })} />
          <Field label="Botão secundário" value={copy.secondaryCta} max={32} onChange={(v) => update((d) => { d.copy.secondaryCta = v; })} />
        </div>
      </Group>

      <Group title="Serviços" count={copy.services.length} open={open === 'services'} onToggle={() => toggle('services', 'servicos')}>
        {copy.services.map((service, index) => (
          <ItemCard key={index} label={`Serviço ${index + 1}`} onRemove={() => update((d) => { d.copy.services.splice(index, 1); })}>
            <Field label="Título" value={service.title} max={60} onChange={(v) => update((d) => { d.copy.services[index].title = v; })} onFocus={() => focusSection('servicos')} />
            <Field label="Descrição" value={service.text} max={260} multiline rows={2} onChange={(v) => update((d) => { d.copy.services[index].text = v; })} onFocus={() => focusSection('servicos')} />
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#c3c8d0]">Ícone</label>
              <select value={service.icon} onChange={(event) => update((d) => { d.copy.services[index].icon = event.target.value as IconId; })} className={inputClass}>
                {ICON_IDS.map((id) => <option key={id} value={id}>{ICON_LABEL[id]}</option>)}
              </select>
            </div>
          </ItemCard>
        ))}
        <AddButton disabled={copy.services.length >= 8} onClick={() => update((d) => { d.copy.services.push({ title: 'Novo serviço', text: 'Descreva o serviço em uma frase.', icon: 'sparkle' }); })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar serviço
        </AddButton>
      </Group>

      <Group title="Sobre e diferenciais" open={open === 'about'} onToggle={() => toggle('about', 'sobre')}>
        <Field label="Título" value={copy.aboutTitle} max={90} onChange={(v) => update((d) => { d.copy.aboutTitle = v; })} onFocus={() => focusSection('sobre')} />
        {copy.aboutParagraphs.map((paragraph, index) => (
          <ItemCard key={index} label={`Parágrafo ${index + 1}`} onRemove={() => update((d) => { d.copy.aboutParagraphs.splice(index, 1); })}>
            <Field label="Texto" value={paragraph} max={700} multiline rows={4} onChange={(v) => update((d) => { d.copy.aboutParagraphs[index] = v; })} onFocus={() => focusSection('sobre')} />
          </ItemCard>
        ))}
        <AddButton disabled={copy.aboutParagraphs.length >= 4} onClick={() => update((d) => { d.copy.aboutParagraphs.push('Escreva aqui um novo parágrafo.'); })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar parágrafo
        </AddButton>
        <p className="pt-1 text-[11px] font-semibold text-[#c3c8d0]">Diferenciais</p>
        {copy.highlights.map((item, index) => (
          <ItemCard key={index} label={`Diferencial ${index + 1}`} onRemove={() => update((d) => { d.copy.highlights.splice(index, 1); })}>
            <Field label="Título" value={item.title} max={70} onChange={(v) => update((d) => { d.copy.highlights[index].title = v; })} onFocus={() => focusSection('sobre')} />
            <Field label="Descrição" value={item.text} max={260} multiline rows={2} onChange={(v) => update((d) => { d.copy.highlights[index].text = v; })} onFocus={() => focusSection('sobre')} />
          </ItemCard>
        ))}
        <AddButton disabled={copy.highlights.length >= 4} onClick={() => update((d) => { d.copy.highlights.push({ title: 'Novo diferencial', text: 'Explique em uma frase.' }); })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar diferencial
        </AddButton>
      </Group>

      <Group title="Como funciona" count={copy.process.length} open={open === 'process'} onToggle={() => toggle('process', 'como-funciona')}>
        {copy.process.map((step, index) => (
          <ItemCard key={index} label={`Passo ${index + 1}`} onRemove={() => update((d) => { d.copy.process.splice(index, 1); })}>
            <Field label="Título" value={step.title} max={70} onChange={(v) => update((d) => { d.copy.process[index].title = v; })} onFocus={() => focusSection('como-funciona')} />
            <Field label="Descrição" value={step.text} max={260} multiline rows={2} onChange={(v) => update((d) => { d.copy.process[index].text = v; })} onFocus={() => focusSection('como-funciona')} />
          </ItemCard>
        ))}
        <AddButton disabled={copy.process.length >= 5} onClick={() => update((d) => { d.copy.process.push({ title: 'Novo passo', text: 'Explique este passo.' }); })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar passo
        </AddButton>
      </Group>

      <Group title="Perguntas frequentes" count={copy.faq.length} open={open === 'faq'} onToggle={() => toggle('faq', 'perguntas')}>
        {copy.faq.map((item, index) => (
          <ItemCard key={index} label={`Pergunta ${index + 1}`} onRemove={() => update((d) => { d.copy.faq.splice(index, 1); })}>
            <Field label="Pergunta" value={item.q} max={140} onChange={(v) => update((d) => { d.copy.faq[index].q = v; })} onFocus={() => focusSection('perguntas')} />
            <Field label="Resposta" value={item.a} max={500} multiline rows={3} onChange={(v) => update((d) => { d.copy.faq[index].a = v; })} onFocus={() => focusSection('perguntas')} />
          </ItemCard>
        ))}
        <AddButton disabled={copy.faq.length >= 8} onClick={() => update((d) => { d.copy.faq.push({ q: 'Nova pergunta?', a: 'Escreva a resposta.' }); })}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar pergunta
        </AddButton>
      </Group>

      <Group title="Chamada final" open={open === 'cta'} onToggle={() => toggle('cta', 'cta')}>
        <Field label="Título" value={copy.ctaTitle} max={90} onChange={(v) => update((d) => { d.copy.ctaTitle = v; })} onFocus={() => focusSection('cta')} />
        <Field label="Texto" value={copy.ctaText} max={240} multiline rows={2} onChange={(v) => update((d) => { d.copy.ctaText = v; })} onFocus={() => focusSection('cta')} />
      </Group>

      <Group title="Contato e horários" open={open === 'contact'} onToggle={() => toggle('contact', 'contato')}>
        <Field label="WhatsApp (com DDD)" value={b.phoneDigits} inputMode="tel" max={16} placeholder="11987654321" hint="Os botões do site abrem a conversa neste número." onChange={(v) => update((d) => { d.business.phoneDigits = v.replace(/\D/g, ''); })} onFocus={() => focusSection('contato')} />
        <Field label="Endereço" value={b.address} max={180} onChange={(v) => update((d) => { d.business.address = v; })} onFocus={() => focusSection('contato')} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bairro" value={b.neighborhood} max={60} onChange={(v) => update((d) => { d.business.neighborhood = v; })} />
          <Field label="Cidade" value={b.city} max={60} onChange={(v) => update((d) => { d.business.city = v; })} />
        </div>
        <Field label="Horário de funcionamento" value={b.hours} max={240} placeholder="Seg a Sex, 8h às 18h" onChange={(v) => update((d) => { d.business.hours = v; })} onFocus={() => focusSection('contato')} />
      </Group>

      {extras.map((section) => {
        const props = section.props || {};
        const items = props.items || [];
        const itemLabels: Record<string, [string, string, string?, string?]> = {
          stats: ['Número ou valor', 'Descrição'],
          testimonials: ['Depoimento', 'Nome de quem disse'],
          pricing: ['Nome do plano', 'Preço', 'Descrição curta', 'Itens inclusos (um por linha)'],
        };
        const labels = itemLabels[section.type];
        return (
          <Group key={section.id} title={SECTION_NAMES[section.type] || 'Seção'} open={open === section.id} onToggle={() => toggle(section.id, section.id)}>
            {section.type !== 'banner' && <Field label="Título da seção" value={props.title || ''} max={90} onChange={(v) => setProps(section.id, (p) => { p.title = v; })} onFocus={() => focusSection(section.id)} />}
            {(section.type === 'text' || section.type === 'banner') && (
              <Field label={section.type === 'banner' ? 'Mensagem' : 'Texto'} value={props.body || ''} max={1200} multiline rows={section.type === 'banner' ? 2 : 6} onChange={(v) => setProps(section.id, (p) => { p.body = v; })} onFocus={() => focusSection(section.id)} />
            )}
            {section.type === 'banner' && <Field label="Texto do botão" value={props.button || ''} max={30} onChange={(v) => setProps(section.id, (p) => { p.button = v; })} />}
            {labels && items.map((item, index) => (
              <ItemCard key={index} label={`Item ${index + 1}`} onRemove={() => setProps(section.id, (p) => { p.items?.splice(index, 1); })}>
                <Field label={labels[0]} value={item.a || ''} max={section.type === 'testimonials' ? 240 : 120} multiline={section.type === 'testimonials'} rows={3} onChange={(v) => setProps(section.id, (p) => { if (p.items) p.items[index].a = v; })} onFocus={() => focusSection(section.id)} />
                <Field label={labels[1]} value={item.b || ''} max={120} onChange={(v) => setProps(section.id, (p) => { if (p.items) p.items[index].b = v; })} />
                {labels[2] && <Field label={labels[2]} value={item.c || ''} max={240} onChange={(v) => setProps(section.id, (p) => { if (p.items) p.items[index].c = v; })} />}
                {labels[3] && <Field label={labels[3]} value={item.d || ''} max={500} multiline rows={3} onChange={(v) => setProps(section.id, (p) => { if (p.items) p.items[index].d = v; })} />}
              </ItemCard>
            ))}
            {labels && (
              <AddButton disabled={items.length >= 8} onClick={() => setProps(section.id, (p) => { p.items = [...(p.items || []), prefabProps(section.type as ExtraType).items?.[0] || { a: '', b: '' }]; })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar item
              </AddButton>
            )}
            {section.type === 'testimonials' && <p className="text-[10.5px] leading-relaxed text-[#f2b48f]">Use apenas depoimentos reais e com a autorização de quem os deu.</p>}
          </Group>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Design
// ---------------------------------------------------------------------------
function ColorRow({ label, value, fallback, onChange, onReset }: { label: string; value: string | undefined; fallback: string; onChange: (value: string) => void; onReset: () => void }) {
  const shown = value || fallback;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] font-medium text-[#d6dae0]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          value={value || ''}
          placeholder={fallback}
          onChange={(event) => { const next = event.target.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next.toLowerCase()); }}
          className={`${inputClass} !w-[96px] !py-1.5 text-center font-mono text-[12px] uppercase`}
          maxLength={7}
          aria-label={`${label} em hexadecimal`}
        />
        <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-lg border border-white/[0.18]" style={{ background: shown }}>
          <input type="color" value={shown} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={label} />
        </label>
        <button type="button" onClick={onReset} disabled={!value} className="text-[11px] text-[#9aa1ac] hover:text-white disabled:opacity-30">Padrão</button>
      </div>
    </div>
  );
}

export function DesignPanel({ data, update, notify }: PanelProps) {
  const [open, setOpen] = useState('style');
  const heroInput = useRef<HTMLInputElement>(null);
  const aboutInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const design = data.design || {};
  const setDesign = (mutate: (design: NonNullable<DemoSiteData['design']>) => void) =>
    update((draft) => { draft.design = draft.design || {}; mutate(draft.design); });
  const toggle = (id: string) => setOpen((current) => (current === id ? '' : id));

  const uploadPhoto = async (file: File | undefined, target: 'hero' | 'about' | 'gallery' | 'heroBg') => {
    if (!file) return;
    try {
      const prepared = await preparePhoto(file);
      const image: DemoImage = { src: prepared.dataUrl, width: prepared.width, height: prepared.height, alt: '', credit: '' };
      update((draft) => {
        if (target === 'gallery') draft.images.gallery = [...draft.images.gallery, image].slice(0, 6);
        else draft.images[target] = image;
      });
    } catch (error: any) { notify(error?.message || 'Não foi possível usar esta imagem.'); }
  };

  const Thumb = ({ image, label, onPick, onRemove }: { image: DemoImage | null; label: string; onPick: () => void; onRemove: () => void }) => (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-[#c3c8d0]">{label}</p>
      <div className="flex items-center gap-3">
        <div className="h-16 w-24 overflow-hidden rounded-lg border border-white/[0.1] bg-[#0b0d11]">
          {image ? <img src={image.src.startsWith('data:') ? image.src : `${image.src}${image.src.includes('?') ? '&' : '?'}auto=format&fit=crop&q=60&w=240`} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] text-[#6f7682]">Ilustração</div>}
        </div>
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={onPick} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 text-[12px] font-semibold text-white hover:bg-white/[0.14]"><Upload className="h-3.5 w-3.5" /> {image ? 'Trocar' : 'Enviar foto'}</button>
          {image && <button type="button" onClick={onRemove} className="text-left text-[11px] text-[#ff8b8b] hover:underline">Remover</button>}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <Group title="Estilo visual" open={open === 'style'} onToggle={() => toggle('style')}>
        <div className="grid grid-cols-3 gap-2">
          {STYLE_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={data.copy.style === id} onClick={() => update((d) => { d.copy.style = id; })}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-[11px] font-medium transition ${data.copy.style === id ? 'border-[#ff7a45] bg-[#ff5a12]/12 text-white' : 'border-white/[0.1] text-[#c4c9d1] hover:border-white/25'}`}>
              <span className="h-7 w-7 rounded-full border border-white/20" style={{ background: STYLE_LABEL[id].swatch }} />{STYLE_LABEL[id].label}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-semibold text-[#c3c8d0]">Estrutura da página</p>
        <div className="flex flex-wrap gap-1.5">
          {LAYOUT_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={(data.copy.layout || '') === id} onClick={() => update((d) => {
                const previous = d.sections || [];
                d.copy.layout = id;
                const base: SectionRef[] = defaultSections(d).map((section) => ({ ...section, hidden: previous.find((item) => item.id === section.id)?.hidden }));
                const extras = previous.filter((section) => section.type !== 'core');
                const at = base.findIndex((section) => section.id === 'cta');
                base.splice(at === -1 ? base.length : at, 0, ...extras);
                d.sections = base;
              })}
              className={`h-8 rounded-lg border px-3 text-[12px] font-medium transition ${data.copy.layout === id ? 'border-[#ff7a45] bg-[#ff5a12]/12 text-white' : 'border-white/[0.1] text-[#c4c9d1] hover:border-white/25'}`}>
              {LAYOUT_LABEL[id]}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] leading-relaxed text-[#8b929e]">Trocar a estrutura reorganiza as seções para a ordem padrão dela. Seções que você adicionou continuam existindo.</p>
      </Group>

      <Group title="Cores" open={open === 'colors'} onToggle={() => toggle('colors')}>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((color) => (
            <button key={color} type="button" aria-label={`Cor de destaque ${color}`} onClick={() => setDesign((x) => { x.accent = color; })}
              className={`h-8 w-8 rounded-full border-2 transition ${design.accent === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`} style={{ background: color }} />
          ))}
        </div>
        <ColorRow label="Destaque (botões)" value={design.accent} fallback="#ff5a12" onChange={(v) => setDesign((x) => { x.accent = v; })} onReset={() => setDesign((x) => { delete x.accent; })} />
        <ColorRow label="Fundo" value={design.bg} fallback="#ffffff" onChange={(v) => setDesign((x) => { x.bg = v; })} onReset={() => setDesign((x) => { delete x.bg; })} />
        <ColorRow label="Texto" value={design.ink} fallback="#111827" onChange={(v) => setDesign((x) => { x.ink = v; })} onReset={() => setDesign((x) => { delete x.ink; })} />
        <button type="button" onClick={() => update((d) => { d.design = { ...d.design, accent: undefined, bg: undefined, ink: undefined }; })} className="text-[11px] font-medium text-[#ff9869] hover:underline">Voltar às cores do estilo</button>
      </Group>

      <Group title="Fontes e cantos" open={open === 'fonts'} onToggle={() => toggle('fonts')}>
        {([['fontHeading', 'Fonte dos títulos'], ['fontBody', 'Fonte do texto']] as const).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#c3c8d0]">{label}</label>
            <select value={design[key] || ''} onChange={(event) => setDesign((x) => { if (event.target.value) x[key] = event.target.value as FontName; else delete x[key]; })} className={inputClass}>
              <option value="">Padrão do estilo</option>
              <optgroup label="Sem serifa">{FONT_NAMES.filter((n) => !['Fraunces', 'Playfair Display', 'Cormorant Garamond', 'Lora', 'DM Serif Display'].includes(n)).map((n) => <option key={n} value={n}>{n}</option>)}</optgroup>
              <optgroup label="Com serifa">{['Fraunces', 'Playfair Display', 'Cormorant Garamond', 'Lora', 'DM Serif Display'].map((n) => <option key={n} value={n}>{n}</option>)}</optgroup>
            </select>
          </div>
        ))}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[#c3c8d0]">Cantos</p>
          <div className="grid grid-cols-3 gap-2">
            {([['sharp', 'Retos'], ['soft', 'Suaves'], ['round', 'Redondos']] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={(design.radius || 'soft') === id} onClick={() => setDesign((x) => { if (id === 'soft') delete x.radius; else x.radius = id; })}
                className={`h-9 rounded-lg border text-[12px] font-medium ${(design.radius || 'soft') === id ? 'border-[#ff7a45] bg-[#ff5a12]/12 text-white' : 'border-white/[0.1] text-[#c4c9d1] hover:border-white/25'}`}>{label}</button>
            ))}
          </div>
        </div>
      </Group>

      <Group title="Fotos" open={open === 'photos'} onToggle={() => toggle('photos')}>
        <div className="space-y-2 rounded-xl border border-[#ff7a45]/25 bg-[#ff5a12]/[0.05] p-3">
          <Thumb image={data.images.heroBg || null} label="Imagem de fundo do topo" onPick={() => bgInput.current?.click()} onRemove={() => update((d) => { d.images.heroBg = null; })} />
          {data.images.hero && !data.images.heroBg && (
            <button type="button" onClick={() => update((d) => { d.images.heroBg = d.images.hero; })} className="text-[11px] font-semibold text-[#ff9869] hover:underline">Usar a foto principal como fundo</button>
          )}
          <p className="text-[10.5px] leading-relaxed text-[#9aa1ac]">Cobre todo o topo da página, com o título por cima. Funciona em qualquer estrutura.</p>
        </div>
        <Thumb image={data.images.hero} label="Foto principal" onPick={() => heroInput.current?.click()} onRemove={() => update((d) => { d.images.hero = null; })} />
        <Thumb image={data.images.about} label="Foto da seção Sobre" onPick={() => aboutInput.current?.click()} onRemove={() => update((d) => { d.images.about = null; })} />
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-[#c3c8d0]">Galeria ({data.images.gallery.length}/6)</p>
          <div className="flex flex-wrap gap-2">
            {data.images.gallery.map((image, index) => (
              <div key={index} className="group relative h-14 w-20 overflow-hidden rounded-lg border border-white/[0.1]">
                <img src={image.src.startsWith('data:') ? image.src : `${image.src}${image.src.includes('?') ? '&' : '?'}auto=format&fit=crop&q=60&w=200`} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remover foto" onClick={() => update((d) => { d.images.gallery.splice(index, 1); })} className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {data.images.gallery.length < 6 && (
              <button type="button" onClick={() => galleryInput.current?.click()} className="flex h-14 w-20 items-center justify-center rounded-lg border border-dashed border-white/[0.2] text-[#c4c9d1] hover:border-[#ff7a45]/60"><Plus className="h-4 w-4" /></button>
            )}
          </div>
        </div>
        <p className="text-[10.5px] leading-relaxed text-[#8b929e]">Use fotos que você tem direito de usar. As imagens são reduzidas automaticamente para o site carregar rápido.</p>
        <input ref={heroInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void uploadPhoto(e.target.files?.[0], 'hero'); e.target.value = ''; }} />
        <input ref={bgInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void uploadPhoto(e.target.files?.[0], 'heroBg'); e.target.value = ''; }} />
        <input ref={aboutInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void uploadPhoto(e.target.files?.[0], 'about'); e.target.value = ''; }} />
        <input ref={galleryInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void uploadPhoto(e.target.files?.[0], 'gallery'); e.target.value = ''; }} />
      </Group>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
export function SectionsPanel({ data, update, focusSection }: PanelProps) {
  const list: SectionRef[] = data.sections && data.sections.length ? data.sections : defaultSections(data);
  const mutate = (fn: (sections: SectionRef[]) => void) =>
    update((draft) => {
      const sections = (draft.sections && draft.sections.length ? draft.sections : defaultSections(draft)).map((section) => ({ ...section }));
      fn(sections);
      draft.sections = sections;
    });

  const move = (index: number, direction: -1 | 1) => mutate((sections) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
  });

  const add = (type: ExtraType) => {
    const id = randomId();
    mutate((sections) => {
      const at = sections.findIndex((section) => section.id === 'cta');
      sections.splice(at === -1 ? sections.length : at, 0, { id, type, props: prefabProps(type) });
    });
    window.setTimeout(() => focusSection(id), 350);
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b929e]">Ordem das seções</p>
        <ul className="space-y-1.5">
          {list.map((section, index) => {
            const name = SECTION_NAMES[section.type === 'core' ? section.id : section.type] || 'Seção';
            const isCore = (CORE_SECTIONS as readonly string[]).includes(section.id);
            return (
              <li key={section.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${section.hidden ? 'border-white/[0.06] bg-transparent opacity-60' : 'border-white/[0.09] bg-white/[0.03]'}`}>
                <button type="button" onClick={() => focusSection(section.id)} className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-white">
                  {name}{!isCore && <span className="ml-2 rounded bg-[#ff5a12]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ff9869]">extra</span>}
                </button>
                <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-md p-1.5 text-[#b5bac3] hover:bg-white/[0.08] disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Descer" disabled={index === list.length - 1} onClick={() => move(index, 1)} className="rounded-md p-1.5 text-[#b5bac3] hover:bg-white/[0.08] disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label={section.hidden ? 'Mostrar' : 'Ocultar'} onClick={() => mutate((sections) => { sections[index].hidden = !sections[index].hidden; })} className="rounded-md p-1.5 text-[#b5bac3] hover:bg-white/[0.08]">
                  {section.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                {!isCore && (
                  <button type="button" aria-label="Excluir seção" onClick={() => mutate((sections) => { sections.splice(index, 1); })} className="rounded-md p-1.5 text-[#ff8b8b] hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b929e]">Adicionar seção pronta</p>
        <div className="grid gap-2">
          {PREFAB.map((item) => (
            <button key={item.type} type="button" onClick={() => add(item.type)} className="group flex items-start gap-3 rounded-xl border border-white/[0.09] bg-white/[0.02] p-3 text-left transition hover:border-[#ff7a45]/55 hover:bg-[#ff5a12]/[0.05]">
              <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#ff5a12]/15 text-[#ff9869]"><Plus className="h-4 w-4" /></span>
              <span><span className="block text-[13px] font-semibold text-white">{item.title}</span><span className="mt-0.5 block text-[11.5px] leading-snug text-[#9aa1ac]">{item.text}</span></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
