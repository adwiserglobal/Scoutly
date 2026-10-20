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
          'A política comercial do WhatsApp (WhatsApp Business Messaging Policy) exige que a empresa tenha o **consentimento (opt-in)** da pessoa para enviar mensagens e proíbe práticas como o envio em massa não solicitado e o uso de métodos automatizados fora dos canais oficiais. Os detalhes e as exceções mudam com o tempo: leia a versão atual nas fontes ao final.',
          'Na prática, existem dois mundos:'
        ],
        table: {
          head: ['', 'App WhatsApp / WhatsApp Business (celular)', 'WhatsApp Business Platform (API)'],
          rows: [
            ['Para quem serve', 'Contato individual, atendimento e primeiro contato pontual', 'Empresas com volume, CRM e consentimento'],
            ['Opt-in', 'Recomendado, mesmo no primeiro contato', 'Exigido para mensagens iniciadas pela empresa'],
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
      'A LGPD não proíbe prospecção. Para tratar dados pessoais comerciais, uma base legal comum é o legítimo interesse (art. 7º, IX), que exige finalidade legítima, necessidade, avaliação do impacto e transparência.',
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
          '**Legítimo interesse (art. 7º, IX):** permite o tratamento quando há uma finalidade legítima e concreta do controlador ou de terceiros, desde que não prevaleçam os direitos e as liberdades do titular. Exige documentar uma avaliação (o chamado teste de balanceamento).'
        ],
        p2: ['A Autoridade Nacional de Proteção de Dados (ANPD) publicou um guia orientativo sobre hipóteses legais de tratamento, incluindo o legítimo interesse. Leia-o nas fontes ao final deste artigo.']
      },
      {
        id: 'teste-legitimo-interesse',
        h: 'O teste do legítimo interesse, em 4 perguntas',
        ol: [
          '**Finalidade legítima:** o motivo é real e específico? (ex.: oferecer um serviço relacionado à atividade da empresa contatada).',
          '**Necessidade:** você usa só os dados necessários? (ex.: o contato comercial divulgado, não a vida pessoal do dono).',
          '**Balanceamento:** a pessoa esperaria razoavelmente receber esse contato? O impacto sobre ela é baixo?',
          '**Salvaguardas e transparência:** você informa quem é, de onde obteve o contato e oferece um jeito simples de pedir para sair?'
        ],
        p2: ['Se a resposta a alguma delas for "não", ajuste a prática antes de prosseguir. Registre a sua avaliação por escrito: ela é a sua prova de que você pensou no assunto.']
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
      ['ANPD: Guia orientativo sobre hipóteses legais de tratamento de dados pessoais, legítimo interesse', 'https://www.gov.br/anpd/pt-br'],
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
];

export const getBlogArticle = (id) => BLOG_ARTICLES.find((article) => article.id === id);
