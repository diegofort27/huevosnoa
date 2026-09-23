'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useSearch } from '@/components/providers/SearchProvider';

export default function Header({ onMenuToggle }) {
    const t = useTranslations('common');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const { user, profile, signOut } = useAuth();
    const { searchTerm, setSearchTerm } = useSearch();

    const switchLocale = (newLocale) => {
        const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
        router.push(newPath);
    };

    const handleLogout = (e) => {
        e.preventDefault();
        try {
            localStorage.clear();
            sessionStorage.clear();
            document.cookie.split(";").forEach((c) => {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
            signOut();
            window.location.href = `/${locale}/login`;
        } catch (err) {
            window.location.href = `/${locale}/login`;
        }
    };

    const displayName = profile?.email?.split('@')[0].toUpperCase() || user?.email?.split('@')[0].toUpperCase() || 'USUARIO';

    return (
        <header className="header">
            <button className="hamburger-btn" onClick={onMenuToggle} aria-label="Toggle menu">
                ☰
            </button>
            <div className="search-box">
                <span>🔍</span>
                <input type="text" placeholder={t('search')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="date-picker">
                    <span>📅</span>
                    <span>{new Date().toLocaleDateString(locale === 'es' ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="lang-switcher hide-mobile">
                    <button className={`lang-btn ${locale === 'es' ? 'active' : ''}`} onClick={() => switchLocale('es')}>ES</button>
                    <button className={`lang-btn ${locale === 'en' ? 'active' : ''}`} onClick={() => switchLocale('en')}>EN</button>
                </div>
                <ThemeToggle />
                <div className="user-menu" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="user-info" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', maxWidth: '150px' }}>
                        <span className="user-name" style={{ fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--accent-primary)' }}>{displayName}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{profile?.role === 'admin' ? 'MAESTRO' : 'OPERADOR'}</span>
                    </div>
                    <button onClick={handleLogout} style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', padding: '6px 12px', marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#b91c1c', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} id="logout-button">
                        SALIR 🚪
                    </button>
                </div>
            </div>
        </header>
    );
}
