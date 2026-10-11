// /out/<이름>: 제휴 링크(static/_redirects의 302)로 보내기 전에 끝난 행사인지 본다.
// 끝난 행사면 Awin으로 보내지 않고 /go/와 같은 "끝났습니다" 안내를 보인다. 줄을 지우는 걸 잊었을 때를 막는다.
// 진행 중이거나 행사 목록에 없는 이름(상시 링크)은 _redirects의 응답을 그대로 돌려준다.
import { HTML_HEADERS, endedPage, endedPromo, notFound, pickLang } from '../../lib/promo-links.js';

export async function onRequest({ request, params, env }) {
  const name = String(params.name || '');
  const origin = new URL(request.url).origin;
  if (!/^[a-z0-9-]+$/.test(name)) return notFound(env, origin);

  const promo = await endedPromo(env, origin, name);
  if (promo) return endedPage(promo, pickLang(request));

  const r = await env.ASSETS.fetch(new Request(new URL('/out/' + name, origin), { redirect: 'manual' }));
  if (r.status < 300 || r.status >= 400) return notFound(env, origin);
  return new Response(null, { status: r.status, headers: { location: r.headers.get('location'), 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' } });
}
