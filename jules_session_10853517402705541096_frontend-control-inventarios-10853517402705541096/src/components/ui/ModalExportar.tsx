import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from './Modal';
import { CLASE_BOTON_PRINCIPAL, CLASE_CAMPO } from './EncabezadoPagina';
import { api } from '../../services/api';
import type { TipoExportacion } from '../../types/inventario';

export interface SolicitudExportacion {
  tipo: TipoExportacion;
  titulo: string;
  nombrePorDefecto: string;
  extra?: Record<string, string | number | undefined>;
}

interface ModalExportarProps {
  solicitud: SolicitudExportacion | null;
  onCerrar: () => void;
  onTerminar: (mensaje: string, esError: boolean) => void;
}

/**
 * Pide el nombre del archivo y descarga el CSV. El backend también lo deja en la carpeta salidas/.
 * Quien lo usa le pone `key` distinta por solicitud, así el nombre arranca con el valor por defecto.
 */
export const ModalExportar: React.FC<ModalExportarProps> = ({ solicitud, onCerrar, onTerminar }) => {
  const [nombre, setNombre] = useState(solicitud?.nombrePorDefecto ?? '');
  const [descargando, setDescargando] = useState(false);

  const exportar = async () => {
    if (!solicitud) return;
    setDescargando(true);
    try {
      const archivo = await api.descargarCsv(solicitud.tipo, nombre.trim(), solicitud.extra);
      onTerminar(`Exportado ${archivo} (también quedó en la carpeta salidas/ del backend).`, false);
      onCerrar();
    } catch (error) {
      onTerminar(error instanceof Error ? error.message : String(error), true);
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Modal
      isOpen={solicitud !== null}
      onClose={onCerrar}
      title={`Exportar CSV — ${solicitud?.titulo ?? ''}`}
      footer={
        <button onClick={exportar} disabled={descargando || !nombre.trim()} className={CLASE_BOTON_PRINCIPAL}>
          <Download className="w-4 h-4" />
          {descargando ? 'Exportando...' : 'Descargar'}
        </button>
      }
    >
      <label className="text-xs font-bold text-slate-700 block mb-1.5">Nombre del archivo</label>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={CLASE_CAMPO} />
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Los archivos de entrega se nombran <strong>Día&lt;N&gt;_Ejercicio&lt;N&gt;</strong> (ej. Día2_Ejercicio6). Solo se
        permiten letras, números, guion y guion bajo.
      </p>
    </Modal>
  );
};
