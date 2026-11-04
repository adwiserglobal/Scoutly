import { ingestReceivedEmail, verifyResendWebhook } from '../server/internalMailService.js';

/** Resend inbound webhook (`email.received`) for the internal mailboxes on scoutly.pro. */
export async function POST(request: Request) {
  const secret = String(process.env.RESEND_WEBHOOK_SECRET || '').trim();
  if (!secret) return Response.json({ error: 'RESEND_WEBHOOK_SECRET não configurada' }, { status: 503 });

  const rawBody = await request.text();
  const valid = verifyResendWebhook(rawBody, {
    id: request.headers.get('svix-id') || '',
    timestamp: request.headers.get('svix-timestamp') || '',
    signature: request.headers.get('svix-signature') || '',
  }, secret);
  if (!valid) return Response.json({ error: 'Assinatura inválida' }, { status: 400 });

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Payload inválido' }, { status: 400 });
  }

  // Other event types can be enabled in Resend without breaking anything: acknowledge and ignore them.
  if (event?.type !== 'email.received') return Response.json({ ignored: true });

  try {
    return Response.json({ received: true, ...(await ingestReceivedEmail(event)) });
  } catch (error: any) {
    console.error('[Inbound Email]', error?.message || error);
    // 5xx makes Resend retry; the unique index keeps retries from duplicating messages.
    return Response.json({ error: 'Falha ao processar o e-mail.' }, { status: Number(error?.statusCode) === 400 ? 400 : 500 });
  }
}
