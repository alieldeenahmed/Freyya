import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og-fonts";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
          fontSize: 130,
        }}
      >
        F
      </div>
    ),
    { ...size, fonts: await loadOgFonts() }
  );
}
