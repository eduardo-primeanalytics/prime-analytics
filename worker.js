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

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function unauthorizedResponse() {
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Prime Analytics Metrics", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}

function metricsUnavailable(message) {
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prime Analytics Metrics</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f6f3ee;color:#1f2933}
    main{max-width:860px;margin:0 auto;padding:48px 20px}
    .card{background:#fff;border:1px solid #e5ddd0;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(37,34,23,.06)}
    h1{margin:0 0 10px;font-size:2rem;line-height:1.1}
    p{line-height:1.6;color:#52606d}
    code{background:#f3f0ea;padding:.15rem .35rem;border-radius:6px}
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>Prime Analytics Metrics</h1>
      <p>${htmlEscape(message)}</p>
      <p>Configure <code>ACCOUNT_ID</code>, <code>ANALYTICS_API_TOKEN</code>, and <code>METRICS_PASSWORD</code> to enable the live funnel view.</p>
    </div>
  </main>
</body>
</html>`, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

async function queryAnalyticsEngine(env, query) {
  if (!env.ACCOUNT_ID || !env.ANALYTICS_API_TOKEN) {
    throw new Error('Metrics configuration is incomplete.');
  }

  const api = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`;
  const response = await fetch(api, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.ANALYTICS_API_TOKEN}`,
      'content-type': 'text/plain;charset=UTF-8',
    },
    body: query,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

function requireMetricsAuth(request, env) {
  const password = env.METRICS_PASSWORD;
  if (!password) {
    return { ok: false, configured: false };
  }

  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) {
    return { ok: false, configured: true };
  }

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(':');
    if (separator === -1) {
      return { ok: false, configured: true };
    }

    const user = decoded.slice(0, separator);
    const pass = decoded.slice(separator + 1);
    return { ok: user === 'prime' && pass === password, configured: true };
  } catch {
    return { ok: false, configured: true };
  }
}

function aggregateMetricRows(rows) {
  const eventTotals = new Map();
  const pathTotals = new Map();
  let totalEvents = 0;

  for (const row of rows) {
    const event = row.event ?? row.blob1 ?? 'unknown';
    const path = row.path ?? row.blob2 ?? '/';
    const count = Number(row.events ?? row.count ?? row.total ?? 0) || 0;

    totalEvents += count;
    eventTotals.set(event, (eventTotals.get(event) || 0) + count);
    const pathKey = `${event}@@${path}`;
    pathTotals.set(pathKey, (pathTotals.get(pathKey) || 0) + count);
  }

  return {
    totalEvents,
    eventTotals: [...eventTotals.entries()].sort((a, b) => b[1] - a[1]),
    pathTotals: [...pathTotals.entries()]
      .map(([key, count]) => {
        const [event, path] = key.split('@@');
        return { event, path, count };
      })
      .sort((a, b) => b.count - a.count),
  };
}

function renderMetricsPage(model) {
  const card = (label, value, note = '') => `
    <div class="card">
      <div class="label">${htmlEscape(label)}</div>
      <div class="value">${htmlEscape(value)}</div>
      ${note ? `<div class="note">${htmlEscape(note)}</div>` : ''}
    </div>`;

  const eventRows = model.eventTotals
    .map(([event, count]) => `<tr><td>${htmlEscape(event)}</td><td>${formatCount(count)}</td></tr>`)
    .join('');

  const pathRows = model.pathTotals
    .slice(0, 12)
    .map((row) => `<tr><td>${htmlEscape(row.event)}</td><td>${htmlEscape(row.path)}</td><td>${formatCount(row.count)}</td></tr>`)
    .join('');

  const totals = Object.fromEntries(model.eventTotals);
  const schedulingClicks = totals.calendly_click || 0;
  const blueprintClicks = totals.blueprint_examples_click || 0;
  const sampleSaas = totals.sample_saas_select || 0;
  const sampleServices = totals.sample_services_select || 0;
  const pdfExports = totals.sample_print || 0;
  const attributionPageClicks = totals.attribution_landing_click || 0;
  const emailClicks = totals.email_click || 0;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prime Analytics Metrics</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    :root{--bg:#f6f3ee;--panel:#fff;--text:#18202a;--muted:#66717e;--line:#e5ddd0;--accent:#0f5bd6;--good:#0b6b4a}
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text)}
    main{max-width:1180px;margin:0 auto;padding:40px 20px 60px}
    header{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:28px}
    h1{margin:0;font-size:2.2rem;line-height:1.05}
    .sub{margin:10px 0 0;color:var(--muted);max-width:760px;line-height:1.6}
    .stamp{font-size:.8rem;color:var(--muted);text-align:right}
    .grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin:24px 0}
    .card,.panel{background:var(--panel);border:1px solid var(--line);border-radius:20px;box-shadow:0 16px 40px rgba(32,29,21,.05)}
    .card{padding:18px}
    .card .label{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:10px}
    .card .value{font-size:1.5rem;font-weight:700;line-height:1.1}
    .card .note{margin-top:8px;color:var(--muted);font-size:.88rem;line-height:1.45}
    .panel{padding:22px;margin-top:18px}
    .panel h2{margin:0 0 14px;font-size:1.2rem}
    .panel p, .panel li{color:var(--muted);line-height:1.6}
    .panel ol{margin:8px 0 0 20px;padding:0}
    table{width:100%;border-collapse:collapse}
    th,td{padding:12px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
    th{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
    .two-col{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}
    .query{font-family:"IBM Plex Mono",Consolas,monospace;font-size:.85rem;background:#f8f6f2;border:1px solid var(--line);padding:14px;border-radius:14px;overflow:auto}
    a{color:var(--accent)}
    .success{color:var(--good);font-weight:600}
    @media (max-width: 960px){
      header,.two-col{grid-template-columns:1fr;display:grid;align-items:start}
      .grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .stamp{text-align:left}
    }
    @media (max-width: 640px){
      main{padding:28px 14px 48px}
      .grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Prime Analytics Metrics</h1>
        <p class="sub">Internal funnel view for the last 30 days. This page is intentionally kept out of the public navigation and search index.</p>
      </div>
      <div class="stamp">
        <div class="success">Live data loaded</div>
        <div>Dataset: <code>prime_analytics_events</code></div>
        <div>Generated: ${htmlEscape(new Date().toISOString())}</div>
      </div>
    </header>

    <section class="grid">
      ${card('Total events', formatCount(model.totalEvents), 'All tracked click events in the last 30 days')}
      ${card('Scheduling clicks', formatCount(schedulingClicks), 'Clicks on the Calendly link')}
      ${card('Blueprint example clicks', formatCount(blueprintClicks), 'Openings of the fictional examples')}
      ${card('SaaS example selections', formatCount(sampleSaas), 'B2B SaaS example chosen')}
      ${card('Services example selections', formatCount(sampleServices), 'Professional-services example chosen')}
      ${card('PDF exports', formatCount(pdfExports), 'Save as PDF interactions')}
      ${card('Email clicks', formatCount(emailClicks), 'Mailto opens from the site')}
    </section>

    <div class="two-col">
      <section class="panel">
        <h2>Events by type</h2>
        <table>
          <thead><tr><th>Event</th><th>Count</th></tr></thead>
          <tbody>${eventRows || '<tr><td colspan="2">No events recorded yet.</td></tr>'}</tbody>
        </table>
      </section>

      <section class="panel">
        <h2>How to read this page</h2>
        <p>This page is the internal sales-funnel view. It reflects only allowlisted conversion events, not page views.</p>
        <ol>
          <li><code>blueprint_examples_click</code> shows whether visitors want proof before booking.</li>
          <li><code>sample_saas_select</code> and <code>sample_services_select</code> show which example resonates.</li>
          <li><code>sample_print</code> shows deeper inspection behavior.</li>
          <li><code>calendly_click</code> is the strongest booking intent signal.</li>
        </ol>
        <p>Compare scheduling clicks against actual Calendly bookings before treating clicks as leads.</p>
      </section>
    </div>

    <section class="panel">
      <h2>Top event and page combinations</h2>
      <table>
        <thead><tr><th>Event</th><th>Path</th><th>Count</th></tr></thead>
        <tbody>${pathRows || '<tr><td colspan="3">No event-path rows yet.</td></tr>'}</tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Query used</h2>
      <div class="query">SELECT blob1 AS event, blob2 AS path, SUM(_sample_interval) AS events
FROM prime_analytics_events
WHERE timestamp &gt; NOW() - INTERVAL '30' DAY
GROUP BY event, path
ORDER BY events DESC</div>
    </section>
  </main>
</body>
</html>`;
}

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

    if (url.pathname === '/metrics') {
      const auth = requireMetricsAuth(request, env);
      if (!auth.configured) {
        return metricsUnavailable('Metrics are not configured yet.');
      }
      if (!auth.ok) {
        return unauthorizedResponse();
      }

      try {
        const queryJSON = await queryAnalyticsEngine(env, `
          SELECT blob1 AS event, blob2 AS path, SUM(_sample_interval) AS events
          FROM prime_analytics_events
          WHERE timestamp > NOW() - INTERVAL '30' DAY
          GROUP BY event, path
          ORDER BY events DESC
        `);

        const rows = Array.isArray(queryJSON?.data) ? queryJSON.data : [];
        const model = aggregateMetricRows(rows);
        return new Response(renderMetricsPage(model), {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'x-robots-tag': 'noindex, nofollow',
          },
        });
      } catch (error) {
        return metricsUnavailable(`The metrics query failed. ${error?.message || 'Unknown error.'}`);
      }
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
