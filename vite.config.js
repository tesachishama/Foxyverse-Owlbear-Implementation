import { defineConfig } from "vite";

// GitHub Pages serves from /Foxyverse-Owlbear-Implementation/
export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/Foxyverse-Owlbear-Implementation/" : "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
  },
});
