/** Builds widgets + harness, then serves the dev host. Re-run after changes (builds take ~2s). */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { serve } from "./serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [resolve(here, "build.mjs"), "--harness"], { stdio: "inherit" });
const port = Number(process.env.PORT ?? 4317);
await serve(port);
const base = `http://127.0.0.1:${port}/host.html`;
console.log(`\nDev host: ${base}?widget=preview-post`);
console.log(`  ${base}?widget=preview-post&theme=dark&width=380`);
console.log(`  ${base}?widget=analytics   ${base}?widget=accounts`);
console.log("  scenarios: loading streaming error cancelled nothing publish-hang publish-error publish-partial edit-hang edit-error unavailable");
