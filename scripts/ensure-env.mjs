/** Creates .env.local from .env.example on first run, so a fresh clone just works. */
import { copyFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  process.exit(0);
}
if (!existsSync(".env.example")) {
  console.error("✗ .env.example is missing — cannot create .env.local");
  process.exit(1);
}
copyFileSync(".env.example", ".env.local");
console.log("✓ created .env.local from .env.example");
