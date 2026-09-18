import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 40,
          fontWeight: 500,
        }}
      >
        F
      </div>
    ),
    size
  );
}
