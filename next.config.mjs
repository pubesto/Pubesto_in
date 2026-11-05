/** @type {import('next').NextConfig} */
const r2Host = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig = {
  images: {
    qualities: [75],
    remotePatterns: [
      ...(r2Host ? [{ protocol: "https", hostname: r2Host, pathname: "/**" }] : []),
      { protocol: "https", hostname: "*.googleusercontent.com", pathname: "/**" },
    ],
  },
  async redirects() {
    return [
      {
        source: '/favicon.ico',
        destination: '/icon.svg',
        permanent: false,
      },
      {
        source: '/notebook-bottle',
        destination: '/product/notebook-bottle',
        permanent: false,
      },
      {
        source: '/product/b-65-do-your-best-notebook-bottle',
        destination: '/product/notebook-bottle',
        permanent: false,
      },
      // The old PIN-protected admin pages now live in the dashboard.
      { source: '/admin', destination: '/dashboard', permanent: false },
      { source: '/admin/reviews', destination: '/dashboard/reviews', permanent: false },
      { source: '/admin/returns', destination: '/dashboard/returns', permanent: false },
      { source: '/login', destination: '/account/login', permanent: false },
    ];
  },
};

export default nextConfig;
