'use client';

import React from 'react';
import AnimatedModal from './AnimatedModal';

/**
 * Reusable Confirmation Modal with smooth animations
 */
export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = '¿Seguro deseas eliminar?',
    message = 'Esta acción no se puede deshacer.',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    type = 'danger'
}) {
    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="400px">
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: '50px', marginBottom: '20px' }}>
                    {type === 'danger' ? '⚠️' : 'ℹ️'}
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>{title}</h3>
                {message && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                        {message}
                    </p>
                )}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button className="btn btn-secondary" onClick={onClose}>
                        {cancelText}
                    </button>
                    <button
                        className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </AnimatedModal>
    );
}

