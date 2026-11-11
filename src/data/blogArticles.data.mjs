/**
 * Public blog / guides content (indexed at /blog/). Plain JS so both the Vite app and the
 * Node SEO build can import it. Inline markup supported in strings: **bold** and [label](/path).
 *
 * Editorial rules:
 *  - No invented statistics. Anything quantitative must be framed as an example or a rule of thumb.
 *  - Legal and platform topics describe general principles and point to the official source.
 *    They are not legal advice.
 */
export const BLOG_ROUTE = '/blog/';
export const BLOG_AUTHOR = 'Equipe Scoutly';

export const BLOG_ARTICLES = [
  {
    id: 'como-prospectar-clientes-no-google-maps',
    tag: 'Prospecção',
    title: 'Como prospectar clientes no Google Maps: método passo a passo (2026)',
    seoTitle: 'Como prospectar clientes no Google Maps (guia 2026)',
    seoDescription: 'Aprenda a prospectar clientes no Google Maps: como escolher nicho e região, qualificar empresas em minutos, abordar e organizar tudo em um funil simples.',
    published: '2026-10-20',
    updated: '2026-10-20',
    readMinutes: 9,
    tldr: [
      'O Google Maps é a maior lista pública de negócios locais, mas ele foi feito para clientes, não para vendedores: você precisa de um método para transformar resultados em leads qualificados.',
      'O processo que funciona tem 5 passos: escolher nicho + território, listar, qualificar por sinais digitais, abordar com um motivo concreto e registrar tudo em um pipeline.',
      'O que separa quem fecha de quem só coleta nomes é a qualificação: uma empresa sem site, com site lento ou sem rastreamento é uma oportunidade específica para um serviço específico.'
    ],
    intro: 'Quase toda agência, freelancer e prestador de serviço local já fez a mesma coisa: abriu o Google Maps, digitou "dentista em Campinas" e começou a copiar telefones em uma planilha. Funciona para as primeiras dez empresas. Depois disso, a lista vira um monte de nomes sem prioridade, sem histórico de contato e sem motivo para ligar. Este guia mostra um método para prospectar clientes no Google Maps de forma repetível, do primeiro filtro até a primeira reunião.',
    sections: [
      {
        id: 'por-que-maps',
        h: 'Por que o Google Maps é uma boa fonte de leads',
        p: [
          'Quem procura um serviço local abre o Maps, e quem quer ser encontrado cadastra o negócio nele. Por isso, a lista de empresas de um bairro costuma estar mais completa ali do que em diretórios antigos, e mostra sinais úteis para vender: avaliações, fotos, horário, site cadastrado e categoria.',
          'Há três limitações que você precisa assumir desde o início:'
        ],
        ul: [
          '**A cobertura varia.** Nem toda empresa tem ficha, e algumas fichas estão desatualizadas. Trate cada dado como uma pista a confirmar, não como verdade absoluta.',
          '**O Maps não organiza nada para você.** Ele não registra quem você já contatou, nem quando, nem o que foi dito.',
          '**Copiar dados em massa viola os termos do Google e não resolve o problema.** Uma lista enorme sem qualificação só aumenta o trabalho. Prefira ferramentas que usem fontes e APIs permitidas e foque em qualidade.'
        ]
      },
      {
        id: 'passo-1-nicho-territorio',
        h: 'Passo 1: escolha um nicho e um território pequeno',
        p: [
          'O erro mais comum é começar amplo demais ("restaurantes no Brasil"). Um recorte pequeno permite que a sua mensagem seja específica e que você aprenda rápido o que funciona.',
          'Uma regra prática: escolha **um segmento**, **uma cidade ou bairro** e **um serviço seu** que resolva um problema visível nesse segmento.'
        ],
        table: {
          head: ['Se você vende…', 'Segmentos que costumam ter a dor', 'Sinal a procurar'],
          rows: [
            ['Criação de sites', 'Clínicas, oficinas, restaurantes, salões, escolas', 'Ficha sem site ou só com rede social'],
            ['Tráfego pago', 'Clínicas, academias, imobiliárias, e-commerces locais', 'Site sem Pixel/Tag Manager, poucas avaliações recentes'],
            ['SEO local', 'Advogados, dentistas, serviços residenciais', 'Ficha incompleta, categoria genérica, fotos antigas'],
            ['Automação / WhatsApp', 'Clínicas, estética, delivery, concessionárias', 'Atendimento só por telefone, sem canal digital claro'],
            ['Velocidade / manutenção de site', 'Qualquer negócio com site próprio', 'PageSpeed baixo no celular']
          ]
        },
        p2: ['Comece com um território onde você consiga, se der certo, visitar ou ligar no mesmo dia. Isso encurta o ciclo de aprendizado.']
      },
      {
        id: 'passo-2-listar',
        h: 'Passo 2: liste as empresas do recorte',
        p: [
          'Faça a busca por segmento e região e salve apenas o que parece promissor. Na prática, vale listar entre 30 e 50 empresas por rodada: é o suficiente para ter volume, e pequeno o bastante para ser qualificado no mesmo dia.',
          'Na [Scoutly](/prospeccao-local/), você busca por segmento e região, vê as empresas no mapa e salva favoritos sem copiar e colar nada. O mesmo fluxo manual funciona com planilha, desde que você registre o mínimo: nome, segmento, bairro, site, telefone, data do contato e status.'
        ]
      },
      {
        id: 'passo-3-qualificar',
        h: 'Passo 3: qualifique por sinais digitais (aqui está o dinheiro)',
        p: [
          'Qualificar é responder, em 2 minutos por empresa, à pergunta: **"Existe um problema concreto que eu posso resolver e que o dono consegue enxergar?"** Sinais públicos ajudam a responder isso.'
        ],
        table: {
          head: ['Sinal', 'Como verificar', 'O que ele sugere'],
          rows: [
            ['Não tem site', 'Ficha sem link, ou link só para Instagram/Linktree', 'Oportunidade para site institucional ou página de captação'],
            ['Site lento no celular', 'Teste gratuito no PageSpeed Insights', 'Perda de visitantes; pauta para otimização'],
            ['Sem Google Analytics / Tag Manager / Pixel', 'Inspeção do código ou ferramenta de auditoria', 'Não mede resultados; porta de entrada para tráfego e analytics'],
            ['Poucas avaliações ou sem resposta do dono', 'Ficha no Maps', 'Reputação local pouco trabalhada'],
            ['Fotos antigas, horário incompleto', 'Ficha no Maps', 'Ficha negligenciada; serviço de gestão de perfil'],
            ['Site sem HTTPS ou sem botão de contato', 'Abrir o site no celular', 'Problemas de conversão e confiança']
          ]
        },
        p2: [
          '**Importante:** um sinal "não detectado" é uma hipótese, não uma prova. Uma empresa pode usar uma ferramenta de um jeito que a verificação automática não vê. Por isso, na abordagem, fale em "identifiquei" ou "não encontrei", nunca em "vocês não têm".',
          'Dê uma nota simples a cada lead (por exemplo, de 0 a 3 pontos para: sinal claro de dor, empresa com sinais de que pode pagar, canal de contato disponível). Priorize quem soma mais pontos.'
        ]
      },
      {
        id: 'passo-4-abordar',
        h: 'Passo 4: aborde com um motivo concreto, não com um pitch genérico',
        p: [
          'Uma mensagem funciona quando prova que você olhou para o negócio da pessoa. A estrutura mais simples tem quatro partes: **observação específica → impacto provável → oferta pequena → pergunta fácil de responder**.'
        ],
        example: 'Olá, Marina! Vi a clínica no Google e reparei que, pelo celular, o site demora bastante para abrir. Quando isso acontece, muita gente desiste antes de ver o botão de agendar. Posso te mandar um diagnóstico de 1 página, sem custo, mostrando onde dá para melhorar?',
        p2: [
          'Veja que a mensagem não promete resultado, não ataca o concorrente e não pede 30 minutos de reunião logo de cara. O pedido é pequeno.',
          'Para cada canal, siga as regras dele. Sobre WhatsApp, leia o guia [prospecção no WhatsApp sem ser banido](/blog/prospeccao-whatsapp-sem-ser-banido/); sobre dados pessoais, veja [prospecção B2B e LGPD](/blog/prospeccao-de-empresas-lgpd/).'
        ]
      },
      {
        id: 'passo-5-pipeline',
        h: 'Passo 5: registre tudo em um pipeline e faça follow-up',
        p: [
          'A maior parte das vendas B2B locais não fecha no primeiro contato. Sem registro, você esquece quem pediu para retornar na semana que vem. Use etapas simples:'
        ],
        ol: [
          '**Novo:** empresa qualificada, ainda não contatada.',
          '**Contatado:** mensagem enviada; defina uma data de retorno.',
          '**Em conversa:** houve resposta; agende o diagnóstico ou reunião.',
          '**Proposta:** valor e escopo enviados.',
          '**Ganho / Perdido:** anote o motivo; é o que melhora a sua próxima rodada.'
        ],
        p2: [
          'Faça de 2 a 3 follow-ups espaçados por alguns dias, cada um com algo novo (um dado, um exemplo), e não apenas "viu minha mensagem?". Se a pessoa pedir para parar, pare e registre.'
        ]
      },
      {
        id: 'rotina-semanal',
        h: 'Uma rotina semanal que cabe em 5 horas',
        table: {
          head: ['Dia', 'Atividade', 'Tempo'],
          rows: [
            ['Segunda', 'Escolher o recorte da semana e listar 40 empresas', '1 h'],
            ['Terça', 'Qualificar e priorizar as 15 melhores', '1 h'],
            ['Quarta', 'Enviar 15 abordagens personalizadas', '1 h 30'],
            ['Quinta', 'Follow-ups e respostas', '45 min'],
            ['Sexta', 'Reuniões / diagnósticos e revisão do pipeline', '45 min']
          ]
        },
        p2: ['Meça, a cada semana, quantas abordagens geraram resposta e quantas respostas viraram reunião. Se a resposta é baixa, mude a mensagem; se a reunião é baixa, mude o recorte ou a oferta.']
      },
      {
        id: 'erros-comuns',
        h: 'Erros comuns que travam a prospecção',
        ul: [
          'Abordar todo mundo com a mesma mensagem.',
          'Listar centenas de empresas e não qualificar nenhuma.',
          'Prometer resultados ("dobrar suas vendas") que você não controla.',
          'Não registrar o que foi falado e perder o timing do retorno.',
          'Insistir depois de um "não" claro.'
        ]
      },
      {
        id: 'na-scoutly',
        h: 'Como fazer esse processo na Scoutly',
        p: [
          'A Scoutly junta as etapas acima: busca por segmento e região, mapa, sinais digitais disponíveis (site, tracking, PageSpeed), favoritos, pipeline e geração de [relatório em PDF](/ajuda/relatorio-pdf/) para enviar ao lead. Para encontrar oportunidades específicas, veja o passo a passo de [como encontrar empresas sem site](/ajuda/empresas-sem-site/) e como [organizar o pipeline](/ajuda/pipeline/).',
          'A cobertura e a disponibilidade dos dados variam por região e fonte. Confirme as informações antes de usá-las na conversa.'
        ]
      }
    ],
    faq: [
      ['É permitido prospectar clientes pelo Google Maps?', 'Consultar dados publicados em fichas de negócios para identificar possíveis clientes é uma prática comum de prospecção. O que você precisa respeitar são os termos de uso do Google (que restringem a extração automatizada em massa) e as regras de cada canal de contato e da LGPD ao abordar as pessoas.'],
      ['Quantas empresas devo prospectar por semana?', 'Não existe um número mágico. Uma rotina de 15 a 30 abordagens personalizadas por semana, com follow-up, costuma ser mais produtiva do que centenas de mensagens genéricas. Ajuste de acordo com a taxa de resposta que você medir.'],
      ['Qual é a melhor forma de abordar: WhatsApp, e-mail ou ligação?', 'Depende do segmento e do contato disponível. Para pequenos negócios locais, o WhatsApp e a ligação costumam ser mais naturais; para empresas maiores, o e-mail e o LinkedIn tendem a funcionar melhor. O essencial é ter um motivo concreto e respeitar as regras do canal.'],
      ['Preciso de uma ferramenta paga para prospectar no Maps?', 'Não é obrigatório: dá para começar com busca manual e planilha. Uma ferramenta passa a valer a pena quando o gargalo é tempo, ou seja, quando qualificar e organizar começa a custar mais do que o serviço que você vende.']
    ],
    sources: [
      ['Google Maps Platform: Termos de Serviço', 'https://cloud.google.com/maps-platform/terms'],
      ['PageSpeed Insights (teste gratuito de desempenho)', 'https://pagespeed.web.dev/']
    ],
    related: ['prospeccao-whatsapp-sem-ser-banido', 'como-vender-sites-para-empresas-sem-site', 'como-agencias-conseguem-clientes-com-ia']
  },
  {
    id: 'prospeccao-whatsapp-sem-ser-banido',
    tag: 'WhatsApp',
    title: 'Prospecção no WhatsApp sem ser banido: regras, scripts e rotina (2026)',
    seoTitle: 'Prospecção no WhatsApp sem ser banido: guia 2026',
    seoDescription: 'Como prospectar no WhatsApp sem perder o número: o que aumenta o risco de bloqueio, como pedir permissão, 5 scripts prontos e uma rotina segura de envio.',
    published: '2026-10-20',
    updated: '2026-10-20',
    readMinutes: 9,
    tldr: [
      'O WhatsApp restringe contas com muitas denúncias e bloqueios, e as regras de uso comercial exigem consentimento (opt-in) para mensagens da empresa. Prospecção em massa é o caminho mais rápido para perder o número.',
      'O padrão que mantém a conta saudável: poucas mensagens por dia, bem personalizadas, com identificação clara, uma pergunta simples e saída fácil ("sem problema se não fizer sentido").',
      'Se você precisa de escala, o caminho oficial é a WhatsApp Business Platform (API) com modelos aprovados e opt-in, e não ferramentas de disparo não oficiais.'
    ],
    intro: '"Meu número foi banido" é uma das reclamações mais comuns entre quem prospecta pelo WhatsApp. Na maioria dos casos, a causa não é um azar: é o comportamento da conta (muitos envios para quem não conhece você, mensagens iguais, nenhuma resposta e várias denúncias). Este guia reúne as boas práticas, scripts prontos e uma rotina de envio para prospectar sem colocar o seu número em risco. Ele é um guia prático, não um aconselhamento jurídico, e as regras da plataforma mudam: confira sempre a política oficial.',
    sections: [
      {
        id: 'como-funciona-banimento',
        h: 'Por que números são bloqueados',
        p: [
          'O WhatsApp não publica uma fórmula exata, mas a lógica geral é conhecida: a plataforma observa sinais de que o destinatário **não quer** aquela mensagem. Os principais são:'
        ],
        ul: [
          '**Bloqueios e denúncias** de quem recebeu a mensagem.',
          '**Volume alto e repetitivo** para pessoas que não têm você nos contatos.',
          '**Mensagens idênticas** enviadas em sequência para muitos números.',
          '**Uso de automação não oficial** (ferramentas de disparo que simulam o aplicativo), que viola os termos do serviço.',
          '**Números novos que, logo no primeiro dia, enviam muitas mensagens.**'
        ],
        p2: ['O ponto central: o seu desempenho depende de como as pessoas reagem. Uma mensagem relevante e respeitosa protege o seu número melhor que qualquer truque técnico.']
      },
      {
        id: 'regras-oficiais',
        h: 'O que as regras oficiais dizem (em linhas gerais)',
        p: [
          'A política comercial do WhatsApp (WhatsApp Business Messaging Policy) exige que a empresa obtenha **opt-in** (permissão) antes de enviar mensagens. O opt-in precisa deixar claro o nome da empresa e que a pessoa aceita receber mensagens por WhatsApp: ter o número de telefone, por si só, não basta. A empresa também deve respeitar pedidos de parar, mesmo quando feitos fora do WhatsApp. A política prevê que a Meta pode limitar ou remover o acesso de quem envia mensagens em escala de forma não autorizada (spam) e limitar contas cuja qualidade é consistentemente baixa, já que as pessoas podem bloquear e denunciar empresas. Os detalhes e as exceções mudam com o tempo: leia a versão atual nas fontes ao final.',
          'Na prática, existem dois mundos:'
        ],
        table: {
          head: ['', 'App WhatsApp / WhatsApp Business (celular)', 'WhatsApp Business Platform (API)'],
          rows: [
            ['Para quem serve', 'Contato individual, atendimento e primeiro contato pontual', 'Empresas com volume, CRM e consentimento'],
            ['Opt-in', 'A política exige permissão; sem ela, o risco é de denúncia e bloqueio', 'Exigido para mensagens iniciadas pela empresa'],
            ['Envio em massa', 'Não é o uso pretendido; maior risco de restrição', 'Possível apenas com modelos aprovados e opt-in'],
            ['Risco ao prospectar a frio', 'Alto se houver volume', 'Não é permitido enviar a quem não deu opt-in']
          ]
        }
      },
      {
        id: 'prospeccao-etica',
        h: 'Como prospectar de forma segura: o "primeiro contato educado"',
        p: ['Esta é a estrutura de um primeiro contato que reduz a chance de bloqueio e ainda é mais eficaz:'],
        ol: [
          '**Identifique-se** (nome e empresa) logo na primeira linha.',
          '**Diga por que está falando com essa empresa** (uma observação específica).',
          '**Faça uma pergunta de resposta fácil** (sim/não, ou "posso enviar?").',
          '**Dê uma saída clara** ("se não for o momento, sem problema, é só me avisar").',
          '**Pare imediatamente** se a pessoa pedir.'
        ],
        p2: ['Prefira um canal de contato que a empresa já divulga publicamente para fins comerciais (por exemplo, o WhatsApp da ficha do negócio). Para entender como isso se relaciona com a LGPD, leia [prospecção B2B e LGPD](/blog/prospeccao-de-empresas-lgpd/).']
      },
      {
        id: 'scripts',
        h: '5 scripts prontos para adaptar',
        p: ['Troque os trechos entre colchetes e escreva com a sua voz. Evite copiar o texto exato em vários contatos: personalize pelo menos a observação.'],
        examples: [
          ['1. Empresa sem site', 'Olá, [Nome]! Aqui é o [Seu nome], da [Sua empresa]. Procurei a [Empresa] no Google e não encontrei um site. Para quem busca [serviço] em [cidade], isso costuma significar perder contatos para quem aparece primeiro. Posso te mostrar um exemplo rápido de como poderia ficar? Se não fizer sentido, sem problema.'],
          ['2. Site lento', 'Oi, [Nome]! Sou o [Seu nome]. Testei o site da [Empresa] no celular e ele demora um pouco para carregar, o que costuma afastar visitantes antes do contato. Preparei um mini-diagnóstico de 1 página. Posso enviar por aqui?'],
          ['3. Avaliações pouco respondidas', 'Olá, [Nome], tudo bem? Vi que a [Empresa] tem boas avaliações no Google, mas algumas ainda estão sem resposta. Responder costuma reforçar a confiança de quem está decidindo. Se quiser, te passo 3 modelos de resposta, sem compromisso.'],
          ['4. Follow-up (dia 3 a 5)', 'Oi, [Nome]! Voltando rapidinho: separei [um dado/exemplo novo] sobre [tema] que talvez ajude a [Empresa]. Quer que eu envie? Se preferir que eu não escreva mais, é só dizer.'],
          ['5. Encerramento educado', 'Oi, [Nome]! Não quero ser inconveniente, então vou encerrar por aqui. Se em algum momento fizer sentido falar sobre [tema], é só me chamar. Sucesso para a [Empresa]!']
        ]
      },
      {
        id: 'rotina',
        h: 'Rotina segura de envio',
        ul: [
          '**Aqueça a conta com uso real:** converse, responda e atenda clientes antes de prospectar. Evite começar um número novo com dezenas de envios.',
          '**Mantenha o volume baixo e irregular.** Em vez de dezenas de mensagens em sequência, distribua ao longo do dia.',
          '**Personalize sempre.** Se você consegue colar a mesma mensagem em 50 contatos, ela é genérica demais.',
          '**Monitore sinais:** muitas mensagens sem resposta, aviso de restrição ou queda de entrega pedem que você pare e revise a abordagem.',
          '**Tenha um número separado do pessoal** para a atividade comercial.',
          '**Registre quem pediu para parar** e nunca volte a contatar.'
        ]
      },
      {
        id: 'quando-api',
        h: 'Quando migrar para a API oficial',
        p: [
          'Se a sua operação já tem volume e processos (equipe de vendas, CRM, campanhas), vale considerar a WhatsApp Business Platform. Ela permite enviar mensagens por modelos aprovados a pessoas que deram opt-in, com métricas de qualidade e entrega. Em troca, exige cadastro, aprovação e normalmente tem custo por conversa/mensagem, que varia por país e categoria. Consulte a tabela de preços atual do provedor.',
          'Para prospecção inicial com poucas empresas, o caminho mais seguro costuma ser o contato individual, bem personalizado, ou outros canais (e-mail, ligação, visita).'
        ]
      },
      {
        id: 'na-scoutly',
        h: 'Como a Scoutly ajuda sem empurrar você para o spam',
        p: [
          'A Scoutly não dispara mensagens por você. Ela ajuda no que vem antes: encontrar empresas, enxergar sinais digitais e escrever uma abordagem personalizada. Em [Configurações, você descreve a sua oferta e o tom](/ajuda/abordagem-ia/) e a IA gera mensagens com base no negócio selecionado, que você revisa e envia pelo canal que preferir. Os dados de contato estão sujeitos aos créditos e ao plano.'
        ]
      }
    ],
    faq: [
      ['Posso enviar mensagem no WhatsApp para uma empresa que nunca falou comigo?', 'Um primeiro contato individual, identificado e relevante para a atividade da empresa é bem diferente de um disparo em massa. Mesmo assim, ele acontece sem consentimento prévio, então o risco de denúncia existe. Seja breve, personalize, ofereça uma saída e pare se a pessoa pedir.'],
      ['Quantas mensagens por dia posso enviar sem ser banido?', 'Não existe um limite oficial público que garanta segurança. O risco depende de reações (bloqueios, denúncias) e do histórico da conta. Comece com poucas conversas por dia, personalizadas, e aumente só se as respostas forem positivas.'],
      ['Ferramentas de disparo em massa funcionam?', 'Ferramentas não oficiais que automatizam o aplicativo violam os termos do WhatsApp e são uma causa frequente de banimento. Para volume, o caminho permitido é a WhatsApp Business Platform, com opt-in e modelos aprovados.'],
      ['O que fazer se meu número for banido?', 'Use os canais de suporte e revisão do próprio WhatsApp, evite criar vários números para contornar a restrição e revise a abordagem que gerou as denúncias.']
    ],
    sources: [
      ['WhatsApp Business Messaging Policy', 'https://business.whatsapp.com/policy'],
      ['Meta for Developers: como obter opt-in no WhatsApp', 'https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in'],
      ['Termos de Serviço do WhatsApp', 'https://www.whatsapp.com/legal/terms-of-service'],
      ['Central de Ajuda do WhatsApp Business', 'https://faq.whatsapp.com/']
    ],
    related: ['como-prospectar-clientes-no-google-maps', 'prospeccao-de-empresas-lgpd', 'como-agencias-conseguem-clientes-com-ia']
  },
  {
    id: 'prospeccao-de-empresas-lgpd',
    tag: 'LGPD',
    title: 'Prospecção B2B e LGPD: o que é permitido ao abordar empresas',
    seoTitle: 'Prospecção B2B e LGPD: o que pode e o que não pode',
    seoDescription: 'Pode prospectar empresas pela LGPD? Entenda legítimo interesse, dados de pessoa jurídica x pessoa física, transparência, opt-out e um checklist prático.',
    published: '2026-10-20',
    updated: '2026-10-20',
    readMinutes: 8,
    tldr: [
      'A LGPD protege dados de pessoas naturais. Dados de uma empresa (razão social, CNPJ, endereço comercial) não são dados pessoais, mas o nome, o WhatsApp ou o e-mail de uma pessoa específica são.',
      'A LGPD não proíbe prospecção. Para tratar dados pessoais comerciais, uma base legal comum é o legítimo interesse (art. 7º, IX), que exige finalidade legítima, necessidade, balanceamento com salvaguardas e transparência.',
      'Na prática: colete o mínimo, informe quem você é e de onde vem o contato, facilite o descadastro e respeite imediatamente quem pedir para parar.'
    ],
    intro: 'Quem prospecta empresas costuma ter a mesma dúvida: "isso é legal pela LGPD?". A resposta honesta é: **depende de que dado você usa, para qual finalidade e de como você trata a pessoa do outro lado**. Este artigo explica os conceitos em linguagem simples e traz um checklist prático. Ele tem caráter informativo e não substitui a orientação de um advogado, principalmente em operações de maior escala.',
    sections: [
      {
        id: 'pj-vs-pf',
        h: 'Dado de empresa x dado de pessoa: a distinção que muda tudo',
        p: ['A Lei Geral de Proteção de Dados (Lei 13.709/2018) trata de **dados pessoais**, isto é, informações relacionadas a uma pessoa natural identificada ou identificável. Isso gera uma separação importante para quem prospecta:'],
        table: {
          head: ['Tipo de dado', 'Exemplo', 'É dado pessoal?'],
          rows: [
            ['Dado de pessoa jurídica', 'Razão social, CNPJ, endereço comercial, telefone fixo da empresa', 'Em regra, não'],
            ['Dado de pessoa natural no contexto profissional', 'Nome do sócio, e-mail pessoal (joao@...), WhatsApp do dono', 'Sim'],
            ['E-mail corporativo genérico', 'contato@empresa.com.br', 'Em geral, não identifica uma pessoa; avalie o contexto'],
            ['Empresário individual / MEI', 'CNPJ que se confunde com a pessoa', 'Pode envolver dado pessoal; trate com cuidado']
          ]
        },
        p2: ['Isso não significa que dados de empresa sejam "livres para qualquer uso". Outras regras, como as do Código de Defesa do Consumidor, da publicidade e as políticas dos canais, continuam valendo.']
      },
      {
        id: 'bases-legais',
        h: 'Qual base legal usar: consentimento ou legítimo interesse?',
        p: [
          'A LGPD (art. 7º) lista as bases legais que permitem tratar dados pessoais. As duas mais citadas em prospecção são:',
        ],
        ul: [
          '**Consentimento:** a pessoa concordou de forma livre, informada e para finalidade específica. Ideal para listas de e-mail e newsletters, mas inviável para o primeiro contato de uma abordagem fria.',
          '**Legítimo interesse (art. 7º, IX):** permite o tratamento quando há uma finalidade legítima e concreta do controlador ou de terceiros, desde que não prevaleçam os direitos e as liberdades do titular. A ANPD recomenda documentar uma avaliação (o chamado teste de balanceamento).'
        ],
        p2: ['A Autoridade Nacional de Proteção de Dados (ANPD) publicou um guia orientativo sobre hipóteses legais de tratamento, incluindo o legítimo interesse. Leia-o nas fontes ao final deste artigo.']
      },
      {
        id: 'teste-legitimo-interesse',
        h: 'O teste do legítimo interesse, em 3 fases',
        p: ['O guia orientativo da ANPD (publicado em fevereiro de 2024) propõe um modelo de teste de balanceamento dividido em três fases. Aplicado à prospecção, ele fica assim:'],
        ol: [
          '**Finalidade:** o interesse é legítimo e concreto? (ex.: oferecer um serviço relacionado à atividade da empresa contatada).',
          '**Necessidade:** o tratamento é realmente necessário para essa finalidade e não há alternativa menos intrusiva? (ex.: usar o contato comercial divulgado, não dados da vida pessoal do dono).',
          '**Balanceamento e salvaguardas:** os riscos para a pessoa são baixos e ela esperaria receber esse contato? Você adota medidas de mitigação, como informar quem é, de onde veio o contato e oferecer um jeito simples de pedir para sair?'
        ],
        p2: ['Segundo o guia, se o resultado do teste for inconclusivo ou não houver salvaguardas adequadas, outra base legal deve ser usada. Registre a sua avaliação por escrito: ela é a sua prova de que você pensou no assunto e atende ao princípio de responsabilização.']
      },
      {
        id: 'direitos',
        h: 'Direitos do titular que você precisa respeitar',
        p: ['Mesmo com base legal, a pessoa mantém direitos previstos na LGPD (art. 18), como saber que seus dados são tratados, corrigi-los, pedir a eliminação quando cabível e **opor-se ao tratamento** feito com base no legítimo interesse. Na prática de vendas, isso se traduz em regras simples:'],
        ul: [
          'Responda rápido a pedidos de "não me contate mais" e registre o pedido.',
          'Tenha uma lista interna de supressão para não contatar quem já recusou.',
          'Ao ser perguntado "onde conseguiu meu contato?", responda com honestidade (ex.: "da ficha pública da empresa no Google").',
          'Não compre nem repasse listas de procedência desconhecida.'
        ]
      },
      {
        id: 'checklist',
        h: 'Checklist prático de prospecção em conformidade',
        ol: [
          'Defina a finalidade: "oferecer [serviço] a empresas do segmento [X]".',
          'Prefira contatos comerciais divulgados pela própria empresa (site, ficha do negócio).',
          'Colete o mínimo: nome da empresa, canal comercial, segmento e sinais públicos relevantes.',
          'Identifique-se no primeiro contato e informe a origem do contato.',
          'Ofereça saída fácil em toda mensagem.',
          'Mantenha uma lista de supressão e a consulte antes de cada envio.',
          'Guarde dados apenas pelo tempo necessário e apague o que perdeu utilidade.',
          'Proteja a sua base: acesso restrito, senha forte, sem planilhas soltas em e-mails.',
          'Documente a avaliação de legítimo interesse.',
          'Em operações maiores, consulte um advogado e defina um encarregado (DPO).'
        ]
      },
      {
        id: 'na-scoutly',
        h: 'Como a Scoutly trata isso',
        p: [
          'A Scoutly é uma ferramenta de pesquisa e organização de dados públicos de negócios. A empresa, o usuário e a finalidade de uso continuam sendo responsabilidade de quem prospecta. Conheça as fontes e as limitações na página [Dados e fontes](/dados-e-fontes/) e leia como organizamos o contato a partir de créditos nas [perguntas frequentes](/perguntas-frequentes/). Um sinal ou contato não detectado nunca deve ser tratado como prova.',
          'Boas práticas de abordagem estão no guia de [prospecção no WhatsApp sem ser banido](/blog/prospeccao-whatsapp-sem-ser-banido/).'
        ]
      }
    ],
    faq: [
      ['É ilegal prospectar empresas pela LGPD?', 'Não. A LGPD não proíbe prospecção comercial. Ela exige que, quando você trata dados pessoais (como nome e contato de uma pessoa), tenha uma base legal, seja transparente, use o mínimo necessário e respeite os direitos do titular.'],
      ['Preciso de consentimento para enviar a primeira mensagem?', 'Não necessariamente. O legítimo interesse pode servir de base para o contato comercial, desde que passe pelo teste de finalidade, necessidade e balanceamento e você ofereça a opção de descadastro. Para listas de e-mail marketing recorrente, o consentimento é a base mais segura.'],
      ['Dados de CNPJ são públicos. Posso usá-los livremente?', 'Dados cadastrais de pessoa jurídica são públicos, mas a LGPD ainda se aplica a dados de pessoas naturais associadas (sócios, MEIs). Ser público não elimina a necessidade de finalidade legítima e transparência.'],
      ['Qual é o risco de descumprir a LGPD?', 'A lei prevê sanções administrativas aplicadas pela ANPD, como advertência e multas, além de eventuais ações de titulares. A gravidade depende do caso concreto.']
    ],
    sources: [
      ['Lei Geral de Proteção de Dados (Lei nº 13.709/2018)', 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm'],
      ['ANPD: Guia orientativo sobre hipóteses legais de tratamento de dados pessoais, legítimo interesse (fev. 2024)', 'https://www.gov.br/anpd/pt-br'],
      ['Receita Federal: Dados Abertos do CNPJ', 'https://dados.gov.br/']
    ],
    related: ['prospeccao-whatsapp-sem-ser-banido', 'como-prospectar-clientes-no-google-maps', 'como-agencias-conseguem-clientes-com-ia']
  },
  {
    id: 'como-vender-sites-para-empresas-sem-site',
    tag: 'Criação de sites',
    title: 'Como encontrar empresas sem site e vender a criação do primeiro site',
    seoTitle: 'Como encontrar empresas sem site e vender sites',
    seoDescription: 'Método para freelancers e agências: encontrar empresas sem site, mostrar o custo de não ter presença online, montar a oferta e fechar o primeiro projeto.',
    published: '2026-10-20',
    updated: '2026-10-20',
    readMinutes: 10,
    tldr: [
      'Empresas sem site são o mercado mais óbvio para quem cria sites, mas "não ter site" raramente é percebido como problema pelo dono: você precisa traduzir em consequências (perda de contatos, desconfiança, dependência de redes sociais).',
      'Funciona melhor vender um **pacote pequeno e claro** (página única + WhatsApp + Google) do que um projeto aberto; preço e prazo definidos reduzem a objeção.',
      'Uma amostra visual feita antes da conversa, ou um mini-diagnóstico, converte mais do que uma explicação teórica.'
    ],
    intro: 'Se você cria sites, existe um mercado enorme à sua volta: clínicas, oficinas, salões, escolas e prestadores de serviço que dependem só de Instagram e WhatsApp. O desafio não é encontrar essas empresas, e sim fazer o dono enxergar que um site resolve um problema dele. Este guia mostra como achar empresas sem site, como abordá-las e como estruturar uma oferta simples que seja fácil de comprar.',
    sections: [
      {
        id: 'mercado',
        h: 'Por que empresas locais ainda não têm site',
        p: ['Antes de vender, entenda as objeções reais. Em conversas com donos de pequenos negócios, as mais comuns são:'],
        ul: [
          '"Meus clientes me acham pelo Instagram/WhatsApp."',
          '"Site é caro e dá trabalho para manter."',
          '"Já tive um site e não trouxe resultado."',
          '"Não sei o que colocar."'
        ],
        p2: ['Cada objeção aponta para uma parte da sua oferta: preço fixo e acessível, manutenção simples, foco em resultado (contatos) e conteúdo pronto.']
      },
      {
        id: 'encontrar',
        h: 'Como encontrar empresas sem site',
        ol: [
          '**Escolha um segmento com ticket médio razoável:** clínicas, odontologia, advocacia, estética, serviços residenciais, escolas.',
          '**Busque por região:** pesquise por segmento e bairro/cidade.',
          '**Filtre quem não tem site cadastrado:** na ficha do Maps, procure negócios com o campo de site vazio ou apontando só para rede social.',
          '**Confirme manualmente:** pesquise o nome da empresa no Google; ela pode ter um site que a ficha não lista.',
          '**Priorize por sinais de que paga:** boas avaliações, fotos, movimento, equipe.'
        ],
        p2: ['Na Scoutly, o passo a passo está em [como encontrar empresas sem site](/ajuda/empresas-sem-site/). A ausência de site na ficha é uma hipótese: confirme antes de abordar.']
      },
      {
        id: 'argumentos',
        h: 'Os argumentos que realmente convencem',
        table: {
          head: ['Argumento', 'Como falar sem exagerar'],
          rows: [
            ['Ser encontrado no Google', '"Quando alguém busca [serviço] em [cidade], seu site tem chance de aparecer e levar direto ao WhatsApp."'],
            ['Credibilidade', '"Hoje muita gente pesquisa a empresa antes de fechar. Um endereço próprio passa mais segurança que só uma rede social."'],
            ['Independência', '"Rede social pode mudar o alcance; o site é seu e fica no ar."'],
            ['Organização', '"Serviços, preços de referência, localização e contato em um só lugar, em vez de explicar tudo no direct."'],
            ['Medição', '"Com o site, dá para medir de onde vêm os contatos."']
          ]
        },
        p2: ['Evite prometer posicionamento no Google, aumento de faturamento ou prazo de resultado. Você controla a entrega do site, não o comportamento do mercado.']
      },
      {
        id: 'oferta',
        h: 'Monte uma oferta pequena e fácil de comprar',
        p: ['Pacotes claros vendem mais do que "orçamento sob consulta". Exemplo de estrutura (adapte aos seus custos):'],
        table: {
          head: ['Item', 'Pacote Essencial', 'Pacote Completo'],
          rows: [
            ['Páginas', '1 página (landing)', 'Até 5 páginas'],
            ['Botão de WhatsApp e mapa', 'Incluso', 'Incluso'],
            ['Perfil Google / ajustes da ficha', 'Opcional', 'Incluso'],
            ['Texto e fotos', 'Cliente envia', 'Apoio na redação'],
            ['Hospedagem e domínio', 'Orientação', 'Configuração incluída'],
            ['Prazo', 'Definido no contrato', 'Definido no contrato'],
            ['Manutenção mensal', 'Opcional', 'Opcional']
          ]
        },
        p2: [
          'Defina o seu preço com base em horas, custos e no valor para o cliente, e não pelo que acha que ele "aguenta pagar". Pesquise o que outros profissionais da sua região cobram e posicione-se com clareza. Uma receita recorrente (manutenção, hospedagem, atualização) estabiliza o seu caixa.'
        ]
      },
      {
        id: 'abordagem',
        h: 'A abordagem: mostre antes de explicar',
        p: ['Dois formatos que funcionam bem para este nicho:'],
        ul: [
          '**Mini-diagnóstico:** uma página que mostra o que a empresa tem hoje (ficha, redes) e onde ela perde contatos. A Scoutly gera um [relatório em PDF](/ajuda/relatorio-pdf/) com a sua marca para isso.',
          '**Amostra visual:** um layout simples com o nome, as cores e as fotos da empresa. Mostre que você já pensou no negócio dela.'
        ],
        example: 'Olá, Dr. Paulo! Vi que a clínica tem ótimas avaliações no Google, mas não encontrei um site próprio. Montei uma amostra de como uma página única poderia ficar, com agendamento direto pelo WhatsApp. Posso te enviar? Se não fizer sentido, sem problema.',
        p2: ['Para o canal e o tom, veja [prospecção no WhatsApp sem ser banido](/blog/prospeccao-whatsapp-sem-ser-banido/).']
      },
      {
        id: 'objecoes',
        h: 'Como responder às objeções mais comuns',
        table: {
          head: ['Objeção', 'Resposta sugerida'],
          rows: [
            ['"Já tenho Instagram."', '"Ótimo, e ele continua importante. O site complementa: aparece na busca do Google e reúne serviços e contato num lugar que você controla."'],
            ['"É caro."', '"Entendo. Por isso o Pacote Essencial tem preço e prazo fechados. Dá para começar pequeno e evoluir depois."'],
            ['"Já tive e não deu resultado."', '"Faz sentido desconfiar. O que faltou foi o site ou a divulgação? Posso ver o que havia antes e te dizer com sinceridade se vale a pena."'],
            ['"Preciso pensar."', '"Claro. Posso te mandar um resumo de 1 página com o que está incluso e retomamos na quinta?"']
          ]
        }
      },
      {
        id: 'depois-da-venda',
        h: 'Depois do primeiro site: indicações e upsell',
        ul: [
          'Peça uma indicação logo após a entrega, quando o cliente está satisfeito.',
          'Ofereça a gestão da ficha do Google e respostas às avaliações.',
          'Proponha, depois, tráfego pago ou SEO local para o mesmo cliente.',
          'Reaproveite o case (com autorização) na sua próxima abordagem do mesmo segmento.'
        ]
      }
    ],
    faq: [
      ['Como saber se uma empresa realmente não tem site?', 'Veja a ficha do Google, pesquise o nome da empresa e o telefone no buscador e confira o Instagram/Facebook. Se continuar sem resultado, a hipótese se confirma. Ferramentas ajudam a filtrar, mas a confirmação manual evita um constrangimento na abordagem.'],
      ['Quanto devo cobrar por um site para pequena empresa?', 'Não há um valor único. Considere suas horas, custos de domínio/hospedagem, complexidade, prazo e o valor para o cliente. Pesquise o mercado da sua região e comece com pacotes de escopo fechado.'],
      ['Vale a pena oferecer site grátis para começar?', 'Em geral, não. Um site totalmente gratuito costuma gerar pouco comprometimento. Prefira uma amostra visual gratuita e cobrar pelo projeto, ou ofereça um desconto de lançamento com escopo e prazo definidos.'],
      ['Preciso saber programar para vender sites?', 'Não necessariamente. Muitos profissionais usam construtores visuais e ferramentas de IA. O diferencial está em entender o negócio do cliente, organizar o conteúdo e entregar no prazo.']
    ],
    sources: [
      ['Google Business Profile: ajuda oficial', 'https://support.google.com/business/'],
      ['PageSpeed Insights', 'https://pagespeed.web.dev/']
    ],
    related: ['como-prospectar-clientes-no-google-maps', 'prospeccao-whatsapp-sem-ser-banido', 'como-agencias-conseguem-clientes-com-ia']
  },
  {
    id: 'como-agencias-conseguem-clientes-com-ia',
    tag: 'Agências',
    title: 'Como agências conseguem clientes com IA: processo de prospecção em 30 dias',
    seoTitle: 'Como agências conseguem clientes com IA (plano 30 dias)',
    seoDescription: 'Plano de 30 dias para agências e freelancers conseguirem clientes com IA: definir o ICP, listar, qualificar, personalizar abordagens e medir o funil.',
    published: '2026-10-20',
    updated: '2026-10-20',
    readMinutes: 10,
    tldr: [
      'IA não substitui o processo de vendas: ela acelera as etapas repetitivas (pesquisar, resumir, escrever o primeiro rascunho) para você gastar mais tempo conversando com quem importa.',
      'O ganho vem de combinar três coisas: um recorte claro de cliente ideal, dados reais da empresa (sinais digitais) e uma mensagem que você revisa antes de enviar.',
      'Um plano de 30 dias com metas pequenas e medição semanal costuma ser mais útil do que procurar a "ferramenta perfeita".'
    ],
    intro: 'Agências de marketing, estúdios de sites e freelancers enfrentam o mesmo dilema: o tempo vai para entregar projetos e não sobra para vender. Quando a captação para, o faturamento oscila. A IA ajuda a transformar a prospecção em uma rotina leve e mensurável, desde que usada com critério. Este plano de 30 dias organiza o trabalho em quatro semanas.',
    sections: [
      {
        id: 'o-que-ia-faz',
        h: 'O que a IA faz bem (e o que ela não faz) na prospecção',
        table: {
          head: ['Etapa', 'IA ajuda?', 'Cuidado'],
          rows: [
            ['Pesquisar o negócio', 'Sim: resume dados e páginas públicas', 'Confirme informações importantes; IA pode errar'],
            ['Identificar a dor provável', 'Sim: cruza sinais com o seu serviço', 'Sinal ausente é hipótese, não prova'],
            ['Escrever a primeira versão da mensagem', 'Sim', 'Revise tom, fatos e promessas'],
            ['Decidir o recorte de cliente ideal', 'Apoia', 'É decisão estratégica sua'],
            ['Negociar e fechar', 'Pouco', 'Relacionamento é humano'],
            ['Enviar em massa sem revisão', 'Não recomendado', 'Risco de spam, bloqueio e má reputação']
          ]
        }
      },
      {
        id: 'semana-1',
        h: 'Semana 1: defina o cliente ideal e a oferta',
        ol: [
          '**Escolha 1 serviço principal** (ex.: site, tráfego pago, SEO local, automação).',
          '**Escolha 1 ou 2 segmentos** onde você já tem experiência ou facilidade de gerar resultado.',
          '**Defina o território** onde você consegue atender e, se possível, visitar.',
          '**Escreva a oferta de entrada** em uma frase: "Eu ajudo [segmento] a [resultado] por meio de [serviço], começando por um [diagnóstico/auditoria/amostra] de baixo custo ou gratuito".',
          '**Liste 3 sinais** que mostram que a empresa precisa do seu serviço (ex.: sem site, sem Pixel, ficha incompleta).'
        ],
        p2: ['Na Scoutly, você registra sua oferta e tom em [Configurações para que a IA escreva alinhada com o seu serviço](/ajuda/abordagem-ia/).']
      },
      {
        id: 'semana-2',
        h: 'Semana 2: monte a lista e qualifique',
        ul: [
          'Liste de 100 a 150 empresas do recorte (use [busca por segmento e região](/prospeccao-local/)).',
          'Qualifique usando sinais digitais; descarte quem não se encaixa.',
          'Priorize as 40 melhores e salve em favoritos ou no pipeline.',
          'Gere um [diagnóstico em PDF](/ajuda/relatorio-pdf/) para as 10 mais promissoras.'
        ],
        p2: ['Para o método detalhado, veja [como prospectar clientes no Google Maps](/blog/como-prospectar-clientes-no-google-maps/).']
      },
      {
        id: 'semana-3',
        h: 'Semana 3: aborde com mensagens personalizadas',
        p: ['Use a IA para gerar o primeiro rascunho a partir dos dados da empresa e **edite sempre**. Um bom rascunho tem observação específica, benefício claro e pergunta simples.'],
        ul: [
          'Meta: 20 a 30 abordagens personalizadas na semana, e não centenas genéricas.',
          'Varie o canal conforme o segmento (WhatsApp, e-mail, ligação ou visita).',
          'Respeite as regras do canal e a LGPD: veja [WhatsApp sem ser banido](/blog/prospeccao-whatsapp-sem-ser-banido/) e [prospecção B2B e LGPD](/blog/prospeccao-de-empresas-lgpd/).',
          'Agende follow-ups no pipeline para 3 a 5 dias depois.'
        ]
      },
      {
        id: 'semana-4',
        h: 'Semana 4: converse, proponha e meça',
        ul: [
          'Transforme respostas em diagnósticos curtos (15 a 20 minutos), não em apresentações longas.',
          'Envie propostas com escopo, prazo e valor claros.',
          'Registre os motivos de perda no pipeline.',
          'Revise os números e ajuste o recorte, a oferta ou a mensagem.'
        ]
      },
      {
        id: 'metricas',
        h: 'As métricas que importam',
        table: {
          head: ['Métrica', 'Como calcular', 'O que ajustar se estiver baixa'],
          rows: [
            ['Taxa de resposta', 'Respostas ÷ abordagens', 'Observação inicial, canal, horário'],
            ['Taxa de reunião', 'Reuniões ÷ respostas', 'Oferta de entrada, clareza do benefício'],
            ['Taxa de proposta', 'Propostas ÷ reuniões', 'Qualificação, diagnóstico'],
            ['Taxa de fechamento', 'Vendas ÷ propostas', 'Preço, escopo, prova social'],
            ['Tempo por lead qualificado', 'Horas ÷ leads qualificados', 'Automatize pesquisa e anotações']
          ]
        },
        p2: ['Os números variam muito por nicho e região. Compare você com você mesmo semana a semana, e não com médias de terceiros que não conhece a origem.']
      },
      {
        id: 'erros',
        h: 'Erros que fazem a IA prejudicar a prospecção',
        ul: [
          'Enviar o texto da IA sem ler (erros de fato e tom robótico).',
          'Usar a mesma mensagem para todo mundo.',
          'Prometer resultados que você não controla.',
          'Depender de dados sem confirmar o que é essencial.',
          'Ignorar pedidos de parar.'
        ]
      }
    ],
    faq: [
      ['Dá para conseguir clientes só com IA?', 'A IA acelera pesquisa e redação, mas conseguir clientes depende de oferta, abordagem, relacionamento e consistência. Use a IA como assistente e revise tudo o que for enviado.'],
      ['Quanto tempo leva para fechar o primeiro cliente?', 'Varia conforme nicho, ticket e qualidade da oferta. Por isso o plano de 30 dias define metas de atividade e medição, em vez de prometer um resultado: o que você controla é o volume de abordagens de qualidade e o aprendizado semanal.'],
      ['A IA pode escrever mensagens que parecem humanas?', 'Pode gerar bons rascunhos, principalmente quando recebe contexto real (negócio, sinais e sua oferta). A revisão humana garante tom adequado e evita afirmações incorretas.'],
      ['Qual a melhor ferramenta de IA para prospecção?', 'A que tem acesso aos dados do lead e à sua oferta, pois sem contexto a mensagem sai genérica. A Scoutly combina busca de empresas, sinais digitais e geração de abordagem com o perfil comercial que você configura.']
    ],
    sources: [
      ['Scoutly: Prospecção com IA', 'https://www.scoutly.pro/prospeccao-com-ia/'],
      ['Scoutly: Dados e fontes', 'https://www.scoutly.pro/dados-e-fontes/']
    ],
    related: ['como-prospectar-clientes-no-google-maps', 'como-vender-sites-para-empresas-sem-site', 'prospeccao-de-empresas-lgpd']
  }

,
  {
    id: 'melhores-ferramentas-de-prospeccao-b2b',
    tag: 'Ferramentas de prospecção',
    title: 'Melhores ferramentas de prospecção B2B em 2026: comparativo por perfil',
    seoTitle: 'Melhores ferramentas de prospecção B2B em 2026',
    seoDescription: 'Compare Scoutly, Ramper, Apollo, Econodata, Speedio e Sales Navigator por tipo de lead, dados, automação e perfil de equipe. Veja como escolher.',
    published: '2026-11-11',
    updated: '2026-11-11',
    readMinutes: 12,
    tldr: [
      'A melhor ferramenta de prospecção depende de quem você precisa encontrar: empresas locais, decisores B2B, contatos profissionais ou contas para uma cadência comercial.',
      'Scoutly é voltada à descoberta de negócios por região e segmento, com mapa, sinais digitais e pipeline. Ramper, Apollo, Econodata, Speedio e Sales Navigator resolvem etapas diferentes da prospecção.',
      'Antes de contratar, teste a cobertura do seu segmento, a qualidade dos contatos, a atualização dos dados, as integrações e o custo por oportunidade realmente utilizável.'
    ],
    intro: 'Escolher uma ferramenta de prospecção B2B parece simples até você comparar plataformas que fazem coisas diferentes. Algumas ajudam a encontrar empresas e decisores. Outras enriquecem contatos, organizam cadências de e-mail e LinkedIn ou permitem mapear negócios em uma região. Este comparativo organiza as principais opções por finalidade, mostra onde cada uma se encaixa e explica quando uma ferramenta de prospecção local como a Scoutly faz mais sentido.',
    sections: [
      {
        id: 'o-que-e-uma-ferramenta-de-prospeccao',
        h: 'Antes do ranking: o que você chama de prospecção?',
        p: [
          'Prospecção é o processo de identificar empresas ou pessoas que podem ter interesse em uma solução, avaliar se fazem sentido para a oferta e iniciar uma conversa comercial. O software pode apoiar uma ou várias dessas etapas, mas nem toda plataforma cobre o processo inteiro.',
          'Uma busca por empresas de determinado segmento em uma cidade é diferente de uma busca por diretores de tecnologia em companhias com mais de mil funcionários. Também é diferente de automatizar uma sequência de e-mails depois que os contatos já foram encontrados. Comparar essas ferramentas apenas pelo tamanho da base ou pela quantidade de funcionalidades leva a escolhas ruins.',
          'Por isso, este guia não apresenta uma vencedora universal. A ordem abaixo é organizada por tipo de operação e não representa um ranking de qualidade. As descrições consideram as funcionalidades divulgadas publicamente pelas próprias empresas e devem ser confirmadas em um teste antes da contratação.'
        ]
      },
      {
        id: 'comparativo-das-ferramentas',
        h: 'Comparativo das ferramentas de prospecção',
        table: {
          head: ['Ferramenta', 'Mais indicada para', 'Principal proposta', 'O que avaliar no teste'],
          rows: [
            ['Scoutly', 'Prospecção local, agências e equipes de campo', 'Descobrir negócios por cidade, região e segmento, analisar sinais digitais e organizar oportunidades no mapa e no pipeline', 'Cobertura no território, disponibilidade de contatos e sinais para o segmento escolhido'],
            ['Ramper GTM', 'Outbound B2B estruturado', 'Combinar base de empresas e decisores, enriquecimento, cadências e recursos de IA para prospecção', 'Aderência da base ao ICP, qualidade dos contatos, limites e canais incluídos no plano'],
            ['Econodata', 'Inteligência de mercado e listas B2B no Brasil', 'Segmentar empresas, dimensionar mercados, localizar decisores e apoiar a geração de leads', 'Filtros disponíveis, critérios de atualização e aderência da lista ao mercado real'],
            ['Speedio', 'Pesquisa de empresas e decisores com filtros', 'Montar listas B2B a partir de atributos firmográficos e critérios de segmentação', 'Precisão dos filtros, cobertura do nicho e possibilidade de integração com o CRM'],
            ['Apollo.io', 'Prospecção B2B e enriquecimento de contatos', 'Pesquisar empresas e pessoas, consultar dados de contato e apoiar atividades de vendas e engajamento', 'Cobertura de empresas brasileiras, créditos, validade dos e-mails e custo por contato útil'],
            ['LinkedIn Sales Navigator', 'Encontrar decisores e desenvolver relações profissionais', 'Pesquisar leads e contas com filtros profissionais e acompanhar sinais dentro do LinkedIn', 'Acesso aos perfis do seu ICP, limites de uso e processo para levar os leads ao CRM']
          ]
        },
        p2: [
          'O comparativo é funcional, não uma avaliação laboratorial de precisão. Cobertura, disponibilidade de dados e condições comerciais podem mudar conforme o plano, o segmento e o país. Não trate uma funcionalidade anunciada como garantia de que todo registro da sua amostra terá a mesma qualidade.'
        ]
      },
      {
        id: 'scoutly-prospeccao-local',
        h: 'Scoutly: para encontrar empresas por território e oportunidade digital',
        p: [
          'A Scoutly foi desenhada para uma pergunta comercial muito concreta: quais negócios existem nesta região e quais deles merecem uma investigação ou abordagem? A busca combina nome, segmento e localização em uma experiência baseada em mapa. Isso ajuda quem precisa prospectar clínicas, restaurantes, imobiliárias, oficinas, escolas, prestadores de serviço e outros negócios com presença física ou atuação local.',
          'Além de encontrar empresas, a plataforma reúne sinais digitais disponíveis para ajudar na qualificação. Dependendo do registro e da região, é possível analisar site, canais públicos de contato, presença digital, indicadores técnicos e informações relacionadas a rastreamento. Favoritos, pipeline e rotas ajudam a transformar uma pesquisa em uma rotina de vendas, em vez de deixar uma lista perdida em uma planilha.',
          'Esse recorte é especialmente útil para agências de marketing, empresas de criação de sites, consultorias, fornecedores regionais e equipes comerciais que trabalham por território. Um exemplo é uma agência que deseja identificar negócios de determinado bairro e priorizar aqueles cuja presença digital merece uma auditoria.',
          'A Scoutly não deve ser confundida com uma base universal de decisores ou com uma plataforma completa de cadências outbound. Ela não promete encontrar o contato pessoal de todas as empresas nem substituir ferramentas especializadas em sequências de e-mail e LinkedIn. Sua proposta é conectar descoberta local, contexto digital e organização da oportunidade. Veja os [recursos da Scoutly](/recursos/) e os [dados e limites das fontes](/dados-e-fontes/) antes de definir seu processo.'
        ]
      },
      {
        id: 'ramper-outbound',
        h: 'Ramper: para operações de outbound B2B',
        p: [
          'A Ramper apresenta o Ramper GTM como uma plataforma para apoiar o caminho entre definir o cliente ideal e iniciar conversas com potenciais compradores. A proposta pública reúne base de empresas e decisores, descoberta de contatos, cadências multicanal e recursos de IA. É uma opção a considerar quando a operação já trabalha com ICP, listas, abordagem recorrente e acompanhamento de respostas.',
          'Esse tipo de ferramenta tende a ser mais relevante para equipes que vendem para outras empresas e precisam abordar profissionais com cargos específicos. Uma empresa de software que procura gestores financeiros em organizações de determinado porte tem uma necessidade diferente de uma agência que quer encontrar restaurantes em cinco bairros.',
          'No teste, não avalie apenas se a plataforma encontra um nome. Verifique se os cargos correspondem ao decisor que compra sua solução, se o contato está atualizado, quais canais entram na cadência e o que é liberado em cada plano. A própria oferta da Ramper diferencia recursos por plano, portanto confirme os limites comerciais diretamente na página oficial.'
        ]
      },
      {
        id: 'econodata-inteligencia-mercado',
        h: 'Econodata: para inteligência de mercado e segmentação de empresas',
        p: [
          'A Econodata se posiciona em inteligência de mercado e prospecção B2B. Sua plataforma apresenta recursos para dimensionar mercados, segmentar empresas por características e apoiar a identificação de decisores e a geração de listas. É uma alternativa relevante para operações que precisam entender o universo de empresas de um setor antes de montar uma carteira comercial.',
          'Esse enfoque pode ajudar tanto na definição de um mercado endereçável quanto na seleção de empresas para uma equipe de vendas. O valor está em transformar uma hipótese ampla, como vender para indústrias de alimentos, em recortes mais específicos por porte, localização e características da empresa.',
          'Antes de contratar, faça uma amostra com empresas conhecidas e compare os resultados com informações recentes. Pergunte como a plataforma atualiza registros, quais dados de contato estão disponíveis, como funciona a exportação e se a ferramenta se integra ao CRM que sua equipe já utiliza.'
        ]
      },
      {
        id: 'speedio-listas-b2b',
        h: 'Speedio: para construir listas B2B com filtros',
        p: [
          'A Speedio divulga uma plataforma de prospecção comercial B2B baseada em filtros para encontrar empresas que correspondam a um perfil de cliente ideal. A página oficial destaca critérios firmográficos, dados de empresas e decisores e integração com ferramentas de CRM.',
          'Esse modelo é interessante quando a principal tarefa é construir listas a partir de atributos definidos, como setor, porte, localização ou tecnologias utilizadas. A pergunta para o teste é direta: consigo encontrar empresas parecidas com meus melhores clientes sem receber uma quantidade excessiva de registros fora do perfil?',
          'Peça uma demonstração com um recorte real do seu ICP. Compare os registros com fontes independentes, verifique a proporção de dados úteis e entenda quais campos estão disponíveis em cada plano. Quantidade de filtros não garante que os resultados serão comercialmente relevantes.'
        ]
      },
      {
        id: 'apollo-database-enrichment',
        h: 'Apollo.io: para dados de contato, pesquisa e enriquecimento',
        p: [
          'A Apollo combina pesquisa de empresas e profissionais com dados de contato e recursos de enriquecimento. Sua documentação descreve registros de empresas e pessoas, endereços de e-mail, telefones diretos e atributos firmográficos e tecnológicos. A plataforma também divulga funcionalidades de gestão e engajamento comercial.',
          'É uma opção que costuma entrar na avaliação de equipes com atuação internacional ou que precisam pesquisar contatos profissionais em diferentes mercados. Para uma operação brasileira, porém, é importante medir a cobertura do setor e do cargo desejado. A existência de um registro não significa que o e-mail esteja válido ou que o telefone seja o melhor canal para abordar aquela pessoa.',
          'Observe também como os créditos são consumidos, quais informações são liberadas em cada plano e como funciona o enriquecimento de dados que sua equipe já possui. Faça uma amostra pequena, confira os contatos manualmente e calcule o custo por contato efetivamente utilizável, não apenas o custo por registro encontrado.'
        ]
      },
      {
        id: 'linkedin-sales-navigator',
        h: 'LinkedIn Sales Navigator: para encontrar decisores e relações profissionais',
        p: [
          'O Sales Navigator é voltado à pesquisa de leads e contas dentro do LinkedIn. A documentação oficial descreve filtros para refinar pessoas e empresas por critérios como função, senioridade, empresa atual, localização, setor e porte. A ferramenta também ajuda a salvar leads e acompanhar mudanças relevantes nas contas.',
          'Seu maior valor está no contexto profissional: entender quem ocupa determinada função, onde trabalha e quais relações podem facilitar uma apresentação. Para vendas consultivas, contratos de maior valor e abordagens baseadas em relacionamento, esse contexto pode ser mais útil do que uma lista genérica de e-mails.',
          'O Sales Navigator não é, por si só, um mapa de todos os estabelecimentos de uma cidade nem um CRM completo. Avalie como os leads serão registrados, como a equipe respeitará os limites e termos da plataforma e quais integrações são necessárias para manter o histórico comercial.'
        ]
      },
      {
        id: 'como-escolher-a-ferramenta',
        h: 'Como escolher a ferramenta certa para sua operação',
        p: [
          'Comece pela origem do seu próximo cliente. Se ele é uma empresa local que você encontra por bairro e segmento, priorize cobertura geográfica e contexto do negócio. Se é um decisor em uma empresa de médio ou grande porte, priorize dados profissionais e filtros de conta. Se sua equipe já possui uma lista e precisa realizar cadências, avalie automação, entregabilidade e integração com CRM.',
          'Depois, transforme a escolha em um teste controlado. Defina um segmento, uma região, um perfil de decisor e uma amostra que sua equipe consiga validar. Use os mesmos critérios para comparar cada fornecedor, em vez de aceitar demonstrações feitas com exemplos selecionados pela própria ferramenta.'
        ],
        ol: [
          '**Aderência ao ICP:** a ferramenta encontra o tipo de empresa ou pessoa que realmente compra sua solução?',
          '**Cobertura:** os resultados existem nos estados, cidades e setores em que você vende?',
          '**Confiabilidade:** os registros estão atualizados e os contatos podem ser confirmados?',
          '**Qualificação:** a plataforma mostra contexto suficiente para entender por que um lead merece atenção?',
          '**Fluxo de trabalho:** é possível salvar, distribuir, acompanhar e exportar os leads sem retrabalho?',
          '**Custo real:** quanto custa um lead que passou pela validação e pode ser trabalhado pela equipe?',
          '**Governança:** as fontes, permissões, termos de uso e práticas de tratamento de dados são compatíveis com a sua operação?'
        ],
        p2: [
          'Uma forma simples de comparar fornecedores é atribuir uma nota de 1 a 5 para cada critério e dar mais peso aos dois fatores que mais afetam seu negócio. Para uma equipe de campo, cobertura territorial pode valer mais que automação de e-mail. Para uma operação enterprise, a identificação do decisor pode ser o principal requisito.'
        ]
      },
      {
        id: 'combinar-ferramentas',
        h: 'É melhor usar uma ferramenta ou combinar várias?',
        p: [
          'Muitas operações precisam de mais de uma camada. Uma ferramenta encontra empresas, outra revela decisores e uma terceira organiza a cadência. Isso não é necessariamente um problema, desde que cada produto tenha uma responsabilidade clara e que os dados não precisem ser copiados manualmente várias vezes.',
          'Uma agência regional pode usar a Scoutly para mapear empresas por território e identificar oportunidades digitais, depois registrar a conversa em seu CRM. Uma empresa de software B2B pode usar uma base de empresas para selecionar contas, Sales Navigator para investigar decisores e uma plataforma de cadência para executar o processo de contato. O stack ideal depende do canal de venda, do ticket e do tamanho da equipe.',
          'Evite comprar ferramentas que repetem a mesma função sem uma hipótese clara de ganho. Antes de adicionar um produto, identifique o gargalo atual: falta de empresas, falta de decisores, contatos desatualizados, pouca personalização, baixa resposta ou ausência de acompanhamento.'
        ]
      },
      {
        id: 'erros-ao-comparar',
        h: 'Erros comuns ao comparar softwares de prospecção',
        ul: [
          'Escolher pela maior quantidade de registros sem testar a relevância para seu ICP.',
          'Comparar uma ferramenta de descoberta local com uma base de decisores como se fossem o mesmo produto.',
          'Considerar um e-mail encontrado como um contato automaticamente válido.',
          'Ignorar créditos, limites de exportação, usuários adicionais e recursos restritos a planos superiores.',
          'Automatizar abordagens antes de validar a lista, a mensagem e as regras do canal.',
          'Tratar sinais ausentes como prova de que a empresa não utiliza uma tecnologia ou não possui determinado recurso.'
        ],
        p2: [
          'O teste precisa refletir o trabalho diário da equipe. Se a ferramenta exige muitas etapas manuais para transformar resultados em oportunidades, esse esforço também faz parte do custo.'
        ]
      }
    ],
    faq: [
      ['Qual é a melhor ferramenta de prospecção B2B?', 'Não existe uma vencedora para todas as operações. A escolha depende de procurar empresas locais, decisores, dados de contato ou automação de cadências. Compare a cobertura e a qualidade em uma amostra do seu ICP.'],
      ['A Scoutly é concorrente do Apollo?', 'As propostas se sobrepõem apenas em parte. A Scoutly foca na descoberta de negócios por localização, sinais digitais e organização de oportunidades locais. A Apollo enfatiza dados de empresas e contatos, enriquecimento e recursos de prospecção. Elas podem atender operações diferentes ou complementares.'],
      ['Qual ferramenta é melhor para prospectar empresas locais?', 'Uma ferramenta baseada em território, mapa e segmento tende a fazer mais sentido quando a equipe precisa encontrar negócios em cidades ou bairros. A Scoutly foi desenhada para esse fluxo, mas a cobertura deve ser testada na região de atuação.'],
      ['CRM e software de prospecção são a mesma coisa?', 'Não. O CRM normalmente organiza contatos, oportunidades e histórico comercial. O software de prospecção ajuda a encontrar e qualificar potenciais clientes e pode incluir recursos de automação. Algumas plataformas combinam as duas categorias.'],
      ['Como saber se os dados de uma ferramenta são bons?', 'Selecione uma amostra de empresas e contatos conhecidos, confira as informações em fontes independentes, verifique a atualidade e meça quantos registros são realmente utilizáveis. Não use apenas o volume anunciado pelo fornecedor.']
    ],
    sources: [
      ['Scoutly: recursos da plataforma', 'https://www.scoutly.pro/recursos/'],
      ['Scoutly: dados, fontes e limites', 'https://www.scoutly.pro/dados-e-fontes/'],
      ['Ramper GTM: principais funcionalidades', 'https://www.ramper.com.br/plataforma'],
      ['Econodata: plataforma de prospecção B2B', 'https://www.econodata.com.br/plataforma-de-prospeccao'],
      ['Speedio: ferramenta de prospecção B2B', 'https://prospeccao.speedio.com.br/'],
      ['Apollo: visão geral dos dados', 'https://knowledge.apollo.io/hc/en-us/articles/45824429846669-Apollo-Data-Overview'],
      ['LinkedIn: como usar o Sales Navigator', 'https://business.linkedin.com/br/pt/sell/sales-navigator/how-to-use']
    ],
    related: [
      'software-de-prospeccao-de-clientes',
      'ferramentas-para-encontrar-empresas-para-prospectar',
      'como-prospectar-clientes-no-google-maps',
      'como-agencias-conseguem-clientes-com-ia'
    ]
  },
  {
    id: 'software-de-prospeccao-de-clientes',
    tag: 'Software de vendas',
    title: 'Software de prospecção de clientes: como escolher em 2026',
    seoTitle: 'Software de prospecção de clientes: como escolher',
    seoDescription: 'Entenda como funciona um software de prospecção de clientes, quais recursos avaliar e como escolher uma plataforma para gerar oportunidades comerciais.',
    published: '2026-11-11',
    updated: '2026-11-11',
    readMinutes: 11,
    tldr: [
      'Um software de prospecção ajuda a encontrar, organizar e qualificar potenciais clientes antes e durante a abordagem comercial.',
      'Existem ferramentas de dados B2B, descoberta local, pesquisa de decisores, enriquecimento, automação de cadências e CRM. Elas resolvem etapas diferentes.',
      'A escolha deve partir do perfil do comprador e ser validada com uma amostra real, medindo cobertura, contatos úteis, tempo poupado e custo por oportunidade.'
    ],
    intro: 'Um software de prospecção de clientes não serve apenas para gerar uma lista de nomes. A ferramenta certa ajuda a encontrar empresas com perfil para comprar, entender o contexto de cada oportunidade e transformar pesquisa em uma rotina comercial organizada. Neste guia, você vai entender os tipos de plataforma, os recursos que realmente importam e um método prático para escolher sem pagar por funcionalidades que sua equipe não usa.',
    sections: [
      {
        id: 'definicao-software-prospeccao',
        h: 'O que é um software de prospecção de clientes?',
        p: [
          'É uma plataforma que apoia a identificação e a qualificação de potenciais compradores. Dependendo do produto, ela pesquisa empresas, encontra profissionais, disponibiliza informações de contato, analisa sinais de compra, organiza listas ou automatiza atividades de abordagem.',
          'A prospecção pode ser feita para consumidores ou empresas. Neste artigo, o foco é a prospecção comercial B2B e a descoberta de empresas locais: negócios que vendem para outras organizações, prestadores de serviço, agências, representantes e equipes que precisam criar novas oportunidades.',
          'Um ponto importante: software de prospecção não cria demanda automaticamente. Ele reduz o trabalho de pesquisa e organização, mas o resultado ainda depende da oferta, do mercado, da qualidade dos dados, da abordagem e da capacidade comercial da equipe.'
        ]
      },
      {
        id: 'etapas-processo',
        h: 'Quais etapas da prospecção o software pode resolver?',
        table: {
          head: ['Etapa', 'Pergunta que a equipe precisa responder', 'Recurso que pode ajudar'],
          rows: [
            ['Definir o mercado', 'Que tipo de empresa tem maior chance de comprar?', 'Filtros de setor, porte, localização e perfil ideal'],
            ['Encontrar empresas', 'Quais negócios existem dentro desse recorte?', 'Bases B2B, mapas, pesquisa local e diretórios'],
            ['Identificar decisores', 'Quem participa ou influencia a compra?', 'Dados profissionais, cargos, áreas e LinkedIn'],
            ['Qualificar oportunidades', 'Por que vale abordar esta empresa agora?', 'Sinais digitais, contexto comercial, dados da conta e pesquisa'],
            ['Iniciar contato', 'Qual canal e mensagem fazem sentido?', 'Cadências, modelos, tarefas e apoio de IA'],
            ['Acompanhar vendas', 'Quem respondeu e qual é o próximo passo?', 'Pipeline, CRM, histórico, lembretes e relatórios']
          ]
        },
        p2: [
          'Algumas ferramentas são especialistas em uma dessas etapas. Outras cobrem várias. O erro é assumir que um produto anunciado como all-in-one será automaticamente o melhor para todas as equipes.'
        ]
      },
      {
        id: 'tipos-de-software',
        h: 'Tipos de software de prospecção',
        p: [
          '**Bases de empresas e inteligência de mercado.** Ajudam a segmentar organizações por setor, porte, localização e outros atributos. São úteis quando a equipe vende para empresas com um perfil relativamente específico e precisa construir listas.',
          '**Plataformas de dados de contatos.** Procuram profissionais, cargos, e-mails e telefones associados às empresas. A qualidade e a atualidade dos registros precisam ser verificadas, principalmente em mercados menores ou nichos especializados.',
          '**Ferramentas de descoberta local.** Ajudam a mapear negócios por cidade, bairro e categoria, muitas vezes com visualização geográfica. São relevantes para vendas territoriais, franquias, agências e prestadores de serviços que atendem empresas locais.',
          '**Ferramentas de sales engagement.** Organizam e automatizam atividades de contato, como sequências de e-mail, tarefas e acompanhamento de respostas. A maior utilidade aparece quando a equipe já tem uma lista qualificada e um processo de abordagem definido.',
          '**Redes profissionais e pesquisa de decisores.** Permitem descobrir quem trabalha em uma empresa, qual função ocupa e como chegar a uma conversa contextual. O LinkedIn Sales Navigator é um exemplo dessa categoria.',
          '**CRM.** Registra contatos, oportunidades, atividades e histórico. Pode estar integrado ao software de prospecção, mas sua função principal é dar continuidade ao relacionamento comercial, não necessariamente encontrar novas empresas.'
        ]
      },
      {
        id: 'recursos-essenciais',
        h: '7 recursos que merecem atenção na escolha',
        ol: [
          '**Busca que acompanha seu ICP.** Deve permitir selecionar setor, porte, localização, tipo de empresa ou características relevantes para a compra.',
          '**Cobertura demonstrável.** O fornecedor precisa conseguir mostrar resultados no seu setor e nas regiões onde você realmente vende.',
          '**Contexto para qualificação.** Além do nome, procure sinais que ajudem a decidir por que aquela empresa merece uma abordagem.',
          '**Dados de contato com transparência.** Entenda quais campos existem, quando são verificados e como o sistema sinaliza dados ausentes ou incertos.',
          '**Organização e histórico.** Favoritos, listas, pipeline, notas e responsáveis evitam que a prospecção vire uma planilha sem dono.',
          '**Integrações e exportação.** Confira se os dados chegam ao CRM e aos canais que sua equipe já utiliza, sem criar uma nova ilha de informação.',
          '**Controles e governança.** Avalie gestão de acesso, origem dos dados, segurança, termos das plataformas e procedimentos internos para tratar dados pessoais.'
        ],
        p2: [
          'Não confunda quantidade de funcionalidades com qualidade. Uma plataforma com menos recursos, mas que resolve o principal gargalo da equipe e apresenta resultados melhores no seu segmento, pode ser a compra mais racional.'
        ]
      },
      {
        id: 'como-avaliar-dados',
        h: 'Como avaliar a qualidade dos dados antes de contratar',
        p: [
          'Peça acesso a uma demonstração ou teste e prepare uma pequena amostra com empresas que você conhece. Inclua diferentes portes, cidades e perfis de cliente. Depois, confira manualmente se os negócios existem, se os segmentos estão corretos, se os sites estão ativos e se os contatos correspondem à empresa.',
          'Registre quantos resultados da amostra são relevantes, quantos possuem dados que podem ser confirmados e quantos podem ser trabalhados pela equipe. Essa análise é mais útil do que comparar somente o tamanho da base divulgado em uma página comercial.',
          'Faça a mesma verificação em mais de um dia ou região quando a cobertura geográfica for importante. Bases e serviços de mapas podem ter lacunas, duplicidades e diferenças de atualização. Nenhum fornecedor deve ser tratado como fonte infalível.',
          'No caso de e-mails e telefones, diferencie dado encontrado, dado validado e dado que realmente permitiu uma conversa. São níveis diferentes de qualidade. Um telefone público também não confirma, por si só, que exista uma conta de WhatsApp ativa.'
        ]
      },
      {
        id: 'como-escolher-por-operacao',
        h: 'Como escolher de acordo com o seu modelo de vendas',
        table: {
          head: ['Sua operação', 'O que priorizar', 'Categoria para avaliar'],
          rows: [
            ['Agência que vende para negócios locais', 'Empresas por região, sinais digitais e organização das oportunidades', 'Descoberta local e mapa, como Scoutly'],
            ['SaaS que vende para outras empresas', 'Segmentação por empresa, decisores e processo de outbound', 'Base B2B, dados de contatos e sales engagement'],
            ['Equipe enterprise', 'Pesquisa de contas, cargos, relações e mudanças profissionais', 'Inteligência de mercado e Sales Navigator'],
            ['Representante ou vendedor de campo', 'Cobertura do território, endereços, rotas e histórico', 'Ferramenta de descoberta geográfica e CRM'],
            ['Equipe com lista própria', 'Enriquecimento, cadência, qualidade dos dados e integração', 'Dados de contatos e sales engagement']
          ]
        },
        p2: [
          'A Scoutly, por exemplo, atende melhor operações que precisam encontrar negócios por cidade, segmento e território, analisar sinais digitais públicos e organizar oportunidades no mapa e no pipeline. Para uma equipe cuja prioridade é descobrir decisores de grandes contas e automatizar sequências extensas de e-mails, uma plataforma B2B especializada pode ser mais adequada. Veja [como a prospecção local funciona na Scoutly](/prospeccao-local/) e compare os [recursos disponíveis](/recursos/).'
        ]
      },
      {
        id: 'roteiro-de-implementacao',
        h: 'Roteiro de implementação em quatro semanas',
        p: [
          'A adoção precisa começar por um processo pequeno que seja possível medir. Comprar licenças e liberar o software para todo mundo sem definir um método costuma produzir listas duplicadas e pouca aprendizagem.'
        ],
        ol: [
          '**Semana 1: defina o recorte.** Escolha um segmento, região, ticket e perfil de comprador. Documente o que faz um lead ser considerado qualificado.',
          '**Semana 2: teste a ferramenta.** Monte uma amostra, confira os dados e registre o tempo necessário para encontrar e validar cada oportunidade.',
          '**Semana 3: desenhe o fluxo.** Defina quem pesquisa, quem aprova a lista, qual canal será usado, como registrar tentativas e quando fazer follow-up.',
          '**Semana 4: revise o resultado.** Compare o número de oportunidades qualificadas, respostas, reuniões, propostas e tempo por lead com o processo anterior.'
        ],
        p2: [
          'O objetivo inicial não deve ser automatizar tudo. Deve ser descobrir onde a equipe perde tempo e se a ferramenta reduz esse esforço sem piorar a qualidade da lista ou da abordagem.'
        ]
      },
      {
        id: 'indicadores-prospeccao',
        h: 'Indicadores para saber se o software está funcionando',
        p: [
          'Acompanhe métricas próximas do trabalho real. Volume de registros encontrados é uma métrica de atividade, não prova de resultado comercial.'
        ],
        table: {
          head: ['Indicador', 'Como interpretar', 'O que pode revelar'],
          rows: [
            ['Taxa de aproveitamento da lista', 'Leads que passaram na qualificação ÷ registros encontrados', 'Se a busca está alinhada ao ICP'],
            ['Tempo por lead qualificado', 'Tempo de pesquisa e validação ÷ leads aprovados', 'Se a plataforma reduz trabalho operacional'],
            ['Taxa de contato válido', 'Contatos confirmados ÷ contatos pesquisados', 'Se os dados servem ao canal escolhido'],
            ['Taxa de resposta', 'Respostas ÷ abordagens realizadas', 'Se público, mensagem e canal fazem sentido'],
            ['Conversão em reunião ou oportunidade', 'Reuniões ou oportunidades ÷ abordagens', 'Se a prospecção gera avanço comercial'],
            ['Custo por oportunidade', 'Custo total da operação ÷ oportunidades qualificadas', 'Se o investimento se sustenta economicamente']
          ]
        }
      },
      {
        id: 'erros-contratacao',
        h: 'Erros que fazem a contratação dar errado',
        ul: [
          'Escolher pelo número de leads da base, sem avaliar quantos correspondem ao cliente ideal.',
          'Comprar automação antes de ter uma proposta clara e uma lista confiável.',
          'Ignorar as limitações regionais e descobrir depois que o segmento principal tem pouca cobertura.',
          'Não combinar o uso da plataforma com o CRM e o processo comercial.',
          'Medir sucesso pelo número de mensagens enviadas, em vez de respostas e oportunidades.',
          'Presumir que uma informação ausente é prova de que a empresa não possui aquele recurso.',
          'Deixar de revisar a conformidade com a LGPD e com os termos dos canais utilizados.'
        ],
        p2: [
          'Uma boa ferramenta torna o processo mais claro, não substitui a responsabilidade comercial. Dados, mensagens e decisões importantes precisam de revisão humana e de critérios documentados.'
        ]
      },
      {
        id: 'onde-entra-scoutly',
        h: 'Onde a Scoutly entra nesse cenário',
        p: [
          'A Scoutly é um software de prospecção local. Seu fluxo começa pela busca de empresas por nome, segmento e região, com resultados apresentados em mapa. A partir daí, a equipe pode avaliar informações públicas e sinais digitais disponíveis, salvar os negócios relevantes e acompanhá-los no pipeline.',
          'Esse desenho favorece quem vende serviços para empresas locais, trabalha por território ou precisa descobrir oportunidades em uma cidade sem montar manualmente uma planilha de cada bairro. O mapa ajuda a pensar em cobertura geográfica; os sinais digitais ajudam a preparar uma hipótese de abordagem; o pipeline mantém o histórico da oportunidade.',
          'A cobertura e a disponibilidade das informações variam por região e fonte. A Scoutly não garante que toda empresa tenha site, telefone, WhatsApp ou e-mail disponível, e um sinal técnico não detectado precisa ser confirmado antes de virar uma afirmação comercial. Consulte a página de [fontes e confiabilidade](/dados-e-fontes/) para entender esses limites.',
          'Se o seu problema é descobrir quais empresas da sua região merecem atenção, conheça a [prospecção local da Scoutly](/prospeccao-local/) e teste o fluxo com um segmento em que você já tenha experiência.'
        ]
      }
    ],
    faq: [
      ['O que faz um software de prospecção?', 'Ajuda a identificar e qualificar potenciais clientes. Dependendo da plataforma, pode pesquisar empresas, encontrar decisores, disponibilizar dados de contato, organizar listas, automatizar abordagens e conectar o trabalho ao CRM.'],
      ['Qual a diferença entre software de prospecção e CRM?', 'O software de prospecção apoia a descoberta e a qualificação de novos clientes. O CRM organiza o relacionamento, o histórico e as oportunidades ao longo do processo comercial. Algumas soluções combinam recursos das duas categorias.'],
      ['Uma pequena empresa precisa de um software de prospecção?', 'Não necessariamente. Uma empresa pequena pode começar com pesquisa manual e planilha. A ferramenta passa a fazer sentido quando o tempo gasto para encontrar, qualificar e acompanhar oportunidades se torna um gargalo recorrente.'],
      ['Qual software é indicado para encontrar empresas por região?', 'Uma plataforma com busca geográfica, filtros por segmento e visualização em mapa é mais aderente a essa necessidade. A Scoutly é voltada à descoberta de negócios locais, sinais digitais e organização de oportunidades por território.'],
      ['Software de prospecção garante novos clientes?', 'Não. Ele pode reduzir o trabalho de pesquisa e organizar atividades, mas vendas dependem de mercado, oferta, qualidade dos dados, abordagem e execução comercial.']
    ],
    sources: [
      ['Scoutly: recursos da plataforma', 'https://www.scoutly.pro/recursos/'],
      ['Scoutly: prospecção local', 'https://www.scoutly.pro/prospeccao-local/'],
      ['Scoutly: dados, fontes e confiabilidade', 'https://www.scoutly.pro/dados-e-fontes/'],
      ['Ramper GTM: funcionalidades', 'https://www.ramper.com.br/plataforma'],
      ['Econodata: plataforma de prospecção B2B', 'https://www.econodata.com.br/plataforma-de-prospeccao'],
      ['LinkedIn: pesquisa avançada no Sales Navigator', 'https://business.linkedin.com/br/pt/sell/sales-navigator/how-to-use']
    ],
    related: [
      'melhores-ferramentas-de-prospeccao-b2b',
      'ferramentas-para-encontrar-empresas-para-prospectar',
      'como-prospectar-clientes-no-google-maps',
      'prospeccao-de-empresas-lgpd'
    ]
  },
  {
    id: 'ferramentas-para-encontrar-empresas-para-prospectar',
    tag: 'Geração de leads',
    title: 'Ferramentas para encontrar empresas e novos clientes para prospectar',
    seoTitle: 'Ferramentas para encontrar empresas e novos clientes',
    seoDescription: 'Conheça ferramentas para localizar empresas por cidade, segmento e perfil. Compare mapas, bases B2B, LinkedIn e métodos para montar listas melhores.',
    published: '2026-11-11',
    updated: '2026-11-11',
    readMinutes: 10,
    tldr: [
      'Para encontrar empresas, você pode usar mapas, bases B2B, pesquisa profissional, diretórios setoriais e fontes públicas. Cada caminho revela um tipo diferente de oportunidade.',
      'O melhor método combina um recorte claro de segmento e região, validação dos dados e critérios para priorizar empresas que realmente podem comprar.',
      'A Scoutly ajuda a descobrir negócios locais por cidade e categoria, avaliar sinais digitais disponíveis e organizar os leads em favoritos e pipeline.'
    ],
    intro: 'Encontrar empresas para prospectar é uma tarefa diferente de simplesmente pesquisar nomes na internet. Uma boa lista precisa reunir negócios que combinam com sua oferta, estão em uma região atendida e apresentam informações suficientes para uma abordagem responsável. Neste guia, você vai conhecer as principais ferramentas e fontes para encontrar empresas, entender os pontos fortes de cada uma e montar uma lista que possa avançar para uma conversa comercial.',
    sections: [
      {
        id: 'por-que-fonte-importa',
        h: 'A fonte muda o tipo de empresa que você encontra',
        p: [
          'Uma pesquisa por empresas em um mapa tende a revelar negócios com presença local e endereço identificável. Uma base B2B pode oferecer filtros de setor, porte e estrutura empresarial. Uma rede profissional ajuda a encontrar pessoas que trabalham nessas empresas. Já um diretório setorial costuma reunir organizações de um mercado específico.',
          'Nenhuma fonte é universal. O que importa é escolher o lugar em que seu comprador provavelmente aparece e complementar o resultado com uma verificação independente. Se você vende para restaurantes e clínicas de uma cidade, uma ferramenta de busca geográfica pode ser mais produtiva do que uma base internacional de decisores. Se vende software para diretores financeiros de grandes empresas, o caminho é outro.'
        ]
      },
      {
        id: 'mapas-e-prospeccao-local',
        h: '1. Mapas e ferramentas de prospecção local',
        p: [
          'Mapas e plataformas geográficas permitem procurar negócios por nome, categoria e localização. São úteis para representantes, prestadores de serviço, empresas de tecnologia local, agências, distribuidores e operações com cobertura territorial.',
          'A Scoutly organiza esse tipo de busca em uma experiência de mapa. Você pode escolher uma cidade, bairro ou segmento, explorar os negócios encontrados e analisar sinais digitais disponíveis, como presença de site e canais públicos de contato. Favoritos, pipeline e rotas ajudam a acompanhar o trabalho depois que a empresa é descoberta.',
          'A principal vantagem é enxergar o território como uma carteira de oportunidades. Em vez de montar uma lista sem contexto, a equipe pode pensar em bairros, rotas, densidade de negócios e segmentos. A limitação é que a cobertura depende das fontes e pode variar de uma cidade para outra. Confirme os resultados antes de abordar.',
          'O Google Maps também pode ser usado para pesquisa manual. Porém, pesquisar e copiar nomes para uma planilha não cria automaticamente um processo de qualificação, histórico ou follow-up. Além disso, é necessário respeitar os termos de uso do serviço e evitar extração automatizada em massa não autorizada. Veja o guia de [como prospectar clientes no Google Maps](/blog/como-prospectar-clientes-no-google-maps/).'
        ]
      },
      {
        id: 'bases-b2b',
        h: '2. Bases de empresas e plataformas de inteligência B2B',
        p: [
          'Bases de empresas são indicadas quando o objetivo é montar uma lista a partir de atributos empresariais. Dependendo do fornecedor, é possível pesquisar por setor, porte, localização, atividade econômica e outras características. Algumas plataformas também oferecem informações de decisores, enriquecimento e integração com CRM.',
          'Econodata e Speedio são exemplos de plataformas brasileiras que divulgam recursos para segmentação e prospecção B2B. A Ramper também apresenta uma base de empresas e decisores conectada a recursos de descoberta de contatos e cadências. Essas soluções podem ser mais adequadas quando o time precisa trabalhar com listas empresariais estruturadas.',
          'O cuidado está na qualidade do recorte. Uma base extensa pode conter empresas inativas, registros repetidos, informações antigas ou organizações que não correspondem ao seu cliente ideal. Teste com uma amostra e confira o que realmente pode ser utilizado.'
        ]
      },
      {
        id: 'linkedin-e-rede-profissional',
        h: '3. Redes profissionais para encontrar decisores',
        p: [
          'Quando você já sabe quais empresas deseja abordar, precisa descobrir quem participa da decisão. O LinkedIn e o Sales Navigator ajudam a pesquisar pessoas por empresa, cargo, função, senioridade, localização e outros filtros profissionais.',
          'A rede profissional oferece contexto que uma lista de telefones não entrega. Você pode entender a trajetória de uma pessoa, acompanhar mudanças de função e identificar conexões em comum que facilitem uma apresentação. Isso é especialmente importante em vendas consultivas, contratos complexos e ciclos de compra mais longos.',
          'A limitação é que a pesquisa dentro de uma rede profissional não substitui uma base de todos os negócios de uma região. Também é importante respeitar os termos da plataforma e manter o processo de registro dos leads no sistema comercial da equipe.'
        ]
      },
      {
        id: 'busca-web-diretorios',
        h: '4. Pesquisa na web, diretórios e associações setoriais',
        p: [
          'Mecanismos de busca podem revelar associações comerciais, sindicatos, feiras, listas de expositores, diretórios de fornecedores e páginas de empresas de um nicho. Para segmentos especializados, essas fontes ajudam a identificar organizações que não aparecem bem em uma pesquisa genérica.',
          'Uma associação do setor industrial pode reunir fabricantes e distribuidores. Uma feira de tecnologia pode publicar a lista de expositores. Um conselho ou diretório profissional pode indicar organizações que atuam em determinada área. Esses caminhos são úteis para complementar bases e encontrar nichos menos óbvios.',
          'Registre a origem de cada empresa e confira se a página está atualizada. Um diretório pode manter empresas que mudaram de endereço ou encerraram atividades. Use a fonte como ponto de partida, não como validação definitiva.'
        ]
      },
      {
        id: 'fontes-publicas',
        h: '5. Registros públicos e dados empresariais',
        p: [
          'Registros públicos e dados empresariais podem ajudar a confirmar a existência de uma empresa, sua razão social, situação cadastral e atividade econômica, conforme o dado disponível e as condições de acesso. No Brasil, informações cadastrais e classificações como CNAE podem apoiar a validação de uma lista.',
          'Esses registros não substituem uma ferramenta comercial. Nem sempre informam o contato responsável pela compra, a necessidade atual ou o canal ideal de abordagem. São mais úteis como fonte de conferência e segmentação do que como solução completa para o trabalho diário do vendedor.',
          'Ao combinar diferentes fontes, mantenha a origem e a data de consulta. Isso facilita corrigir informações e explicar de onde veio cada dado utilizado na prospecção.'
        ]
      },
      {
        id: 'comparativo-fontes',
        h: 'Comparativo: qual fonte usar em cada situação?',
        table: {
          head: ['Fonte ou ferramenta', 'Melhor uso', 'Ponto de atenção'],
          rows: [
            ['Scoutly e mapas', 'Descobrir negócios locais por segmento e território', 'Cobertura e dados disponíveis variam por região'],
            ['Econodata, Speedio e Ramper', 'Segmentar empresas e montar listas B2B', 'Validar campos, atualização, limites e aderência ao ICP'],
            ['Apollo.io', 'Pesquisar empresas e contatos, inclusive em operações internacionais', 'Conferir a cobertura do Brasil e a validade dos contatos'],
            ['LinkedIn Sales Navigator', 'Encontrar decisores e contexto profissional', 'Não substitui a descoberta de todos os negócios locais'],
            ['Google e diretórios setoriais', 'Pesquisar nichos, fornecedores, expositores e associações', 'Exigem validação manual e organização'],
            ['Registros públicos', 'Confirmar dados cadastrais e atividade empresarial', 'Não garantem contato comercial ou intenção de compra']
          ]
        },
        p2: [
          'A combinação ideal costuma ser uma fonte principal e uma fonte de validação. Adicionar muitos serviços sem um motivo claro aumenta duplicidade, trabalho operacional e dificuldade para manter os dados atualizados.'
        ]
      },
      {
        id: 'metodo-lista-prospeccao',
        h: 'Como montar uma lista de empresas em seis passos',
        ol: [
          '**Defina o que você vende.** Descreva o serviço, o problema que resolve, o ticket e o tipo de empresa que costuma se beneficiar.',
          '**Escolha um segmento e uma região.** Comece com um recorte que a equipe consiga validar. Evite pesquisar todos os setores e todas as cidades de uma vez.',
          '**Selecione a fonte.** Use mapa para negócios locais, base B2B para listas firmográficas e rede profissional para localizar decisores.',
          '**Valide uma amostra.** Confira existência, segmento, site, localização e contato. Remova duplicados e registros que não correspondem ao perfil.',
          '**Priorize por sinais.** Dê prioridade a empresas com necessidade visível, potencial de compra e um canal adequado para iniciar a conversa.',
          '**Registre o próximo passo.** Salve o lead, anote a origem, registre a abordagem e defina quando revisar ou fazer follow-up.'
        ],
        p2: [
          'Uma lista menor e bem qualificada geralmente é mais fácil de trabalhar do que milhares de registros sem contexto. O processo deve permitir que qualquer pessoa da equipe entenda por que uma empresa foi incluída.'
        ]
      },
      {
        id: 'qualificar-antes-abordar',
        h: 'Como saber se uma empresa vale a abordagem',
        p: [
          'Encontrar uma empresa é apenas o começo. Antes de entrar em contato, responda a quatro perguntas: ela se encaixa no segmento que você atende? Está dentro da sua região ou capacidade de entrega? Existe um problema que sua solução pode resolver? Há um canal apropriado para iniciar uma conversa?',
          'Sinais digitais ajudam a formular hipóteses. Uma empresa sem site identificado pode ter interesse em presença digital, mas pode também depender de redes sociais ou de outro canal. Um site lento pode justificar uma análise, mas não prova que a empresa esteja perdendo vendas. Uma tag de rastreamento não detectada pode estar bloqueada ou carregada de forma dinâmica.',
          'A abordagem deve descrever o que você observou e convidar a uma conversa, sem transformar uma hipótese em acusação. Para entender limites e boas práticas de dados pessoais, leia o guia sobre [prospecção B2B e LGPD](/blog/prospeccao-de-empresas-lgpd/) e o conteúdo sobre [WhatsApp na prospecção](/blog/prospeccao-whatsapp-sem-ser-banido/).'
        ]
      },
      {
        id: 'como-scoutly-ajuda',
        h: 'Como a Scoutly ajuda a encontrar empresas para prospectar',
        p: [
          'A Scoutly foi criada para operações que precisam encontrar negócios por território e entender melhor o contexto de cada empresa. A pesquisa pode partir de um segmento, de uma localização ou do nome de uma empresa. Os resultados aparecem no mapa e podem ser avaliados por informações públicas disponíveis.',
          'A equipe pode salvar oportunidades, organizar o pipeline e planejar o próximo passo sem separar a descoberta do acompanhamento. Para agências e freelancers, sinais de presença digital ajudam a identificar empresas que merecem uma auditoria mais detalhada. Para equipes de campo, a visualização geográfica facilita pensar em bairros e rotas.',
          'A plataforma não garante que todas as empresas tenham contatos completos, WhatsApp ou dados técnicos identificáveis. A disponibilidade depende da fonte, da região e do próprio negócio. Consulte [como os dados são obtidos e quais são seus limites](/dados-e-fontes/) e conheça a página de [prospecção local](/prospeccao-local/).',
          'Quando o gargalo da equipe é descobrir negócios locais e organizar as oportunidades, teste a Scoutly com um segmento conhecido. Comece por uma cidade e avalie a qualidade dos resultados antes de ampliar a pesquisa.'
        ]
      },
      {
        id: 'erros-lista-empresas',
        h: 'Erros que prejudicam uma lista de prospecção',
        ul: [
          'Pesquisar muitos segmentos e regiões antes de entender quem compra sua solução.',
          'Confundir volume de registros com quantidade de oportunidades qualificadas.',
          'Usar dados de contato sem conferir a origem, a atualidade e a finalidade do canal.',
          'Não registrar como cada empresa foi encontrada.',
          'Abordar um negócio com uma afirmação que a equipe não verificou.',
          'Deixar a lista parada sem responsável, próxima ação e histórico.'
        ],
        p2: [
          'Uma rotina eficiente não termina quando a empresa aparece na tela. Ela termina quando existe uma decisão: abordar, pesquisar melhor, acompanhar em outro momento ou descartar com um motivo registrado.'
        ]
      }
    ],
    faq: [
      ['Qual ferramenta usar para encontrar empresas para prospectar?', 'Depende do perfil. Mapas e ferramentas de prospecção local ajudam a encontrar negócios por território. Bases B2B apoiam filtros empresariais e dados de decisores. Redes profissionais ajudam a localizar pessoas dentro das contas.'],
      ['Como encontrar empresas por cidade e segmento?', 'Defina a categoria e a região, pesquise em mapas ou em uma plataforma de descoberta local, confira os registros e organize os resultados em uma lista ou pipeline. A Scoutly reúne busca geográfica, sinais digitais disponíveis e organização de oportunidades.'],
      ['Google Maps é suficiente para prospectar?', 'Pode servir para pesquisa inicial, principalmente em negócios locais, mas não substitui qualificação, registro de histórico e follow-up. Também é necessário respeitar os termos de uso e evitar extração automatizada em massa não autorizada.'],
      ['Como encontrar o dono ou decisor de uma empresa?', 'Use fontes profissionais e registros públicos adequados para identificar funções e vínculos, e confirme as informações antes de tratar uma pessoa como decisora. Uma ficha comercial ou um telefone da empresa não prova quem é o responsável pela compra.'],
      ['Posso usar os dados encontrados para enviar mensagens em massa?', 'Não presuma que a disponibilidade pública de um dado autoriza qualquer uso. Verifique a base legal aplicável, a finalidade, os direitos dos titulares, os termos do canal e as regras da plataforma. Prefira contatos relevantes e abordagens individualizadas.']
    ],
    sources: [
      ['Scoutly: prospecção local', 'https://www.scoutly.pro/prospeccao-local/'],
      ['Scoutly: recursos', 'https://www.scoutly.pro/recursos/'],
      ['Scoutly: fontes e confiabilidade dos dados', 'https://www.scoutly.pro/dados-e-fontes/'],
      ['Econodata: plataforma de prospecção B2B', 'https://www.econodata.com.br/plataforma-de-prospeccao'],
      ['Speedio: ferramenta de prospecção comercial B2B', 'https://prospeccao.speedio.com.br/'],
      ['LinkedIn: pesquisa avançada no Sales Navigator', 'https://business.linkedin.com/br/pt/sell/sales-navigator/how-to-use'],
      ['Google Maps Platform: termos de serviço', 'https://cloud.google.com/maps-platform/terms']
    ],
    related: [
      'melhores-ferramentas-de-prospeccao-b2b',
      'software-de-prospeccao-de-clientes',
      'como-prospectar-clientes-no-google-maps',
      'como-vender-sites-para-empresas-sem-site'
    ]
  }

];

export const getBlogArticle = (id) => BLOG_ARTICLES.find((article) => article.id === id);
