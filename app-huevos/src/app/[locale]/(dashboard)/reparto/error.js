'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
    useEffect(() => {
        console.error('Reparto Page Error:', error);
    }, [error]);

    return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--accent-danger)', marginBottom: '16px' }}>Ups! Algo salió mal en la Hoja de Ruta</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{error.message}</p>
            <button
                className="btn btn-primary"
                onClick={() => reset()}
            >
                Reintentar
            </button>
        </div>
    );
}
