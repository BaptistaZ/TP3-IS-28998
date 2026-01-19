import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // =============================================================================
  // Dev Server / Local DX
  // =============================================================================
  server: {
    proxy: {
      /**
       * GraphQL endpoint proxy for local development.
       *
       * Why: avoids CORS issues and keeps the frontend calling relative URLs
       * (e.g. fetch("/graphql")) while the BI service runs on a different port.
       *
       * Note: this only applies to `vite dev`. In Docker/production, the frontend
       * should point to the BI service via the reverse proxy / container network
       * (not localhost).
       */
      "/graphql": { target: "http://localhost:4000", changeOrigin: true },

      /* Same as `/graphql`, but explicitly covers trailing-slash requests made by some clients/tools. */
      "/graphql/": { target: "http://localhost:4000", changeOrigin: true },

      /* Health endpoint proxy for local development checks. */
      "/health": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});