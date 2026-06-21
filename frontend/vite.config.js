import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the app from https://<owner>.github.io/<repo>/, so the
// build needs `base` set to "/<repo>/". We read it from VITE_BASE (set by the
// GitHub Actions workflow to "/${repo}/"). Defaults to "/" for local dev.
export default defineConfig(() => ({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
}));
