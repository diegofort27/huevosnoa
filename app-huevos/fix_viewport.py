with open(r'src\app\[locale]\layout.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace(
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />\n                <link rel="preconnect" href="https://fonts.googleapis.com" />'
)
with open(r'src\app\[locale]\layout.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('OK')
