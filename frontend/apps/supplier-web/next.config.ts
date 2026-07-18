import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@pssms/api-client',
    '@pssms/ui',
    '@pssms/auth',
    '@pssms/permissions',
  ],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@pssms/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@pssms/api-client': path.resolve(
        __dirname,
        '../../packages/api-client/src',
      ),
      '@pssms/auth': path.resolve(__dirname, '../../packages/auth/src'),
      '@pssms/permissions': path.resolve(
        __dirname,
        '../../packages/permissions/src',
      ),
    };
    return config;
  },
};

export default nextConfig;
