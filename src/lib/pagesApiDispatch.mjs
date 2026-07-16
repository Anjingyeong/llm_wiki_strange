const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

export function notFound() {
  return json({ error: 'not_found' }, 404);
}

export function methodDispatcher(request, { method, onKnownMethod }) {
  if (request.method.toUpperCase() !== method.toUpperCase()) {
    return notFound();
  }
  return onKnownMethod();
}

export function routeDispatcher(request, { pathname, routes }) {
  const route = routes[pathname];
  return route ? methodDispatcher(request, route) : notFound();
}
