with open(r'src\components\layout\Sidebar.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace(
    "<div className=\"upgrade-banner\">",
    """<div className="lang-switcher-mobile show-mobile" style={{padding: '0 16px 16px'}}>
                <div style={{fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px'}}>IDIOMA</div>
                <div style={{display: 'flex', gap: '8px'}}>
                    <a href={`/es${pathname.replace(/^\\/(es|en)/, '')}`} style={{padding: '6px 16px', borderRadius: '6px', background: locale === 'es' ? 'var(--accent-primary)' : 'transparent', color: 'white', fontWeight: '600', fontSize: '13px', textDecoration: 'none'}}>ES</a>
                    <a href={`/en${pathname.replace(/^\\/(es|en)/, '')}`} style={{padding: '6px 16px', borderRadius: '6px', background: locale === 'en' ? 'var(--accent-primary)' : 'transparent', color: 'white', fontWeight: '600', fontSize: '13px', textDecoration: 'none'}}>EN</a>
                </div>
            </div>
            <div className="upgrade-banner">"""
)
with open(r'src\components\layout\Sidebar.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('OK')
