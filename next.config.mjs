/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/favicon.ico',
        destination: '/icon.svg',
        permanent: false,
      },
      {
        source: '/notebook-bottle',
        destination: '/product/b-65-do-your-best-notebook-bottle',
        permanent: false,
      },
      {
        source: '/product/notebook-bottle',
        destination: '/product/b-65-do-your-best-notebook-bottle',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
