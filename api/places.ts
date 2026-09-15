import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryPlacesInBBox } from '../server/overtureService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

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
        error: 'Coordenadas fora dos limites válidos (-180 a 180 para longitude, -90 a 90 para latitude).',
        places: []
      });
    }

    const places = await queryPlacesInBBox(west, south, east, north, limit);
    return res.status(200).json({ places, total: places.length });
  } catch (err: any) {
    console.error('[API /api/places Error]:', err.message || err);
    return res.status(500).json({
      error: 'Erro ao consultar estabelecimentos do Overture Maps. O mapa continuará funcional.',
      places: []
    });
  }
}
