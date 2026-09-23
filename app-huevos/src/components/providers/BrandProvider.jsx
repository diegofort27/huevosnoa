'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const BrandContext = createContext({
    companyName: 'Horizon',
    companyLogoUrl: null,
    companyCuit: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    loading: true,
    refreshBrand: () => { },
    updateBrandState: () => { }
});

export function BrandProvider({ children }) {
    const [brandSettings, setBrandSettings] = useState({
        companyName: 'Horizon',
        companyLogoUrl: null,
        companyCuit: '',
        companyAddress: '',
        companyPhone: '',
        companyEmail: '',
        loading: true
    });

    const loadBrandSettings = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (!error && data) {
                setBrandSettings({
                    companyName: data.company_name || 'Horizon',
                    companyLogoUrl: data.company_logo_url || null,
                    companyCuit: data.company_cuit || '',
                    companyAddress: data.company_address || '',
                    companyPhone: data.company_phone || '',
                    companyEmail: data.company_email || '',
                    loading: false
                });
            } else {
                setBrandSettings(prev => ({ ...prev, loading: false }));
            }
        } catch (e) {
            console.error('Error cargando configuración de marca:', e);
            setBrandSettings(prev => ({ ...prev, loading: false }));
        }
    }, []);

    useEffect(() => {
        loadBrandSettings();
    }, [loadBrandSettings]);

    const updateBrandState = (newSettings) => {
        setBrandSettings(prev => ({
            ...prev,
            ...newSettings
        }));
    };

    return (
        <BrandContext.Provider
            value={{
                ...brandSettings,
                refreshBrand: loadBrandSettings,
                updateBrandState
            }}
        >
            {children}
        </BrandContext.Provider>
    );
}

export function useBrand() {
    const context = useContext(BrandContext);
    if (!context) {
        throw new Error('useBrand debe usarse dentro de un BrandProvider');
    }
    return context;
}
