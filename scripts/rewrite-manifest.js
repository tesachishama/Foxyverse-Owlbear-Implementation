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

// Cache busting: Owlbear can keep serving a cached bundle even when URLs are the same.
// We stamp the built manifest version with the commit SHA (or timestamp) so the plugin
// update is reliably detected.
const shaRaw = (process.env.GITHUB_SHA || process.env.VITE_BUILD_SHA || "").trim();
const sha = shaRaw ? shaRaw.slice(0, 7) : "";
const stamp = sha || new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
if (typeof manifest.version === "string" && manifest.version.trim()) {
  // Keep the base version, append a build metadata stamp.
  const baseVersion = manifest.version.split("+")[0].trim();
  manifest.version = `${baseVersion}+${stamp}`;
}

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
