import { listarPresupuestos, type PresupuestoGuardado } from "./db";
import { normalizar } from "./utils";

type Periodo = "anio" | "12m" | "todo";

// Colores de las series (validados para daltonismo). El color sigue a la
// serie: "Presupuestado" siempre azul, "Aceptado" siempre naranja.
const COLOR_PRESUPUESTADO = "#3f6fa8";
const COLOR_ACEPTADO = "#e2932f";
const COLOR_MATERIALES = "#a9c0dc";

// En "Todo", el gráfico muestra como mucho los últimos 24 meses
const MAX_MESES_GRAFICO = 24;
const MAX_CLIENTES = 5;

const NOMBRES_MES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

let presupuestos: PresupuestoGuardado[] = [];
let periodo: Periodo = "anio";
let huboError = false;

// --- Formatos ---

const formatoCompacto = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// $ 2,2 M / $ 464 mil
function montoCompacto(monto: number) {
  return `$ ${formatoCompacto.format(monto)}`;
}

// $ 2.203.163,00
function montoCompleto(monto: number) {
  return `$ ${monto.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function plural(cantidad: number, singular: string) {
  return `${cantidad} ${singular}${cantidad === 1 ? "" : "s"}`;
}

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

// --- Tooltip (uno solo, compartido por todos los gráficos) ---

interface FilaTooltip {
  color?: string;
  etiqueta: string;
  valor: string;
}

let tooltip: HTMLElement | null = null;

function mostrarTooltip(
  titulo: string,
  filas: FilaTooltip[],
  x: number,
  y: number
) {
  if (!tooltip) {
    tooltip = el("div", "grafico-tooltip");
    tooltip.setAttribute("role", "status");
    document.body.appendChild(tooltip);
  }

  tooltip.replaceChildren(el("div", "grafico-tooltip-titulo", titulo));

  filas.forEach((fila) => {
    const linea = el("div", "grafico-tooltip-fila");

    if (fila.color) {
      const clave = el("span", "grafico-tooltip-clave");
      clave.style.background = fila.color;
      linea.append(clave);
    }

    linea.append(
      el("span", "grafico-tooltip-etiqueta", fila.etiqueta),
      el("strong", undefined, fila.valor)
    );
    tooltip!.append(linea);
  });

  tooltip.hidden = false;

  // Al lado del puntero, sin salirse de la ventana
  const ancho = tooltip.offsetWidth;
  const alto = tooltip.offsetHeight;
  const izquierda = Math.min(x + 14, window.innerWidth - ancho - 8);
  const arriba = Math.max(8, Math.min(y - alto - 10, window.innerHeight - alto - 8));

  tooltip.style.left = `${Math.max(8, izquierda)}px`;
  tooltip.style.top = `${arriba}px`;
}

function ocultarTooltip() {
  if (tooltip) {
    tooltip.hidden = true;
  }
}

// El mismo detalle con el mouse y con el teclado (foco)
function conectarTooltip(
  elemento: HTMLElement,
  titulo: string,
  filas: FilaTooltip[]
) {
  elemento.tabIndex = 0;

  elemento.addEventListener("pointermove", (e) => {
    mostrarTooltip(titulo, filas, e.clientX, e.clientY);
  });
  elemento.addEventListener("pointerleave", ocultarTooltip);

  elemento.addEventListener("focus", () => {
    const caja = elemento.getBoundingClientRect();
    mostrarTooltip(titulo, filas, caja.left + caja.width / 2, caja.top);
  });
  elemento.addEventListener("blur", ocultarTooltip);
}

// --- Cálculo ---

interface DatosMes {
  anio: number;
  mes: number;
  cantidad: number;
  presupuestado: number;
  aceptado: number;
}

function inicioDelPeriodo(): Date | null {
  const hoy = new Date();

  if (periodo === "anio") {
    return new Date(hoy.getFullYear(), 0, 1);
  }

  if (periodo === "12m") {
    return new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
  }

  return null;
}

// Un casillero por cada mes del período, aunque no tenga presupuestos
function agruparPorMes(
  lista: PresupuestoGuardado[],
  inicio: Date | null
): DatosMes[] {
  const hoy = new Date();

  const primero =
    inicio ??
    lista.reduce(
      (min, p) => (p.creadoEn < min ? p.creadoEn : min),
      hoy
    );

  const meses: DatosMes[] = [];
  const cursor = new Date(primero.getFullYear(), primero.getMonth(), 1);

  while (cursor <= hoy) {
    meses.push({
      anio: cursor.getFullYear(),
      mes: cursor.getMonth(),
      cantidad: 0,
      presupuestado: 0,
      aceptado: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const porClave = new Map(meses.map((m) => [`${m.anio}-${m.mes}`, m]));

  lista.forEach((p) => {
    const mes = porClave.get(
      `${p.creadoEn.getFullYear()}-${p.creadoEn.getMonth()}`
    );

    if (!mes) {
      return;
    }

    mes.cantidad += 1;
    mes.presupuestado += p.total;

    if (p.estado === "aceptado") {
      mes.aceptado += p.total;
    }
  });

  return meses;
}

// Tope y marcas del eje en números redondos (0 / 500 mil / 1 M ...)
function escalaRedonda(maximo: number) {
  if (maximo <= 0) {
    return { tope: 1, marcas: [0] };
  }

  const crudo = maximo / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const n = crudo / potencia;
  const paso = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * potencia;
  const tope = Math.ceil(maximo / paso) * paso;

  const marcas: number[] = [];

  for (let v = 0; v <= tope + paso / 2; v += paso) {
    marcas.push(v);
  }

  return { tope, marcas };
}

// --- Indicadores ---

function crearIndicador(etiqueta: string, valor: string, detalle: string, titulo?: string) {
  const tarjeta = el("div", "kpi");
  const numero = el("strong", "kpi-valor", valor);

  if (titulo) {
    numero.title = titulo;
  }

  tarjeta.append(
    el("span", "kpi-etiqueta", etiqueta),
    numero,
    el("span", "kpi-detalle", detalle)
  );

  return tarjeta;
}

function renderIndicadores(lista: PresupuestoGuardado[]) {
  const suma = (items: PresupuestoGuardado[]) =>
    items.reduce((acc, p) => acc + p.total, 0);

  const aceptados = lista.filter((p) => p.estado === "aceptado");
  const rechazados = lista.filter((p) => p.estado === "rechazado");
  const pendientes = lista.filter((p) => p.estado === "pendiente");
  const conRespuesta = aceptados.length + rechazados.length;

  const tasa =
    conRespuesta > 0
      ? `${Math.round((aceptados.length / conRespuesta) * 100)} %`
      : "—";

  (document.getElementById("kpis") as HTMLElement).replaceChildren(
    crearIndicador(
      "Presupuestado",
      montoCompacto(suma(lista)),
      plural(lista.length, "presupuesto"),
      montoCompleto(suma(lista))
    ),
    crearIndicador(
      "Aceptado",
      montoCompacto(suma(aceptados)),
      plural(aceptados.length, "presupuesto"),
      montoCompleto(suma(aceptados))
    ),
    crearIndicador(
      "Tasa de cierre",
      tasa,
      conRespuesta > 0
        ? `${aceptados.length} de ${conRespuesta} con respuesta`
        : "Todavía no hay respuestas marcadas"
    ),
    crearIndicador(
      "Esperando respuesta",
      montoCompacto(suma(pendientes)),
      plural(pendientes.length, "presupuesto"),
      montoCompleto(suma(pendientes))
    )
  );
}

// --- Gráfico por mes ---

function etiquetaMes(mes: DatosMes, conAnio: boolean) {
  const nombre = NOMBRES_MES[mes.mes];
  return conAnio ? `${nombre} ${String(mes.anio).slice(2)}` : nombre;
}

function renderGraficoMeses(meses: DatosMes[]) {
  const grafico = document.getElementById("grafico-meses") as HTMLElement;
  const visibles = meses.slice(-MAX_MESES_GRAFICO);

  const maximo = Math.max(...visibles.map((m) => m.presupuestado), 0);
  const { tope, marcas } = escalaRedonda(maximo);

  // Eje Y y grilla (líneas finas y lisas)
  const ejeY = el("div", "grafico-eje-y");
  const plot = el("div", "grafico-plot");

  marcas.forEach((marca) => {
    const porcentaje = (marca / tope) * 100;

    const etiqueta = el("span", undefined, marca === 0 ? "0" : montoCompacto(marca));
    etiqueta.style.bottom = `${porcentaje}%`;
    ejeY.append(etiqueta);

    const linea = el("div", "grafico-grilla");
    linea.style.bottom = `${porcentaje}%`;
    plot.append(linea);
  });

  // Columnas: dos barras finas por mes
  const columnas = el("div", "grafico-columnas");
  const ejeX = el("div", "grafico-eje-x");

  const altura = (valor: number) =>
    valor > 0 ? `max(2px, ${(valor / tope) * 100}%)` : "0";

  visibles.forEach((mes, i) => {
    const grupo = el("div", "grafico-mes");

    const barraPresupuestado = el("div", "grafico-barra");
    barraPresupuestado.style.height = altura(mes.presupuestado);
    barraPresupuestado.style.background = COLOR_PRESUPUESTADO;

    const barraAceptado = el("div", "grafico-barra");
    barraAceptado.style.height = altura(mes.aceptado);
    barraAceptado.style.background = COLOR_ACEPTADO;

    grupo.append(barraPresupuestado, barraAceptado);

    const titulo = `${NOMBRES_MES[mes.mes]} ${mes.anio} · ${plural(mes.cantidad, "presupuesto")}`;
    grupo.setAttribute(
      "aria-label",
      `${titulo}. Presupuestado ${montoCompleto(mes.presupuestado)}, aceptado ${montoCompleto(mes.aceptado)}`
    );

    conectarTooltip(grupo, titulo, [
      {
        color: COLOR_PRESUPUESTADO,
        etiqueta: "Presupuestado",
        valor: montoCompleto(mes.presupuestado),
      },
      {
        color: COLOR_ACEPTADO,
        etiqueta: "Aceptado",
        valor: montoCompleto(mes.aceptado),
      },
    ]);

    columnas.append(grupo);

    // El año se aclara en el primer mes y en cada enero
    ejeX.append(el("span", undefined, etiquetaMes(mes, i === 0 || mes.mes === 0)));
  });

  plot.append(columnas);
  grafico.replaceChildren(ejeY, plot, el("div"), ejeX);

  // Tabla equivalente (todos los meses del período)
  const tabla = el("table", "tabla-estadisticas");
  const encabezado = el("tr");
  ["Mes", "Presupuestos", "Presupuestado", "Aceptado"].forEach((titulo) =>
    encabezado.append(el("th", undefined, titulo))
  );
  tabla.append(encabezado);

  [...meses].reverse().forEach((mes) => {
    const fila = el("tr");
    fila.append(
      el("td", undefined, `${NOMBRES_MES[mes.mes]} ${mes.anio}`),
      el("td", undefined, String(mes.cantidad)),
      el("td", undefined, montoCompleto(mes.presupuestado)),
      el("td", undefined, montoCompleto(mes.aceptado))
    );
    tabla.append(fila);
  });

  (document.getElementById("tabla-meses") as HTMLElement).replaceChildren(tabla);
}

// --- Mano de obra y materiales (parte de un total) ---

function renderComposicion(lista: PresupuestoGuardado[]) {
  const contenedor = document.getElementById("composicion") as HTMLElement;

  const mano = lista.reduce((acc, p) => acc + p.datos.subtotalMano, 0);
  const materiales = lista.reduce(
    (acc, p) => acc + p.datos.subtotalMateriales,
    0
  );
  const total = mano + materiales;

  if (total <= 0) {
    contenedor.replaceChildren(
      el("p", "estadisticas-sin-datos", "Sin montos cargados en este período.")
    );
    return;
  }

  const partes = [
    { etiqueta: "Mano de obra", monto: mano, color: COLOR_PRESUPUESTADO },
    { etiqueta: "Materiales", monto: materiales, color: COLOR_MATERIALES },
  ];

  const barra = el("div", "composicion-barra");
  const detalle = el("div", "composicion-detalle");

  partes.forEach((parte) => {
    const porcentaje = (parte.monto / total) * 100;
    const texto = `${Math.round(porcentaje)} %`;

    if (parte.monto > 0) {
      const segmento = el("div", "composicion-segmento");
      segmento.style.flexGrow = String(parte.monto);
      segmento.style.background = parte.color;
      conectarTooltip(segmento, parte.etiqueta, [
        { etiqueta: texto, valor: montoCompleto(parte.monto) },
      ]);
      barra.append(segmento);
    }

    // Etiquetas directas: nombre, porcentaje y monto junto a su color
    const fila = el("div", "composicion-fila");
    const muestra = el("span", "leyenda-muestra");
    muestra.style.background = parte.color;

    fila.append(
      muestra,
      el("span", "composicion-etiqueta", parte.etiqueta),
      el("strong", undefined, texto),
      el("span", "composicion-monto", montoCompleto(parte.monto))
    );
    detalle.append(fila);
  });

  contenedor.replaceChildren(barra, detalle);
}

// --- Clientes más presupuestados ---

function renderTopClientes(lista: PresupuestoGuardado[]) {
  const contenedor = document.getElementById("top-clientes") as HTMLElement;

  const grupos = new Map<
    string,
    { nombre: string; total: number; aceptado: number; cantidad: number }
  >();

  lista.forEach((p) => {
    const clave = normalizar(p.cliente);

    if (!grupos.has(clave)) {
      grupos.set(clave, { nombre: p.cliente, total: 0, aceptado: 0, cantidad: 0 });
    }

    const grupo = grupos.get(clave)!;
    grupo.total += p.total;
    grupo.cantidad += 1;

    if (p.estado === "aceptado") {
      grupo.aceptado += p.total;
    }
  });

  const top = [...grupos.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_CLIENTES);

  const maximo = Math.max(...top.map((c) => c.total), 0);

  if (maximo <= 0) {
    contenedor.replaceChildren(
      el("p", "estadisticas-sin-datos", "Sin montos cargados en este período.")
    );
    return;
  }

  // Una sola serie: todas las barras del mismo color, valor en la punta
  contenedor.replaceChildren(
    ...top.map((cliente) => {
      const fila = el("div", "ranking-fila");
      const pista = el("div", "ranking-pista");
      const barra = el("div", "ranking-barra");

      barra.style.width = `${(cliente.total / maximo) * 100}%`;
      pista.append(barra, el("span", "ranking-valor", montoCompacto(cliente.total)));

      fila.append(el("span", "ranking-nombre", cliente.nombre), pista);

      conectarTooltip(
        fila,
        `${cliente.nombre} · ${plural(cliente.cantidad, "presupuesto")}`,
        [
          { etiqueta: "Presupuestado", valor: montoCompleto(cliente.total) },
          { etiqueta: "Aceptado", valor: montoCompleto(cliente.aceptado) },
        ]
      );

      return fila;
    })
  );
}

// --- Render general ---

function render() {
  const contenido = document.getElementById(
    "estadisticas-contenido"
  ) as HTMLElement;
  const vacio = document.getElementById("estadisticas-vacio") as HTMLElement;

  document
    .querySelectorAll<HTMLButtonElement>(".filtro-opcion")
    .forEach((boton) => {
      const activo = boton.dataset.periodo === periodo;
      boton.classList.toggle("activo", activo);
      boton.setAttribute("aria-checked", String(activo));
    });

  ocultarTooltip();

  const inicio = inicioDelPeriodo();
  const delPeriodo = presupuestos.filter(
    (p) => inicio === null || p.creadoEn >= inicio
  );

  if (huboError || delPeriodo.length === 0) {
    contenido.hidden = true;
    vacio.hidden = false;
    vacio.textContent = huboError
      ? "No se pudieron leer los presupuestos."
      : presupuestos.length === 0
        ? "Todavía no hay presupuestos guardados. Las estadísticas se arman con los que guardás en Clientes."
        : "No hay presupuestos guardados en este período.";
    return;
  }

  contenido.hidden = false;
  vacio.hidden = true;

  renderIndicadores(delPeriodo);
  renderGraficoMeses(agruparPorMes(delPeriodo, inicio));
  renderComposicion(delPeriodo);
  renderTopClientes(delPeriodo);
}

export async function refrescarEstadisticas() {
  try {
    presupuestos = await listarPresupuestos();
    huboError = false;
  } catch (e) {
    console.error("No se pudieron leer los presupuestos:", e);
    presupuestos = [];
    huboError = true;
  }

  render();
}

export function initEstadisticas() {
  document
    .querySelectorAll<HTMLButtonElement>(".filtro-opcion")
    .forEach((boton) => {
      boton.addEventListener("click", () => {
        periodo = boton.dataset.periodo as Periodo;
        render();
      });
    });

  // Gráfico <-> tabla con los mismos datos
  const btnTabla = document.getElementById("btn-tabla-meses") as HTMLButtonElement;

  btnTabla.addEventListener("click", () => {
    const tabla = document.getElementById("tabla-meses") as HTMLElement;
    const grafico = document.getElementById("grafico-meses") as HTMLElement;
    const leyenda = document.getElementById("leyenda-meses") as HTMLElement;

    const verTabla = tabla.hidden;
    tabla.hidden = !verTabla;
    grafico.hidden = verTabla;
    leyenda.hidden = verTabla;
    btnTabla.textContent = verTabla ? "Ver gráfico" : "Ver tabla";
  });

  // Los datos se vuelven a leer cada vez que se entra a la pantalla, así
  // reflejan lo último guardado y los estados cambiados en Clientes
  document
    .querySelector('.nav-item[data-view="estadisticas"]')
    ?.addEventListener("click", refrescarEstadisticas);

  window.addEventListener("scroll", ocultarTooltip, true);
}
