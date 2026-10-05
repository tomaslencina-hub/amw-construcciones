export function initNavegacion() {
  const botones = document.querySelectorAll<HTMLButtonElement>(".nav-item");
  const vistas = document.querySelectorAll<HTMLElement>(".view");

  botones.forEach((boton) => {
    boton.addEventListener("click", () => {
      const destino = boton.dataset.view;

      botones.forEach((b) => b.classList.remove("active"));
      boton.classList.add("active");

      vistas.forEach((vista) => {
        vista.hidden = vista.id !== `view-${destino}`;
      });
    });
  });
}

// Cambia de vista desde el código (igual que tocar el botón del menú)
export function irAVista(vista: "presupuesto" | "clientes" | "proveedores") {
  document
    .querySelector<HTMLButtonElement>(`.nav-item[data-view="${vista}"]`)
    ?.click();
}
