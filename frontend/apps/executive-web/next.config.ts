import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@pssms/api-client', '@pssms/ui'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@pssms/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@pssms/api-client': path.resolve(
        __dirname,
        '../../packages/api-client/src',
      ),
    };
    return config;
  },
};

export default nextConfig;
