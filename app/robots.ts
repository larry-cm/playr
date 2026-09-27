import type { MetadataRoute } from "next"

// App privada: nada se indexa.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  }
}
