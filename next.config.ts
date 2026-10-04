import type { NextConfig } from "next"
import fs from "fs"
import path from "path"

// Next.js solo autocarga .env(.local); las credenciales del proveedor (.env.platform) y las del bot de
// Telegram de pedidos (.env.telegram) viven separadas (ver CLAUDE.md), así que se inyectan a mano.
for (const archivo of [".env.platform", ".env.telegram"]) {
  const envPath = path.join(__dirname, archivo)
  if (!fs.existsSync(envPath)) continue
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (match) process.env[match[1]] = match[2]
  }
}


const isDev = process.env.NODE_ENV !== "production"

// La Content-Security-Policy lleva un nonce por petición: la pone proxy.ts (ver @lib/csp).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Los worktrees viven dentro del repo (.claude/worktrees/*) y cada uno tiene su pnpm-workspace.yaml: sin esto Turbopack toma
  // como raíz el repo de afuera, vigila también las otras copias y el HMR se rompe (recargas en bucle).
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
