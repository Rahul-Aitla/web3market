// Local Postgres via embedded-postgres — a REAL Postgres binary (downloaded
// on first run). Real wire protocol → full Prisma compatibility, no cloud.
// Run: npm run db  →  postgresql://postgres:postgres@127.0.0.1:5433/postgres
import { existsSync, rmSync, readFileSync } from "node:fs";
import net from "node:net";
import EmbeddedPostgres from "embedded-postgres";

// Already running? Don't start a second postmaster on the same data dir.
const portFree = await new Promise((resolve) => {
  const s = net.connect(5433, "127.0.0.1");
  s.on("connect", () => { s.end(); resolve(false); });
  s.on("error", () => resolve(true));
});
if (!portFree) {
  console.log("Postgres already running on 127.0.0.1:5433 — nothing to do.");
  process.exit(0);
}

// Port is free but a stale lock may remain from a killed postmaster.
const pidFile = "./pgdata-real/postmaster.pid";
if (existsSync(pidFile)) {
  try { rmSync(pidFile, { force: true }); } catch {}
}

const pg = new EmbeddedPostgres({
  databaseDir: "./pgdata-real",
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
});

if (!existsSync("./pgdata-real/PG_VERSION")) await pg.initialise();
await pg.start();
console.log("Postgres listening on 127.0.0.1:5433 (data in ./pgdata-real)");
