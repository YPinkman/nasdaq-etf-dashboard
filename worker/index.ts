const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init?.headers,
    },
  });
}

export default {
  fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...jsonHeaders,
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        service: 'nasdaq-etf-dashboard-worker',
        message: 'Cloudflare Worker is running locally.',
      });
    }

    if (url.pathname === '/api/time') {
      return jsonResponse({
        ok: true,
        now: new Date().toISOString(),
        timezone: 'UTC',
      });
    }

    return jsonResponse(
      {
        ok: false,
        error: 'Not found',
      },
      { status: 404 },
    );
  },
} satisfies ExportedHandler;
