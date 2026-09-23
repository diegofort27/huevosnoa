'use client'; // Error components must be Client Components

export default function GlobalError({ error, reset }) {
    return (
        <html>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
                <style>{`
          body {
            font-family: 'Inter', sans-serif;
            background: #f3f4f6;
            color: #111827;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .card {
            background: #ffffff;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            max-width: 400px;
            width: 100%;
            text-align: center;
          }
          button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            width: 100%;
            transition: background 0.2s;
          }
          button:hover {
            background: #2563eb;
          }
        `}</style>
            </head>
            <body>
                <div className="card">
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>💥</div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>
                        Error Crítico
                    </h1>
                    <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px', lineHeight: '1.6' }}>
                        Ocurrió un error grave en la aplicación que impide mostrar esta página.<br />
                        <i>{error?.message || 'Error de Layout Principal'}</i>
                    </p>
                    <button onClick={() => reset()}>
                        Recargar Página
                    </button>
                </div>
            </body>
        </html>
    );
}
