import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off deliberately. Next warns that it cannot guarantee
  // it on a non-Node runtime because of how `setTimeout` is implemented, and
  // this app has nothing for it to cache: the whole page is a client component
  // with no server data fetching. Turn it back on only alongside a move back to
  // the Node runtime, or once Bun support is guaranteed.
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
