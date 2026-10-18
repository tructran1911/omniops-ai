import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Slim output for Docker/Cloud Run (.next/standalone/server.js)
  output: "standalone",
  // Server-only libraries: keep them out of the client bundle
  serverExternalPackages: ["firebase-admin", "@google-cloud/storage", "@google/adk"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
