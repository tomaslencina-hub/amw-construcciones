import type { DatosPresupuesto } from "./formulario";
import { construirPDF } from "./pdf";

// Guardamos la última blob URL para liberarla (evita fugas de memoria)
// cada vez que se abre una vista previa nueva o se cierra el modal.
let blobUrlActual: string | null = null;

export async function mostrarPreview(datos: DatosPresupuesto) {
  const modal = document.getElementById("modal-preview")!;
  const contenido = document.getElementById("preview-content")!;

  modal.style.display = "block";
  contenido.innerHTML = `<div class="preview-loading">Generando vista previa…</div>`;

  try {
    const doc = await construirPDF(datos);

    if (blobUrlActual) {
      URL.revokeObjectURL(blobUrlActual);
    }

    const blob = doc.output("blob");
    blobUrlActual = URL.createObjectURL(blob);

    contenido.innerHTML = `
      <iframe
        src="${blobUrlActual}"
        class="preview-iframe"
        title="Vista previa del presupuesto"
      ></iframe>
    `;
  } catch (e) {
    console.error("No se pudo generar la vista previa:", e);
    contenido.innerHTML = `<p class="preview-loading">No se pudo generar la vista previa.</p>`;
  }
}

export function cerrarPreview() {
  const modal = document.getElementById("modal-preview")!;
  modal.style.display = "none";

  if (blobUrlActual) {
    URL.revokeObjectURL(blobUrlActual);
    blobUrlActual = null;
  }
}