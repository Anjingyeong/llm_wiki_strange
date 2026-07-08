export async function onRequestPost(context) {
  try {
    const wikiAccessKey = context.env?.WIKI_ACCESS_KEY || 'smart-safety-2026';
    const body = await context.request.json();
    const key = typeof body.key === 'string' ? body.key : '';

    if (key === wikiAccessKey) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    } else {
      return new Response(
        JSON.stringify({ ok: false, message: '잘못된 접근 키입니다.' }),
        {
          status: 400,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, message: '서버 내부 오류가 발생했습니다.' }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      }
    );
  }
}
