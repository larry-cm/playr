// Service worker de Playr. Solo hace una cosa: recibir el archivo que se comparte desde otra app (Nequi, la app del
// banco) con Playr instalado (Web Share Target, ver app/manifest.ts). El POST a /compartir no llega al servidor: el
// archivo se guarda en IndexedDB y la pestaña abre Mis compras, que lo lee (app/administrar/compras/compartido.tsx).
// Nada más pasa por acá: no se guarda en caché ninguna página ni respuesta (los datos son de la sesión de cada pestaña).

const DB = "playr-compartir"
const STORE = "archivos"
const CLAVE = "ultimo"
const DESTINO = "/administrar/compras?compartido=1"

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

function abrir() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

/** Deja el archivo como el último compartido; sin archivo borra el anterior (así no se toma uno viejo por este). */
async function guardar(archivo) {
    const db = await abrir()
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite")
            const store = tx.objectStore(STORE)
            if (archivo) store.put({ archivo, nombre: archivo.name, tipo: archivo.type, fecha: Date.now() }, CLAVE)
            else store.delete(CLAVE)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
            tx.onabort = () => reject(tx.error)
        })
    } finally {
        db.close()
    }
}

self.addEventListener("fetch", (event) => {
    const { request } = event
    if (request.method !== "POST") return
    const url = new URL(request.url)
    if (url.origin !== self.location.origin || url.pathname !== "/compartir") return

    event.respondWith(
        (async () => {
            try {
                // Lo que llega del menú Compartir del sistema trae Sec-Fetch-Site "none"; un formulario de otro sitio no
                // puede dejar un "comprobante" en el pedido del cliente.
                const ajeno = request.headers.get("Sec-Fetch-Site") === "cross-site"
                const datos = ajeno ? null : await request.formData()
                const archivo = datos?.getAll("archivo").find((f) => f instanceof File && f.size > 0)
                await guardar(archivo ?? null)
            } catch (e) {
                // Mis compras avisa que no llegó el archivo y que lo adjunte desde el chat.
                console.error("sw: no se pudo guardar el archivo compartido", e)
            }
            return Response.redirect(new URL(DESTINO, self.location.origin).href, 303)
        })(),
    )
})
