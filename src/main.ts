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
import { initNavegacion, irAVista } from "./components/navegacion";
import { confirmar } from "./components/dialogos";
import {
  actualizarPresupuesto,
  guardarPresupuesto,
  type PresupuestoGuardado,
} from "./components/db";
import { initClientes, refrescarClientes } from "./components/clientes";
import { initProveedores } from "./components/proveedores";
import { initEstadisticas } from "./components/estadisticas";
import { mostrarToast } from "./components/toast";
import { preguntarGuardado } from "./components/dialogoGuardar";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { initEmisor, validarEmisor } from "./components/emisor";

comprobarActualizaciones();
initNavegacion();
initEmisor();
const { limpiarFormulario, tieneDatosCargados, iniciarParaCliente, cargarDatos } =
  initFormulario();

// Presupuesto guardado que se está editando (null = se está cargando uno
// nuevo). Mientras hay uno, "guardar" lo reemplaza en vez de crear otro.
let enEdicion: PresupuestoGuardado | null = null;

function establecerEdicion(presupuesto: PresupuestoGuardado | null) {
  enEdicion = presupuesto;

  const aviso = document.getElementById("aviso-edicion") as HTMLElement;
  aviso.hidden = presupuesto === null;

  if (presupuesto) {
    (document.getElementById("aviso-edicion-texto") as HTMLElement).textContent =
      `Estás editando el presupuesto de ${presupuesto.cliente} del ${presupuesto.creadoEn.toLocaleDateString("es-AR")}. Al guardar se reemplaza.`;
  }
}

// Antes de volcar otra cosa en el formulario, avisa si se perdería algo
async function confirmarReemplazo(texto: string) {
  if (!tieneDatosCargados()) {
    return true;
  }

  return confirmar({
    titulo: "Hay un presupuesto a medio cargar",
    texto,
    textoBoton: "Continuar",
    peligro: true,
  });
}

initClientes({
  // "Nuevo presupuesto" en la tarjeta de un cliente: va a la carga con ese
  // cliente ya puesto.
  async onNuevoPresupuesto(cliente) {
    if (
      !(await confirmarReemplazo(
        `Si empezás uno nuevo para "${cliente}" se pierde lo que estaba cargado.`
      ))
    ) {
      return;
    }

    irAVista("presupuesto");
    establecerEdicion(null);
    iniciarParaCliente(cliente);
  },

  // "Editar": abre el presupuesto tal como se guardó; al guardar lo reemplaza
  async onEditar(presupuesto) {
    if (
      !(await confirmarReemplazo(
        "Si abrís este presupuesto para editarlo se pierde lo que estaba cargado."
      ))
    ) {
      return;
    }

    irAVista("presupuesto");
    cargarDatos(presupuesto.datos);
    establecerEdicion(presupuesto);
  },

  // "Duplicar": mismos datos como presupuesto nuevo (con la fecha en
  // blanco); el original queda intacto
  async onDuplicar(presupuesto) {
    if (
      !(await confirmarReemplazo(
        "Si duplicás este presupuesto se pierde lo que estaba cargado."
      ))
    ) {
      return;
    }

    irAVista("presupuesto");
    cargarDatos({ ...presupuesto.datos, fecha: "" });
    establecerEdicion(null);
    mostrarToast("Copia lista: cambiá lo que necesites");
  },
});

document
  .getElementById("btn-cancelar-edicion")
  ?.addEventListener("click", () => {
    establecerEdicion(null);
    limpiarFormulario();
  });

initProveedores();
initEstadisticas();

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

  const editado = enEdicion;

  const respuesta = await preguntarGuardado(
    datos.cliente,
    accion,
    editado !== null
  );

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
      // Editando: reemplaza el guardado. Si no, crea uno nuevo.
      if (editado) {
        await actualizarPresupuesto(editado.id, datos);
      } else {
        await guardarPresupuesto(datos);
      }

      await refrescarClientes();
      mostrarToast(
        editado ? "Cambios guardados" : "Presupuesto guardado en Clientes"
      );
    } catch (e) {
      console.error("No se pudo guardar el presupuesto:", e);
      mostrarToast("No se pudo guardar el presupuesto en Clientes", "error");
    }
  }

  establecerEdicion(null);
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
