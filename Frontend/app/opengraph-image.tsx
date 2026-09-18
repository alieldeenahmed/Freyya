import { ImageResponse } from "next/og";
import { SITE_TAGLINE } from "@/lib/site";

export const alt = "Freyya. Your skin, but better.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F3EE",
          color: "#2B2420",
        }}
      >
        <div style={{ fontSize: 108, letterSpacing: 28, paddingLeft: 28 }}>FREYYA</div>
        <div style={{ width: 72, height: 2, background: "#C9A876", marginTop: 48 }} />
        <div style={{ fontSize: 30, letterSpacing: 6, marginTop: 40, color: "#6B6058" }}>
          {SITE_TAGLINE.toUpperCase()}
        </div>
      </div>
    ),
    size
  );
}
