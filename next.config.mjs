/** @type {import('next').NextConfig} */
// The SDK and protocol packages are consumed as raw TypeScript via the Chess repo's workspace exports.
// Next's bundler needs to transpile them (otherwise node-style ESM resolution tries to read `.ts` and
// chokes). The explicit entries point tsc + webpack at the source.
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chess/client', '@chess/protocol'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
