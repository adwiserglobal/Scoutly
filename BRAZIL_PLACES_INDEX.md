# Scoutly Brazil Places Index

Objetivo: tirar Overture/S3 do caminho crítico do mapa.

Fluxo novo:

Overture Maps -> importação periódica -> Supabase/Postgres + PostGIS -> /api/places-fast -> mapa

## Configuração

1. Criar um projeto Supabase.
2. Executar `supabase/migrations/001_scoutly_places.sql` no SQL Editor.
3. Configurar no ambiente do backend/Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Rodar localmente a importação:
   - `npm run import:brazil`
5. Publicar a branch e medir `/api/places-fast`.

A service role é somente server-side e nunca deve ser exposta como `VITE_*`.

## Comportamento seguro

Se o banco Brasil ainda não estiver configurado, `/api/places-fast` volta automaticamente para a consulta atual do Overture. Isso permite publicar a mudança sem quebrar o mapa e ativar o índice depois.

## Rollout recomendado

Para custo zero/baixo, começar por São Paulo e outras capitais antes de carregar o Brasil inteiro. Depois ampliar a cobertura conforme uso real. O schema e o endpoint já suportam a base nacional.
