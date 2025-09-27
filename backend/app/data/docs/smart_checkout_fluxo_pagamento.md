# Smart Checkout – Fluxo de Pagamento (MVP)

## Objetivo
Permitir pagamentos frictionless com meios locais (PIX, cartão, carteiras).

## Fluxo Básico
1. Cliente inicia checkout (cart ID).
2. Antifraude (sincrono): risco baixo segue; alto = 3DS/biometria.
3. Meios de pagamento:
   - PIX: gerar QR + copiar/colar; polling de confirmação (30–90s).
   - Cartão: tokenização + 3DS quando necessário.
4. Webhooks: `payment_authorized`, `payment_failed`, `payment_settled`.
5. Atualização de assinatura/recorrência.

## KPIs
- Conversão por método, tempo até autorização, taxa de falha por adquirente.
