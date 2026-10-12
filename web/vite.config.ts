import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site from /<repo-name>/. Override with VITE_BASE if the repo is named differently.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/tiktok-recipes/",
  plugins: [react()],
  server: { fs: { allow: [".."] } }, // shared/cuisines.json lives outside web/
});
