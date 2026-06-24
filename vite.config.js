import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5182, strictPort: false, open: true },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Separa las librerías de vendor en chunks cacheables aparte del
        // código de la app, reduciendo el bundle inicial y mejorando el
        // cacheo entre despliegues (react/supabase/xlsx cambian poco).
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js", "@supabase/ssr"],
          xlsx: ["xlsx"],
        },
      },
    },
  },
});
