import type { PropsWithChildren } from 'react';
import type { Metadata, Viewport } from 'next';
import { getLocale, setLocale } from '@/core/i18n/locale';
import React from 'react';

import { Root } from '@/components/Root/Root';
import { I18nProvider } from '@/core/i18n/provider';

import '@telegram-apps/telegram-ui/dist/styles.css';
import 'normalize.css/normalize.css';
import './_assets/globals.css';

export const metadata: Metadata = {
  title: 'TONOT Chance',
  description: 'Игра, где всегда есть шанс',
};

// Отдельный экспорт viewport согласно новым требованиям Next.js
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <head>
        {/* Можно удалить дублирующую мета-тег viewport, так как он будет добавлен автоматически */}
      </head>
      <body>
        <I18nProvider>
          <Root>
            {children}
          </Root>
        </I18nProvider>
      </body>
    </html>
  );
}
