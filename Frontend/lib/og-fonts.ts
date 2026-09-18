import { readFile } from "node:fs/promises";
import path from "node:path";

// The brand fonts for generated images. next/font can't be used there.
export async function loadOgFonts() {
  const [serif, sans] = await Promise.all([
    readFile(path.join(process.cwd(), "assets/fonts/CormorantGaramond-Medium.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/Manrope-Regular.ttf")),
  ]);

  return [
    { name: "Cormorant Garamond", data: serif, weight: 500 as const, style: "normal" as const },
    { name: "Manrope", data: sans, weight: 400 as const, style: "normal" as const },
  ];
}
