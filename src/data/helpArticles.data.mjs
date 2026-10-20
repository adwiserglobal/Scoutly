/**
 * Help center content. Plain JS on purpose: the app (TypeScript) and the static SEO
 * generator (scripts/build-seo.mjs, run by Node after the Vite build) share this single source.
 * Update `updated` whenever an article changes; it feeds the visible date, the schema and the sitemap.
 */
const img = (name, width, height, alt, caption) => ({
  src: `/help/${name}.webp`,
  width,
  height,
  alt,
  caption,
});

export const HELP_ARTICLES = [
  {
    id: 'relatorio-pdf',
    seoTitle: 'Como gerar relatório em PDF para clientes | Scoutly',
    seoDescription: 'Aprenda a gerar o relatório em PDF da presença digital de uma empresa, com índice, plano de ação e dados reais, pronto para enviar ao cliente.',
    published: '2026-10-20',
    updated: '2026-10-20',
    tag: 'Relatórios',
    title: 'Como gerar o relatório em PDF para enviar ao cliente',
    summary: 'Baixe um relatório de 3 páginas com os dados reais da empresa, pronto para mandar por WhatsApp ou e-mail.',
    readMinutes: 3,
    intro:
      'O relatório mostra como está a presença digital da empresa (site, velocidade, contato, redes e avaliações), explica o que isso significa na prática e propõe um plano de ação. Todos os números vêm de dados observados e nenhum telefone ou e-mail aparece no arquivo.',
    steps: [
      {
        title: 'Abra a empresa',
        body: 'No mapa, clique no pino da empresa ou escolha-a na lista de resultados. O painel com o perfil abre no lado direito da tela.',
      },
      {
        title: 'Clique em “Relatório para o cliente (PDF)”',
        body: 'O botão fica logo abaixo de “Ligar” (ou “WhatsApp confirmado”) e “Ver site”. Se a empresa tem site, o Scoutly espera a medição de velocidade do Google antes de gerar: por alguns segundos o botão mostra “Medindo velocidade do site…”.',
        images: [img('a1-side-pdf', 1140, 840, 'Painel da empresa com o botão Relatório para o cliente (PDF) destacado')],
      },
      {
        title: 'Baixe e confira o arquivo',
        body: 'O PDF é baixado automaticamente com o nome relatorio-presenca-digital-nome-da-empresa.pdf. A página 1 traz o índice de presença digital (de 0 a 100) e os quatro pilares avaliados; a página 2 explica o que cada resultado significa; a página 3 traz o plano de ação sugerido.',
        images: [img('a1-pdf-pages', 1400, 988, 'Páginas 1 e 3 do relatório em PDF', 'Páginas 1 (resumo) e 3 (plano de ação) do relatório')],
      },
      {
        title: 'Envie ao cliente',
        body: 'Anexe o PDF à sua mensagem de WhatsApp ou e-mail. O relatório termina com um convite para conversar, então ele já ajuda a fechar a reunião.',
      },
    ],
    tips: [
      'Para o relatório sair com a sua logo, cores e contato, veja o artigo “Como colocar sua logo e cores no relatório”.',
      'Se a medição de velocidade do Google não estiver disponível (site fora do ar, por exemplo), o relatório sai sem a nota de velocidade em vez de mostrar um número estimado.',
      'Se o botão avisar que o Scoutly foi atualizado, clique em “Recarregar página” e tente de novo.',
    ],
  },
  {
    id: 'logo-e-cores',
    seoTitle: 'Como colocar sua logo e cores no relatório | Scoutly',
    seoDescription: 'Veja como personalizar o relatório em PDF da Scoutly com a sua logo, cores, nome e contato, para enviar ao cliente com a identidade da sua marca.',
    published: '2026-10-20',
    updated: '2026-10-20',
    tag: 'Relatórios',
    title: 'Como colocar sua logo e cores no relatório',
    summary: 'Personalize o PDF com o nome, a logo, as cores e o contato da sua empresa ou agência.',
    readMinutes: 3,
    intro:
      'Por padrão o relatório sai com a identidade do Scoutly. Em poucos passos você troca por a sua: nome, logo, paleta de cores, frase de apresentação e contato. A configuração vale para todos os relatórios que você gerar.',
    steps: [
      {
        title: 'Abra as Configurações',
        body: 'No menu lateral, clique em “Configurações”. No celular, abra o menu (ícone de três linhas) e escolha “Configurações”.',
        images: [img('a2-menu', 880, 1120, 'Menu lateral com o item Configurações destacado')],
      },
      {
        title: 'Vá até “Identidade do relatório em PDF”',
        body: 'É a seção logo abaixo de “Minha abordagem comercial”. Preencha o nome que deve aparecer no relatório (o seu ou o da sua agência) e, se quiser, uma frase de apresentação.',
      },
      {
        title: 'Envie a logo e escolha as cores',
        body: 'Clique em “Enviar logo” (1). Aceitamos PNG, JPG, WebP ou SVG; fundo transparente funciona melhor. Depois escolha uma paleta pronta (2) ou defina a cor de destaque e a cor da capa. A capa leva texto branco, então use uma cor escura nela: o Scoutly avisa se a cor ficar clara demais.',
        images: [
          img('a2-brand', 1400, 1397, 'Seção Identidade do relatório com logo, paleta, contato e botão Salvar numerados', '① Logo · ② Paleta e cores · ③ Contato · ④ Salvar'),
        ],
      },
      {
        title: 'Adicione o seu contato',
        body: 'Em “Contato no final do relatório” (3), informe e-mail, WhatsApp e site ou Instagram. Eles aparecem no convite para conversa, na última página do PDF.',
      },
      {
        title: 'Salve e gere um relatório',
        body: 'Clique em “Salvar identidade” (4). A prévia da capa, ao lado do formulário, mostra como ficará. A partir daí, todo relatório já sai com a sua marca.',
        images: [img('a2-pdf-branded', 1400, 988, 'Relatório em PDF com logo, cores e contato personalizados', 'Exemplo de relatório com a identidade de uma marca fictícia')],
      },
    ],
    tips: [
      'A logo é colocada sobre uma faixa branca na capa, para aparecer bem em qualquer cor.',
      'O rodapé continua indicando que os dados foram coletados com o Scoutly.',
      'Se o nome ficar em branco, o relatório usa o nome da sua conta.',
    ],
  },
  {
    id: 'abordagem-ia',
    seoTitle: 'Como a IA escreve mensagens com a sua oferta | Scoutly',
    seoDescription: 'Descreva o que você faz e deixe a IA da Scoutly escrever mensagens de WhatsApp e e-mail com a sua oferta, para vender serviços ou buscar uma vaga.',
    published: '2026-10-20',
    updated: '2026-10-20',
    tag: 'Inteligência artificial',
    title: 'Como fazer a IA escrever mensagens com a sua oferta',
    summary: 'Conte à IA o que você faz e ela passa a escrever as abordagens de WhatsApp e e-mail em seu nome.',
    readMinutes: 4,
    intro:
      'Cada pessoa vende algo diferente: um freelancer de sites, uma agência, alguém buscando uma vaga. Em “Minha abordagem comercial” você descreve a sua situação e a IA escreve as mensagens falando por você, sem textos genéricos.',
    steps: [
      {
        title: 'Abra “Minha abordagem comercial”',
        body: 'Vá em “Configurações” no menu lateral. A seção fica logo abaixo do seu perfil.',
        images: [img('a2-menu', 880, 1120, 'Menu lateral com o item Configurações destacado')],
      },
      {
        title: 'Escolha o que você busca',
        body: 'Selecione entre vender seus serviços, conseguir uma oportunidade (vaga, estágio, projeto), propor parceria ou outro objetivo. A IA muda a abordagem conforme a escolha: quem busca uma vaga, por exemplo, não recebe mensagens vendendo serviços.',
        images: [img('a3-outreach-goal', 1400, 481, 'Opções de objetivo da abordagem comercial', 'Escolha o objetivo da abordagem')],
      },
      {
        title: 'Descreva o que você faz',
        body: 'Escreva com suas palavras o que oferece (1), para quem e quais são seus diferenciais. Em “Ação desejada ao final” (2) diga o que quer que o cliente faça, como “agendar uma conversa de 15 minutos”. Use “O que evitar” para regras como não citar preços. Escolha também o tom de voz.',
        images: [img('a3-outreach-fields', 1400, 1006, 'Campos da abordagem comercial: o que você faz, ação desejada e botão salvar', '① O que você faz · ② Ação desejada · ③ Salvar')],
      },
      {
        title: 'Salve',
        body: 'Clique em “Salvar abordagem” (3). A confirmação “Abordagem salva” aparece logo abaixo do formulário.',
      },
      {
        title: 'Gere a mensagem em uma empresa',
        body: 'Abra uma empresa, vá em “Abordagem comercial” e clique em “Gerar abordagem”. A IA usa o que você descreveu e os sinais reais da empresa (como não ter site). Para outra versão, clique em “Gerar outra versão” (2); para usar, clique em “Copiar”.',
        images: [img('a3-message', 1140, 1720, 'Mensagem gerada pela IA no painel da empresa', 'Exemplo de mensagem gerada com a oferta de uma freelancer de sites')],
      },
    ],
    tips: [
      'A IA usa apenas o que você escreveu: ela não inventa serviços, preços ou resultados.',
      'Sem a abordagem preenchida, as mensagens saem com um texto genérico.',
      'Revise a mensagem antes de enviar. Ela é um ótimo ponto de partida, mas é você quem assina.',
    ],
  },
  {
    id: 'pipeline',
    seoTitle: 'Como adicionar empresas ao pipeline | Scoutly',
    seoDescription: 'Passo a passo para adicionar empresas ao pipeline da Scoutly, mover cada contato entre etapas e acompanhar negociações até o fechamento.',
    published: '2026-10-20',
    updated: '2026-10-20',
    tag: 'Organização',
    title: 'Como adicionar uma empresa ao pipeline e acompanhar a negociação',
    summary: 'Organize seus contatos em etapas e saiba em que pé está cada negociação.',
    readMinutes: 3,
    intro:
      'O pipeline é o seu funil de vendas: cada empresa que você aborda fica em uma coluna (Contatados, Em negociação, Fechados ou Perdidos) e avança conforme a conversa evolui.',
    steps: [
      {
        title: 'Abra a empresa',
        body: 'No mapa, clique no pino da empresa ou escolha-a na lista de resultados.',
      },
      {
        title: 'Clique em “Adicionar ao pipeline”',
        body: 'O botão fica no topo do painel, ao lado da estrela. Depois do clique, ele vira o selo verde “No pipeline” e a empresa entra na coluna “Contatados”.',
        images: [
          img('a4-add', 1140, 660, 'Botão Adicionar ao pipeline no topo do painel da empresa', 'Antes: botão “Adicionar ao pipeline”'),
          img('a4-added', 1140, 660, 'Selo No pipeline no topo do painel da empresa', 'Depois: selo “No pipeline”'),
        ],
      },
      {
        title: 'Abra a aba Pipeline',
        body: 'No menu lateral, clique em “Pipeline”. As empresas aparecem em quatro colunas: Contatados (1), Em negociação, Fechados e Perdidos.',
        images: [img('a4-pipeline', 800, 560, 'Tela do pipeline com as colunas de etapas', '① Colunas de etapas · ② Avançar etapa')],
      },
      {
        title: 'Mude a empresa de etapa',
        body: 'Conforme a conversa avança, use o botão “Avançar etapa” (2) do card ou arraste o card para outra coluna. Para voltar, use “Recuar etapa”. Se o negócio não deu certo, mova para “Perdidos”.',
      },
      {
        title: 'Registre anotações',
        body: 'Em cada card você pode escrever um comentário (por exemplo, o nome da pessoa que atendeu). Abrindo a ficha completa da empresa, também é possível salvar anotações no “Funil de vendas (CRM)”.',
      },
    ],
    tips: [
      'Ao abrir o WhatsApp de uma empresa, o Scoutly pergunta se você quer adicioná-la ao pipeline.',
      'Favoritos e pipeline são diferentes: o favorito serve para guardar, o pipeline serve para acompanhar a negociação.',
    ],
  },
  {
    id: 'empresas-sem-site',
    seoTitle: 'Como encontrar empresas sem site | Scoutly',
    seoDescription: 'Aprenda a usar busca, filtros e recomendações da Scoutly para encontrar empresas sem site e com WhatsApp e priorizar as melhores oportunidades.',
    published: '2026-10-20',
    updated: '2026-10-20',
    tag: 'Prospecção',
    title: 'Como encontrar empresas sem site e com contato',
    summary: 'Use busca, filtros e recomendações para chegar às melhores oportunidades da região.',
    readMinutes: 4,
    intro:
      'Empresas sem site, mas com WhatsApp, costumam ser ótimas oportunidades para vender sites, anúncios e automação. Veja como encontrá-las em poucos cliques e avisar quando um dado estiver errado.',
    steps: [
      {
        title: 'Aproxime o mapa da região',
        body: 'Digite uma cidade, bairro ou segmento na busca (1) ou use “Perto de você”. As empresas aparecem a partir do zoom 11; se o mapa avisar “Aproxime o mapa”, dê mais zoom.',
        images: [img('a5-header', 1400, 133, 'Barra superior com busca, filtros e recomendados numerados', '① Busca · ② Filtros · ③ Recomendados')],
      },
      {
        title: 'Abra os Filtros',
        body: 'Clique em “Filtros” (2), ao lado da busca. O painel abre no lado direito da tela.',
      },
      {
        title: 'Marque “Sem site” e “Com WhatsApp”',
        body: 'Clique em “Sem site (Oportunidades)” (1) e em “Com WhatsApp” (2). Os dois filtros funcionam juntos, e o número de empresas no mapa e na lista se atualiza na hora. Você também pode filtrar por categoria e ordenar o resultado.',
        images: [img('a5-filters', 880, 1040, 'Painel de filtros com Sem site e Com WhatsApp selecionados', '① Sem site · ② Com WhatsApp')],
      },
      {
        title: 'Veja as recomendações',
        body: 'Clique em “Recomendados” (3 na primeira imagem) para abrir um card à direita com as empresas que mais combinam com a sua prospecção (1). Na aba “Empresas novas” (2) ficam as empresas abertas há poucos meses, que ainda não têm presença digital estruturada. Esse recurso está nos planos Pro e Agency.',
        images: [img('a5-recs', 880, 1160, 'Card de recomendados com as abas Para você e Empresas novas', '① Empresa recomendada · ② Empresas novas')],
      },
      {
        title: 'Confira os dados e avise se algo estiver errado',
        body: 'Antes de abordar, abra a empresa e veja o WhatsApp, o site e as redes. Se algo estiver desatualizado, clique no polegar para baixo em “Os dados estão atualizados?” e escolha o que podemos melhorar: WhatsApp, Site, Redes sociais ou Outros. A equipe recebe o aviso e corrige a base.',
        images: [img('a5-feedback', 1140, 800, 'Pergunta sobre quais dados podem ser melhorados no painel da empresa')],
      },
    ],
    tips: [
      'Combine “Sem site” com “Com WhatsApp” para falar direto com quem decide.',
      'Use o relatório em PDF para mostrar ao dono da empresa, com dados reais, o que ele está perdendo sem um site.',
    ],
  },
];

export function getHelpArticle(id) {
  return HELP_ARTICLES.find((article) => article.id === id);
}
