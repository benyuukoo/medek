export default async (request) => {
  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const itemId = parts[parts.length - 1];
  if (!itemId || !/^\d+$/.test(itemId)) {
    return new Response("Missing item_id", { status: 400 });
  }
  const resp = await fetch(
    `https://francemedek.app.n8n.cloud/webhook/zoho-item-image-raw?item_id=${itemId}`
  );
  const headers = new Headers(resp.headers);
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("CDN-Cache-Control", "public, max-age=86400");
  headers.set("Netlify-CDN-Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
  return new Response(resp.body, {
    status: resp.status,
    headers,
  });
};

export const config = { path: "/api/image/*" };
