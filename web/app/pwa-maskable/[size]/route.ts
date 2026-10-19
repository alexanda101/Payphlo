import { ImageResponse } from "next/og";
import { createPayphloIcon } from "../../pwa-icon-art";

const supportedSizes = new Set([192, 512]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: sizeParam } = await params;
  const size = Number(sizeParam);

  if (!supportedSizes.has(size)) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(createPayphloIcon(true), {
    width: size,
    height: size,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
