export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // 루트만 가른다. 언어가 붙은 주소는 그대로 통과시켜 크롤러가 튕기지 않게 한다.
  if (url.pathname !== "/") {
    return next();
  }

  const accept = request.headers.get("Accept-Language") || "";
  const preferred = accept.split(",")[0].trim().toLowerCase().split("-")[0];

  const target = preferred === "en" ? "/en/" : "/ko/";
  return Response.redirect(new URL(target, url.origin).href, 302);
}
