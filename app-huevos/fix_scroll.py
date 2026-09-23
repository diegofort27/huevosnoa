with open(r'src\app\globals.css', 'a', encoding='utf-8') as f:
    f.write("""
/* Sidebar scroll fix for mobile */
@media (max-width: 768px) {
    .sidebar {
        overflow-y: auto;
        max-height: 100vh;
        z-index: 999;
        position: fixed;
        top: 0;
        left: 0;
    }
}
""")
print('OK')
