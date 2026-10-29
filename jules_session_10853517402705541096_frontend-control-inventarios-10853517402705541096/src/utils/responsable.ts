// Quién está contando: se escribe una vez y se guarda en el navegador, así el Paso 1 y el
// Paso 2 usan el mismo nombre. Si el navegador no deja guardar, solo se pierde el recordatorio.

const CLAVE_RESPONSABLE = 'inventarios_responsable';

export function leerResponsableGuardado(): string {
  try {
    return localStorage.getItem(CLAVE_RESPONSABLE) ?? '';
  } catch {
    return '';
  }
}

export function guardarResponsable(nombre: string) {
  try {
    localStorage.setItem(CLAVE_RESPONSABLE, nombre);
  } catch {
    // Sin almacenamiento: el nombre dura mientras la pantalla esté abierta.
  }
}
