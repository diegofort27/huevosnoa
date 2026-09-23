import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import { AuthProvider } from '../../components/providers/AuthProvider';
import { ThemeProvider } from '../../components/providers/ThemeProvider';
import { SearchProvider } from '../../components/providers/SearchProvider';
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
    );
}