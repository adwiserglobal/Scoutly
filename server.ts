import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDuckDB, queryPlacesInBBox } from './server/overtureService';
import { enrichBusinessWebsite } from './server/enrichService';
import { handleAIChat, generateContextualSuggestions } from './server/aiService';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

  // GET /api/places - Query real places from Overture Maps via DuckDB
  app.get('/api/places', async (req, res) => {
    try {
      const west = parseFloat(req.query.west as string);
      const south = parseFloat(req.query.south as string);
      const east = parseFloat(req.query.east as string);
      const north = parseFloat(req.query.north as string);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5000;

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

      // Check bounding box span to prevent overly large table scans (enforce ~zoom 12+)
      const lngSpan = Math.abs(east - west);
      const latSpan = Math.abs(north - south);
      if (lngSpan > 0.4 || latSpan > 0.4 || (lngSpan * latSpan) > 0.16) {
        return res.status(400).json({
          error: 'Aproxime o mapa para visualizar os negócios. A área selecionada é muito ampla.',
          places: []
        });
      }

      const places = await queryPlacesInBBox(west, south, east, north, limit);
      res.json({ places, total: places.length });
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
