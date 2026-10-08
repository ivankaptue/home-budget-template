import { defineConfig, loadEnv } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pkg from "../package.json" with { type: "json" };

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

// .env lives at the repo root (shared with the scripts); see .env.example.
const envDir = fileURLToPath(new URL("..", import.meta.url));
const REQUIRED = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_APP_ID"];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "VITE_");
  const missing = REQUIRED.filter((k) => !env[k]?.trim());
  // Never build an app without a Firebase config: it would be deployed and break on every phone.
  if (missing.length > 0) throw new Error(`Missing ${missing.join(", ")}: copy .env.example to .env (CI: repository variables)`);
  const tagline = env.VITE_APP_TAGLINE?.trim() || "Le budget de la maison";

  return {
    envDir,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_COMMIT__: JSON.stringify(commit()),
      "import.meta.env.VITE_APP_TAGLINE": JSON.stringify(tagline),
    },
    plugins: [
      preact(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png"],
        manifest: {
          name: "Carnet Budget Maison",
          short_name: "Carnet",
          description: tagline,
          lang: "fr-CA",
          start_url: "/",
          display: "standalone",
          background_color: "#F2F5F2",
          theme_color: "#1E6B52",
          icons: [
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/__\//],
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
              handler: "CacheFirst",
              options: { cacheName: "google-fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
            },
          ],
        },
      }),
    ],
    build: { outDir: "dist", emptyOutDir: true },
  };
});
