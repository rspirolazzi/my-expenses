import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Next.js only serves its dev resources to localhost; also allow http://127.0.0.1:3000.
  allowedDevOrigins: ["127.0.0.1"],
};

export default withNextIntl(nextConfig);
