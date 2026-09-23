'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const LicenseContext = createContext({});

export const LicenseProvider = ({ children }) => {
    const [licenseInfo, setLicenseInfo] = useState({
        isValid: true, // Por defecto en desarrollo para no bloquear
        licenseKey: process.env.NEXT_PUBLIC_LICENSE_KEY || 'DEV_LICENSE',
        clientName: 'Cliente Local',
        features: {
            analytics: true,
            invoicing: true,
            multi_warehouse: true,
            backup_cloud: true,
            custom_branding: true,
        },
        expiresAt: null,
        status: 'active',
        loading: true,
        error: null
    });

    const masterUrl = process.env.NEXT_PUBLIC_MASTER_LICENSE_SERVER_URL;
    const licenseKey = process.env.NEXT_PUBLIC_LICENSE_KEY;

    const validateLicense = useCallback(async () => {
        // Si no hay URL del servidor master configurada, asumimos modo desarrollo local
        if (!masterUrl || !licenseKey) {
            console.log('Licencia: Modo local / Desarrollo sin Servidor Master.');
            setLicenseInfo(prev => ({ ...prev, loading: false }));
            return;
        }

        try {
            // Verificamos si tenemos una licencia guardada en cache local (válida por 24h offline)
            const cached = localStorage.getItem('app_license_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                const isStillFresh = parsed.cachedAt && (Date.now() - parsed.cachedAt < 24 * 60 * 60 * 1000);
                if (isStillFresh) {
                    setLicenseInfo({ ...parsed.info, loading: false });
                }
            }

            // Petición al servidor central de licencias
            const res = await fetch(`${masterUrl}/api/license/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    licenseKey: licenseKey,
                    domain: typeof window !== 'undefined' ? window.location.hostname : 'unknown'
                })
            });

            if (res.ok) {
                const data = await res.json();
                const newInfo = {
                    isValid: data.status === 'active',
                    licenseKey,
                    clientName: data.clientName || 'Cliente',
                    features: data.features || {},
                    expiresAt: data.expiresAt || null,
                    status: data.status || 'active',
                    loading: false,
                    error: null
                };
                setLicenseInfo(newInfo);
                // Guardar en cache local para resiliencia offline
                localStorage.setItem('app_license_cache', JSON.stringify({
                    info: newInfo,
                    cachedAt: Date.now()
                }));
            } else {
                console.warn('Licencia: Servidor Master respondió con error');
                setLicenseInfo(prev => ({ ...prev, loading: false, error: 'No se pudo verificar licencia' }));
            }
        } catch (err) {
            console.error('Licencia Error:', err.message);
            // Si falla internet, usamos el cache local existente
            setLicenseInfo(prev => ({ ...prev, loading: false }));
        }
    }, [masterUrl, licenseKey]);

    useEffect(() => {
        validateLicense();
    }, [validateLicense]);

    const isFeatureEnabled = (featureKey) => {
        if (!licenseInfo.isValid) return false;
        // Si no está definida explícitamente en el objeto, por defecto se habilita
        if (licenseInfo.features[featureKey] === undefined) return true;
        return licenseInfo.features[featureKey] === true;
    };

    return (
        <LicenseContext.Provider value={{ ...licenseInfo, isFeatureEnabled, recheckLicense: validateLicense }}>
            {children}
        </LicenseContext.Provider>
    );
};

export const useLicense = () => useContext(LicenseContext);
