import {
  listarProveedores,
  crearProveedor,
  renombrarProveedor,
  eliminarProveedor,
  agregarMaterial,
  actualizarMaterial,
  eliminarMaterial,
  type Proveedor,
  type Material,
  type DatosMaterial,
} from "./db";
import { confirmar, pedirTexto } from "./dialogos";
import { mostrarToast } from "./toast";
import { crearAvatar, normalizar } from "./utils";

const ICONO_EDITAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
`;

const ICONO_BORRAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <line x1="4" y1="7" x2="20" y2="7"></line>
    <path d="M6 7V4h12v3"></path>
    <path d="M6 7l1 13h10l1-13"></path>
  </svg>
`;

const ICONO_GUARDAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
`;

const ICONO_CANCELAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
`;

const ICONO_MAS = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
`;

let proveedores: Proveedor[] = [];
let huboError = false;

// Material que está en modo edición (uno a la vez)
let materialEditando: number | null = null;

// Después de refrescar, deja el cursor listo en el formulario de este
// proveedor (para cargar varios materiales seguidos)
let proveedorAEnfocar: number | null = null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  clase?: string,
  texto?: string
) {
  const elemento = document.createElement(tag);

  if (clase) {
    elemento.className = clase;
  }

  if (texto !== undefined) {
    elemento.textContent = texto;
  }

  return elemento;
}

function botonIcono(clase: string, icono: string, etiqueta: string) {
  const boton = el("button", `btn-icono ${clase}`.trim());
  boton.type = "button";
  boton.innerHTML = icono;
  boton.setAttribute("aria-label", etiqueta);
  boton.title = etiqueta;
  return boton;
}

function precioTexto(material: Material) {
  const precio = `$ ${material.precio.toFixed(2)}`;
  return material.unidad ? `${precio} / ${material.unidad}` : precio;
}

function existeProveedor(nombre: string, exceptoId?: number) {
  return proveedores.some(
    (p) => p.id !== exceptoId && normalizar(p.nombre) === normalizar(nombre)
  );
}

function mostrarErrorGuardado(e: unknown) {
  console.error("No se pudo guardar el cambio en Proveedores:", e);
  mostrarToast("No se pudo guardar el cambio", "error");
}

// --- Formularios de material (agregar y editar comparten campos) ---

function agregarCamposMaterial(form: HTMLFormElement, material?: Material) {
  form.innerHTML = `
    <input name="nombre" class="material-input-nombre" placeholder="Material" aria-label="Material">
    <input name="unidad" class="material-input-unidad" placeholder="Unidad" aria-label="Unidad">
    <input name="precio" type="number" min="0" step="0.01" class="material-input-precio" placeholder="Precio" aria-label="Precio">
  `;

  if (material) {
    campo(form, "nombre").value = material.nombre;
    campo(form, "unidad").value = material.unidad;
    campo(form, "precio").value = String(material.precio);
  }
}

function campo(form: HTMLFormElement, nombre: string) {
  return form.elements.namedItem(nombre) as HTMLInputElement;
}

function leerFormularioMaterial(form: HTMLFormElement): DatosMaterial | null {
  const nombre = campo(form, "nombre").value.trim();
  const unidad = campo(form, "unidad").value.trim();
  const precio = parseFloat(campo(form, "precio").value);

  if (!nombre || isNaN(precio) || precio < 0) {
    mostrarToast("Completá el nombre del material y un precio válido", "error");
    return null;
  }

  return { nombre, unidad, precio };
}

function crearFilaEdicion(material: Material) {
  const form = el("form", "material-form material-form-edicion");
  agregarCamposMaterial(form, material);

  const btnGuardar = botonIcono("btn-icono-guardar", ICONO_GUARDAR, "Guardar");
  btnGuardar.type = "submit";

  const btnCancelar = botonIcono("", ICONO_CANCELAR, "Cancelar");

  form.append(btnGuardar, btnCancelar);

  const cancelar = () => {
    materialEditando = null;
    render();
  };

  btnCancelar.addEventListener("click", cancelar);

  form.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cancelar();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const datos = leerFormularioMaterial(form);

    if (!datos) {
      return;
    }

    try {
      await actualizarMaterial(material.id, datos);
      materialEditando = null;
      await refrescarProveedores();
    } catch (error) {
      mostrarErrorGuardado(error);
    }
  });

  requestAnimationFrame(() => campo(form, "precio").focus());

  return form;
}

function crearFilaMaterial(material: Material) {
  if (material.id === materialEditando) {
    return crearFilaEdicion(material);
  }

  const fila = el("div", "material-fila");

  const info = el("div", "material-info");
  info.append(
    el("span", "material-nombre", material.nombre),
    el(
      "span",
      "material-fecha",
      `Precio al ${material.actualizadoEn.toLocaleDateString("es-AR")}`
    )
  );

  const acciones = el("div", "material-acciones");

  const btnEditar = botonIcono("", ICONO_EDITAR, "Editar material");
  btnEditar.addEventListener("click", () => {
    materialEditando = material.id;
    render();
  });

  const btnBorrar = botonIcono(
    "btn-icono-peligro",
    ICONO_BORRAR,
    "Eliminar material"
  );
  btnBorrar.addEventListener("click", async () => {
    const ok = await confirmar({
      titulo: "¿Eliminar material?",
      texto: `Se va a borrar "${material.nombre}" de este proveedor.`,
      textoBoton: "Eliminar",
      peligro: true,
    });

    if (!ok) {
      return;
    }

    try {
      await eliminarMaterial(material.id);
      await refrescarProveedores();
    } catch (error) {
      mostrarErrorGuardado(error);
    }
  });

  acciones.append(btnEditar, btnBorrar);

  fila.append(
    info,
    el("strong", "material-precio", precioTexto(material)),
    acciones
  );

  return fila;
}

// --- Tarjeta de proveedor ---

function crearTarjeta(proveedor: Proveedor) {
  const tarjeta = el("article", "proveedor-card");
  tarjeta.dataset.id = String(proveedor.id);

  // Encabezado
  const header = el("header", "proveedor-header");

  const titulo = el("div", "proveedor-titulo");
  const cantidad = proveedor.materiales.length;
  titulo.append(
    el("h3", undefined, proveedor.nombre),
    el("span", undefined, `${cantidad} material${cantidad === 1 ? "" : "es"}`)
  );

  const acciones = el("div", "proveedor-acciones");

  const btnRenombrar = botonIcono("", ICONO_EDITAR, "Renombrar proveedor");
  btnRenombrar.addEventListener("click", async () => {
    const nombre = await pedirTexto({
      titulo: "Renombrar proveedor",
      etiqueta: "Nombre de la empresa",
      valor: proveedor.nombre,
      textoBoton: "Guardar",
    });

    if (!nombre || nombre === proveedor.nombre) {
      return;
    }

    if (existeProveedor(nombre, proveedor.id)) {
      mostrarToast(`Ya existe un proveedor llamado "${nombre}"`, "error");
      return;
    }

    try {
      await renombrarProveedor(proveedor.id, nombre);
      await refrescarProveedores();
    } catch (error) {
      mostrarErrorGuardado(error);
    }
  });

  const btnEliminar = botonIcono(
    "btn-icono-peligro",
    ICONO_BORRAR,
    "Eliminar proveedor"
  );
  btnEliminar.addEventListener("click", async () => {
    const ok = await confirmar({
      titulo: `¿Eliminar "${proveedor.nombre}"?`,
      texto:
        cantidad > 0
          ? `También se van a borrar sus ${cantidad} material${cantidad === 1 ? "" : "es"} cargados.`
          : "El proveedor no tiene materiales cargados.",
      textoBoton: "Eliminar",
      peligro: true,
    });

    if (!ok) {
      return;
    }

    try {
      await eliminarProveedor(proveedor.id);
      await refrescarProveedores();
      mostrarToast("Proveedor eliminado");
    } catch (error) {
      mostrarErrorGuardado(error);
    }
  });

  acciones.append(btnRenombrar, btnEliminar);
  header.append(crearAvatar(proveedor.nombre), titulo, acciones);

  // Materiales
  const lista = el("div", "proveedor-materiales");

  if (cantidad === 0) {
    lista.append(
      el(
        "p",
        "proveedor-sin-materiales",
        "Todavía no tiene materiales. Cargá el primero acá abajo."
      )
    );
  } else {
    lista.append(...proveedor.materiales.map(crearFilaMaterial));
  }

  // Alta de material (Enter también agrega)
  const form = el("form", "material-form material-form-nuevo");
  agregarCamposMaterial(form);

  const btnAgregar = botonIcono(
    "btn-agregar-material",
    ICONO_MAS,
    "Agregar material"
  );
  btnAgregar.type = "submit";
  form.append(btnAgregar);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const datos = leerFormularioMaterial(form);

    if (!datos) {
      return;
    }

    try {
      await agregarMaterial(proveedor.id, datos);
      proveedorAEnfocar = proveedor.id;
      await refrescarProveedores();
    } catch (error) {
      mostrarErrorGuardado(error);
    }
  });

  tarjeta.append(header, lista, form);

  return tarjeta;
}

// --- Resultados del buscador de materiales ---

interface Coincidencia {
  material: Material;
  proveedor: Proveedor;
}

function crearGrupoResultado(nombre: string, items: Coincidencia[]) {
  items.sort((a, b) => a.material.precio - b.material.precio);

  // "Mejor precio" solo tiene sentido si todos cotizan en la misma unidad
  const mismaUnidad = items.every(
    (i) => normalizar(i.material.unidad) === normalizar(items[0].material.unidad)
  );
  const marcarMejor = items.length > 1 && mismaUnidad;

  const grupo = el("div", "resultado-grupo");

  const titulo = el("div", "resultado-titulo");
  titulo.append(
    el("strong", undefined, nombre),
    el(
      "span",
      undefined,
      `${items.length} proveedor${items.length === 1 ? "" : "es"}`
    )
  );
  grupo.append(titulo);

  items.forEach((item, index) => {
    const fila = el("button", "resultado-fila");
    fila.type = "button";
    fila.title = `Ver ${item.proveedor.nombre}`;

    fila.append(
      crearAvatar(item.proveedor.nombre, true),
      el("span", "resultado-proveedor", item.proveedor.nombre)
    );

    if (marcarMejor && index === 0) {
      fila.append(el("span", "badge-mejor", "Mejor precio"));
    }

    fila.append(
      el("strong", "resultado-precio", precioTexto(item.material))
    );

    fila.addEventListener("click", () => irAProveedor(item.proveedor.id));

    grupo.append(fila);
  });

  return grupo;
}

// Sale de la búsqueda y lleva a la tarjeta del proveedor, resaltándola
function irAProveedor(id: number) {
  (document.getElementById("buscar-material") as HTMLInputElement).value = "";
  render();

  const tarjeta = document.querySelector<HTMLElement>(
    `.proveedor-card[data-id="${id}"]`
  );

  if (!tarjeta) {
    return;
  }

  tarjeta.scrollIntoView({ behavior: "smooth", block: "center" });
  tarjeta.classList.add("resaltado");
  setTimeout(() => tarjeta.classList.remove("resaltado"), 1600);
}

// --- Render general ---

function render() {
  const buscador = document.getElementById(
    "buscar-material"
  ) as HTMLInputElement;
  const grilla = document.getElementById("proveedores-grid") as HTMLElement;
  const resultados = document.getElementById(
    "proveedores-resultados"
  ) as HTMLElement;
  const vacio = document.getElementById("proveedores-vacio") as HTMLElement;

  const busqueda = normalizar(buscador.value);

  grilla.hidden = busqueda !== "";
  resultados.hidden = busqueda === "";

  if (huboError) {
    grilla.replaceChildren();
    resultados.replaceChildren();
    vacio.textContent = "No se pudo leer el listado de proveedores.";
    vacio.hidden = false;
    return;
  }

  if (!busqueda) {
    grilla.replaceChildren(...proveedores.map(crearTarjeta));

    vacio.textContent =
      'Todavía no cargaste proveedores. Empezá con "+ Nuevo proveedor".';
    vacio.hidden = proveedores.length > 0;
  } else {
    // Agrupa por nombre de material (sin importar mayúsculas ni acentos)
    const grupos = new Map<string, { nombre: string; items: Coincidencia[] }>();

    proveedores.forEach((proveedor) => {
      proveedor.materiales.forEach((material) => {
        const clave = normalizar(material.nombre);

        if (!clave.includes(busqueda)) {
          return;
        }

        if (!grupos.has(clave)) {
          grupos.set(clave, { nombre: material.nombre, items: [] });
        }

        grupos.get(clave)!.items.push({ material, proveedor });
      });
    });

    const ordenados = [...grupos.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    );

    resultados.replaceChildren(
      ...ordenados.map(([, g]) => crearGrupoResultado(g.nombre, g.items))
    );

    vacio.textContent = `Ningún proveedor tiene un material que coincida con "${buscador.value.trim()}".`;
    vacio.hidden = grupos.size > 0;
  }

  if (proveedorAEnfocar !== null) {
    const tarjeta = grilla.querySelector<HTMLElement>(
      `.proveedor-card[data-id="${proveedorAEnfocar}"]`
    );

    proveedorAEnfocar = null;

    tarjeta?.scrollIntoView({ block: "nearest" });
    tarjeta
      ?.querySelector<HTMLInputElement>(".material-form-nuevo .material-input-nombre")
      ?.focus();
  }
}

export async function refrescarProveedores() {
  try {
    proveedores = await listarProveedores();
    huboError = false;
  } catch (e) {
    console.error("No se pudo leer el listado de proveedores:", e);
    proveedores = [];
    huboError = true;
  }

  render();
}

async function nuevoProveedor() {
  const nombre = await pedirTexto({
    titulo: "Nuevo proveedor",
    etiqueta: "Nombre de la empresa",
    placeholder: "Ej: Electroluz",
    textoBoton: "Crear proveedor",
  });

  if (!nombre) {
    return;
  }

  if (existeProveedor(nombre)) {
    mostrarToast(`Ya existe un proveedor llamado "${nombre}"`, "error");
    return;
  }

  try {
    const id = await crearProveedor(nombre);

    // Si había una búsqueda activa, se limpia para ver la tarjeta nueva
    (document.getElementById("buscar-material") as HTMLInputElement).value =
      "";

    proveedorAEnfocar = id;
    await refrescarProveedores();
  } catch (error) {
    mostrarErrorGuardado(error);
  }
}

export function initProveedores() {
  document
    .getElementById("buscar-material")
    ?.addEventListener("input", render);

  document
    .getElementById("btn-nuevo-proveedor")
    ?.addEventListener("click", nuevoProveedor);

  refrescarProveedores();
}
