import { getStore } from "@netlify/blobs";

const SCHEMA = {
  roster: ["id", "dept", "name", "active", "note"],
  log: ["id", "date", "dept", "name", "type", "cat", "what", "by", "shift", "el", "ts"],
  spot: ["id", "date", "dept", "name", "cat", "why", "ex", "fun", "fav", "st"],
};
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function clean(key, rec) {
  const o = {};
  for (const c of SCHEMA[key]) {
    let v = rec[c];
    if (v === undefined || v === null) v = "";
    if (key === "roster" && c === "active") v = v === true || v === "Yes" || v === "true";
    else if (key === "spot" && c === "st") v = Number(v) || 0;
    else if (key === "log" && c === "ts") v = Number(v) || 0;
    else v = String(v).slice(0, 5000);
    o[c] = v;
  }
  return o;
}

export default async (req) => {
  const store = getStore({ name: "recognition", consistency: "strong" });
  try {
    if (req.method === "GET") {
      const out = { roster: [], log: [], spot: [] };
      await Promise.all(
        Object.keys(SCHEMA).map(async (k) => {
          const { blobs } = await store.list({ prefix: k + "/" });
          const recs = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
          out[k] = recs.filter(Boolean);
        })
      );
      return json({ data: out });
    }
    if (req.method === "POST") {
      const b = await req.json();
      if (!SCHEMA[b.key]) return json({ error: "Unknown table" }, 400);
      if (b.action === "save") {
        if (!b.rec || !ID.test(String(b.rec.id))) return json({ error: "Bad id" }, 400);
        await store.setJSON(`${b.key}/${b.rec.id}`, clean(b.key, b.rec));
        return json({ data: true });
      }
      if (b.action === "remove") {
        if (!ID.test(String(b.id))) return json({ error: "Bad id" }, 400);
        await store.delete(`${b.key}/${b.id}`);
        return json({ data: true });
      }
    }
    return json({ error: "Unsupported request" }, 405);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
};

export const config = { path: "/api" };
