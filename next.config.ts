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

const nextConfig: NextConfig = {
  /* config options here */
}

export default nextConfig
