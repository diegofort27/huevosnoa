'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Reusable Animated Modal wrapper using Framer Motion
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Handler to close modal
 * @param {React.ReactNode} children - Modal content
 * @param {string} maxWidth - Max width of modal container (default: '500px')
 * @param {string} className - Additional custom classes
 */
export default function AnimatedModal({
    isOpen,
    onClose,
    children,
    maxWidth = '500px',
    className = ''
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="modal-overlay"
                    onClick={onClose}
                    style={{ zIndex: 10000 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.div
                        className={`modal ${className}`}
                        style={{ maxWidth, width: '100%' }}
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 12 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
