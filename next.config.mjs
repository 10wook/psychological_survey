/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["exceljs", "@prisma/client", "bcryptjs"],
};

export default nextConfig;
