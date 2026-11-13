/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pg / pglite are server-only — keep external so Next doesn't bundle them.
    serverComponentsExternalPackages: ["pg", "@electric-sql/pglite"],
  },
};

export default nextConfig;
