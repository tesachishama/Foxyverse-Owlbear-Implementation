/**
 * After vite build, rewrite dist/manifest.json to use full URLs for icon and popover.
 * Owlbear resolves these relative to the document, so we need absolute URLs for GitHub Pages.
 * Base URL: set EXTENSION_BASE_URL or BUILD_BASE_URL, or default to known GitHub Pages URL.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distManifest = join(__dirname, "..", "dist", "manifest.json");

const baseUrl =
  process.env.EXTENSION_BASE_URL ||
  process.env.BUILD_BASE_URL ||
  "https://tesachishama.github.io/Foxyverse-Owlbear-Implementation";

const manifest = JSON.parse(readFileSync(distManifest, "utf8"));
if (manifest.action) {
  manifest.action.icon = manifest.action.icon.startsWith("http")
    ? manifest.action.icon
    : `${baseUrl.replace(/\/$/, "")}/${manifest.action.icon.replace(/^\//, "")}`;
  manifest.action.popover = manifest.action.popover.startsWith("http")
    ? manifest.action.popover
    : `${baseUrl.replace(/\/$/, "")}/${manifest.action.popover === "." ? "" : manifest.action.popover.replace(/^\//, "")}`;
  if (!manifest.action.popover.endsWith("/")) manifest.action.popover += "/";
}

writeFileSync(distManifest, JSON.stringify(manifest, null, 2), "utf8");
console.log("Rewrote manifest with base URL:", baseUrl);
