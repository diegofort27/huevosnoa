with open(r'src\app\globals.css', 'a', encoding='utf-8') as f:
    f.write("""
/* Ocultar switcher de idioma en sidebar en desktop */
@media (min-width: 769px) {
    .lang-switcher-mobile { display: none !important; }
}
""")
print('OK')
