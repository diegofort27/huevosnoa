with open(r'src\app\globals.css', 'a', encoding='utf-8') as f:
    f.write("""
/* Header mobile compacto */
@media (max-width: 768px) {
    .hide-mobile { display: none !important; }
    .header { padding: 0 10px; gap: 8px; }
    .date-picker { font-size: 11px; padding: 4px 8px; }
    .date-picker span:first-child { display: none; }
    .user-name { max-width: 80px !important; font-size: 10px !important; }
    #logout-button { padding: 4px 8px !important; font-size: 12px !important; }
}
""")
print('OK')
