# Stripe billing setup

A Scoutly agora usa dois mecanismos para manter a assinatura sincronizada.

1. O retorno do Checkout confirma a sessão diretamente no backend da Scoutly.
2. O webhook da Stripe mantém renovação, falha de pagamento, cancelamento e alterações de plano sincronizados mesmo quando o usuário não está com a Scoutly aberta.

## Webhook

Crie um endpoint de webhook na Stripe apontando para

`https://www.scoutly.pro/api/stripe-webhook`

Eventos necessários

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`

Depois copie o signing secret do endpoint para a variável de ambiente server-side

`STRIPE_WEBHOOK_SECRET`

Nunca exponha essa chave em uma variável `VITE_*`.

## Customer Portal

Ative o Stripe Customer Portal e permita

- troca de plano
- cancelamento da assinatura
- atualização do método de pagamento
- visualização do histórico de cobranças

Os preços liberados para troca devem corresponder às variáveis

- `STRIPE_PRICE_GO`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_AGENCY`

A Scoutly identifica o plano pelo Price ID atual da assinatura. Isso permite que mudanças feitas no Customer Portal sejam refletidas automaticamente no banco após o webhook.

## Fluxo de pagamento

Depois de um checkout concluído, a Stripe redireciona para

`/?billing=success&session_id={CHECKOUT_SESSION_ID}`

A Scoutly valida a sessão no servidor usando o usuário Firebase autenticado e compara o `client_reference_id` com o UID da sessão. O frontend não consegue ativar um plano apenas alterando parâmetros da URL.

Quando a assinatura é confirmada

- a tabela `subscriptions` é atualizada
- o plano do workspace é sincronizado
- a URL de retorno é limpa
- a tela de boas-vindas do plano é exibida
- o acesso pago fica disponível imediatamente

## Idempotência

Os eventos processados são registrados em `stripe_events`. Um mesmo evento recebido novamente pela Stripe não reaplica a operação se já estiver marcado como `processed`.

## Testes recomendados antes do merge

Use Stripe Test Mode e valide pelo menos

- Trial para Go
- Trial para Pro
- Trial para Agency
- retorno cancelado do Checkout
- upgrade pelo Customer Portal
- downgrade pelo Customer Portal
- cancelamento no fim do período
- reativação antes do fim do período
- falha de pagamento
- renovação bem-sucedida
- reenvio manual de um webhook já processado
