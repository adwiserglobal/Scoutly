import type { Business, PageSpeedData } from '../types';

/** Subset of the tracking audit (static public HTML scan) used by the report. */
export interface DiagnosticTracking {
  status?: string;
  ga4?: { detected?: boolean };
  gtm?: { detected?: boolean };
  metaPixel?: { detected?: boolean };
  googleAds?: { detected?: boolean };
}

export interface DiagnosticPdfOptions {
  business: Business;
  /** Website URL resolved by the app (dataset or discovered on the web). */
  websiteUrl?: string | null;
  /** PageSpeed result for the website, when available. */
  pageSpeed?: PageSpeedData | null;
  tracking?: DiagnosticTracking | null;
  /**
   * Contact availability only. The report is sent to the business itself and must
   * never carry phone/e-mail values, so locked (credit-gated) contacts cannot leak.
   */
  contact: { hasPhone: boolean; hasWhatsApp: boolean; hasEmail: boolean };
  /** Name shown as the author of the report (agency / consultant). */
  preparedBy?: string | null;
}

type RGB = [number, number, number];

const ORANGE: RGB = [255, 90, 18];
const INK: RGB = [30, 30, 30];
const MUTED: RGB = [110, 110, 110];
const LINE: RGB = [232, 226, 217];
const PAPER: RGB = [250, 247, 242];
const GREEN: RGB = [22, 163, 74];
const AMBER: RGB = [217, 119, 6];
const RED: RGB = [220, 38, 38];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 22;

function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'empresa'
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function hostOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function socialName(url: string): string {
  const host = hostOf(url).toLowerCase();
  if (host.includes('instagram')) return 'Instagram';
  if (host.includes('facebook') || host.includes('fb.com')) return 'Facebook';
  if (host.includes('tiktok')) return 'TikTok';
  if (host.includes('youtube') || host.includes('youtu.be')) return 'YouTube';
  if (host.includes('linkedin')) return 'LinkedIn';
  if (host.includes('wa.me') || host.includes('whatsapp')) return 'WhatsApp';
  return host;
}

function scoreColor(score: number): RGB {
  return score >= 90 ? GREEN : score >= 50 ? AMBER : RED;
}

function scoreLabel(score: number): string {
  return score >= 90 ? 'Rápido' : score >= 50 ? 'Moderado' : 'Lento';
}

/**
 * Builds and downloads a client-ready PDF diagnosing the business's digital presence.
 * PageSpeed figures are only included when they come from the real Google PageSpeed
 * Insights API; Scoutly's own estimates are never presented as Google data.
 */
