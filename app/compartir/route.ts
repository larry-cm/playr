import { NextResponse, type NextRequest } from "next/server"

// Destino del "Compartir" de Android (share_target en app/manifest.ts). Normalmente lo responde el service worker
// (public/sw.js) y esto no se ejecuta; si el worker todavía no estaba activo, el archivo se pierde (el servidor no sabe
// de qué pestaña ni de qué sesión viene) y Mis compras le pide al cliente que lo adjunte desde el chat.
const destino = (request: NextRequest) => NextResponse.redirect(new URL("/administrar/compras?compartido=1", request.url), 303)

export const POST = destino
export const GET = destino
