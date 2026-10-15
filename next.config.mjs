/** @type {import('next').NextConfig} */
// The SDK + protocol packages are consumed as raw TypeScript via the Chess repo's workspace exports.
// Two bits of config are needed to make that work:
//   1. `transpilePackages`: tells Next's SWC to compile their TypeScript (otherwise node-ESM resolution
//      tries to read `.ts` files directly and chokes).
//   2. webpack's `resolve.extensionAlias`: the SDK's source uses TS-ESM-style `.js` imports (e.g.
//      `import { X } from './http.js'`) which webpack normally takes literally. Mapping `.js` → `.ts`
//      restores the TS compiler's resolution semantics.
const nextConfig = {
  reactStrictMode: true,
  // `output: 'standalone'` emits a self-contained server bundle under .next/standalone/ with only
  // the deps the app actually uses. The Fly Dockerfile copies that bundle instead of node_modules.
  output: 'standalone',
  // Keeping `typedRoutes` off for now — it requires the full route registry file to exist before any
  // `router.push('/foo')` typechecks, which is friction during scaffolding. Re-enable once the IA is
  // stable and we can commit to generating the registry file in CI.
  transpilePackages: ['@chess/client', '@chess/protocol'],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
