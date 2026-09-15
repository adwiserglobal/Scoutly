import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDuckDB } from '../server/overtureService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('API leads started');
  try {
    const db = await getDuckDB();

    if (req.method === 'GET') {
      db.all('SELECT business_id, status, notes, updated_at FROM user_leads', (err, rows: any[]) => {
        if (err) {
          console.error('[DuckDB] Error fetching leads:', err);
          return res.status(500).json({ error: err.message, leads: {} });
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
        return res.status(200).json({ leads: leadsMap });
      });
    } else if (req.method === 'POST') {
      const { businessId, status, notes } = req.body;
      if (!businessId) {
        return res.status(400).json({ error: 'businessId é obrigatório' });
      }
      const updatedAt = new Date().toISOString();
      db.run(
        'INSERT OR REPLACE INTO user_leads (business_id, status, notes, updated_at) VALUES (?, ?, ?, ?)',
        businessId,
        status || 'NOVO',
        notes || '',
        updatedAt,
        (err) => {
          if (err) {
            console.error('[DuckDB] Error saving lead:', err);
            return res.status(500).json({ error: err.message });
          }
          return res.status(200).json({ success: true, businessId, status, notes, updatedAt });
        }
      );
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (err: any) {
    console.error('[API /api/leads Error FULL]:', err);
    return res.status(500).json({ error: err.message || 'Erro no banco de dados', leads: {} });
  }
}
