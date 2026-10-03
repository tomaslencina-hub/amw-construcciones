interface OpcionesDialogo {
  titulo: string;
  texto?: string;
  textoBoton: string;
  peligro?: boolean;
  campo?: {
    etiqueta: string;
    valor?: string;
    placeholder?: string;
  };
}

// Devuelve null si se cancela; si no, el texto del campo ("" si no tiene).
function abrirDialogo(opciones: OpcionesDialogo): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal";
    overlay.style.display = "block";

    overlay.innerHTML = `
      <form class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dialogo-titulo">
        <h2 id="dialogo-titulo"></h2>
        <p class="dialogo-texto" hidden></p>
        <label class="dialogo-campo" hidden>
          <span></span>
          <input type="text">
        </label>
        <div class="dialogo-acciones">
          <button type="button" class="btn-dialogo-cancelar">Cancelar</button>
          <button type="submit" class="${opciones.peligro ? "btn-dialogo-peligro" : "btn-dialogo-si"}"></button>
        </div>
      </form>
    `;

    const form = overlay.querySelector(".dialogo") as HTMLFormElement;
    const texto = overlay.querySelector(".dialogo-texto") as HTMLElement;
    const campo = overlay.querySelector(".dialogo-campo") as HTMLElement;
    const input = campo.querySelector("input") as HTMLInputElement;
    const btnCancelar = overlay.querySelector(
      ".btn-dialogo-cancelar"
    ) as HTMLButtonElement;
    const btnAceptar = overlay.querySelector(
      "button[type=submit]"
    ) as HTMLButtonElement;

    (overlay.querySelector("h2") as HTMLElement).textContent = opciones.titulo;
    btnAceptar.textContent = opciones.textoBoton;

    if (opciones.texto) {
      texto.textContent = opciones.texto;
      texto.hidden = false;
    }

    if (opciones.campo) {
      campo.hidden = false;
      (campo.querySelector("span") as HTMLElement).textContent =
        opciones.campo.etiqueta;
      input.value = opciones.campo.valor ?? "";
      input.placeholder = opciones.campo.placeholder ?? "";

      // No se puede aceptar con el campo vacío
      const actualizarBoton = () => {
        btnAceptar.disabled = !input.value.trim();
      };
      input.addEventListener("input", actualizarBoton);
      actualizarBoton();
    }

    const cerrar = (respuesta: string | null) => {
      document.removeEventListener("keydown", alPresionarTecla);
      overlay.remove();
      resolve(respuesta);
    };

    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cerrar(null);
      }
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!btnAceptar.disabled) {
        cerrar(opciones.campo ? input.value.trim() : "");
      }
    });

    btnCancelar.addEventListener("click", () => cerrar(null));

    // Click afuera del cuadro = cancelar
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cerrar(null);
      }
    });

    document.addEventListener("keydown", alPresionarTecla);
    document.body.appendChild(overlay);

    if (opciones.campo) {
      input.focus();
      input.select();
    } else {
      btnAceptar.focus();
    }
  });
}

export async function confirmar(opciones: {
  titulo: string;
  texto: string;
  textoBoton: string;
  peligro?: boolean;
}): Promise<boolean> {
  return (await abrirDialogo(opciones)) !== null;
}

export function pedirTexto(opciones: {
  titulo: string;
  etiqueta: string;
  textoBoton: string;
  valor?: string;
  placeholder?: string;
}): Promise<string | null> {
  return abrirDialogo({
    titulo: opciones.titulo,
    textoBoton: opciones.textoBoton,
    campo: {
      etiqueta: opciones.etiqueta,
      valor: opciones.valor,
      placeholder: opciones.placeholder,
    },
  });
}
