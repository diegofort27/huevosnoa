'use client'; // Error components must be Client Components

import { useEffect } from 'react';

export default function Error({ error, reset }) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('App caught an error:', error);
    }, [error]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-secondary)',
            padding: '20px'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
                    Algo salió mal
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: '1.6' }}>
                    Ocurrió un error inesperado al cargar esta vista. <br />
                    <i>{error?.message || 'Error desconocido'}</i>
                </p>
                <button
                    onClick={
                        // Attempt to recover by trying to re-render the segment
                        () => reset()
                    }
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                >
                    Volver a intentar
                </button>
            </div>
        </div>
    );
}
