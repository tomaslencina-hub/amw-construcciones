export interface ItemPresupuesto {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio: number;
  total: number;
}

export interface DatosPresupuesto {
  cliente: string;
  fecha: string;
  manoObra: ItemPresupuesto[];
  materiales: ItemPresupuesto[];
  observaciones: string;
  subtotalMano: number;
  subtotalMateriales: number;
  totalGeneral: number;
}

const ICONO_BORRAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <line x1="4" y1="7" x2="20" y2="7"></line>
    <path d="M6 7V4h12v3"></path>
    <path d="M6 7l1 13h10l1-13"></path>
  </svg>
`;

export function initFormulario() {
  const containerManoObra = document.getElementById(
    "tabla-mano-obra"
  ) as HTMLElement;

  const containerMateriales = document.getElementById(
    "tabla-materiales"
  ) as HTMLElement;

  function actualizarTotales() {
    let subtotalMano = 0;
    let subtotalMateriales = 0;

    containerManoObra
      .querySelectorAll(".input-total")
      .forEach((input) => {
        subtotalMano += parseFloat(
          (input as HTMLInputElement).value
        ) || 0;
      });

    containerMateriales
      .querySelectorAll(".input-total")
      .forEach((input) => {
        subtotalMateriales += parseFloat(
          (input as HTMLInputElement).value
        ) || 0;
      });

    const totalGeneral =
      subtotalMano + subtotalMateriales;

    (
      document.getElementById(
        "sub-mano"
      ) as HTMLElement
    ).textContent =
      `$ ${subtotalMano.toFixed(2)}`;

    (
      document.getElementById(
        "sub-materiales"
      ) as HTMLElement
    ).textContent =
      `$ ${subtotalMateriales.toFixed(2)}`;

    (
      document.getElementById(
        "total-final"
      ) as HTMLElement
    ).textContent =
      `$ ${totalGeneral.toFixed(2)}`;
  }

  function crearFila() {
    const div = document.createElement("div");

    div.className = "fila-presupuesto";

    div.innerHTML = `
      <input
        type="text"
        class="input-descripcion"
        placeholder="Descripción"
      >

      <input
        type="number"
        class="input-cant"
        placeholder="0"
        min="0"
      >

      <input
        type="text"
        class="input-unidad"
        placeholder="un"
      >

      <input
        type="number"
        class="input-precio"
        placeholder="0"
        min="0"
      >

      <input
        type="number"
        class="input-total"
        readonly
      >

      <button
        type="button"
        class="btn-delete"
        aria-label="Eliminar fila"
      >
        ${ICONO_BORRAR}
      </button>
    `;

    const cant = div.querySelector(
      ".input-cant"
    ) as HTMLInputElement;

    const precio = div.querySelector(
      ".input-precio"
    ) as HTMLInputElement;

    const total = div.querySelector(
      ".input-total"
    ) as HTMLInputElement;

    const btnDelete = div.querySelector(
      ".btn-delete"
    ) as HTMLButtonElement;

    const calcular = () => {
      const cantidad =
        parseFloat(cant.value) || 0;

      const precioUnitario =
        parseFloat(precio.value) || 0;

      total.value = (
        cantidad * precioUnitario
      ).toFixed(2);

      actualizarTotales();
    };

    cant.addEventListener("input", calcular);

    precio.addEventListener(
      "input",
      calcular
    );

    btnDelete.addEventListener(
      "click",
      () => {
        div.remove();
        actualizarTotales();
      }
    );

    return div;
  }

  document
    .getElementById("add-mano-obra")
    ?.addEventListener("click", () => {
      containerManoObra.appendChild(
        crearFila()
      );
    });

  document
    .getElementById("add-materiales")
    ?.addEventListener("click", () => {
      containerMateriales.appendChild(
        crearFila()
      );
    });

  // Agrega una fila inicial
  containerManoObra.appendChild(
    crearFila()
  );

  containerMateriales.appendChild(
    crearFila()
  );

  actualizarTotales();
}

export function obtenerDatosPresupuesto(): DatosPresupuesto {
  const obtenerItems = (
    containerId: string
  ): ItemPresupuesto[] => {
    const filas = document.querySelectorAll(
      `#${containerId} .fila-presupuesto`
    );

    return Array.from(filas).map((fila) => {
      return {
        descripcion: (
          fila.querySelector(
            ".input-descripcion"
          ) as HTMLInputElement
        ).value,

        cantidad:
          parseFloat(
            (
              fila.querySelector(
                ".input-cant"
              ) as HTMLInputElement
            ).value
          ) || 0,

        unidad: (
          fila.querySelector(
            ".input-unidad"
          ) as HTMLInputElement
        ).value,

        precio:
          parseFloat(
            (
              fila.querySelector(
                ".input-precio"
              ) as HTMLInputElement
            ).value
          ) || 0,

        total:
          parseFloat(
            (
              fila.querySelector(
                ".input-total"
              ) as HTMLInputElement
            ).value
          ) || 0,
      };
    });
  };

  const manoObra = obtenerItems(
    "tabla-mano-obra"
  );

  const materiales = obtenerItems(
    "tabla-materiales"
  );

  const subtotalMano = manoObra.reduce(
    (acc, item) => acc + item.total,
    0
  );

  const subtotalMateriales =
    materiales.reduce(
      (acc, item) => acc + item.total,
      0
    );

  return {
    cliente: (
      document.getElementById(
        "cliente"
      ) as HTMLInputElement
    ).value,

    fecha: (
      document.getElementById(
        "fecha"
      ) as HTMLInputElement
    ).value,

    observaciones: (
        document.getElementById(
            "observaciones"
        ) as HTMLTextAreaElement
    ).value,

    manoObra,

    materiales,

    subtotalMano,

    subtotalMateriales,

    totalGeneral:
      subtotalMano +
      subtotalMateriales,
  };
}
