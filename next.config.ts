import type { NextConfig } from "next";
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.10.51'],
  output: 'standalone',
  turbopack: {},
};

export default withPWA(nextConfig);
