import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDuckDB, queryPlacesInBBox } from './server/overtureService';
import { enrichBusinessWebsite } from './server/enrichService';
import { handleAIChat, generateContextualSuggestions } from './server/aiService';
import { analyzePageSpeed } from './server/pagespeedService';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy Firebase Authentication handler for custom domain and local testing
  app.all('/__/auth/*', async (req, res) => {
    try {
      const targetUrl = `https://gen-lang-client-0931227900.firebaseapp.com${req.originalUrl}`;
      const headers: Record<string, string> = {};
      for (const [key, val] of Object.entries(req.headers)) {
        if (key.toLowerCase() !== 'host' && typeof val === 'string') {
          headers[key] = val;
        }
      }
      headers['host'] = 'gen-lang-client-0931227900.firebaseapp.com';

      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
      });

      res.status(response.status);
      response.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error('[Firebase Auth Proxy Error]:', err?.message || err);
      res.status(502).send('Error proxying auth request');
    }
  });

  // Warm up DuckDB asynchronously in background so first request is faster
  getDuckDB().catch((err) => {
    console.warn('[Server Startup] DuckDB background init error (will retry on first query):', err.message);
  });

  // GET /api/leads - Fetch all user prospect leads from persistent DuckDB database
  app.get('/api/leads', async (req, res) => {
    try {
      const db = await getDuckDB();
      db.all('SELECT business_id, status, notes, updated_at FROM user_leads', (err, rows: any[]) => {
        if (err) {
          console.error('[DuckDB] Error fetching user leads:', err);
          return res.status(500).json({ error: 'Erro ao buscar leads', leads: {} });
        }
        const leadsMap: Record<string, { status: string; notes: string; updatedAt: string }> = {};
        if (rows) {
          for (const row of rows) {
            leadsMap[row.business_id] = {
              status: row.status,
              notes: row.notes || '',
              updatedAt: row.updated_at,
            };
          }
        }
        res.json({ leads: leadsMap });
      });
    } catch (err: any) {
      console.error('[API /api/leads GET Error]:', err.message || err);
      res.status(500).json({ error: 'Erro no banco de dados', leads: {} });
    }
  });

  // POST /api/leads - Save or update lead status/notes in persistent DuckDB database
  app.post('/api/leads', async (req, res) => {
    try {
      const { businessId, status, notes } = req.body;
      if (!businessId) {
        return res.status(400).json({ error: 'businessId é obrigatório' });
      }

      const db = await getDuckDB();
      const updatedAt = new Date().toISOString();
      db.run(
        'INSERT OR REPLACE INTO user_leads (business_id, status, notes, updated_at) VALUES (?, ?, ?, ?)',
        businessId,
        status || 'NOVO',
        notes || '',
        updatedAt,
        (err) => {
          if (err) {
            console.error('[DuckDB] Error saving user lead:', err);
            return res.status(500).json({ error: 'Erro ao salvar lead no banco de dados' });
          }
          res.json({ success: true, businessId, status, notes, updatedAt });
        }
      );
    } catch (err: any) {
      console.error('[API /api/leads POST Error]:', err.message || err);
      res.status(500).json({ error: 'Erro no banco de dados' });
    }
  });

  // GET /api/enrich - Enrich business details via website parsing
  app.get('/api/enrich', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const result = await enrichBusinessWebsite(url);
      res.json(result);
    } catch (err: any) {
      console.error('[API /api/enrich Error]:', err.message || err);
      res.status(500).json({
        error: 'Erro ao enriquecer dados.',
        details: err.message
      });
    }
  });

  // GET /api/pagespeed - Analyze Google PageSpeed performance score and metrics
  app.get('/api/pagespeed', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: 'Parâmetro url é obrigatório' });
      }

      const result = await analyzePageSpeed(url);
      res.json(result);
    } catch (err: any) {
      console.error('[API /api/pagespeed Error]:', err.message || err);
      res.status(500).json({
        error: 'Erro ao analisar velocidade da página com Google PageSpeed.',
        details: err.message,
      });
    }
  });

  // POST /api/ai/chat - OpenRouter AI Assistant for prospecting and copy generation
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, history, businesses, currentRegionName, searchMode } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Mensagem é obrigatória' });
      }

      const response = await handleAIChat({
        message,
        history: Array.isArray(history) ? history : [],
        businesses: Array.isArray(businesses) ? businesses : [],
        currentRegionName: currentRegionName || 'Região Atual',
        searchMode: searchMode === 'deep' ? 'deep' : 'default',
      });

      res.json(response);
    } catch (err: any) {
      console.error('[API /api/ai/chat Error]:', err.message || err);
      res.status(500).json({
        error: 'Erro ao processar consulta de IA.',
        details: err.message,
      });
    }
  });

  // POST /api/ai/suggestions - Generate AI contextual prospecting suggestions
  app.post('/api/ai/suggestions', async (req, res) => {
    try {
      const { recentSearches, currentRegionName } = req.body;
      const suggestions = await generateContextualSuggestions(
        Array.isArray(recentSearches) ? recentSearches : [],
        currentRegionName || 'São Paulo'
      );
      res.json({ suggestions });
    } catch (err: any) {
      console.error('[API /api/ai/suggestions Error]:', err.message || err);
      res.status(500).json({
        suggestions: [
          'Ache restaurantes sem site em Florianópolis',
          'Busque clínicas e consultórios em Curitiba',
          'Oficinas mecânicas com WhatsApp em São Paulo',
          'Agências de marketing e B2B em São Paulo',
        ],
      });
    }
  });

  // POST /api/ai/generate-message - Generate a personalized prospecting message using fast OpenRouter free models, with Gemini & Smart Template fallbacks
  app.post('/api/ai/generate-message', async (req, res) => {
    try {
      const { business } = req.body;
      if (!business) {
        return res.status(400).json({ error: 'Business data is required' });
      }

      const prompt = `Você é um especialista em vendas B2B (SDR/BDR). Sua tarefa é escrever uma mensagem de prospecção fria curta, direta e altamente persuasiva para abordar a empresa "${business.name}" via WhatsApp.
      
INFORMAÇÕES DA EMPRESA:
- Nome: ${business.name}
- Categoria principal: ${business.category || 'Não informada'}
- Website: ${business.website || 'Não possui website (Oferecer criação de site/cardápio digital!)'}
- O site está lento? ${business.pageSpeedScore ? `O site atual tirou nota ${business.pageSpeedScore}/100 no Google PageSpeed Insights (lento, precisa de otimização).` : 'Sem dados de lentidão.'}
- Oferece delivery? ${business.delivery ? 'Sim' : 'Não informado'}

DIRETRIZES DA MENSAGEM:
1. Seja educado, humano e natural (sem jargões engessados).
2. Vá direto ao ponto: ataque uma oportunidade real (se não tem site, ofereça um site profissional para atrair clientes locais; se o site tá lento, ofereça otimização para não perder vendas).
3. Escreva no máximo 3 parágrafos curtos.
4. Comece com saudação amigável chamando pelo nome ou empresa.
5. Termine com uma pergunta engajadora (Call to Action).
6. Escreva EXCLUSIVAMENTE a mensagem pronta para enviar no WhatsApp, sem introduções, sem explicações e sem aspas.`;

      let generatedMessage = '';

      // TIER 1: OpenRouter fast free models requested by user
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (openRouterKey) {
        const freeModels = [
          'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
          'nvidia/nemotron-3-super-120b-a12b:free',
          'google/gemma-4-31b-it:free',
          'google/gemma-4-26b-a4b-it:free'
        ];

        for (const modelName of freeModels) {
          try {
            const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${openRouterKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: modelName,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 350,
              }),
              signal: AbortSignal.timeout(8000),
            });

            if (orRes.ok) {
              const data = await orRes.json();
              const content = data.choices?.[0]?.message?.content?.trim();
              // Validate that the model didn't just output internal thinking
              if (content && !content.startsWith('Okay, the user wants me to') && content.length > 20) {
                generatedMessage = content;
                console.log(`[API /generate-message] Generated with OpenRouter (${modelName})`);
                break;
              }
            }
          } catch (e: any) {
            console.warn(`[API /generate-message] OpenRouter ${modelName} skipped:`, e.message);
          }
        }
      }

      // TIER 2: Gemini API fallback if OpenRouter free pool is exhausted/delayed
      if (!generatedMessage && process.env.GEMINI_API_KEY) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          // Try fast flash-lite first, then flash
          const geminiModels = ['gemini-3.5-flash-lite', 'gemini-2.5-flash'];
          for (const gModel of geminiModels) {
            try {
              const response = await ai.models.generateContent({
                model: gModel,
                contents: prompt,
                config: { temperature: 0.7 },
              });
              if (response.text && response.text.trim().length > 20) {
                generatedMessage = response.text.trim();
                console.log(`[API /generate-message] Generated with Gemini (${gModel})`);
                break;
              }
            } catch (gErr: any) {
              console.warn(`[API /generate-message] Gemini ${gModel} skipped:`, gErr.message);
            }
          }
        } catch (geminiErr: any) {
          console.warn('[API /generate-message] Gemini fallback error:', geminiErr.message);
        }
      }

      // TIER 3: Contextual Sales Template Fallback (100% guarantee that user never gets an error)
      if (!generatedMessage) {
        const bizName = business.name || 'sua empresa';
        if (!business.website) {
          generatedMessage = `Olá, tudo bem?\n\nEstava pesquisando referências de ${business.category || 'empresas'} na região e notei que a ${bizName} ainda não possui um site ou catálogo online próprio.\n\nHoje em dia a maioria dos clientes pesquisa no Google antes de entrar em contato. Nós criamos páginas profissionais de alta conversão para atrair mais clientes locais.\n\nVocê teria 5 minutinhos para eu te mostrar uma prévia de como ficaria a presença digital da ${bizName}?`;
        } else if (business.pageSpeedScore && business.pageSpeedScore < 60) {
          generatedMessage = `Olá! Tudo bem?\n\nEstava navegando pelo site da ${bizName} e notei que ele está com um carregamento lento no celular (nota ${business.pageSpeedScore}/100 no Google PageSpeed).\n\nMais da metade dos visitantes desiste quando a página demora mais de 3 segundos para abrir. Nós somos especialistas em acelerar sites e otimizar para o topo do Google.\n\nPosso te enviar um diagnóstico rápido gratuito mostrando os pontos que estão travando a velocidade do seu site?`;
        } else {
          generatedMessage = `Olá, tudo bem?\n\nSou especialista em tecnologia e marketing digital para empresas do segmento de ${business.category || 'serviços'}.\n\nEstava analisando a presença da ${bizName} e identifiquei oportunidades para aumentar o volume de orçamentos e agendamentos diretos no seu WhatsApp.\n\nSeria interessante para vocês verem como implementamos essa estrutura em empresas parceiras?`;
        }
        console.log('[API /generate-message] Generated with smart contextual fallback');
      }

      res.json({ message: generatedMessage });
    } catch (err: any) {
      console.error('[API /api/ai/generate-message Error]:', err.message || err);
      res.status(500).json({
        error: 'Erro ao gerar mensagem com a IA.',
        details: err.message,
      });
    }
  });

  // GET /api/places - Query real places from Overture Maps via DuckDB
  app.get('/api/places', async (req, res) => {
    try {
      const west = parseFloat(req.query.west as string);
      const south = parseFloat(req.query.south as string);
      const east = parseFloat(req.query.east as string);
      const north = parseFloat(req.query.north as string);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5000;

      const zoom = req.query.zoom ? parseFloat(req.query.zoom as string) : undefined;

      // Coordinate validations
      if (isNaN(west) || isNaN(south) || isNaN(east) || isNaN(north)) {
        return res.status(400).json({
          error: 'Parâmetros de coordenadas inválidos. Forneça west, south, east e north como números decimais.',
          places: []
        });
      }

      if (west < -180 || west > 180 || east < -180 || east > 180 || south < -90 || south > 90 || north < -90 || north > 90) {
        return res.status(400).json({
          error: 'Coordenadas fora dos limites geográficos globais.',
          places: []
        });
      }

      if (south >= north || west >= east) {
        return res.status(400).json({
          error: 'Bounding box inválida: south deve ser menor que north e west menor que east.',
          places: []
        });
      }

      // Check bounding box span to prevent excessive global scans
      const lngSpan = Math.abs(east - west);
      const latSpan = Math.abs(north - south);
      if (lngSpan > 1.2 || latSpan > 1.2 || (lngSpan * latSpan) > 1.44) {
        return res.status(400).json({
          error: 'Aproxime o mapa para visualizar os negócios. A área selecionada é muito ampla.',
          places: []
        });
      }

      const { places, cached, durationMs } = await queryPlacesInBBox(west, south, east, north, limit, zoom);
      res.json({ places, total: places.length, cached, durationMs });
    } catch (err: any) {
      console.error('[API /api/places Error]:', err.message || err);
      res.status(500).json({
        error: 'Erro ao consultar estabelecimentos do Overture Maps. O mapa continuará funcional.',
        places: []
      });
    }
  });

  // API Route to fetch real businesses (backward compatibility)
  app.post('/api/prospects', async (req, res) => {
    try {
      res.json({ businesses: [] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro interno no servidor' });
    }
  });

  // In-memory persistent stores for pipeline leads and favorites
  const userLeadsStore: Record<string, { status: string; notes: string }> = {};
  const userFavoritesStore: Record<string, boolean> = {};

  app.get('/api/leads', (req, res) => {
    res.json({
      leads: userLeadsStore,
      favorites: userFavoritesStore,
    });
  });

  app.post('/api/leads', (req, res) => {
    const { businessId, status, notes, isFavorite } = req.body;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId é obrigatório' });
    }
    if (status !== undefined) {
      userLeadsStore[businessId] = {
        status,
        notes: notes !== undefined ? notes : (userLeadsStore[businessId]?.notes || ''),
      };
    }
    if (isFavorite !== undefined) {
      userFavoritesStore[businessId] = Boolean(isFavorite);
    }
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
