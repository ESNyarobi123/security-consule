import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@pssms/api-client'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@pssms/api-client': path.resolve(
        __dirname,
        '../../packages/api-client/src',
      ),
      '@pssms/auth': path.resolve(__dirname, '../../packages/auth/src'),
    };
    return config;
  },
};

export default nextConfig;
