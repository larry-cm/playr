import type { MetadataRoute } from "next"

// Playr instalable (PWA). Con la app instalada en Android, aparece al tocar "Compartir" en Nequi o en la app del banco:
// el comprobante llega a /compartir, lo recibe el service worker (public/sw.js) y Mis compras lo asocia al pedido que
// espera su comprobante (app/administrar/compras/compartido.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Playr",
    short_name: "Playr",
    description: "Tus cuentas y perfiles de streaming en un solo lugar.",
    lang: "es",
    start_url: "/administrar",
    scope: "/",
    display: "standalone",
    // Compartir con la app ya abierta reusa su ventana: conserva la sesión de esa pestaña (sessionStorage) y no pide login.
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/compartir",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        files: [{ name: "archivo", accept: ["image/*", "application/pdf", ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic"] }],
      },
    },
  }
}
