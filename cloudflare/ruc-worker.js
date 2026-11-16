// Worker de Cloudflare para autocompletar RUC en el carrito de DrasTec.
// Consulta datos públicos de SUNAT a través de apis.net.pe y responde solo a la web de DrasTec.
// Opcional: guarda tu token de apis.net.pe como secreto "TOKEN" (Settings → Variables) para usar su API oficial con clave.
const ORIGINS = ["https://drxnu.github.io", "https://drastec.com", "https://www.drastec.com"];

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
      "Access-Control-Allow-Methods": "GET",
      "Vary": "Origin",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const n = new URL(req.url).searchParams.get("numero") || "";
    if (!/^(10|15|17|20)\d{9}$/.test(n)) return Response.json({ error: "RUC inválido" }, { status: 400, headers: cors });

    const cache = caches.default, key = new Request("https://ruc.cache/" + n);
    let hit = await cache.match(key);
    if (hit) return new Response(hit.body, { headers: { ...cors, "Content-Type": "application/json" } });

    const url = env.TOKEN
      ? "https://api.apis.net.pe/v2/sunat/ruc?numero=" + n
      : "https://api.apis.net.pe/v1/ruc?numero=" + n;
    const r = await fetch(url, { headers: env.TOKEN ? { Authorization: "Bearer " + env.TOKEN } : {} });
    if (!r.ok) return Response.json({ error: "No disponible" }, { status: 502, headers: cors });
    const d = await r.json();
    const out = JSON.stringify({
      nombre: d.nombre || d.razonSocial || "",
      estado: d.estado || "", condicion: d.condicion || "",
      direccion: d.direccion || "", distrito: d.distrito || "", provincia: d.provincia || "", departamento: d.departamento || "",
    });
    await cache.put(key, new Response(out, { headers: { "Cache-Control": "max-age=86400" } }));
    return new Response(out, { headers: { ...cors, "Content-Type": "application/json" } });
  },
};
