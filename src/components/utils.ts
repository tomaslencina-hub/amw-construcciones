// Para comparar y filtrar texto sin distinguir mayúsculas ni acentos
export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Número de presupuesto con ceros adelante: 12 → "0012"
export function formatearNumero(numero: number) {
  return String(numero).padStart(4, "0");
}

const SUPERINDICES: Record<string, string> = { "2": "²", "3": "³" };

// Escribe las unidades de superficie y volumen con superíndice:
// "m2" → "m²", "M3" → "m³", "cm2" → "cm²", "mts2" → "m²", "m^2" → "m²".
export function formatearUnidad(texto: string) {
  return texto.replace(
    /\b(mm|cm|dm|km|mts?|m)\^?([23])\b/gi,
    (_, base: string, exponente: string) => {
      const unidad = base.toLowerCase().startsWith("mt")
        ? "m"
        : base.toLowerCase();
      return unidad + SUPERINDICES[exponente];
    }
  );
}

// Aplica formatearUnidad mientras se escribe en un campo de unidad
export function autoformatearUnidad(input: HTMLInputElement) {
  input.addEventListener("input", () => {
    const formateado = formatearUnidad(input.value);

    if (formateado !== input.value) {
      input.value = formateado;
    }
  });
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
