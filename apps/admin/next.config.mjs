/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@app/ui', '@app/validation', '@app/types'],
};

export default nextConfig;
