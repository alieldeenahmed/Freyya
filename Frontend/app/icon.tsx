import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og-fonts";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2B2420",
          color: "#C9A876",
          fontFamily: "Cormorant Garamond",
          fontSize: 48,
        }}
      >
        F
      </div>
    ),
    { ...size, fonts: await loadOgFonts() }
  );
}
