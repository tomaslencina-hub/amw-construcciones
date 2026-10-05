import {
  initFormulario,
  obtenerDatosPresupuesto,
  type DatosPresupuesto,
} from "./components/formulario";

import { generarPDF } from "./components/pdf";

import {
  mostrarPreview,
  cerrarPreview,
} from "./components/preview";

import { comprobarActualizaciones } from "./components/updater";
import { initNavegacion } from "./components/navegacion";
import { guardarPresupuesto } from "./components/db";
import { initClientes, refrescarClientes } from "./components/clientes";
import { initProveedores } from "./components/proveedores";
import { mostrarToast } from "./components/toast";
import { preguntarGuardado } from "./components/dialogoGuardar";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { initEmisor, validarEmisor } from "./components/emisor";

comprobarActualizaciones();
initNavegacion();
initEmisor();
const { limpiarFormulario } = initFormulario();
initClientes();
initProveedores();

// Vista previa (ahora es el PDF real, dentro de un iframe)
document
  .getElementById("btn-preview")
  ?.addEventListener("click", async () => {
    const datos = obtenerDatosPresupuesto();

    if (!validarEmisor(datos.emisor!)) {
      return;
    }

    await mostrarPreview(datos);
  });

// Imprimir: abre la vista previa (el PDF real) y dispara el
// diálogo de impresión del visor de PDF embebido, no el de la página.
async function imprimir(datos: DatosPresupuesto) {
  await mostrarPreview(datos);

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
}

// Descargar o imprimir: primero pregunta si se guarda en Clientes,
// después hace la acción y deja el formulario limpio para el próximo.
async function finalizarPresupuesto(accion: "descargar" | "imprimir") {
  const datos = obtenerDatosPresupuesto();

  if (!validarEmisor(datos.emisor!)) {
    return;
  }

  const respuesta = await preguntarGuardado(datos.cliente, accion);

  if (!respuesta) {
    return;
  }

  if (accion === "descargar") {
    await generarPDF(datos);
  } else {
    await imprimir(datos);
  }

  if (respuesta === "guardar") {
    try {
      await guardarPresupuesto(datos);
      await refrescarClientes();
      mostrarToast("Presupuesto guardado en Clientes");
    } catch (e) {
      console.error("No se pudo guardar el presupuesto:", e);
      mostrarToast("No se pudo guardar el presupuesto en Clientes", "error");
    }
  }

  limpiarFormulario();
}

document
  .getElementById("btn-pdf")
  ?.addEventListener("click", () => finalizarPresupuesto("descargar"));

document
  .getElementById("btn-print")
  ?.addEventListener("click", () => finalizarPresupuesto("imprimir"));

// Controles de ventana propios (la ventana no tiene barra de título)
document
  .getElementById("btn-minimizar")
  ?.addEventListener("click", () => getCurrentWindow().minimize());

document
  .getElementById("btn-cerrar-app")
  ?.addEventListener("click", () => getCurrentWindow().close());

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
