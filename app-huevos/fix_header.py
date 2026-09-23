with open(r'src\components\layout\Header.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace(
    '<div className="lang-switcher">',
    '<div className="lang-switcher hide-mobile">'
)
with open(r'src\components\layout\Header.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('OK')
