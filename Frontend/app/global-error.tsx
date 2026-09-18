"use client";

// Replaces the root layout, so it can't rely on the fonts or providers defined there.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: 24,
          textAlign: "center",
          background: "#F7F3EE",
          color: "#2B2420",
          fontFamily: "Georgia, serif",
        }}
      >
        <h1 style={{ fontSize: 40, fontWeight: 400, margin: 0 }}>That didn&apos;t load.</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>Try again in a moment.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "12px 32px",
            border: "1px solid #2B2420",
            background: "#2B2420",
            color: "#F7F3EE",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
