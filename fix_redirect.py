with open(r'src\app\[locale]\page.jsx', 'w', encoding='utf-8') as f:
    f.write("import { redirect } from 'next/navigation';\nexport default function LocalePage() {\n    redirect('/es/ventas');\n}\n")
print('OK')
