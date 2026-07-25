import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Playr | Maneja tus cuentas y perfiles de manera sencilla",
  description: "Playr es una aplicación web que te permite gestionar tus cuentas y perfiles de manera sencilla y eficiente. Con Playr, puedes organizar tus plataformas de streaming, facilitando el acceso y la administración de tu información y credenciales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${outfit.className} h-full antialiased bg-black`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
