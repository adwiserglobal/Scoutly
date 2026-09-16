import 'dotenv/config';
import duckdb from 'duckdb';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OVERTURE_RELEASE = process.env.OVERTURE_RELEASE || '2026-08-19.0';
const BATCH_SIZE = Number(process.env.IMPORT_BATCH_SIZE || 500);

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY (ou o legado SUPABASE_SERVICE_ROLE_KEY) antes de importar.');
}

// Grande São Paulo / RMSP. Bounding box propositalmente um pouco ampla para cobrir
// os 39 municípios metropolitanos sem importar o estado inteiro.
const GSP_BBOX = {
  west: -47.20,
  south: -24.20,
  east: -45.65,
  north: -23.15,
};

const db = new duckdb.Database(':memory:');

function exec(sql: string): Promise<void> {
  return new Promise((resolve, reject) => db.run(sql, (err) => err ? reject(err) : resolve()));
}

function all(sql: string, ...params: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => db.all(sql, ...params, (err, rows) => err ? reject(err) : resolve(rows || [])));
}

async function upsert(rows: any[]) {
  if (!rows.length) return;
  const endpoint = `${SUPABASE_URL!.replace(/\/$/, '')}/rest/v1/scoutly_places?on_conflict=id`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SECRET_KEY!,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase import failed ${res.status}: ${await res.text()}`);
}

async function main() {
  await exec("INSTALL httpfs; LOAD httpfs;");
  await exec("INSTALL spatial; LOAD spatial;");
  await exec("SET s3_region='us-west-2';");
  await exec('PRAGMA threads=8;');

  const source = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme=places/type=place/*`;
  let offset = 0;
  let imported = 0;

  console.log('[Scoutly Import] Iniciando importação da Grande São Paulo...');

  while (true) {
    const rows = await all(`
      SELECT
        id,
        names.primary AS name,
        ST_Y(geometry) AS latitude,
        ST_X(geometry) AS longitude,
        coalesce(basic_category, categories.primary, taxonomy.primary) AS category,
        basic_category,
        taxonomy.primary AS taxonomy_primary,
        confidence,
        operating_status,
        websites,
        emails,
        phones,
        socials,
        addresses
      FROM read_parquet('${source}', filename=false)
      WHERE bbox.xmin >= ${GSP_BBOX.west} AND bbox.xmax <= ${GSP_BBOX.east}
        AND bbox.ymin >= ${GSP_BBOX.south} AND bbox.ymax <= ${GSP_BBOX.north}
      LIMIT ${BATCH_SIZE} OFFSET ${offset};
    `);

    if (!rows.length) break;

    const payload = rows.map((row) => {
      const address = Array.isArray(row.addresses) && row.addresses.length
        ? [row.addresses[0]?.freeform, row.addresses[0]?.locality, row.addresses[0]?.region, row.addresses[0]?.postcode].filter(Boolean).join(', ')
        : null;
      const websites = Array.isArray(row.websites) ? row.websites : [];
      const emails = Array.isArray(row.emails) ? row.emails : [];
      const phones = Array.isArray(row.phones) ? row.phones : [];
      const socials = Array.isArray(row.socials) ? row.socials : [];
      return {
        id: String(row.id),
        name: row.name || 'Estabelecimento Comercial',
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        category: row.category || null,
        basic_category: row.basic_category || null,
        taxonomy_primary: row.taxonomy_primary || null,
        confidence: typeof row.confidence === 'number' ? row.confidence : null,
        operating_status: row.operating_status || null,
        website: websites[0] || null,
        websites,
        email: emails[0] || null,
        emails,
        phone: phones[0] || null,
        phones,
        socials,
        address,
        source: 'Overture Maps',
      };
    });

    await upsert(payload);
    imported += payload.length;
    offset += rows.length;
    console.log(`[Scoutly Import] ${imported} negócios da Grande SP importados...`);

    if (rows.length < BATCH_SIZE) break;
  }

  console.log(`[Scoutly Import] Finalizado. Total Grande SP: ${imported}`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  db.close();
  process.exit(1);
});
