// Shared server helpers. Secrets come only from Cloudflare env (never from the browser).
const enc = new TextEncoder();
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Env var NAMES that hold Stripe Price IDs / R2 object keys.
export const BOOKS = {
  rg:  { title: 'Relationship Goals', price: 'PRICE_RELATIONSHIP_GOALS', live: 'price_1UVnvZ2KocqskCUCifaUnbRc', test: 'price_1UVrSo2KocqskCUCSp1XTWZA', cents: 499, name: 'relationship goals', key: 'BOOK_KEY_RELATIONSHIP_GOALS', file: 'relationship-goals.epub' },
  wws: { title: 'Watch Where You’re Standing: The Three Circles Method', price: 'PRICE_WWYS', live: 'price_1UVnzd2KocqskCUC9GV59sJh', cents: 499, name: 'watch where', key: 'BOOK_KEY_WWYS', file: 'watch-where-youre-standing.epub' },
};
export const PACKAGES = {
  essential: { label: 'Essential', price: 'PRICE_ESSENTIAL', live: 'price_1UVnkS2KocqskCUCYaGvMYLk', test: 'price_1UVraB2KocqskCUC5hgJaAox', cents: 5000, name: 'essential', usd: 50, min: 30 },
  extended:  { label: 'Extended',  price: 'PRICE_EXTENDED', live: 'price_1UVnnS2KocqskCUCob4hSgAM', cents: 9900, name: 'extended', usd: 99, min: 60 },
  premium:   { label: 'Premium',   price: 'PRICE_PREMIUM', live: 'price_1UVnrF2KocqskCUC2VvxOjbk', cents: 19900, name: 'premium',   usd: 199, min: 90 },
};
export const CATEGORIES = { 'financial-wellness': 'Financial Wellness', 'health-fitness': 'Health & Fitness', 'personal-development': 'Personal Development' };
export const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
export const validSession = (id) => /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id || '');

function form(params) {
  const out = new URLSearchParams();
  const walk = (p, v) => { if (v && typeof v === 'object') for (const k in v) walk(`${p}[${k}]`, v[k]); else if (v !== undefined) out.append(p, v); };
  for (const k in params || {}) walk(k, params[k]);
  return out;
}
export async function stripe(env, method, path, params) {
  const r = await fetch('https://api.stripe.com/v1' + path, {
    method,
    headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: method === 'POST' ? form(params) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Stripe error ' + r.status);
  return j;
}

// Price guard: confirms with Stripe that the Price ID is active, one-time, USD, the expected amount,
// and belongs to the expected product. A mismatch blocks checkout instead of charging the wrong amount.
// Env var (if set) overrides the built-in ID, e.g. when switching from test to live mode.
// Mode follows the Stripe secret key, so test and live Price IDs can never be mixed by accident.
export const stripeMode = (env) => (/^[sr]k_live_/.test(env.STRIPE_SECRET_KEY || '') ? 'live' : 'test');
export async function checkedPrice(env, item) {
  const id = env[item.price] || item[stripeMode(env)]; // optional PRICE_* env var overrides the built-in ID
  if (!id) throw new Error('No ' + stripeMode(env) + ' Price ID configured for ' + item.name);
  const p = await stripe(env, 'GET', '/prices/' + encodeURIComponent(id) + '?expand[]=product');
  const ok = p.active && p.type === 'one_time' && p.currency === 'usd' && p.unit_amount === item.cents
    && p.product?.active !== false && String(p.product?.name || '').toLowerCase().includes(item.name);
  if (!ok) throw new Error('Price check failed for ' + id);
  return id;
}

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}
function safeEq(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

// Time-limited download tokens: {s: session id, b: book key, e: expiry (unix s)}
export async function signToken(env, payload) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  return body + '.' + b64u(await hmac(env.DOWNLOAD_SIGNING_SECRET, body));
}
export async function readToken(env, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !safeEq(b64u(await hmac(env.DOWNLOAD_SIGNING_SECRET, body)), sig)) return null;
  try { const p = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))); return p.e > Date.now() / 1000 ? p : null; } catch { return null; }
}

// Verifies Stripe's webhook signature (5 minute tolerance).
export async function verifyStripeSig(env, raw, header) {
  const t = /t=(\d+)/.exec(header)?.[1];
  const sigs = [...header.matchAll(/v1=([0-9a-f]+)/g)].map((m) => m[1]);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = hex(await hmac(env.STRIPE_WEBHOOK_SECRET, `${t}.${raw}`));
  return sigs.some((s) => safeEq(s, expected));
}

export async function sendEmail(env, { to, subject, html, replyTo }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.NOTIFY_EMAIL_FROM, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!r.ok) throw new Error('Email send failed ' + r.status);
}
