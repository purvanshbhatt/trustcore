/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK || 'true',
  },
};

module.exports = nextConfig;
