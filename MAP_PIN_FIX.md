# Correção do carregamento do mapa e do pin

Base analisada `202df4d`. Branch `fix/map-loading-and-radar-pin`.

## Alterações

- O cache do navegador passa a guardar os limites realmente consultados. Uma consulta parcial deixa de marcar um tile inteiro como carregado. Resultados limitados não cobrem áreas menores nem consultas com limites maiores.
- Resultados vazios bem-sucedidos também ficam no cache. Falhas não são convertidas em áreas vazias e permanecem disponíveis para nova tentativa.
- Removidas as consultas especulativas de áreas vizinhas que competiam com o mapa e o pin. O debounce da busca visível passou de 280 ms para 180 ms, com retorno imediato para áreas em cache.
- Consultas antigas não podem atualizar os resultados nem encerrar o indicador de uma busca mais recente. Mover o mapa não cancela a busca do pin. Remover ou mover o pin cancela sua consulta anterior.
- O botão do pin usa o centro atual do mapa, inclusive após arrastar a tela. Alterar o raio ou ativar o filtro recalcula a lista corretamente.
- Erros do pin aparecem junto ao controle, com botão para tentar novamente. Requisições ao endpoint de negócios têm limite de espera de 45 segundos.
- O cache persistente usa respostas por área e limite, com validade de 15 minutos. Substitui milhares de gravações individuais por uma gravação por resposta. As tabelas anteriores não são apagadas e os dados de leads não são alterados.
- O arquivo package-lock.json foi sincronizado porque o original impedia a instalação com npm ci.

## Verificação

- npm test — 9 testes de regressão de cache, cancelamento, pin e persistência.
- npm run lint — TypeScript sem erros.
- npm run build — compilação de produção concluída. O Vite mantém um aviso de tamanho do bundle.
- O teste de persistência executa SQL em um DuckDB local real e simula somente extensões externas e respostas do S3.

Não foi possível validar o mapa visualmente ou medir o tempo do Overture em produção neste ambiente. O download da extensão httpfs foi bloqueado. A primeira consulta de uma região continua dependendo da leitura remota dos arquivos do Overture; não há garantia de carregamento instantâneo.

## Validação após publicar

1. Mover o mapa lentamente para uma área vizinha e depois mover rapidamente entre bairros. A consulta final deve corresponder à última área.
2. Voltar a uma área já consultada e verificar o reaproveitamento do cache.
3. Mover o mapa e ativar o pin. Ele deve aparecer no centro atual da tela.
4. Arrastar e soltar o pin duas vezes rapidamente, alterar o raio e ativar/desativar o filtro do raio.
5. Simular falha da API e tentar novamente pelo controle do pin. Nenhum resultado de uma busca removida deve reaparecer.

## Aplicação do patch

Na base indicada, executar `git apply --check Scoutly-map-pin.patch`, seguido de `git apply Scoutly-map-pin.patch`. Instalar com `npm ci`, executar os testes e o build, então publicar pelo fluxo habitual do projeto.
