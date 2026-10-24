# Scoutly Global Places

Objetivo: carregar negócios com a mesma velocidade em qualquer cidade do mundo, sem custo recorrente.

## Por que existia lentidão fora de São Paulo

| Região | Caminho antes | Resultado |
| --- | --- | --- |
| Grande São Paulo | Supabase/PostGIS (`scoutly_places`) | rápido |
| Resto do Brasil e do mundo | OSM Overpass (API pública, com fila e limites) → "Overture heavy" | lento; o "Overture heavy" estava **quebrado**: apontava para o release `2026-08-19.0`, que a Overture já removeu do S3, e para uma coluna (`categories`) que não existe mais no schema novo |

Supabase grátis tem 500 MB. O Overture inteiro tem ~88 milhões de lugares (11,9 GB em parquet); não cabe em um banco gratuito, e consultar o parquet no S3 a cada pedido é lento por natureza.

## Arquitetura

```
Overture (S3, parquet)
        │  mensal, GitHub Actions (grátis)
        ▼
scripts/places-tiles/build.py   DuckDB → quadtree adaptativo → tiles JSON gzip
        ▼
places-<release>.pmtiles  +  manifest.json          Cloudflare R2 (10 GB grátis, sem egress)
        ▼
server/placesTiles.ts            leitor PMTiles v3 (sem dependências), leitura por range
        ▼
/api/places-fast  e  queryOvertureViaApi (busca por segmento/nome, Agentic, IA)
```

* **Quadtree adaptativo** (níveis 7, 9, 11, 13, 15): uma célula vira folha quando tem no máximo 2.500 lugares; senão é dividida em 16. Resultado: qualquer viewport lê poucos objetos de 50–500 KB, tanto no centro de São Paulo quanto no interior do Piauí.
* **PMTiles** é um formato aberto de arquivo único com índice de diretórios. Um viewport vira 2–10 leituras por *HTTP Range* (alguns KB de diretório + os tiles). Não há banco, nem cold start de query, nem cota de linhas.
* **Cache em 3 camadas**: LRU de tiles na instância da função, CDN da Vercel (`s-maxage=3600`) e cache da borda da Cloudflare.
* **Segurança dos e-mails**: telefones, sites e redes sociais já eram exibidos na lista; o e-mail só é liberado pelo servidor após o crédito. No arquivo público o e-mail fica **criptografado (AES-256-GCM)** com `SCOUTLY_PLACES_KEY`; só a API decifra e reencapsula no token selado (`businessSealService`). Sem a chave, o arquivo simplesmente não carrega e-mails.
* **Atualização atômica**: o build sobe `places-<release>.pmtiles` e só então troca `manifest.json`. O servidor relê o manifest a cada 10 minutos, sem redeploy.

## Fallback (nada quebra se algo falhar)

`/api/places-fast`: Supabase (Grande SP) → **places tiles** → OSM → Overture legado.
Se `SCOUTLY_PLACES_URL` não existir, o comportamento é exatamente o de antes.

## Implantação (uma vez, ~15 minutos)

1. **Cloudflare R2** (plano gratuito: 10 GB, 10 M leituras/mês, sem cobrança de saída; a Cloudflare pede um cartão para ativar o R2, mas não cobra dentro do limite).
   * Crie o bucket (ex.: `scoutly-places`).
   * Ative acesso público (domínio `r2.dev` ou um domínio próprio, ex. `places.scoutly.pro`; o domínio próprio ganha cache de borda).
   * Crie um token de API (Object Read & Write) para esse bucket.
2. **Secrets do GitHub** (Settings → Secrets → Actions): `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `SCOUTLY_PLACES_KEY` (qualquer string longa e aleatória; guarde-a, pois a mesma vai para a Vercel).
3. **Primeiro build**: Actions → *Build worldwide places archive* → *Run workflow*. Comece com `countries = BR,US,MX,PT` para validar. Depois rode vazio (mundo inteiro). Quando funcionar, crie a variável de repositório `PLACES_TILES_ENABLED = true` (Settings → Variables) para ligar o build mensal automático.
4. **Vercel** (Environment Variables):
   * `SCOUTLY_PLACES_URL` = `https://<seu-dominio-publico>/` (com a barra final, pois ele lê o `manifest.json`)
   * `SCOUTLY_PLACES_KEY` = a mesma do GitHub
5. Redeploy. Verifique: `curl -sI '<app>/api/places-fast?west=-46.7&south=-23.6&east=-46.6&north=-23.5'` deve trazer `X-Scoutly-Places-Source: tiles:<release>:<n>` para áreas fora da Grande SP.

## Tamanho e custo (medido)

Medições reais com o release `2026-10-21.0`:

| Amostra | Lugares | Arquivo | Por lugar |
| --- | --- | --- | --- |
| Região metropolitana da Cidade do México | 355 mil | 42 MB | ~119 B |
| 1/16 do release (parte 0: Américas, 4,2 M lugares) | 4,23 milhões | 0,50 GB | ~118 B |

O build dessa amostra levou ~1,5 minuto (3,4 GB de RAM). Leitura sobre o arquivo de 0,5 GB via HTTP Range: mediana 35 ms e p95 294 ms por viewport, com resultado idêntico ao do parquet original (36 de 40 áreas aleatórias exatas; as outras diferem em 1 a 3 lugares na borda da caixa por arredondamento a 6 casas, e 1 foi cortada pelo limite de resultados).

Isso projeta ~7–10 GB para o mundo todo com `min_confidence = 0.35` (~65 M lugares). O limite gratuito do R2 é 10 GB. Se passar de 10 GB, use `--min-confidence 0.5` (workflow: *min_confidence*) ou a lista de países.

Custo recorrente esperado: **R$ 0** (GitHub Actions free, R2 free, Vercel free). Durante a troca mensal existem duas versões por algumas horas (o storage do R2 é cobrado por média mensal, então isso não passa de centavos mesmo no pior caso).

## Operação

* O build roda todo dia 3 às 05:17 UTC e também sob demanda.
* Quer só um país novo? Rode o workflow com `countries`. O arquivo substitui o anterior, então liste **todos** os países desejados.
* Rodar localmente: `pip install duckdb pyarrow pmtiles cryptography` e `python scripts/places-tiles/build.py --help`.
* Disco do runner: o DuckDB usa `RUNNER_TEMP` para spill. Se o runner ficar sem espaço no mundo inteiro, rode localmente ou por blocos de países.

## O que continua no Supabase

A Grande SP segue no índice PostGIS (busca por segmento/nome com RPCs próprios) até validarmos o mundo inteiro em produção. Depois disso dá para aposentá-lo e liberar o banco.
