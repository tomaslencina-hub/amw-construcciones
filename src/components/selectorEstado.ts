import type { EstadoPresupuesto } from "./db";

// Selector propio del estado del presupuesto. Reemplaza al <select> del
// navegador, cuya lista desplegable no se puede estilizar.

const ESTADOS: { valor: EstadoPresupuesto; texto: string }[] = [
  { valor: "pendiente", texto: "Pendiente" },
  { valor: "aceptado", texto: "Aceptado" },
  { valor: "rechazado", texto: "Rechazado" },
];

const ICONO_CHEVRON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
`;

const ICONO_CHECK = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
`;

// Solo puede haber un menú abierto a la vez
let cerrarAbierto: (() => void) | null = null;

/**
 * Arma el botón con el estado actual. Al elegir otro se llama a onCambiar;
 * si devuelve false (no se pudo guardar), el botón queda como estaba.
 */
export function crearSelectorEstado(
  estado: EstadoPresupuesto,
  onCambiar: (nuevo: EstadoPresupuesto) => Promise<boolean>
) {
  let actual = estado;

  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "estado-boton";
  boton.title = "Respuesta del cliente";
  boton.setAttribute("aria-haspopup", "listbox");
  boton.setAttribute("aria-expanded", "false");

  const mostrar = () => {
    const texto = ESTADOS.find((e) => e.valor === actual)?.texto ?? actual;
    boton.dataset.estado = actual;
    boton.setAttribute("aria-label", `Estado: ${texto}`);
    boton.innerHTML = `
      <span class="estado-punto" aria-hidden="true"></span>
      <span class="estado-texto">${texto}</span>
      ${ICONO_CHEVRON}
    `;
  };

  const elegir = async (nuevo: EstadoPresupuesto) => {
    if (nuevo === actual) {
      return;
    }

    const anterior = actual;
    actual = nuevo;
    mostrar();

    if (!(await onCambiar(nuevo))) {
      actual = anterior;
      mostrar();
    }
  };

  boton.addEventListener("click", () => {
    if (boton.getAttribute("aria-expanded") === "true") {
      cerrarAbierto?.();
    } else {
      abrirMenu(boton, actual, elegir);
    }
  });

  mostrar();
  return boton;
}

function abrirMenu(
  boton: HTMLButtonElement,
  actual: EstadoPresupuesto,
  elegir: (nuevo: EstadoPresupuesto) => void
) {
  cerrarAbierto?.();

  const menu = document.createElement("div");
  menu.className = "estado-menu";
  menu.setAttribute("role", "listbox");

  const opciones = ESTADOS.map(({ valor, texto }) => {
    const opcion = document.createElement("button");
    opcion.type = "button";
    opcion.className = "estado-opcion";
    opcion.dataset.estado = valor;
    opcion.setAttribute("role", "option");
    opcion.setAttribute("aria-selected", String(valor === actual));
    opcion.innerHTML = `
      <span class="estado-punto" aria-hidden="true"></span>
      <span class="estado-texto">${texto}</span>
      ${valor === actual ? ICONO_CHECK : ""}
    `;

    opcion.addEventListener("click", () => {
      cerrar();
      boton.focus();
      elegir(valor);
    });

    return opcion;
  });

  menu.append(...opciones);
  document.body.append(menu);

  // Fixed sobre la pantalla: las tarjetas recortan lo que se sale de ellas.
  // Si no entra abajo del botón, se abre hacia arriba.
  const rect = boton.getBoundingClientRect();
  const alto = menu.offsetHeight;
  const entraAbajo = rect.bottom + 6 + alto <= window.innerHeight;

  menu.style.minWidth = `${rect.width}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.top = entraAbajo
    ? `${rect.bottom + 6}px`
    : `${rect.top - 6 - alto}px`;

  boton.setAttribute("aria-expanded", "true");
  opciones.find((o) => o.dataset.estado === actual)?.focus();

  const alClickearAfuera = (e: MouseEvent) => {
    const objetivo = e.target as Node;

    if (!menu.contains(objetivo) && !boton.contains(objetivo)) {
      cerrar();
    }
  };

  const alPresionarTecla = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      cerrar();
      boton.focus();
      return;
    }

    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
      return;
    }

    e.preventDefault();

    const indice = opciones.indexOf(document.activeElement as HTMLButtonElement);
    const paso = e.key === "ArrowDown" ? 1 : -1;
    const siguiente = (indice + paso + opciones.length) % opciones.length;
    opciones[siguiente].focus();
  };

  const alScrollear = (e: Event) => {
    if (!menu.contains(e.target as Node)) {
      cerrar();
    }
  };

  function cerrar() {
    menu.remove();
    boton.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", alClickearAfuera, true);
    document.removeEventListener("keydown", alPresionarTecla);
    document.removeEventListener("scroll", alScrollear, true);
    window.removeEventListener("resize", cerrar);
    cerrarAbierto = null;
  }

  document.addEventListener("mousedown", alClickearAfuera, true);
  document.addEventListener("keydown", alPresionarTecla);
  document.addEventListener("scroll", alScrollear, true);
  window.addEventListener("resize", cerrar);
  cerrarAbierto = cerrar;
}