export async function downloadDiagnosticPdf({
  business,
  websiteUrl,
  pageSpeed,
  tracking,
  contact,
  preparedBy,
}: DiagnosticPdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const now = new Date();

  const socials = Array.from(new Set((business.socials || []).map(socialName)));
  const website = websiteUrl || business.website || null;
  const googleSpeed = pageSpeed && pageSpeed.source === 'google_pagespeed_api' ? pageSpeed : null;
  const hasPhone = contact.hasPhone || contact.hasWhatsApp;
  const hasTrackingData = Boolean(tracking && tracking.status === 'verified');
  const trackers = hasTrackingData
    ? [
        tracking?.ga4?.detected && 'Google Analytics 4',
        tracking?.gtm?.detected && 'Google Tag Manager',
        tracking?.metaPixel?.detected && 'Meta Pixel',
        tracking?.googleAds?.detected && 'Google Ads',
      ].filter(Boolean) as string[]
    : [];

  let y = 0;

  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const paragraph = (text: string, opts: { size?: number; bold?: boolean; c?: RGB; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    color(opts.c ?? INK);
    const lines: string[] = doc.splitTextToSize(text, CONTENT_W - indent);
    const lineH = size * 0.42;
    ensureSpace(lines.length * lineH + 1);
    doc.text(lines, MARGIN + indent, y + lineH * 0.8);
    y += lines.length * lineH + (opts.gap ?? 2);
  };

  const sectionTitle = (title: string) => {
    ensureSpace(16);
    y += 4;
    fill(ORANGE);
    doc.rect(MARGIN, y, 1.6, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    color(INK);
    doc.text(title, MARGIN + 4.5, y + 4.8);
    y += 10;
  };

  const chip = (text: string, c: RGB, x: number, yy: number, w: number) => {
    fill(c);
    doc.roundedRect(x, yy, w, 5.6, 1.6, 1.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(text, x + w / 2, yy + 3.9, { align: 'center' });
  };

  const checkRow = (label: string, status: 'ok' | 'warn' | 'info', value: string) => {
    const valueLines: string[] = (doc.setFont('helvetica', 'normal'), doc.setFontSize(9.5), doc.splitTextToSize(value, CONTENT_W - 78));
    const rowH = Math.max(9, valueLines.length * 4.2 + 4.5);
    ensureSpace(rowH);
    stroke(LINE);
    doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    color(INK);
    doc.text(label, MARGIN, y + 5.6);
    if (status === 'ok') chip('OK', GREEN, MARGIN + 52, y + 2, 16);
    else if (status === 'warn') chip('ATENÇÃO', RED, MARGIN + 52, y + 2, 16);
    else chip('INFO', MUTED, MARGIN + 52, y + 2, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    color(INK);
    doc.text(valueLines, MARGIN + 72, y + 5.6);
    y += rowH;
  };

  // ---------------------------------------------------------------- Header
  fill(ORANGE);
  doc.rect(0, 0, PAGE_W, 44, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('DIAGNÓSTICO DE PRESENÇA DIGITAL', MARGIN, 14);
  doc.setFontSize(20);
  const nameLines: string[] = doc.splitTextToSize(business.name, CONTENT_W - 40);
  doc.text(nameLines.slice(0, 2), MARGIN, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Emitido em ${formatDate(now)}`, PAGE_W - MARGIN, 14, { align: 'right' });
  if (business.category) {
    doc.text(business.category, MARGIN, nameLines.length > 1 ? 40 : 34);
  }
  y = 52;

  // ---------------------------------------------------------------- Summary
  sectionTitle('Resumo da empresa');
  const summary: Array<[string, string]> = [];
  if (business.category) summary.push(['Segmento', business.category]);
  if (business.address) summary.push(['Endereço', business.address]);
  if (website) summary.push(['Site', hostOf(website)]);
  for (const [k, v] of summary) {
    ensureSpace(7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    color(MUTED);
    doc.text(k, MARGIN, y + 4);
    doc.setFont('helvetica', 'normal');
    color(INK);
    const lines: string[] = doc.splitTextToSize(v, CONTENT_W - 30);
    doc.text(lines, MARGIN + 30, y + 4);
    y += Math.max(6.5, lines.length * 4.4 + 2);
  }

  // ---------------------------------------------------------------- Presence
  sectionTitle('Presença digital');
  checkRow(
    'Site próprio',
    website ? 'ok' : 'warn',
    website ? `Encontrado: ${hostOf(website)}` : 'Não identificamos um site próprio da empresa.'
  );
  if (website && /^https:\/\//i.test(website)) {
    checkRow('Site seguro (HTTPS)', 'ok', 'O endereço do site usa conexão segura.');
  } else if (website && /^http:\/\//i.test(website)) {
    checkRow('Site seguro (HTTPS)', 'warn', 'O endereço cadastrado não usa HTTPS; navegadores podem alertar os visitantes.');
  }
  checkRow(
    'Telefone / WhatsApp',
    hasPhone ? 'ok' : 'warn',
    contact.hasWhatsApp
      ? 'WhatsApp identificado para atendimento.'
      : hasPhone
      ? 'Contato direto disponível para os clientes.'
      : 'Nenhum telefone público encontrado.'
  );
  checkRow(
    'Redes sociais',
    socials.length ? 'ok' : 'warn',
    socials.length ? socials.join(', ') : 'Nenhum perfil em redes sociais identificado.'
  );
  checkRow('E-mail', contact.hasEmail ? 'ok' : 'info', contact.hasEmail ? 'E-mail de contato disponível.' : 'Nenhum e-mail público identificado.');
  if (website && hasTrackingData) {
    checkRow(
      'Medição de resultados',
      trackers.length ? 'ok' : 'info',
      trackers.length
        ? `Detectado no site: ${trackers.join(', ')}.`
        : 'Não detectamos Google Analytics ou Pixel no código público da página inicial.'
    );
  }

  // ---------------------------------------------------------------- Speed
  if (website) {
    sectionTitle('Velocidade do site (Google PageSpeed Insights, celular)');
    if (googleSpeed) {
      ensureSpace(34);
      const c = scoreColor(googleSpeed.score);
      fill(PAPER);
      stroke(LINE);
      doc.roundedRect(MARGIN, y, CONTENT_W, 26, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(30);
      color(c);
      doc.text(String(googleSpeed.score), MARGIN + 8, y + 17);
      const scoreW = doc.getTextWidth(String(googleSpeed.score));
      doc.setFontSize(9);
      color(MUTED);
      doc.text('/ 100', MARGIN + 8 + scoreW + 1.5, y + 17);
      chip(scoreLabel(googleSpeed.score).toUpperCase(), c, MARGIN + 44, y + 6, 24);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      color(INK);
      const note: string[] = doc.splitTextToSize(
        'Nota de desempenho medida pelo Google no celular. Notas abaixo de 50 são consideradas lentas; acima de 90, rápidas.',
        CONTENT_W - 52
      );
      doc.text(note, MARGIN + 44, y + 15);
      y += 31;

      const metrics: Array<[string, string, string]> = [
        ['Primeiro conteúdo', googleSpeed.fcp || '-', 'Quando algo aparece na tela'],
        ['Maior elemento', googleSpeed.lcp || '-', 'Quando o conteúdo principal carrega'],
        ['Bloqueio', googleSpeed.tbt || '-', 'Tempo em que a página trava'],
        ['Estabilidade', googleSpeed.cls || '-', 'O layout "pula" durante o carregamento?'],
        ['Índice de velocidade', googleSpeed.speedIndex || '-', 'Rapidez de exibição geral'],
      ];
      const boxW = (CONTENT_W - 4 * 3) / 5;
      ensureSpace(26);
      metrics.forEach(([label, value, caption], i) => {
        const x = MARGIN + i * (boxW + 3);
        stroke(LINE);
        fill([255, 255, 255]);
        doc.roundedRect(x, y, boxW, 24, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        color(MUTED);
        doc.text(doc.splitTextToSize(label, boxW - 4), x + 2.5, y + 5);
        doc.setFontSize(12);
        color(INK);
        doc.text(value, x + 2.5, y + 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        color(MUTED);
        doc.text(doc.splitTextToSize(caption, boxW - 4), x + 2.5, y + 17.5);
      });
      y += 30;

      if (googleSpeed.diagnostics && googleSpeed.diagnostics.length > 0) {
        paragraph('Pontos de melhoria identificados pelo Google', { bold: true, size: 10, gap: 1.5 });
        for (const d of googleSpeed.diagnostics.slice(0, 6)) {
          ensureSpace(6);
          fill(ORANGE);
          doc.circle(MARGIN + 1.5, y + 2.6, 0.8, 'F');
          paragraph(`${d.title}  (impacto ${d.impact.toLowerCase()})`, { indent: 5, size: 9.5, gap: 1.2 });
        }
      }
      const measured = googleSpeed.fetchedAt ? new Date(googleSpeed.fetchedAt) : now;
      paragraph(`Medição realizada em ${formatDate(measured)} para ${hostOf(googleSpeed.url || website)}.`, {
        size: 8,
        c: MUTED,
        gap: 1,
      });
    } else {
      paragraph(
        'A medição oficial de velocidade do Google não estava disponível no momento da emissão deste relatório, por isso não apresentamos nota de desempenho.',
        { size: 9.5, c: MUTED }
      );
    }
  }

  // ---------------------------------------------------------------- Opportunities
  sectionTitle('Oportunidades identificadas');
  const opportunities: string[] = [];
  if (!website) {
    opportunities.push(
      'Sem site próprio, a empresa depende de mapas e redes sociais para ser encontrada. Um site com botão de WhatsApp e formulário captura clientes que pesquisam no Google.'
    );
  } else if (googleSpeed) {
    if (googleSpeed.score < 50) {
      opportunities.push(
        `O site é considerado lento pelo Google no celular (nota ${googleSpeed.score}/100). O conteúdo principal leva ${googleSpeed.lcp || 'tempo demais'} para aparecer, e visitantes impacientes tendem a sair antes do carregamento.`
      );
    } else if (googleSpeed.score < 90) {
      opportunities.push(
        `O site tem desempenho moderado (nota ${googleSpeed.score}/100). Há espaço para ganhar velocidade e melhorar o posicionamento frente a concorrentes mais rápidos.`
      );
    } else {
      opportunities.push(
        `O site tem boa velocidade (nota ${googleSpeed.score}/100). As oportunidades estão em captar mais contatos, SEO local e campanhas de divulgação.`
      );
    }
  }
  if (website && /^http:\/\//i.test(website)) {
    opportunities.push('Migrar o site para HTTPS transmite confiança e evita avisos de "site não seguro" nos navegadores.');
  }
  if (!hasPhone) {
    opportunities.push('Divulgar um telefone ou WhatsApp facilita o contato e aumenta a chance de conversão de quem encontra a empresa.');
  }
  if (!socials.length) {
    opportunities.push('Criar e manter perfis em redes sociais amplia o alcance e dá prova social à marca.');
  }
  if (website && hasTrackingData && trackers.length === 0) {
    opportunities.push('Instalar ferramentas de medição (como Google Analytics) permite saber de onde vêm os clientes e quanto cada canal rende.');
  }
  if (opportunities.length === 0) {
    opportunities.push('A presença digital está bem estruturada. Podemos explorar anúncios, automação de atendimento e SEO local para crescer ainda mais.');
  }
  for (const item of opportunities) {
    ensureSpace(8);
    fill(ORANGE);
    doc.circle(MARGIN + 1.5, y + 2.6, 0.8, 'F');
    paragraph(item, { indent: 5, size: 9.5, gap: 2.2 });
  }

  // ---------------------------------------------------------------- Next steps
  sectionTitle('Próximos passos');
  paragraph(
    `Podemos apresentar um plano de ação sob medida para ${business.name}, com prioridades, prazos e investimento. Responda a esta mensagem para agendarmos uma conversa rápida.`,
    { size: 10 }
  );
  if (preparedBy) {
    paragraph(`Preparado por: ${preparedBy}`, { bold: true, size: 10, gap: 1 });
  }

  // ---------------------------------------------------------------- Footer
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(LINE);
    doc.line(MARGIN, PAGE_H - 16, PAGE_W - MARGIN, PAGE_H - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    color(MUTED);
    const sources = googleSpeed
      ? 'Fontes: Google PageSpeed Insights e dados públicos de cadastro (Overture Maps), que podem estar desatualizados.'
      : 'Fonte: dados públicos de cadastro (Overture Maps), que podem estar desatualizados.';
    doc.text(sources, MARGIN, PAGE_H - 11);
    doc.text(`Gerado com Scoutly  |  ${p}/${pages}`, PAGE_W - MARGIN, PAGE_H - 11, { align: 'right' });
  }

  doc.save(`diagnostico-${slugify(business.name)}.pdf`);
}
