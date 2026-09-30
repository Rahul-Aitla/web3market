/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      "@x402/core": "./src/lib/optional-module-stub.cjs",
      "@x402/core/client": "./src/lib/optional-module-stub.cjs",
      "@x402/evm": "./src/lib/optional-module-stub.cjs",
      "@x402/evm/exact/client": "./src/lib/optional-module-stub.cjs",
      "@x402/evm/upto/client": "./src/lib/optional-module-stub.cjs",
      "@x402/svm": "./src/lib/optional-module-stub.cjs",
      "@x402/svm/exact/client": "./src/lib/optional-module-stub.cjs",
    },
  },
};

export default nextConfig;
