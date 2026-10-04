import type { Metadata } from "next";
import { Alegreya, Archivo } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "./lib/useTheme";

// Archivo carga el eje wdth: las marcas postales usan el ancho condensado
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const alegreya = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Aurora Panel",
  description: "Aurora's status, letters, and memory, read-only.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${alegreya.variable} h-full antialiased`}
      // el script de tema cambia data-theme antes de hidratar
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
