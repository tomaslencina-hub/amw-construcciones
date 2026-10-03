export type RespuestaGuardado = "guardar" | "no-guardar" | null;

/**
 * Pregunta, antes de descargar o imprimir, si el presupuesto se guarda en
 * el historial de Clientes. Devuelve null si el usuario cancela (no se
 * descarga ni se imprime nada).
 */
export function preguntarGuardado(
  cliente: string,
  accion: "descargar" | "imprimir"
): Promise<RespuestaGuardado> {
  return new Promise((resolve) => {
    const nombre = cliente.trim();

    const overlay = document.createElement("div");
    overlay.className = "modal";
    overlay.style.display = "block";

    overlay.innerHTML = `
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dialogo-titulo">
        <h2 id="dialogo-titulo">¿Guardar en Clientes?</h2>
        <p class="dialogo-texto"></p>
        <div class="dialogo-acciones">
          <button type="button" class="btn-dialogo-cancelar">Cancelar</button>
          <button type="button" class="btn-dialogo-no">Solo ${accion}</button>
          <button type="button" class="btn-dialogo-si">Guardar y ${accion}</button>
        </div>
      </div>
    `;

    const texto = overlay.querySelector(".dialogo-texto") as HTMLElement;
    const btnCancelar = overlay.querySelector(
      ".btn-dialogo-cancelar"
    ) as HTMLButtonElement;
    const btnNo = overlay.querySelector(".btn-dialogo-no") as HTMLButtonElement;
    const btnSi = overlay.querySelector(".btn-dialogo-si") as HTMLButtonElement;

    // Sin nombre no hay cómo encontrarlo después en el listado
    if (nombre) {
      texto.textContent = `El presupuesto de "${nombre}" va a quedar en el historial de Clientes para verlo o descargarlo más adelante.`;
    } else {
      texto.textContent =
        "Para guardarlo en Clientes, cancelá y completá el nombre del cliente.";
      btnSi.disabled = true;
    }

    const cerrar = (respuesta: RespuestaGuardado) => {
      document.removeEventListener("keydown", alPresionarTecla);
      overlay.remove();
      resolve(respuesta);
    };

    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cerrar(null);
      }
    };

    btnCancelar.addEventListener("click", () => cerrar(null));
    btnNo.addEventListener("click", () => cerrar("no-guardar"));
    btnSi.addEventListener("click", () => cerrar("guardar"));

    // Click afuera del cuadro = cancelar
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cerrar(null);
      }
    });

    document.addEventListener("keydown", alPresionarTecla);
    document.body.appendChild(overlay);

    (btnSi.disabled ? btnNo : btnSi).focus();
  });
}
