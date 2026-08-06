declare module "next-pwa" {
  import type { NextConfig } from "next";
  interface PWAOptions {
    dest: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    scope?: string;
    sw?: string;
    fallbacks?: Record<string, string>;
    cacheOnFrontEndNav?: boolean;
    aggressiveFrontEndNavCaching?: boolean;
    reloadOnOnline?: boolean;
    workboxOptions?: object;
  }
  export default function withPWA(options: PWAOptions): (config: NextConfig) => NextConfig;
}