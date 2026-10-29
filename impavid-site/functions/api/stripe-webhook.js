import { verifyStripeSig, sendEmail, esc, stripeMode } from '../../server/lib.js';
// Stripe -> here. Owner is notified only for verified, paid consultation sessions, once per session.
export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  if (!(await verifyStripeSig(env, raw, request.headers.get('stripe-signature') || ''))) return new Response('Bad signature', { status: 400 });
  const ev = JSON.parse(raw);
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(ev.type)) return new Response('ignored');
  if (ev.livemode !== (stripeMode(env) === 'live')) return new Response('mode mismatch ignored'); // test event vs live key or the reverse
  const s = ev.data.object, m = s.metadata || {};
  if (s.payment_status !== 'paid' || m.kind !== 'consultation') return new Response('ok');
  const flag = 'consult:' + s.id;
  if (await env.NOTIFIED.get(flag)) return new Response('duplicate ignored'); // Stripe retry
  const email = s.customer_details?.email || s.customer_email || '';
  const rows = [['Name', m.full_name], ['Email', email], ['Phone', m.phone], ['Category', m.category_label], ['Package', m.package_label],
    ['Amount paid', '$' + ((s.amount_total || 0) / 100).toFixed(2)], ['Payment', s.payment_intent], ['Checkout session', s.id]];
  await sendEmail(env, { // throws on failure -> 500 -> Stripe retries
    to: env.NOTIFY_EMAIL_TO, replyTo: email || undefined, subject: `${ev.livemode ? '' : '[TEST] '}New paid consultation: ${m.category_label} / ${m.package_label}`,
    html: '<h2>New paid consultation</h2><p>Payment confirmed. Contact the customer to schedule.</p><table>' + rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('') + '</table>',
  });
  await env.NOTIFIED.put(flag, '1', { expirationTtl: 60 * 60 * 24 * 90 });
  if (email) { try { await sendEmail(env, { to: email, subject: 'Your consultation with The Impavid', html: '<p>Thank you for booking with The Impavid! Your payment has been received. We will contact you within 24–48 hours to personally arrange your consultation.</p>' }); } catch {} }
  return new Response('ok');
}
