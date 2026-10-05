import { confirmar } from "./dialogos";
import { obtenerEmisor, type Emisor } from "./emisor";

export interface ItemPresupuesto {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
  total: number;
}

export interface Tarea {
  nombre: string;
  manoObra: ItemPresupuesto[];
  materiales: ItemPresupuesto[];
}

export interface DatosPresupuesto {
  cliente: string;
  fecha: string;
  tareas: Tarea[];
  observaciones: string;
  subtotalMano: number;
  subtotalMateriales: number;
  totalGeneral: number;
  // Define el diseño del PDF. Los presupuestos guardados antes de que
  // existiera esta opción no lo tienen: se toman como de A.M.W.
  emisor?: Emisor;
}

const ICONO_BORRAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <line x1="4" y1="7" x2="20" y2="7"></line>
    <path d="M6 7V4h12v3"></path>
    <path d="M6 7l1 13h10l1-13"></path>
  </svg>
`;

const ICONO_LABOR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 14a8 8 0 0 1 16 0" />
    <rect x="2" y="14" width="20" height="3.2" rx="1.4" />
    <line x1="12" y1="5.5" x2="12" y2="9" />
  </svg>
`;

const ICONO_MATERIALES = `
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="2" y="5" width="8" height="5" rx="1" />
    <rect x="11.5" y="5" width="10.5" height="5" rx="1" />
    <rect x="6" y="12" width="8" height="5" rx="1" />
    <rect x="15.5" y="12" width="6.5" height="5" rx="1" />
    <rect x="2" y="12" width="3" height="5" rx="1" />
  </svg>
`;

