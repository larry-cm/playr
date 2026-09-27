import type { NextConfig } from "next"
import fs from "fs"
import path from "path"

// Next.js solo autocarga .env(.local); las credenciales del proveedor viven
// separadas en .env.platform (ver CLAUDE.md), así que se inyectan a mano.
const platformEnvPath = path.join(__dirname, ".env.platform")
if (fs.existsSync(platformEnvPath)) {
  for (const line of fs.readFileSync(platformEnvPath, "utf-8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (match) process.env[match[1]] = match[2]
  }
}


const isDev = process.env.NODE_ENV !== "production"

// El navegador solo habla con la propia app y con Supabase (REST/Auth y Realtime
// por WebSocket). Las fuentes de next/font se sirven desde el propio dominio;
// los enlaces a wa.me son navegaciones y no pasan por CSP.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin
  } catch {
    return ""
  }
})()
const supabaseWs = supabaseOrigin.replace(/^http/, "ws")

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next inyecta scripts inline para hidratar; React en desarrollo usa eval.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
