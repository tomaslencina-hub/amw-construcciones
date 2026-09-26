import {
  initFormulario,
  obtenerDatosPresupuesto,
} from "./components/formulario";

import { generarPDF } from "./components/pdf";

import {
  mostrarPreview,
  cerrarPreview,
} from "./components/preview";

import { comprobarActualizaciones } from "./components/updater";
import { initNavegacion } from "./components/navegacion";

comprobarActualizaciones();
initNavegacion();
initFormulario();

// Vista previa (ahora es el PDF real, dentro de un iframe)
document
  .getElementById("btn-preview")
  ?.addEventListener("click", async () => {
    await mostrarPreview(
      obtenerDatosPresupuesto()
    );
  });

// PDF
document
  .getElementById("btn-pdf")
  ?.addEventListener("click", async () => {
    await generarPDF(
      obtenerDatosPresupuesto()
    );
  });

// Cerrar modal
document
  .getElementById("cerrar-modal")
  ?.addEventListener("click", () => {
    cerrarPreview();
  });

// Cerrar haciendo click afuera
window.addEventListener("click", (e) => {
  const modal =
    document.getElementById("modal-preview");

  if (e.target === modal) {
    cerrarPreview();
  }
});

// Imprimir: abre la vista previa (el PDF real) y dispara el
// diálogo de impresión del visor de PDF embebido, no el de la página.
document
  .getElementById("btn-print")
  ?.addEventListener("click", async () => {
    await mostrarPreview(
      obtenerDatosPresupuesto()
    );

    const iframe = document.querySelector<HTMLIFrameElement>(
      ".preview-iframe"
    );

    iframe?.addEventListener(
      "load",
      () => {
        iframe.contentWindow?.print();
      },
      { once: true }
    );
  });