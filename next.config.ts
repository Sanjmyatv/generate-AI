import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static finds its binary next to its own files, so it must stay a plain node_modules package.
  serverExternalPackages: ["ffmpeg-static"],
  // The site's own pictures and sample videos change rarely: let browsers keep them for a day instead of asking every
  // visit, which saves mobile data. (Uploaded previews are served with a year-long cache already.)
  async headers() {
    return [
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
      { source: "/templates/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};

export default nextConfig;
