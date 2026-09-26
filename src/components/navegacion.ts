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
