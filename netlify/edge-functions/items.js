export default async (request) => {
  const listResp = await fetch(
    "https://francemedek.app.n8n.cloud/webhook/zoho-items-list"
  );
  if (!listResp.ok) {
    return new Response(listResp.body, { status: listResp.status });
  }
  const data = await listResp.json();
  const items = data.items || [];

  const enriched = await Promise.all(
    items.map(async (item) => {
      try {
        const imgResp = await fetch(
          `https://francemedek.app.n8n.cloud/webhook/base64-item-image?item_id=${item.item_id}`
        );
        if (imgResp.ok) {
          const imgData = await imgResp.json();
          item.base64image = imgData.base64image || null;
        }
      } catch (_) {
        item.base64image = null;
      }
      return item;
    })
  );

  const body = JSON.stringify({
    count: data.count,
    items: enriched,
    fetched_at: data.fetched_at,
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
      "CDN-Cache-Control": "public, max-age=300",
      "Netlify-CDN-Cache-Control":
        "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
};

export const config = { path: "/api/items" };
