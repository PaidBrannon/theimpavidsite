// Square sandbox checkout helpers. Secrets stay in Cloudflare Pages environment.
import { json, BOOKS, PACKAGES, CATEGORIES } from './lib.js';
export { json, BOOKS, PACKAGES, CATEGORIES };
export function squareConfig(env) {
  if (env.SQUARE_ENVIRONMENT !== 'sandbox') throw new Error('Square sandbox configuration required');
  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) throw new Error('Square credentials missing');
}
export async function square(env, method, path, payload) {
  squareConfig(env);
  const response = await fetch('https://connect.squareupsandbox.com/v2' + path, {
    method, headers: { Authorization: 'Bearer ' + env.SQUARE_ACCESS_TOKEN,
      'Square-Version': '2025-10-16', 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Square API error', response.status, (data.errors || []).map(e => e.code).join(','));
    throw new Error('Square request failed (' + response.status + ')');
  }
  return data;
}
export function originFor(request) {
  return new URL(request.url).origin;
}
export async function createCheckout(env, request, record, lineItems) {
  if (!env.NOTIFIED) throw new Error('KV NOTIFIED binding missing');
  const reference = crypto.randomUUID();
  const redirect = originFor(request) + '/?square_ref=' + encodeURIComponent(reference) + '#success';
  const result = await square(env, 'POST', '/online-checkout/payment-links', {
    idempotency_key: crypto.randomUUID(),
    order: { location_id: env.SQUARE_LOCATION_ID, reference_id: reference,
      line_items: lineItems.map(item => ({
        name: item.name, quantity: String(item.quantity || 1),
        base_price_money: { amount: item.cents, currency: 'USD' }
      })) },
    checkout_options: { redirect_url: redirect, ask_for_shipping_address: false },
  });
  const orderId = result.payment_link?.order_id || result.related_resources?.orders?.[0]?.id;
  const url = result.payment_link?.url;
  if (!orderId || !url) throw new Error('Square did not return checkout details');
  await env.NOTIFIED.put('square:order:' + reference, JSON.stringify({
    ...record, orderId, amount: lineItems.reduce((sum, item) => sum + item.cents * (item.quantity || 1), 0),
    createdAt: Date.now()
  }), { expirationTtl: 60 * 60 * 24 * 90 });
  return json({ url });
}
export async function verifySquareOrder(env, reference) {
  if (!/^[0-9a-f-]{36}$/i.test(reference || '') || !env.NOTIFIED) return null;
  const raw = await env.NOTIFIED.get('square:order:' + reference);
  if (!raw) return null;
  const record = JSON.parse(raw);
  const orderResponse = await square(env, 'GET', '/orders/' + encodeURIComponent(record.orderId));
  const order = orderResponse.order;
  if (!order || order.id !== record.orderId || order.reference_id !== reference ||
      order.location_id !== env.SQUARE_LOCATION_ID || order.state !== 'COMPLETED' ||
      Number(order.total_money?.amount) !== record.amount || order.total_money?.currency !== 'USD') return null;
  const tenders = order.tenders || [];
  let paid = false;
  for (const tender of tenders) {
    if (!tender.payment_id) continue;
    const paymentResponse = await square(env, 'GET', '/payments/' + encodeURIComponent(tender.payment_id));
    const p = paymentResponse.payment;
    if (p?.order_id === record.orderId && p.location_id === env.SQUARE_LOCATION_ID &&
        p.status === 'COMPLETED' && p.amount_money?.currency === 'USD' &&
        Number(p.amount_money?.amount) === record.amount) { paid = true; break; }
  }
  return paid ? record : null;
}
