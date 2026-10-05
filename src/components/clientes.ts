import { listarPresupuestos, type PresupuestoGuardado } from "./db";
import { generarPDF } from "./pdf";
import { mostrarPreview } from "./preview";
import { crearAvatar, normalizar } from "./utils";

const ICONO_VER = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
`;

const ICONO_DESCARGAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M9 13l3 3 3-3" />
    <line x1="12" y1="11" x2="12" y2="16" />
  </svg>
`;

let presupuestos: PresupuestoGuardado[] = [];
let huboError = false;

// Montos con separador de miles, ej: $ 12.150.000,00
function formatearMonto(monto: number) {
  return `$ ${monto.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function crearFila(presupuesto: PresupuestoGuardado) {
  const fila = document.createElement("article");
  fila.className = "cliente-item";

  fila.innerHTML = `
    <div class="cliente-info">
      <strong class="cliente-nombre"></strong>
      <span class="cliente-meta"></span>
    </div>
    <div class="cliente-total">
      <span>Total</span>
      <strong></strong>
    </div>
    <div class="cliente-acciones">
      <button type="button" class="btn-fila btn-fila-ver" title="Vista previa">
        ${ICONO_VER}
        Ver
      </button>
      <button type="button" class="btn-fila btn-fila-descargar" title="Descargar PDF">
        ${ICONO_DESCARGAR}
        Descargar
      </button>
    </div>
  `;

  fila.prepend(crearAvatar(presupuesto.cliente));

  (fila.querySelector(".cliente-nombre") as HTMLElement).textContent =
    presupuesto.cliente;

  const fecha = presupuesto.creadoEn.toLocaleDateString("es-AR");
  const hora = presupuesto.creadoEn.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const tareas = presupuesto.datos.tareas.length;

  // Si no se emitió como A.M.W., se aclara a nombre de quién salió
  const emisor = presupuesto.datos.emisor;
  const emitidoPor =
    emisor?.tipo === "otro" ? ` · Emitido por ${emisor.nombre}` : "";

  (fila.querySelector(".cliente-meta") as HTMLElement).textContent =
    `${fecha}, ${hora} hs · ${tareas} tarea${tareas === 1 ? "" : "s"}${emitidoPor}`;

  (fila.querySelector(".cliente-total strong") as HTMLElement).textContent =
    formatearMonto(presupuesto.total);

  fila.querySelector(".btn-fila-ver")?.addEventListener("click", async () => {
    await mostrarPreview(presupuesto.datos, presupuesto.creadoEn);
  });

  fila
    .querySelector(".btn-fila-descargar")
    ?.addEventListener("click", async () => {
      await generarPDF(presupuesto.datos, presupuesto.creadoEn);
    });

  return fila;
}

function render() {
  const lista = document.getElementById("clientes-lista") as HTMLElement;
  const vacio = document.getElementById("clientes-vacio") as HTMLElement;
  const filtro = normalizar(
    (document.getElementById("clientes-filtro") as HTMLInputElement).value
  );

  const visibles = presupuestos.filter((p) =>
    normalizar(p.cliente).includes(filtro)
  );

  lista.replaceChildren(...visibles.map(crearFila));

  const contador = document.getElementById("clientes-contador") as HTMLElement;
  contador.textContent =
    presupuestos.length === 0
      ? ""
      : `${presupuestos.length} presupuesto${presupuestos.length === 1 ? "" : "s"} guardado${presupuestos.length === 1 ? "" : "s"}`;

  vacio.hidden = visibles.length > 0;

  if (huboError) {
    vacio.textContent = "No se pudo leer el historial de clientes.";
  } else if (presupuestos.length === 0) {
    vacio.textContent =
      "Todavía no hay presupuestos guardados. Aparecen acá cuando descargás un PDF.";
  } else {
    vacio.textContent = "No hay clientes que coincidan con la búsqueda.";
  }
}

export async function refrescarClientes() {
  try {
    presupuestos = await listarPresupuestos();
    huboError = false;
  } catch (e) {
    console.error("No se pudo leer el historial de clientes:", e);
    presupuestos = [];
    huboError = true;
  }

  render();
}

export function initClientes() {
  document
    .getElementById("clientes-filtro")
    ?.addEventListener("input", render);

  refrescarClientes();
}
