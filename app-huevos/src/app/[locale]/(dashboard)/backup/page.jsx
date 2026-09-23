'use client';

import { useState } from 'react';
import { PageGuard } from '@/components/auth/RoleGuard';

export default function BackupPage() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState('');

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    setMessage('');
    try {
      const response = await fetch('/api/backup', {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Error al generar el backup en el servidor');
      }

      // Convertir respuesta a Blob
      const blob = await response.blob();
      
      // Crear URL para el blob
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Obtener el nombre del archivo de los headers si es posible, o generar uno
      const disposition = response.headers.get('content-disposition');
      let filename = 'Backup_App_Huevos.xlsx';
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setMessage('¡Backup descargado exitosamente!');
    } catch (error) {
      console.error(error);
      setMessage('Hubo un error al intentar descargar el backup.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadJsonBackup = async () => {
    setIsDownloading(true);
    setMessage('');
    try {
      const response = await fetch('/api/backup?format=json');
      if (!response.ok) throw new Error('Error al generar el backup JSON');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Respaldo_Completo_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setMessage('¡Respaldo JSON completo descargado con éxito!');
    } catch (error) {
      console.error(error);
      setMessage('Hubo un error al descargar el backup JSON.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <PageGuard permission="dashboard.view">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Respaldo y Portabilidad de Datos (Pilar 5 y 7)</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">💾 Descargar copia de seguridad</h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-300">
              Genera y descarga una copia completa con el 100% de la información operativa de la empresa (clientes, ventas, cobros, inventario, proveedores y comprobantes fiscales).
            </p>
            
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={handleDownloadBackup}
                disabled={isDownloading}
                className={`px-4 py-2 font-semibold text-white rounded-md shadow-sm ${
                  isDownloading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                } transition-colors`}
              >
                {isDownloading ? 'Generando Excel...' : '📊 Descargar Respaldo en Excel'}
              </button>

              <button
                onClick={handleDownloadJsonBackup}
                disabled={isDownloading}
                className={`px-4 py-2 font-semibold text-white rounded-md shadow-sm ${
                  isDownloading ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                } transition-colors`}
              >
                {isDownloading ? 'Generando JSON...' : '📦 Exportar 100% Datos (JSON Portable)'}
              </button>
            </div>
            
            {message && (
              <p className={`text-sm mt-2 ${message.includes('error') ? 'text-red-500' : 'text-green-600'}`}>
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </PageGuard>
  );
}
