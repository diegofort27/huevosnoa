with open(r'src\app\globals.css', 'a', encoding='utf-8') as f:
    f.write("""
/* Mobile hamburger button */
.hamburger-btn {
    display: none;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 8px;
    color: var(--text-primary);
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
}
@media (max-width: 768px) {
    .hamburger-btn { display: block; }
    .sidebar.sidebar-open { transform: translateX(0) !important; }
    .sidebar-overlay { display: block !important; }
}
""")
print('OK')
