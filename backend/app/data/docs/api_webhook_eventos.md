# API – Webhooks de Pagamento

**Endpoint:** POST /webhooks/payments

Eventos:
- `payment_authorized`: { payment_id, amount, method, customer_id, timestamp }
- `payment_failed`: { payment_id, reason, retries, acquirer }
- `payment_settled`: { payment_id, settlement_date }

Segurança: assinatura HMAC (cabecalho `X-Signature`).
Retries: exponencial (até 5 tentativas).
