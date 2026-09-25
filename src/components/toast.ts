const ICONO_CHECK = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
`;

const ICONO_ERROR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="8" x2="12" y2="13" />
    <line x1="12" y1="16.5" x2="12" y2="16.51" />
    <circle cx="12" cy="12" r="9" />
  </svg>
`;

export function mostrarToast(
  mensaje: string,
  tipo: "exito" | "error" = "exito"
) {
  let contenedor = document.getElementById("toast-container");

  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "toast-container";
    document.body.appendChild(contenedor);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `
    ${tipo === "error" ? ICONO_ERROR : ICONO_CHECK}
    <span>${mensaje}</span>
  `;

  contenedor.appendChild(toast);

  // Fuerza el reflow para que la transición de entrada se dispare
  requestAnimationFrame(() => {
    toast.classList.add("toast-visible");
  });

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}
