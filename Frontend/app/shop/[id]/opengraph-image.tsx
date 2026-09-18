import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getAllProducts, getProductById } from "@/lib/products";

export const alt = "Freyya product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllProducts().map((product) => ({ id: product.id }));
}

export default async function ProductOpengraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProductById(id);
  const name = product?.name ?? "Freyya";

  let photo: string | undefined;
  if (product) {
    const file = await readFile(path.join(process.cwd(), "public", product.image));
    photo = `data:image/jpeg;base64,${file.toString("base64")}`;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#F7F3EE",
          color: "#2B2420",
        }}
      >
        <div
          style={{
            width: 570,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 64px",
          }}
        >
          <div style={{ fontSize: 26, letterSpacing: 12, color: "#C9A876" }}>FREYYA</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 72, lineHeight: 1.1 }}>{name}</div>
            <div style={{ width: 56, height: 2, background: "#C9A876", marginTop: 36 }} />
            {product && (
              <div style={{ fontSize: 28, marginTop: 28, color: "#6B6058" }}>
                {product.tagline}
              </div>
            )}
          </div>
          <div style={{ fontSize: 26, color: "#6B6058" }}>
            {product ? `$${product.price}` : ""}
          </div>
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={630} height={630} style={{ objectFit: "cover" }} />
        )}
      </div>
    ),
    size
  );
}
