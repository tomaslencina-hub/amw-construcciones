import { mostrarToast } from "./toast";

/**
 * Quién emite el presupuesto, y por lo tanto con qué diseño sale el PDF:
 * - "amw": diseño de A.M.W., con el logo y los datos de la empresa.
 * - "otro": diseño neutro, sin nada de A.M.W., con los datos que se carguen.
 */
export type Emisor =
  | { tipo: "amw" }
  | {
      tipo: "otro";
      nombre: string;
      dni: string;
      cuit: string;
      telefono: string;
    };

// Los datos del otro emisor se recuerdan entre usos para no reescribirlos
const CLAVE_GUARDADO = "emisor-otro";

const CAMPOS = ["nombre", "dni", "cuit", "telefono"] as const;

let tipoActual: Emisor["tipo"] = "amw";

function campo(nombre: (typeof CAMPOS)[number]) {
  return document.getElementById(`emisor-${nombre}`) as HTMLInputElement;
}

function mostrarTipo(tipo: Emisor["tipo"]) {
  tipoActual = tipo;

  document
    .querySelectorAll<HTMLButtonElement>(".segmento")
    .forEach((boton) => {
      const activo = boton.dataset.emisor === tipo;
      boton.classList.toggle("activo", activo);
      boton.setAttribute("aria-checked", String(activo));
    });

  (document.getElementById("emisor-campos") as HTMLElement).hidden =
    tipo !== "otro";
}

export function initEmisor() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO) ?? "{}");

    CAMPOS.forEach((nombre) => {
      campo(nombre).value = guardado[nombre] ?? "";
    });
  } catch (e) {
    console.warn("No se pudieron leer los datos guardados del emisor:", e);
  }

  CAMPOS.forEach((nombre) => {
    campo(nombre).addEventListener("input", () => {
      const datos = Object.fromEntries(
        CAMPOS.map((c) => [c, campo(c).value.trim()])
      );
      localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(datos));
    });
  });

  document
    .querySelectorAll<HTMLButtonElement>(".segmento")
    .forEach((boton) => {
      boton.addEventListener("click", () => {
        mostrarTipo(boton.dataset.emisor as Emisor["tipo"]);

        if (tipoActual === "otro" && !campo("nombre").value.trim()) {
          campo("nombre").focus();
        }
      });
    });

  mostrarTipo("amw");
}

// Deja el selector como estaba en un presupuesto guardado (al editarlo o
// duplicarlo). No pisa los datos recordados del "otro emisor" habitual:
// esos solo se guardan cuando se escriben a mano.
export function establecerEmisor(emisor: Emisor) {
  if (emisor.tipo === "otro") {
    campo("nombre").value = emisor.nombre;
    campo("dni").value = emisor.dni;
    campo("cuit").value = emisor.cuit;
    campo("telefono").value = emisor.telefono;
  }

  mostrarTipo(emisor.tipo);
}

export function obtenerEmisor(): Emisor {
  if (tipoActual === "amw") {
    return { tipo: "amw" };
  }

  return {
    tipo: "otro",
    nombre: campo("nombre").value.trim(),
    dni: campo("dni").value.trim(),
    cuit: campo("cuit").value.trim(),
    telefono: campo("telefono").value.trim(),
  };
}

/**
 * El diseño de otro emisor necesita al menos el nombre: sin eso el PDF
 * saldría sin encabezado. Avisa y devuelve false si falta.
 */
export function validarEmisor(emisor: Emisor): boolean {
  if (emisor.tipo === "otro" && !emisor.nombre) {
    mostrarToast("Completá el nombre del emisor del presupuesto", "error");
    campo("nombre").focus();
    return false;
  }

  return true;
}
