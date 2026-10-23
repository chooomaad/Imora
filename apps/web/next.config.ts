import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "*.supabase.co";

const nextConfig: NextConfig = {
  // Monorepo root (apps/web -> repo root) for output tracing
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@imora/shared"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Gyroscope/VR are used by the 360° viewer
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), gyroscope=(self), accelerometer=(self), xr-spatial-tracking=(self)" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
