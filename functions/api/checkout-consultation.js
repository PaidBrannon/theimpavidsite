import { json, stripe, checkedPrice, PACKAGES, CATEGORIES } from '../../server/lib.js';
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch (e) { console.error(e.message); return json({ error: 'Invalid request.' }, 400); }
  const cat = CATEGORIES[b.category], pkg = PACKAGES[b.package];
  const name = String(b.name || '').trim(), email = String(b.email || '').trim(), phone = String(b.phone || '').trim();
  if (!cat || !pkg) return json({ error: 'Choose a category and package.' }, 400);
  if (name.length < 2 || name.length > 100) return json({ error: 'Enter your full name.' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return json({ error: 'Enter a valid email address.' }, 400);
  if (!/^[0-9+()\-.\s]{7,25}$/.test(phone)) return json({ error: 'Enter a valid phone number.' }, 400);
  const origin = env.SITE_URL || new URL(request.url).origin;
  const meta = { kind: 'consultation', category: b.category, category_label: cat, package: b.package, package_label: pkg.label, full_name: name, phone };
  try {
    const price = await checkedPrice(env, pkg);
    const s = await stripe(env, 'POST', '/checkout/sessions', {
      mode: 'payment',
      line_items: [{ price, quantity: 1 }],
      customer_email: email,
      metadata: meta,
      payment_intent_data: { metadata: meta },
      success_url: origin + '/?session_id={CHECKOUT_SESSION_ID}#success',
      cancel_url: origin + '/#booking',
    });
    return json({ url: s.url });
  } catch { return json({ error: 'Could not start checkout. Please try again.' }, 502); }
}
