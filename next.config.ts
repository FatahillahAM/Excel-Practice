import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // `generateExamWorkbook` reads the template from disk at a computed path the
  // tracer cannot follow: ship it with the function that generates, the
  // `/levels` page, whose Server Action is Start.
  outputFileTracingIncludes: {
    "/levels": ["./assets/templates/**"],
  },
  async redirects() {
    // `/` opens Dashboard with a real 307, before any rendering. Rendering
    // `app/page.tsx` cannot give one: the response status is already sent as
    // 200 by then (observed with this config), so its `redirect()` would only
    // reach the browser as a client-side redirect.
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
};

export default nextConfig;
