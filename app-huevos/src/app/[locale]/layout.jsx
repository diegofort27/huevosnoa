import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import { AuthProvider } from '../../components/providers/AuthProvider';
import { ThemeProvider } from '../../components/providers/ThemeProvider';
import { SearchProvider } from '../../components/providers/SearchProvider';
import '../globals.css';
import '../cmdk.css';

import { BrandProvider } from '../../components/providers/BrandProvider';

import { LicenseProvider } from '../../components/providers/LicenseProvider';

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }) {
    const { locale } = await params;

    if (!routing.locales.includes(locale)) {
        notFound();
    }

    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body>
                <NextIntlClientProvider messages={messages}>
                    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                        <LicenseProvider>
                            <AuthProvider>
                                <BrandProvider>
                                    <SearchProvider>
                                        {children}
                                    </SearchProvider>
                                </BrandProvider>
                            </AuthProvider>
                        </LicenseProvider>
                    </ThemeProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}