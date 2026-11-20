import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Authenticated CRUD is request-time. Cache Components wanted a static shell
  // around useParams/useRouter, which fights this product more than it helps.
  output: "standalone",
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
