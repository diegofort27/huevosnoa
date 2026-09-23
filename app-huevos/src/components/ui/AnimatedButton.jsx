'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

/**
 * Micro-interactive button with Framer Motion hover/tap feedback and animated spinner state
 */
export default function AnimatedButton({
    children,
    isLoading = false,
    disabled = false,
    className = 'btn btn-primary',
    onClick,
    type = 'button',
    icon: Icon,
    ...props
}) {
    return (
        <motion.button
            type={type}
            className={className}
            disabled={disabled || isLoading}
            onClick={onClick}
            whileHover={!(disabled || isLoading) ? { scale: 1.02 } : undefined}
            whileTap={!(disabled || isLoading) ? { scale: 0.98 } : undefined}
            transition={{ duration: 0.12 }}
            {...props}
        >
            {isLoading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Cargando...</span>
                </span>
            ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    {Icon && <Icon size={16} />}
                    {children}
                </span>
            )}
        </motion.button>
    );
}
