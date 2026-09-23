'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Reusable Page Transition wrapper component for smooth page entrance/exits
 */
export default function PageTransition({ children, className = '' }) {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: '100%', height: '100%' }}
        >
            {children}
        </motion.div>
    );
}
