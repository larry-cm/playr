import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Bodega",
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
