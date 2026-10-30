import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // `/` (Login's default `next`) opens Dashboard with a real 307. The root
    // layout streams (it reads the preference cookies), so a redirect thrown
    // from `app/page.tsx` would arrive as a client-side redirect after a 200.
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
