import type { NextConfig } from "next";

const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  typedRoutes: true,
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {})
};

export default nextConfig;
