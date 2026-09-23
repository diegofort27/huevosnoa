'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function BackupReminder() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Verificar si ya se mostró hoy
    const today = new Date().toISOString().split('T')[0];
    const lastBackupReminder = localStorage.getItem('lastBackupReminder');

    if (lastBackupReminder !== today) {
      // Mostrar el recordatorio
      setShow(true);
      // Guardar que ya se mostró hoy
      localStorage.setItem('lastBackupReminder', today);

      // Ocultar después de 3.5 segundos
      const timer = setTimeout(() => {
        setShow(false);
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] bg-blue-600 text-white px-6 py-4 rounded-lg shadow-lg flex flex-col gap-2 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex items-center gap-2">
        <span className="text-xl">💾</span>
        <p className="font-semibold">¡No olvides realizar tu backup diario!</p>
      </div>
      <Link href="/backup" className="text-sm underline text-blue-100 hover:text-white" onClick={() => setShow(false)}>
        Ir a Respaldo ahora
      </Link>
    </div>
  );
}
