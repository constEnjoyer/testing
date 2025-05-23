import createNextIntlPlugin from 'next-intl/plugin';
 
const withNextIntl = createNextIntlPlugin("./src/core/i18n/i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{
      protocol: 'https',
      hostname: '**',
    }],
  },
  transpilePackages: ['@telegram-apps/sdk-react'],
  env: {
    SKIP_DB_CONNECTION_DURING_BUILD: process.env.VERCEL ? 'false' : 'true',
  },
  // Принудительный динамический рендеринг для API маршрутов
  experimental: {
    // appDocumentPreloading: true,
    // serverComponentsExternalPackages: ['mongoose'],
  },
  // Настройки webpack для подавления предупреждения о punycode
  webpack: (config, { isServer }) => {
    // Отключаем предупреждение о punycode
    config.ignoreWarnings = [
      { message: /Critical dependency: the request of a dependency is an expression/ },
      { message: /Module not found: Can't resolve 'punycode'/ },
      { message: /The `punycode` module is deprecated/ }
    ];
    
    return config;
  },
};

export default withNextIntl(nextConfig);
