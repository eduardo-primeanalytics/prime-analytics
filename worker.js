const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

const ALLOWED_EVENTS = new Set([
  'calendly_click',
  'email_click',
  'blueprint_examples_click',
  'sample_saas_select',
  'sample_services_select',
  'sample_print',
  'attribution_landing_click',
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let redirect = false;

    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      redirect = true;
    }
    if (url.hostname === 'www.primeanalytics.ai') {
      url.hostname = 'primeanalytics.ai';
      redirect = true;
    }
    if (redirect) {
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/__events') {
      if (request.method !== 'POST') {
        return new Response(null, { status: 405, headers: { Allow: 'POST' } });
      }

      const origin = request.headers.get('Origin');
      if (origin && origin !== 'https://primeanalytics.ai') {
        return new Response(null, { status: 403 });
      }

      try {
        const body = await request.json();
        const event = typeof body.event === 'string' ? body.event : '';
        const path = typeof body.path === 'string' && body.path.startsWith('/')
          ? body.path.slice(0, 120)
          : '/';

        if (!ALLOWED_EVENTS.has(event)) {
          return new Response(null, { status: 400 });
        }

        env.ANALYTICS.writeDataPoint({
          blobs: [event, path],
          indexes: [event],
        });

        return new Response(null, {
          status: 204,
          headers: { 'Cache-Control': 'no-store' },
        });
      } catch {
        return new Response(null, { status: 400 });
      }
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
    headers.set('Content-Security-Policy', CSP);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
