import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { resolvedUploadsDir } from "@/lib/uploads";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

// Public route - serves ONLY from uploads/preview/. Never reads private/.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { previewMediaType: true, previewMediaPath: true },
  });
  if (!asset || asset.previewMediaType === "NONE" || !asset.previewMediaPath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.resolve(
    resolvedUploadsDir(),
    "preview",
    path.basename(asset.previewMediaPath)
  );
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";
  const size = fs.statSync(filePath).size;

  const range = request.headers.get("range");
  if (asset.previewMediaType === "VIDEO" && range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
      if (start < end) {
        const chunk = Buffer.alloc(end - start + 1);
        const fd = fs.openSync(filePath, "r");
        fs.readSync(fd, chunk, 0, chunk.length, start);
        fs.closeSync(fd);
        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunk.length),
          },
        });
      }
    }
  }

  const buf = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
