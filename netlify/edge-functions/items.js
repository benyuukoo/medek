export default async (request) => {
  const resp = await fetch("https://francemedek.app.n8n.cloud/webhook/zoho-items-list");
  const headers = new Headers(resp.headers);
  headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("CDN-Cache-Control", "public, max-age=300");
  headers.set("Netlify-CDN-Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
  return new Response(resp.body, {
    status: resp.status,
    headers,
  });
};

export const config = { path: "/api/items" };
