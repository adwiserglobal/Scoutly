# Scoutly — plano de SEO e GEO

Objetivo: tornar as **páginas públicas** da Scoutly rastreáveis, úteis para buscas com intenção comercial e fáceis de citar em mecanismos de resposta por IA. Nenhum arquivo ou diretiva garante posição, indexação ou recomendação por um assistente.

Domínio canônico: `https://scoutly.pro`. Idiomas: pt-BR (principal), inglês (visão geral indexável em `/en/`).

## Implementado no branch de redesign

1. **HTML rastreável:** `scripts/build-seo.mjs` gera HTML estático completo para sete rotas públicas, além de conteúdo inicial sem JavaScript na home. A aplicação React continua atendendo o produto autenticado; não há dados de clientes nem leads nas páginas geradas.
2. **SEO on-page:** título, descrição, um H1, subtítulos semânticos, links internos, canonical, Open Graph, Twitter Card e `hreflang` no par home pt-BR/home inglês. O conteúdo público apresenta apenas funcionalidades e limitações respaldadas pelo produto.
3. **Dados estruturados:** `Organization`, `WebSite`, `SoftwareApplication`, `WebPage` e `BreadcrumbList`; `FAQPage` na página de perguntas frequentes. Não publicar avaliações, notas, depoimentos ou preços não verificados.
4. **Descoberta e indexação:** `/sitemap.xml` gerado no build; `/robots.txt` público permite OAI-SearchBot, GPTBot e visitantes de conteúdo público, sem abrir APIs e páginas privadas. `/llms.txt` e `/llms-full.txt` descrevem o produto e referenciam as URLs públicas. Esses arquivos são suplementares, não substituem HTML acessível.
5. **Previews protegidos:** os builds do Vercel em ambiente `preview` recebem `noindex` e `robots.txt` restritivo, evitando concorrer com o domínio canônico.
6. **Privacidade:** o servidor aplica `X-Robots-Tag: noindex, nofollow, noarchive` nas rotas de login, dashboard, configurações, pipeline e APIs. O bloqueio de autenticação continua obrigatório: `robots.txt` não é mecanismo de segurança.
7. **Validação:** `npm run build` também executa `scripts/check-seo.mjs`. Se alguma página pública, canonical, JSON-LD, sitemap ou regra de preview falhar, o build termina com erro.

## Mapa de conteúdo por intenção

| URL | Busca/necessidade principal |
|---|---|
| `/` | Conhecer a Scoutly e iniciar o uso |
| `/prospeccao-local/` | Software de prospecção local; encontrar empresas por segmento e região |
| `/prospeccao-com-ia/` | Prospecção com IA; agente comercial com contexto |
| `/para-agencias/` | Prospecção de clientes para agências de marketing |
| `/recursos/` | Mapa de empresas, contatos, auditoria digital e pipeline |
| `/dados-e-fontes/` | Critérios, fontes e confiabilidade da informação |
| `/perguntas-frequentes/` | Dúvidas concretas sobre produto, créditos, contatos e IA |
| `/en/` | Visão geral do produto em inglês |

As páginas se relacionam por links HTML. Evitar produção massiva de páginas quase idênticas por cidade ou segmento, especialmente quando não há conteúdo editorial específico ou fonte confiável.

## Publicação e verificação operacional — requer acesso ao domínio

