import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The host environment may export NODE_ENV=production, which makes `next dev`
// skip CSS/PostCSS processing. Pin it to development for the dev server only.
process.env.NODE_ENV = "development";

const here = dirname(fileURLToPath(import.meta.url));
const nextBin = join(here, "..", "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, "dev", "-p", "3000"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
