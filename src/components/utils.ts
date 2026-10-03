// Para comparar y filtrar texto sin distinguir mayúsculas ni acentos
export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Cada nombre toma siempre el mismo color
const COLORES_AVATAR = ["#e2932f", "#2f8f82", "#16324f", "#b4532a", "#5b6bbf"];

// Cuadradito de color con la inicial (proveedores y clientes)
export function crearAvatar(nombre: string, chico = false) {
  let hash = 0;

  for (const letra of nombre) {
    hash = (hash * 31 + letra.charCodeAt(0)) >>> 0;
  }

  const avatar = document.createElement("span");
  avatar.className = chico
    ? "proveedor-avatar proveedor-avatar-chico"
    : "proveedor-avatar";
  avatar.textContent = nombre.trim().charAt(0).toUpperCase() || "?";
  avatar.style.background = COLORES_AVATAR[hash % COLORES_AVATAR.length];

  return avatar;
}
