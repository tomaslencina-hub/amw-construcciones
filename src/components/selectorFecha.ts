// Calendario propio para la fecha del presupuesto. Reemplaza al del
// navegador, que no se puede estilizar. El valor se sigue guardando en el
// input oculto #fecha como "aaaa-mm-dd", igual que el input de fecha nativo.

const ICONO_CALENDARIO = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <line x1="3.5" y1="10" x2="20.5" y2="10" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="16" y1="3" x2="16" y2="7" />
  </svg>
`;

const ICONO_ANTERIOR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 6l-6 6 6 6" />
  </svg>
`;

const ICONO_SIGUIENTE = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
`;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// La semana arranca el lunes, como se usa en Argentina
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const ALTO_CALENDARIO = 390;

let input: HTMLInputElement;
let disparador: HTMLButtonElement;
let textoDisparador: HTMLElement;
let panel: HTMLElement;
let tituloMes: HTMLElement;
let grilla: HTMLElement;

// Mes que se está mostrando (no necesariamente el de la fecha elegida)
let mesVisible = new Date();

function aTexto(fecha: Date) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function desdeTexto(valor: string): Date | null {
  const [anio, mes, dia] = valor.split("-").map(Number);
  return anio && mes && dia ? new Date(anio, mes - 1, dia) : null;
}

function mismoDia(a: Date, b: Date) {
  return aTexto(a) === aTexto(b);
}

function mostrarValor() {
  const fecha = desdeTexto(input.value);

  // "Viernes, 6 de noviembre de 2026"
  const texto = fecha?.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  textoDisparador.textContent = texto
    ? texto.charAt(0).toUpperCase() + texto.slice(1)
    : "Elegir fecha";

  disparador.classList.toggle("vacio", !fecha);
}

function dibujarMes() {
  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();
  const elegida = desdeTexto(input.value);
  const hoy = new Date();

  tituloMes.textContent = `${MESES[mes]} ${anio}`;

  // Arranca en el lunes de la semana del día 1 y completa 6 semanas, así
  // el calendario mide siempre lo mismo.
  const primero = new Date(anio, mes, 1);
  const desfase = (primero.getDay() + 6) % 7;
  const inicio = new Date(anio, mes, 1 - desfase);

  const dias: HTMLButtonElement[] = [];

  for (let i = 0; i < 42; i++) {
    const fecha = new Date(
      inicio.getFullYear(),
      inicio.getMonth(),
      inicio.getDate() + i
    );

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "calendario-dia";
    boton.textContent = String(fecha.getDate());
    boton.dataset.fecha = aTexto(fecha);
    boton.tabIndex = -1;

    boton.classList.toggle("otro-mes", fecha.getMonth() !== mes);
    boton.classList.toggle("hoy", mismoDia(fecha, hoy));

    if (elegida && mismoDia(fecha, elegida)) {
      boton.classList.add("elegido");
      boton.setAttribute("aria-pressed", "true");
    }

    dias.push(boton);
  }

  grilla.replaceChildren(...dias);

  // Un solo día entra con Tab; dentro de la grilla se mueve con las flechas
  const enfocable =
    dias.find((d) => d.classList.contains("elegido")) ??
    dias.find((d) => d.classList.contains("hoy") && !d.classList.contains("otro-mes")) ??
    dias.find((d) => !d.classList.contains("otro-mes"));

  if (enfocable) {
    enfocable.tabIndex = 0;
  }
}

function cambiarMes(delta: number) {
  mesVisible = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + delta, 1);
  dibujarMes();
}

function elegir(valor: string) {
  input.value = valor;
  mostrarValor();
  cerrar();
  disparador.focus();
}

function ubicarPanel() {
  // Se posiciona sobre la pantalla (fixed) porque la columna derecha
  // scrollea por dentro y recortaría el calendario.
  const rect = disparador.getBoundingClientRect();
  const entraAbajo = rect.bottom + 8 + ALTO_CALENDARIO <= window.innerHeight;

  panel.style.left = `${rect.left}px`;
  panel.style.top = entraAbajo
    ? `${rect.bottom + 8}px`
    : `${Math.max(8, rect.top - 8 - ALTO_CALENDARIO)}px`;
}

function abrir() {
  const elegida = desdeTexto(input.value) ?? new Date();
  mesVisible = new Date(elegida.getFullYear(), elegida.getMonth(), 1);

  dibujarMes();
  ubicarPanel();
  panel.hidden = false;
  disparador.setAttribute("aria-expanded", "true");

  grilla.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();

  document.addEventListener("mousedown", alClickearAfuera, true);
  document.addEventListener("keydown", alPresionarTecla);
  window.addEventListener("resize", cerrar);
  document.addEventListener("scroll", alScrollear, true);
}

function cerrar() {
  if (panel.hidden) {
    return;
  }

  panel.hidden = true;
  disparador.setAttribute("aria-expanded", "false");

  document.removeEventListener("mousedown", alClickearAfuera, true);
  document.removeEventListener("keydown", alPresionarTecla);
  window.removeEventListener("resize", cerrar);
  document.removeEventListener("scroll", alScrollear, true);
}

function alClickearAfuera(e: MouseEvent) {
  const objetivo = e.target as Node;

  if (!panel.contains(objetivo) && !disparador.contains(objetivo)) {
    cerrar();
  }
}

function alScrollear(e: Event) {
  if (!panel.contains(e.target as Node)) {
    cerrar();
  }
}

function alPresionarTecla(e: KeyboardEvent) {
  if (e.key === "Escape") {
    cerrar();
    disparador.focus();
    return;
  }

  const actual = document.activeElement as HTMLElement | null;

  if (!actual?.classList.contains("calendario-dia")) {
    return;
  }

  const saltos: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  };

  const salto = saltos[e.key];

  if (salto === undefined) {
    return;
  }

  e.preventDefault();

  const fecha = desdeTexto(actual.dataset.fecha ?? "");

  if (!fecha) {
    return;
  }

  fecha.setDate(fecha.getDate() + salto);

  if (fecha.getMonth() !== mesVisible.getMonth()) {
    mesVisible = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    dibujarMes();
  }

  grilla
    .querySelectorAll<HTMLButtonElement>(".calendario-dia")
    .forEach((d) => (d.tabIndex = -1));

  const destino = grilla.querySelector<HTMLButtonElement>(
    `[data-fecha="${aTexto(fecha)}"]`
  );

  if (destino) {
    destino.tabIndex = 0;
    destino.focus();
  }
}

export function initSelectorFecha() {
  input = document.getElementById("fecha") as HTMLInputElement;
  const contenedor = document.getElementById("selector-fecha") as HTMLElement;

  contenedor.innerHTML = `
    <button type="button" class="selector-fecha-disparador" aria-haspopup="dialog" aria-expanded="false">
      <span class="selector-fecha-texto"></span>
      ${ICONO_CALENDARIO}
    </button>

    <div class="calendario" role="dialog" aria-label="Elegir fecha" hidden>
      <div class="calendario-encabezado">
        <span class="calendario-titulo"></span>
        <div class="calendario-navegacion">
          <button type="button" class="calendario-flecha" data-delta="-1" aria-label="Mes anterior">${ICONO_ANTERIOR}</button>
          <button type="button" class="calendario-flecha" data-delta="1" aria-label="Mes siguiente">${ICONO_SIGUIENTE}</button>
        </div>
      </div>

      <div class="calendario-semana">
        ${DIAS_SEMANA.map((d) => `<span>${d}</span>`).join("")}
      </div>

      <div class="calendario-grilla"></div>

      <div class="calendario-pie">
        <button type="button" class="calendario-accion" data-accion="borrar">Borrar</button>
        <button type="button" class="calendario-accion calendario-hoy" data-accion="hoy">Hoy</button>
      </div>
    </div>
  `;

  disparador = contenedor.querySelector(".selector-fecha-disparador") as HTMLButtonElement;
  textoDisparador = contenedor.querySelector(".selector-fecha-texto") as HTMLElement;
  panel = contenedor.querySelector(".calendario") as HTMLElement;
  tituloMes = contenedor.querySelector(".calendario-titulo") as HTMLElement;
  grilla = contenedor.querySelector(".calendario-grilla") as HTMLElement;

  disparador.addEventListener("click", () => {
    if (panel.hidden) {
      abrir();
    } else {
      cerrar();
    }
  });

  contenedor.querySelectorAll<HTMLButtonElement>(".calendario-flecha").forEach((boton) => {
    boton.addEventListener("click", () => cambiarMes(Number(boton.dataset.delta)));
  });

  grilla.addEventListener("click", (e) => {
    const dia = (e.target as HTMLElement).closest<HTMLButtonElement>(".calendario-dia");

    if (dia?.dataset.fecha) {
      elegir(dia.dataset.fecha);
    }
  });

  contenedor.querySelector('[data-accion="hoy"]')?.addEventListener("click", () => {
    elegir(aTexto(new Date()));
  });

  contenedor.querySelector('[data-accion="borrar"]')?.addEventListener("click", () => {
    elegir("");
  });

  mostrarValor();
}

// Para cargar la fecha desde afuera (limpiar, editar o duplicar): cambia el
// valor y actualiza lo que se ve en el botón.
export function establecerFecha(valor: string) {
  input.value = valor;
  mostrarValor();
}