const ICONO_CHEVRON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
`;

export function initFormulario() {
  const contenedorTareas = document.getElementById(
    "tareas-contenedor"
  ) as HTMLElement;

  const sumarTotales = (contenedor: Element) =>
    Array.from(contenedor.querySelectorAll(".input-total")).reduce(
      (acc, input) => acc + (parseFloat((input as HTMLInputElement).value) || 0),
      0
    );

  function actualizarTotales() {
    let subtotalMano = 0;
    let subtotalMateriales = 0;

    // Subtotales por sección y por tarea, y acumulado general
    contenedorTareas.querySelectorAll(".tarea-card").forEach((tarea) => {
      const mano = sumarTotales(tarea.querySelector(".tarea-mano-obra")!);
      const materiales = sumarTotales(tarea.querySelector(".tarea-materiales")!);

      (tarea.querySelector(".subtotal-mano-obra") as HTMLElement).textContent =
        `$ ${mano.toFixed(2)}`;
      (tarea.querySelector(".subtotal-materiales") as HTMLElement).textContent =
        `$ ${materiales.toFixed(2)}`;
      (tarea.querySelector(".tarea-subtotal strong") as HTMLElement).textContent =
        `$ ${(mano + materiales).toFixed(2)}`;

      subtotalMano += mano;
      subtotalMateriales += materiales;
    });

    const totalGeneral = subtotalMano + subtotalMateriales;

    (document.getElementById("sub-mano") as HTMLElement).textContent =
      `$ ${subtotalMano.toFixed(2)}`;

    (document.getElementById("sub-materiales") as HTMLElement).textContent =
      `$ ${subtotalMateriales.toFixed(2)}`;

    (document.getElementById("total-final") as HTMLElement).textContent =
      `$ ${totalGeneral.toFixed(2)}`;
  }

  function crearFilaItem() {
    const div = document.createElement("div");
    div.className = "fila-presupuesto";

    div.innerHTML = `
      <input type="text" class="input-descripcion" placeholder="Descripción" aria-label="Descripción">
      <input type="number" class="input-cant" placeholder="Cant." min="0" aria-label="Cantidad">
      <input type="text" class="input-unidad" placeholder="Unidad" aria-label="Unidad">
      <input type="number" class="input-precio" placeholder="Precio" min="0" aria-label="Precio unitario">
      <input type="number" class="input-total" placeholder="0.00" readonly tabindex="-1" aria-label="Total">
      <button type="button" class="btn-delete" aria-label="Eliminar fila">
        ${ICONO_BORRAR}
      </button>
    `;

    const cant = div.querySelector(".input-cant") as HTMLInputElement;
    const precio = div.querySelector(".input-precio") as HTMLInputElement;
    const total = div.querySelector(".input-total") as HTMLInputElement;
    const btnDelete = div.querySelector(".btn-delete") as HTMLButtonElement;

    const calcular = () => {
      const cantidad = parseFloat(cant.value) || 0;
      const precioUnitario = parseFloat(precio.value) || 0;
      total.value = (cantidad * precioUnitario).toFixed(2);
      actualizarTotales();
    };

    cant.addEventListener("input", calcular);
    precio.addEventListener("input", calcular);

    btnDelete.addEventListener("click", () => {
      div.remove();
      actualizarTotales();
    });

    return div;
  }

  // Numera las tareas 01, 02, 03... según su orden actual
  function renumerarTareas() {
    contenedorTareas
      .querySelectorAll(".tarea-numero")
      .forEach((numero, index) => {
        numero.textContent = String(index + 1).padStart(2, "0");
      });
  }

  const encabezadoColumnas = `
    <div class="grid-header">
      <span>Descripción</span>
      <span>Cant</span>
      <span>Unidad</span>
      <span>Precio</span>
      <span class="grid-header-total">Total</span>
      <span></span>
    </div>
  `;

  function crearTarea() {
    const div = document.createElement("div");
    div.className = "tarea-card";

    div.innerHTML = `
      <div class="tarea-header">
        <span class="tarea-numero"></span>
        <input
          type="text"
          class="tarea-nombre"
          placeholder="Nombre de la tarea (ej: Demolición)"
        >
        <div class="tarea-subtotal">
          <span>Subtotal</span>
          <strong></strong>
        </div>
        <button type="button" class="btn-icono btn-colapsar" aria-label="Contraer tarea" title="Contraer / expandir">
          ${ICONO_CHEVRON}
        </button>
        <button type="button" class="btn-icono btn-icono-peligro btn-delete-tarea" aria-label="Eliminar tarea" title="Eliminar tarea">
          ${ICONO_BORRAR}
        </button>
      </div>

      <div class="tarea-cuerpo">
        <div class="tarea-seccion">
          <div class="seccion-titulo">
            <span class="icon-badge icon-labor" aria-hidden="true">${ICONO_LABOR}</span>
            <h3>Mano de obra</h3>
            <span class="seccion-subtotal subtotal-mano-obra"></span>
          </div>
          ${encabezadoColumnas}
          <div class="tarea-mano-obra"></div>
          <button type="button" class="btn-add-fila" data-tipo="mano-obra">
            + Agregar mano de obra
          </button>
        </div>

        <div class="tarea-seccion">
          <div class="seccion-titulo">
            <span class="icon-badge icon-materials" aria-hidden="true">${ICONO_MATERIALES}</span>
            <h3>Materiales</h3>
            <span class="seccion-subtotal subtotal-materiales"></span>
          </div>
          ${encabezadoColumnas}
          <div class="tarea-materiales"></div>
          <button type="button" class="btn-add-fila" data-tipo="materiales">
            + Agregar material
          </button>
        </div>
      </div>
    `;

    const contenedorManoObra = div.querySelector(
      ".tarea-mano-obra"
    ) as HTMLElement;

    const contenedorMateriales = div.querySelector(
      ".tarea-materiales"
    ) as HTMLElement;

    div.querySelectorAll(".btn-add-fila").forEach((boton) => {
      boton.addEventListener("click", () => {
        const tipo = (boton as HTMLElement).dataset.tipo;
        const destino =
          tipo === "mano-obra" ? contenedorManoObra : contenedorMateriales;
        const fila = crearFilaItem();
        destino.appendChild(fila);
        (fila.querySelector(".input-descripcion") as HTMLInputElement).focus();
      });
    });

    const btnColapsar = div.querySelector(".btn-colapsar") as HTMLButtonElement;
    btnColapsar.addEventListener("click", () => {
      const colapsada = div.classList.toggle("colapsada");
      btnColapsar.setAttribute(
        "aria-label",
        colapsada ? "Expandir tarea" : "Contraer tarea"
      );
    });

    // Si la tarea ya tiene algo cargado, pide confirmación antes de borrarla
    div.querySelector(".btn-delete-tarea")?.addEventListener("click", async () => {
      const tieneDatos = Array.from(div.querySelectorAll("input")).some(
        (input) => !input.readOnly && input.value.trim() !== ""
      );

      if (tieneDatos) {
        const nombre = (div.querySelector(".tarea-nombre") as HTMLInputElement)
          .value.trim();

        const ok = await confirmar({
          titulo: "¿Eliminar tarea?",
          texto: nombre
            ? `Se va a borrar "${nombre}" con todos sus ítems.`
            : "Se va a borrar la tarea con todos sus ítems.",
          textoBoton: "Eliminar",
          peligro: true,
        });

        if (!ok) {
          return;
        }
      }

      div.remove();
      renumerarTareas();
      actualizarTotales();
    });

    // Cada tarea nueva arranca con una fila de ejemplo en cada sección
    contenedorManoObra.appendChild(crearFilaItem());
    contenedorMateriales.appendChild(crearFilaItem());

    return div;
  }

  document.getElementById("add-tarea")?.addEventListener("click", () => {
    const tarea = crearTarea();
    contenedorTareas.appendChild(tarea);
    renumerarTareas();
    actualizarTotales();

    tarea.scrollIntoView({ behavior: "smooth", block: "start" });
    (tarea.querySelector(".tarea-nombre") as HTMLInputElement).focus({
      preventScroll: true,
    });
  });

  // Deja el formulario como recién abierto: una tarea vacía y sin datos
  // del cliente. Se usa después de descargar o imprimir.
  function limpiarFormulario() {
    contenedorTareas.replaceChildren(crearTarea());
    renumerarTareas();

    (document.getElementById("cliente") as HTMLInputElement).value = "";
    (document.getElementById("fecha") as HTMLInputElement).value = "";
    (document.getElementById("observaciones") as HTMLTextAreaElement).value =
      "";

    actualizarTotales();
  }

  // Arranca con una tarea inicial para no abrir la app vacía
  contenedorTareas.appendChild(crearTarea());

  renumerarTareas();
  actualizarTotales();

  return { limpiarFormulario };
}

export function obtenerDatosPresupuesto(): DatosPresupuesto {
  const leerItems = (contenedor: Element): ItemPresupuesto[] => {
    return Array.from(contenedor.querySelectorAll(".fila-presupuesto")).map(
      (fila) => ({
        descripcion: (
          fila.querySelector(".input-descripcion") as HTMLInputElement
        ).value,

        cantidad:
          parseFloat(
            (fila.querySelector(".input-cant") as HTMLInputElement).value
          ) || 0,

        unidad: (fila.querySelector(".input-unidad") as HTMLInputElement)
          .value,

        precio:
          parseFloat(
            (fila.querySelector(".input-precio") as HTMLInputElement).value
          ) || 0,

        total:
          parseFloat(
            (fila.querySelector(".input-total") as HTMLInputElement).value
          ) || 0,
      })
    );
  };

  const tareas: Tarea[] = Array.from(
    document.querySelectorAll(".tarea-card")
  ).map((tareaEl) => {
    const nombre =
      (tareaEl.querySelector(".tarea-nombre") as HTMLInputElement).value ||
      "Sin nombre";

    const manoObra = leerItems(
      tareaEl.querySelector(".tarea-mano-obra") as Element
    );

    const materiales = leerItems(
      tareaEl.querySelector(".tarea-materiales") as Element
    );

    return { nombre, manoObra, materiales };
  });

  const subtotalMano = tareas.reduce(
    (acc, t) => acc + t.manoObra.reduce((a, i) => a + i.total, 0),
    0
  );

  const subtotalMateriales = tareas.reduce(
    (acc, t) => acc + t.materiales.reduce((a, i) => a + i.total, 0),
    0
  );

  return {
    cliente: (document.getElementById("cliente") as HTMLInputElement).value,
    fecha: (document.getElementById("fecha") as HTMLInputElement).value,
    observaciones: (
      document.getElementById("observaciones") as HTMLTextAreaElement
    ).value,
    tareas,
    subtotalMano,
    subtotalMateriales,
    totalGeneral: subtotalMano + subtotalMateriales,
    emisor: obtenerEmisor(),
  };
}