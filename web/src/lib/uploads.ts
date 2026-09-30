import path from "node:path";

// UPLOADS_DIR is relative to the Next.js process cwd (web/). Always resolve
// to an absolute path - a relative env value would depend on process.cwd()
// at request time and break under some run configurations.
export function resolvedUploadsDir(): string {
  return path.resolve(
    process.cwd(),
    /* turbopackIgnore: true */ process.env.UPLOADS_DIR ?? "../uploads"
  );
}