1. Publicar o branch validado no ambiente **Production** do projeto Vercel associado a `scoutly.pro`. Não enviar o preview à indexação. Conferir se os caminhos estáticos, `/robots.txt`, `/sitemap.xml` e `/llms.txt` retornam HTTP 200 sem login.
2. Conferir `https://scoutly.pro/`, `/prospeccao-local/` e `/en/` com JavaScript desativado. Conferir canonical, robots e dados estruturados no HTML **da resposta HTTP**, não somente no navegador após hidratação.
3. Verificar o domínio no **Google Search Console** via DNS, enviar `https://scoutly.pro/sitemap.xml`, usar Inspeção de URL em home e nas principais páginas e acompanhar erros de cobertura. Cadastro/verificação exigem acesso do proprietário.
4. Verificar o domínio no **Bing Webmaster Tools** e enviar o sitemap. Opcional: configurar `INDEXNOW_KEY` no build de produção. Depois de conferir que `https://scoutly.pro/<chave>.txt` contém a chave, executar `npm run seo:submit` para notificar as URLs públicas modificadas. Notificação não garante indexação.
5. Garantir que WAF, CDN, CAPTCHA ou regras antibot não respondam 403 para crawlers legítimos de busca, especialmente OAI-SearchBot. Permitir acesso **somente às páginas públicas**; nunca desligar autenticação ou a proteção das APIs.
6. Usar Rich Results Test e validação JSON-LD para encontrar falhas de schema. Dados estruturados não garantem resultados enriquecidos; a exibição de FAQ rich results é restrita.

## GEO — como tornar a informação recuperável e confiável

- Manter nomes, descrição do produto, limites dos planos e afirmações de capacidades consistentes entre home, páginas de recursos, FAQ e documentação.
- Redigir definições diretas e respostas completas sobre fontes, limites e casos de uso. Incluir links canônicos para páginas que podem fundamentar uma resposta de IA.
- Publicar conteúdo original útil: explicações de prospecção local, qualificação comercial, auditoria digital e metodologia. Não inventar estatísticas, estudos de caso, clientes ou comparações.
- Não confundir rastreador de pesquisa (OAI-SearchBot) com rastreador de treinamento (GPTBot) ou acessos acionados pelo usuário (ChatGPT-User). Permissão do primeiro pode viabilizar descoberta em busca, sem assegurar citação/recomendação.
- `llms.txt` é uma convenção suplementar ainda sem adoção garantida por mecanismos de IA. A prioridade permanece HTML público, fontes verificáveis, links, metadados consistentes e reputação real.

## Medição após entrar em produção

| Frequência | Métrica | Ferramenta |
|---|---|---|
| Semanal (primeiras 4 semanas) | URLs descobertas/indexadas, erros de cobertura, sitemaps | Search Console e Bing Webmaster |
| Semanal | Impressões, cliques, CTR, consultas de marca e sem marca | Search Console |
| Quinzenal | Visitas e cadastros por página orgânica, com consentimento quando aplicável | Analytics da Scoutly |
| Mensal | Referências observáveis de mecanismos de IA, links e menções documentadas | Analytics e relatórios manuais |
| Mensal | Páginas lentas, imagens pesadas e alterações de CWV | PageSpeed / CrUX |

**Não tratar ausência de visitas identificadas de IA como prova de que não há menções ou recomendações.** Nem toda resposta de IA produz um clique e nem todo serviço preserva um referrer identificável.

## Próxima etapa editorial (30–90 dias)

- Criar guias originais que respondam perguntas específicas: como prospectar empresas por região, como identificar oportunidades digitais e como transformar pesquisa em pipeline.
- Demonstrar fluxos reais do produto com capturas ou vídeos próprios, texto alternativo e descrições que expliquem o que a interface efetivamente faz.
- Publicar estudos de caso somente após autorização e com resultados verificáveis; não criar depoimentos fictícios.
- Buscar citações e links editoriais naturais de comunidades, parceiros e canais relevantes. Não comprar backlinks nem usar páginas em massa feitas só para capturar palavras-chave.
- Reavaliar a estratégia com consultas reais do Search Console, evitando afirmar volume ou dificuldade de palavra-chave sem dados.

## Comandos

```bash
npm run build        # Inclui geração e validação de SEO
npm run seo:check    # Verifica arquivos dist já gerados
npm run seo:submit   # Opcional: notifica IndexNow depois de configurar a chave de produção
```

Referências técnicas: [Google Search Central (JS/SSR)](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering), [Google SEO para desenvolvedores](https://developers.google.com/search/docs/fundamentals/get-started-developers), [OpenAI crawlers](https://developers.openai.com/api/docs/bots), [IndexNow](https://www.indexnow.org/pt_br/faq).
