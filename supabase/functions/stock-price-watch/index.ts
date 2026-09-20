// Edge Function stock-price-watch: scrapea el catalogo del proveedor (login + paginas por HTTP plano, sin navegador ni LLM),
// y sincroniza business.*: una corrida + snapshot por producto + market_alert por cada cambio (agotado / volvio stock / precio).
// La dispara pg_cron cada 6 h (migracion 20260920120005). Desplegar SIEMPRE con --no-verify-jwt: la auth es el header x-cron-secret.
// ?dry=1 = todo menos escribir (para probar).
import { createClient } from "npm:@supabase/supabase-js@2";
import { clasificar, clave, comparar, scrapeCatalog, type Estado } from "./lib.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const need = (k: string) => {
  const v = env(k);
  if (!v) throw new Error(`falta el secret ${k}`);
  return v;
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
type Res<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
const rows = async <T>(q: Res<T>): Promise<T> => {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as T;
};

Deno.serve(async (req) => {
  const secret = env("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "unauthorized" }, 401);
  const dry = new URL(req.url).searchParams.has("dry");
  try {
    const cfg = { base: need("PLATFORM_URL"), storePath: need("PLATFORM_STORE_PATH"), email: need("PLATFORM_EMAIL"), password: need("PLATFORM_PASSWORD") };
    const { total, productos } = await scrapeCatalog(cfg);
    const host = new URL(cfg.base).hostname; // == business.provider.nombre ('tuproveedor2.com')
    const db = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false }, db: { schema: "business" } });

    const prov = await rows<{ id: number }>(db.from("provider").select("id").eq("nombre", host).single());
    const cuenta = await rows<{ id: number }>(db.from("provider_account").select("id").eq("provider_id", prov.id).order("id").limit(1).single());
    const prevRun = await rows<{ id: number; total_productos: number } | null>(
      db.from("extraction_run").select("id,total_productos").eq("provider_id", prov.id).order("id", { ascending: false }).limit(1).maybeSingle(),
    );
    // guarda anti-basura: un catalogo que se achica a menos de la mitad es un sitio roto/en mantenimiento, no "todo se agoto"
    if (prevRun && productos.length < prevRun.total_productos / 2) throw new Error(`catalogo sospechoso: ${productos.length} productos vs ${prevRun.total_productos} en la corrida anterior`);

    const listings = await rows<{ id: number; nombre_raw: string }[]>(db.from("market_listing").select("id,nombre_raw").eq("provider_id", prov.id));
    const idPorClave = new Map(listings.map((l) => [clave(l.nombre_raw), l.id]));
    const clavePorId = new Map(listings.map((l) => [l.id, clave(l.nombre_raw)]));
    const prev = new Map<string, Estado>();
    if (prevRun) {
      const snaps = await rows<{ listing_id: number; precio: number; disponible: boolean }[]>(
        db.from("market_listing_snapshot").select("listing_id,precio,disponible").eq("run_id", prevRun.id),
      );
      for (const s of snaps) prev.set(clavePorId.get(s.listing_id)!, { precio: Number(s.precio), disponible: s.disponible });
    }

    const alertas = comparar(prev, productos); // sin corrida previa, prev vacio => sin alertas
    const vistos = new Set(productos.map((p) => clave(p.nombre)));
    const nuevos = productos.filter((p) => !idPorClave.has(clave(p.nombre)));
    const ausentes = listings.filter((l) => !vistos.has(clave(l.nombre_raw))).map((l) => l.nombre_raw); // renombrados/retirados: visibles en el log
    const disponibles = productos.filter((p) => p.disponible).length;
    const resumenRun = { total, disponibles, agotados: total - disponibles, nuevos: nuevos.map((p) => p.nombre), ausentes, alertas: alertas.length };
    if (dry) return json({ dry: true, ...resumenRun, detalle: alertas });

    const plats = await rows<{ id: number; nombre: string }[]>(db.from("platform").select("id,nombre"));
    if (nuevos.length) {
      const ins = await rows<{ id: number; nombre_raw: string }[]>(
        db.from("market_listing").insert(nuevos.map((p) => {
          const c = clasificar(p.nombre, plats.map((x) => x.nombre));
          return { provider_id: prov.id, platform_id: plats.find((x) => x.nombre === c.platform)?.id ?? null, access_type: c.access, nombre_raw: p.nombre };
        })).select("id,nombre_raw"),
      );
      for (const l of ins) idPorClave.set(clave(l.nombre_raw), l.id);
    }
    const run = await rows<{ id: number }>(
      db.from("extraction_run").insert({
        provider_id: prov.id,
        provider_account_id: cuenta.id,
        fecha_extraccion: new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
        total_productos: total,
        disponibles,
        agotados: total - disponibles,
      }).select("id").single(),
    );
    try {
      const s = await db.from("market_listing_snapshot").insert(productos.map((p) => ({ listing_id: idPorClave.get(clave(p.nombre)), run_id: run.id, precio: p.precio, disponible: p.disponible })));
      if (s.error) throw new Error(s.error.message);
      if (alertas.length) {
        const a = await db.from("market_alert").insert(alertas.map((x) => ({ listing_id: idPorClave.get(clave(x.nombre)), run_id: run.id, tipo_cambio: x.tipo, valor_anterior: x.anterior, valor_nuevo: x.nuevo })));
        if (a.error) throw new Error(a.error.message);
      }
    } catch (e) { // sin snapshots completos la corrida no sirve de baseline: se deshace entera
      await db.from("market_alert").delete().eq("run_id", run.id);
      await db.from("market_listing_snapshot").delete().eq("run_id", run.id);
      await db.from("extraction_run").delete().eq("id", run.id);
      throw e;
    }
    console.log("corrida", run.id, JSON.stringify(resumenRun));
    return json({ run_id: run.id, ...resumenRun });
  } catch (e) {
    console.error("stock-price-watch:", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
