'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import BackupReminder from '@/components/layout/BackupReminder';
import CommandPalette from '@/components/ui/CommandPalette';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Toaster } from 'sonner';
import PageTransition from '@/components/ui/PageTransition';

export default function DashboardLayout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const locale = useLocale();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey) {
                if (e.key === 'v' || e.key === 'V') {
                    e.preventDefault();
                    router.push(`/${locale}/ventas?action=new&t=${Date.now()}`);
                } else if (e.key === 'c' || e.key === 'C') {
                    e.preventDefault();
                    router.push(`/${locale}/cobranzas?action=new&t=${Date.now()}`);
                } else if (e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                    router.push(`/${locale}/gastos?action=new&t=${Date.now()}`);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [locale, router]);

    return (
        <div className="app-layout">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="main-content">
                <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
                <div className="page-content">
                    <PageTransition key={pathname}>
                        {children}
                    </PageTransition>
                </div>
            </main>
            <BackupReminder />
            <CommandPalette />
            <Toaster
                position="bottom-right"
                richColors
                closeButton
                duration={4000}
                toastOptions={{
                    style: {
                        fontFamily: 'var(--font-sans, Inter, sans-serif)',
                        fontSize: '14px',
                    }
                }}
            />
        </div>
    );
}
