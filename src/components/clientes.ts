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

const ICONO_PDF = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </svg>
`;

// Cuántos presupuestos se muestran por cliente antes de "Ver los N"
const VISIBLES_POR_CLIENTE = 3;

interface GrupoCliente {
  clave: string;
  nombre: string;
  presupuestos: PresupuestoGuardado[];
}

interface OpcionesClientes {
  // Se llama al tocar "Nuevo presupuesto" en la tarjeta de un cliente
  onNuevoPresupuesto: (cliente: string) => void;
}

let presupuestos: PresupuestoGuardado[] = [];
let huboError = false;
let opciones: OpcionesClientes;

// Clientes que tienen desplegada la lista completa de presupuestos
const expandidos = new Set<string>();

// Montos con separador de miles, ej: $ 12.150.000,00
function formatearMonto(monto: number) {
  return `$ ${monto.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function plural(cantidad: number, singular: string, sufijo = "s") {
  return `${cantidad} ${singular}${cantidad === 1 ? "" : sufijo}`;
}

// Agrupa por nombre de cliente sin distinguir mayúsculas ni acentos.
// Los presupuestos ya vienen del más nuevo al más viejo, así que el
// nombre que se muestra es el del más reciente.
function agruparPorCliente(lista: PresupuestoGuardado[]): GrupoCliente[] {
  const grupos = new Map<string, GrupoCliente>();

  lista.forEach((presupuesto) => {
    const clave = normalizar(presupuesto.cliente);

    if (!grupos.has(clave)) {
      grupos.set(clave, { clave, nombre: presupuesto.cliente, presupuestos: [] });
    }

    grupos.get(clave)!.presupuestos.push(presupuesto);
  });

  return [...grupos.values()];
}

function crearFilaPresupuesto(presupuesto: PresupuestoGuardado) {
  const fila = document.createElement("div");
  fila.className = "presupuesto-fila";

  fila.innerHTML = `
    <span class="presupuesto-icono" aria-hidden="true">${ICONO_PDF}</span>
    <div class="presupuesto-info">
      <strong></strong>
      <span></span>
    </div>
    <strong class="presupuesto-total"></strong>
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

  const fecha = presupuesto.creadoEn.toLocaleDateString("es-AR");
  const hora = presupuesto.creadoEn.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  (fila.querySelector(".presupuesto-info strong") as HTMLElement).textContent =
    `${fecha}, ${hora} hs`;

  // Si no se emitió como A.M.W., se aclara a nombre de quién salió
  const emisor = presupuesto.datos.emisor;
  const emitidoPor =
    emisor?.tipo === "otro" ? ` · Emitido por ${emisor.nombre}` : "";

  (fila.querySelector(".presupuesto-info span") as HTMLElement).textContent =
    plural(presupuesto.datos.tareas.length, "tarea") + emitidoPor;

  (fila.querySelector(".presupuesto-total") as HTMLElement).textContent =
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

function crearTarjetaCliente(grupo: GrupoCliente) {
  const tarjeta = document.createElement("article");
  tarjeta.className = "cliente-grupo";

  tarjeta.innerHTML = `
    <header class="cliente-grupo-header">
      <div class="cliente-info">
        <strong class="cliente-nombre"></strong>
        <span class="cliente-meta"></span>
      </div>
      <button type="button" class="btn-fila btn-fila-nuevo">
        + Nuevo presupuesto
      </button>
    </header>
    <div class="cliente-presupuestos"></div>
  `;

  const total = grupo.presupuestos.length;

  tarjeta
    .querySelector(".cliente-grupo-header")
    ?.prepend(crearAvatar(grupo.nombre));

  (tarjeta.querySelector(".cliente-nombre") as HTMLElement).textContent =
    grupo.nombre;

  (tarjeta.querySelector(".cliente-meta") as HTMLElement).textContent =
    `${plural(total, "presupuesto")} · último el ${grupo.presupuestos[0].creadoEn.toLocaleDateString("es-AR")}`;

  tarjeta.querySelector(".btn-fila-nuevo")?.addEventListener("click", () => {
    opciones.onNuevoPresupuesto(grupo.nombre);
  });

  const expandido = expandidos.has(grupo.clave);
  const visibles = expandido
    ? grupo.presupuestos
    : grupo.presupuestos.slice(0, VISIBLES_POR_CLIENTE);

  tarjeta
    .querySelector(".cliente-presupuestos")
    ?.append(...visibles.map(crearFilaPresupuesto));

  if (total > VISIBLES_POR_CLIENTE) {
    const btnVerTodos = document.createElement("button");
    btnVerTodos.type = "button";
    btnVerTodos.className = "btn-ver-todos";
    btnVerTodos.textContent = expandido
      ? "Ver menos"
      : `Ver los ${total} presupuestos`;

    btnVerTodos.addEventListener("click", () => {
      if (expandido) {
        expandidos.delete(grupo.clave);
      } else {
        expandidos.add(grupo.clave);
      }

      render();
    });

    tarjeta.append(btnVerTodos);
  }

  return tarjeta;
}

function render() {
  const lista = document.getElementById("clientes-lista") as HTMLElement;
  const vacio = document.getElementById("clientes-vacio") as HTMLElement;
  const filtro = normalizar(
    (document.getElementById("clientes-filtro") as HTMLInputElement).value
  );

  const grupos = agruparPorCliente(presupuestos);
  const visibles = grupos.filter((g) => g.clave.includes(filtro));

  lista.replaceChildren(...visibles.map(crearTarjetaCliente));

  const contador = document.getElementById("clientes-contador") as HTMLElement;
  contador.textContent =
    presupuestos.length === 0
      ? ""
      : `${plural(grupos.length, "cliente")} · ${plural(presupuestos.length, "presupuesto")}`;

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

export function initClientes(opcionesIniciales: OpcionesClientes) {
  opciones = opcionesIniciales;

  document
    .getElementById("clientes-filtro")
    ?.addEventListener("input", render);

  refrescarClientes();
}
