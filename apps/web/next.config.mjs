/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpila os pacotes internos (entregues como código-fonte TS/TSX).
  transpilePackages: ['@app/ui', '@app/validation', '@app/types'],
};

export default nextConfig;
