import { NextResponse } from "next/server";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { getSessionUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { resolvedUploadsDir } from "@/lib/uploads";

const PROMPT_TYPES: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
};
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
const VIDEO_EXTS = new Set(["mp4", "webm"]);

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

// Text files never contain NUL bytes - rejects binaries renamed to .txt/.md/.json
function looksLikeText(buf: Buffer): boolean {
  return !buf.includes(0);
}

function magicOk(buf: Buffer, ext: string): boolean {
  if (ext === "png")
    return (
      buf.length > 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
    );
  if (ext === "jpg" || ext === "jpeg")
    return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (ext === "webp")
    return (
      buf.length > 12 &&
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP"
    );
  if (ext === "mp4")
    return buf.length > 8 && buf.toString("ascii", 4, 8) === "ftyp";
  if (ext === "webm")
    return (
      buf.length > 4 &&
      buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3
    );
  return false;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await rateLimit(`upload:${user.userId}`, 20, 60))) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const promptFile = form.get("promptFile");
  if (!(promptFile instanceof File) || promptFile.size === 0) {
    return NextResponse.json({ error: "promptFile is required" }, { status: 400 });
  }
  const promptExt = extOf(promptFile.name);
  const promptMime = PROMPT_TYPES[promptExt];
  if (!promptMime) {
    return NextResponse.json(
      { error: "promptFile must be .txt, .md or .json" },
      { status: 400 }
    );
  }
  if (promptFile.size > 1024 * 1024) {
    return NextResponse.json(
      { error: "promptFile must be under 1MB" },
      { status: 400 }
    );
  }
  const promptBuf = Buffer.from(await promptFile.arrayBuffer());
  if (!looksLikeText(promptBuf)) {
    return NextResponse.json(
      { error: "promptFile must be a text file" },
      { status: 400 }
    );
  }

  let previewMediaPath: string | undefined;
  let previewMediaType: "IMAGE" | "VIDEO" | undefined;
  let mediaBuf: Buffer | undefined;
  let mediaExt = "";
  const previewMedia = form.get("previewMedia");
  if (previewMedia instanceof File && previewMedia.size > 0) {
    mediaExt = extOf(previewMedia.name);
    const isImage = IMAGE_EXTS.has(mediaExt);
    const isVideo = VIDEO_EXTS.has(mediaExt);
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: "previewMedia must be jpg/png/webp or mp4/webm" },
        { status: 400 }
      );
    }
    const maxSize = isImage ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
    if (previewMedia.size > maxSize) {
      return NextResponse.json(
        { error: `previewMedia must be under ${isImage ? "5MB" : "20MB"}` },
        { status: 400 }
      );
    }
    mediaBuf = Buffer.from(await previewMedia.arrayBuffer());
    if (!magicOk(mediaBuf, mediaExt)) {
      return NextResponse.json(
        { error: "previewMedia content does not match its extension" },
        { status: 400 }
      );
    }
    previewMediaType = isImage ? "IMAGE" : "VIDEO";
  }

  const uploadsDir = resolvedUploadsDir();
  const promptName = `${crypto.randomUUID()}.${promptExt}`;
  const privateDir = path.join(uploadsDir, "private");
  await mkdir(privateDir, { recursive: true });
  await writeFile(path.join(privateDir, promptName), promptBuf);

  if (mediaBuf) {
    const mediaName = `${crypto.randomUUID()}.${mediaExt}`;
    const previewDir = path.join(uploadsDir, "preview");
    await mkdir(previewDir, { recursive: true });
    await writeFile(path.join(previewDir, mediaName), mediaBuf);
    previewMediaPath = `preview/${mediaName}`;
  }

  return NextResponse.json({
    promptFilePath: `private/${promptName}`,
    promptFileType: promptMime,
    promptFileSizeBytes: promptBuf.length,
    previewMediaPath,
    previewMediaType,
  });
}
