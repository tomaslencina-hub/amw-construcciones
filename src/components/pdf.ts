import jsPDF from "jspdf";
import autoTable, { type CellDef, type UserOptions } from "jspdf-autotable";
import type { DatosPresupuesto, ItemPresupuesto } from "./formulario";
import { mostrarToast } from "./toast";

/**
 * Datos de la empresa que aparecen en el membrete y en el pie del PDF.
 * Los campos vacíos (o null) simplemente no se muestran.
 */
const EMPRESA = {
  nombre: "A.M.W.",
  descripcion: "",
  direccion: "",
  telefono: "",
  email: "",
  // Días de validez del presupuesto, ej: 15. null = no se muestra.
  validezDias: null as number | null,
};

type RGB = [number, number, number];

const COLOR_INK: RGB = [22, 50, 79];
const COLOR_INK_DARK: RGB = [16, 31, 51];
const COLOR_AMBER: RGB = [226, 147, 47];
const COLOR_MUTED: RGB = [107, 122, 143];
const COLOR_BORDER: RGB = [220, 227, 234];
const COLOR_PAPER: RGB = [244, 246, 249];
const COLOR_TEXT: RGB = [27, 39, 51];

// Carga el logo horizontal del membrete (src/assets/AMW-logo-pdf.jpg,
// dibujo + "A.M.W Construcciones en general") y lo devuelve como data URL
// para poder incrustarlo en el PDF.
async function cargarLogoDataURL(): Promise<string> {
  const logoUrl = new URL("../assets/AMW-logo-pdf.jpg", import.meta.url).href;

  const response = await fetch(logoUrl);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// $ 12.150.000,00
function formatearMonto(monto: number) {
  return `$ ${monto.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatearCantidad(cantidad: number) {
  return cantidad.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// 02/10/2026
function formatearFecha(fecha: Date) {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${fecha.getFullYear()}`;
}

/**
 * Arma el documento PDF y lo devuelve SIN guardarlo ni descargarlo.
 * La usan tanto generarPDF() (descarga) como mostrarPreview() (vista previa),
 * así ambas muestran exactamente el mismo documento.
 * fechaGeneracion es la que figura en el pie: al reabrir un presupuesto
 * guardado se pasa la fecha en que se creó, para que el documento no cambie.
 */
export async function construirPDF(
  datos: DatosPresupuesto,
  fechaGeneracion: Date = new Date()
): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const derecha = pageWidth - margin;

  // Dónde arranca el contenido en las páginas siguientes a la primera
  const inicioPaginaNueva = 16;

  // Hasta dónde puede llegar el contenido sin pisar el pie de página
  const margenInferior = 22;
  const limiteInferior = pageHeight - margenInferior;
  const altoUtilPagina = limiteInferior - inicioPaginaNueva;

  // La fecha cargada en el formulario viene como "aaaa-mm-dd"
  const fechaEmision = datos.fecha
    ? datos.fecha.split("-").reverse().join("/")
    : formatearFecha(fechaGeneracion);

  const nuevaPagina = () => {
    doc.addPage();
    return inicioPaginaNueva;
  };

  // --- Membrete ---
  // El logo ya incluye el nombre de la empresa. Si no se puede cargar,
  // se escribe el nombre en texto para que el PDF no quede sin membrete.
  const logoY = 12;
  const logoAlto = 21;
  let finMembreteY = logoY + logoAlto;

  try {
    const logoDataUrl = await cargarLogoDataURL();
    const { width, height } = doc.getImageProperties(logoDataUrl);
    doc.addImage(
      logoDataUrl,
      "JPEG",
      margin,
      logoY,
      (logoAlto * width) / height,
      logoAlto
    );
  } catch (e) {
    console.warn("No se pudo cargar el logo para el PDF:", e);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...COLOR_INK);
    doc.text(EMPRESA.nombre, margin, 23);
    finMembreteY = 26;
  }

  // Datos de contacto (si están cargados), debajo del logo
  const lineasEmpresa = [
    EMPRESA.descripcion,
    EMPRESA.direccion,
    [EMPRESA.telefono, EMPRESA.email].filter(Boolean).join("  ·  "),
  ].filter(Boolean);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_MUTED);
  lineasEmpresa.forEach((linea, i) => {
    doc.text(linea, margin, finMembreteY + 5 + i * 4.2);
  });

  if (lineasEmpresa.length > 0) {
    finMembreteY += 5 + (lineasEmpresa.length - 1) * 4.2;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLOR_INK);
  doc.text("PRESUPUESTO", derecha, 23, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Fecha de emisión: ${fechaEmision}`, derecha, 29, {
    align: "right",
  });

  if (EMPRESA.validezDias) {
    doc.text(`Validez: ${EMPRESA.validezDias} días`, derecha, 33.5, {
      align: "right",
    });
  }

  // La línea divisoria baja si hay datos de contacto debajo del logo
  const separadorY = Math.max(40, finMembreteY + 6);

  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, separadorY, derecha, separadorY);

  // --- Panel cliente + importe total ---
  const panelY = separadorY + 6;
  const panelAlto = 24;

  doc.setFillColor(...COLOR_PAPER);
  doc.rect(margin, panelY, contentWidth, panelAlto, "F");
  doc.setFillColor(...COLOR_AMBER);
  doc.rect(margin, panelY, 1.4, panelAlto, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_AMBER);
  doc.text("PREPARADO PARA", margin + 7, panelY + 8.5);

  doc.setFontSize(13);
  doc.setTextColor(...COLOR_TEXT);
  const nombreCliente = doc.splitTextToSize(
    datos.cliente || "-",
    contentWidth - 14
  )[0] as string;
  doc.text(nombreCliente, margin + 7, panelY + 17);

  let cursorY = panelY + panelAlto + 12;

  // --- Tareas ---
  const ALTO_TITULO_TAREA = 13;
  const ALTO_TITULO_SECCION = 7;

  const encabezadoTabla: CellDef[] = [
    { content: "Descripción" },
    { content: "Cant.", styles: { halign: "right" } },
    { content: "Unidad" },
    { content: "Precio unit.", styles: { halign: "right" } },
    { content: "Importe", styles: { halign: "right" } },
  ];

  // Opciones de la tabla, compartidas entre la medición y el dibujo real
  // para que el alto medido coincida exactamente con el dibujado.
  // Si se pasa subtotal, se agrega como fila de pie incrustada en la tabla,
  // alineada debajo de la columna Importe.
  const opcionesTabla = (
    body: string[][],
    subtotal?: number
  ): UserOptions => ({
    margin: {
      left: margin,
      right: margin,
      top: inicioPaginaNueva,
      bottom: margenInferior,
    },
    head: [encabezadoTabla],
    body,
    foot:
      subtotal === undefined
        ? undefined
        : [
            [
              {
                content: "Subtotal",
                colSpan: 4,
                styles: { halign: "right" },
              },
              {
                content: formatearMonto(subtotal),
                styles: { halign: "right" },
              },
            ],
          ],
    showFoot: "lastPage",
    // Si la tabla es tan larga que ocupa más de una página, al menos
    // no parte una fila por la mitad.
    rowPageBreak: "avoid",
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: COLOR_TEXT,
      cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 },
      lineColor: COLOR_BORDER,
      lineWidth: { bottom: 0.15 },
    },
    headStyles: {
      fillColor: COLOR_PAPER,
      textColor: COLOR_MUTED,
      fontStyle: "bold",
      fontSize: 7.5,
      lineWidth: 0,
    },
    footStyles: {
      textColor: COLOR_INK,
      fontStyle: "bold",
      fontSize: 9.5,
      lineColor: COLOR_INK,
      lineWidth: { top: 0.35 },
    },
    columnStyles: {
      1: { halign: "right", cellWidth: 18 },
      2: { cellWidth: 20 },
      3: { halign: "right", cellWidth: 32 },
      4: { halign: "right", cellWidth: 34, fontStyle: "bold" },
    },
  });

  // Mide el alto real de una tabla dibujándola en un documento descartable
  // de una sola página muy alta. Devuelve Infinity si ni así entra.
  const medirAltoTabla = (opciones: UserOptions): number => {
    const tmp = new jsPDF({ format: [pageWidth, 2000] });

    autoTable(tmp, {
      ...opciones,
      startY: 0,
      margin: { left: margin, right: margin, top: 0, bottom: 0 },
    });

    if (tmp.getNumberOfPages() > 1) {
      return Infinity;
    }

    return (tmp as any).lastAutoTable.finalY;
  };

  // Rótulo chico ("MANO DE OBRA") arriba de la tabla
  const dibujarSeccionTabla = (
    titulo: string,
    startY: number,
    opciones: UserOptions
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(titulo.toUpperCase(), margin + 2.5, startY + 4.5);

    autoTable(doc, { ...opciones, startY: startY + ALTO_TITULO_SECCION });

    return (doc as any).lastAutoTable.finalY as number;
  };

  // "01  Demolición" con una línea fina debajo
  const dibujarTituloTarea = (numero: number, nombre: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...COLOR_AMBER);
    doc.text(String(numero).padStart(2, "0"), margin, y + 6);

    doc.setTextColor(...COLOR_INK);
    const titulo = doc.splitTextToSize(
      nombre || "Sin nombre",
      contentWidth - 12
    )[0] as string;
    doc.text(titulo, margin + 9, y + 6);

    doc.setDrawColor(...COLOR_INK);
    doc.setLineWidth(0.35);
    doc.line(margin, y + 9.5, derecha, y + 9.5);
  };

  const filasDe = (items: ItemPresupuesto[]) =>
    items.map((i) => [
      i.descripcion || "-",
      formatearCantidad(i.cantidad),
      i.unidad || "-",
      formatearMonto(i.precio),
      formatearMonto(i.total),
    ]);

  datos.tareas.forEach((tarea, indiceTarea) => {
    const numero = indiceTarea + 1;

    // Subtotal de la tarea (mano de obra + materiales de esa tarea sola)
    const subtotalTarea =
      tarea.manoObra.reduce((acc, i) => acc + i.total, 0) +
      tarea.materiales.reduce((acc, i) => acc + i.total, 0);

    const secciones: { titulo: string; body: string[][] }[] = [];

    if (tarea.manoObra.length > 0) {
      secciones.push({ titulo: "Mano de obra", body: filasDe(tarea.manoObra) });
    }

    if (tarea.materiales.length > 0) {
      secciones.push({ titulo: "Materiales", body: filasDe(tarea.materiales) });
    }

    if (secciones.length === 0) {
      if (cursorY + ALTO_TITULO_TAREA > limiteInferior) {
        cursorY = nuevaPagina();
      }

      dibujarTituloTarea(numero, tarea.nombre, cursorY);
      cursorY += ALTO_TITULO_TAREA + 6;
      return;
    }

    secciones.forEach((seccion, i) => {
      const esPrimera = i === 0;
      const esUltima = i === secciones.length - 1;

      // El subtotal va incrustado como pie de la última tabla de la tarea
      const opciones = opcionesTabla(
        seccion.body,
        esUltima ? subtotalTarea : undefined
      );

      // Bloque que no se debe partir: rótulo de sección + tabla completa
      // (y el título de la tarea, si es su primera tabla).
      const altoBloque =
        (esPrimera ? ALTO_TITULO_TAREA : 0) +
        ALTO_TITULO_SECCION +
        medirAltoTabla(opciones);

      const espacioRestante = limiteInferior - cursorY;

      // Si el bloque no entra en lo que queda de la página, salta entero a
      // la siguiente. Si ni siquiera entra en una página vacía se deja
      // fluir, salvo que quede tan poco lugar que convenga arrancar arriba.
      let saltoDePagina = false;

      if (
        altoBloque > espacioRestante &&
        (altoBloque <= altoUtilPagina || espacioRestante < 60)
      ) {
        cursorY = nuevaPagina();
        saltoDePagina = true;
      }

      if (esPrimera) {
        dibujarTituloTarea(numero, tarea.nombre, cursorY);
        cursorY += ALTO_TITULO_TAREA;
      } else if (saltoDePagina) {
        // Si la segunda tabla quedó en otra página, se repite el título
        // para que se sepa a qué tarea pertenece
        dibujarTituloTarea(
          numero,
          `${tarea.nombre || "Sin nombre"} (continuación)`,
          cursorY
        );
        cursorY += ALTO_TITULO_TAREA;
      }

      cursorY = dibujarSeccionTabla(seccion.titulo, cursorY, opciones) + 5;
    });

    cursorY += 8;
  });

  // --- Cierre: observaciones (siempre, a todo el ancho) y debajo el total ---
  const anchoTotales = 80;
  const totalesX = derecha - anchoTotales;

  // Si no se cargaron observaciones, el recuadro aparece igual con un aviso
  const obsTexto = datos.observaciones?.trim() ?? "";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const obsLineas = doc.splitTextToSize(
    obsTexto || "Sin observaciones.",
    contentWidth - 10
  ) as string[];

  const ALTO_ROTULO_OBS = 7;
  const altoCajaObs = 8 + obsLineas.length * 4.4;
  const separacionObsTotal = 8;

  const altoFilaTotal = 7;
  const altoTotales = 30;

  // El bloque de cierre (observaciones + total) nunca se parte ni queda
  // pegado al pie
  const altoCierre =
    ALTO_ROTULO_OBS + altoCajaObs + separacionObsTotal + altoTotales;

  if (cursorY + altoCierre > limiteInferior) {
    cursorY = nuevaPagina();
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("OBSERVACIONES", margin + 2.5, cursorY + 4.5);

  const cajaObsY = cursorY + ALTO_ROTULO_OBS;

  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, cajaObsY, contentWidth, altoCajaObs);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...(obsTexto ? COLOR_TEXT : COLOR_MUTED));
  doc.text(obsLineas, margin + 5, cajaObsY + 6.8);

  cursorY = cajaObsY + altoCajaObs + separacionObsTotal;

  const filasTotales: [string, number][] = [
    ["Mano de obra", datos.subtotalMano],
    ["Materiales", datos.subtotalMateriales],
  ];

  // Un solo panel gris claro (como el del cliente) con los subtotales,
  // una línea fina y el total destacado solo con tipografía
  doc.setFillColor(...COLOR_PAPER);
  doc.rect(totalesX, cursorY, anchoTotales, altoTotales, "F");
  doc.setFillColor(...COLOR_AMBER);
  doc.rect(totalesX, cursorY, 1.4, altoTotales, "F");

  filasTotales.forEach(([etiqueta, monto], i) => {
    const y = cursorY + 7.5 + i * altoFilaTotal;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(etiqueta, totalesX + 7, y);

    doc.setTextColor(...COLOR_TEXT);
    doc.text(formatearMonto(monto), derecha - 6, y, { align: "right" });
  });

  const lineaY = cursorY + 18.5;

  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(totalesX + 7, lineaY, derecha - 6, lineaY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_AMBER);
  doc.text("TOTAL", totalesX + 7, lineaY + 7.3);

  doc.setFontSize(13);
  doc.setTextColor(...COLOR_INK);
  doc.text(formatearMonto(datos.totalGeneral), derecha - 6, lineaY + 7.5, {
    align: "right",
  });

  // --- Franja superior y pie en todas las páginas ---
  const pageCount = doc.getNumberOfPages();

  const contacto = [EMPRESA.telefono, EMPRESA.email]
    .filter(Boolean)
    .join("  ·  ");

  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);

    doc.setFillColor(...COLOR_INK_DARK);
    doc.rect(0, 0, pageWidth, 4, "F");
    doc.setFillColor(...COLOR_AMBER);
    doc.rect(0, 4, pageWidth, 0.8, "F");

    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 15, derecha, pageHeight - 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);

    const pieIzquierdo = [
      `${EMPRESA.nombre} · Presupuesto emitido el ${formatearFecha(fechaGeneracion)}`,
      contacto,
    ]
      .filter(Boolean)
      .join("  ·  ");

    doc.text(pieIzquierdo, margin, pageHeight - 10);
    doc.text(`Página ${p} de ${pageCount}`, derecha, pageHeight - 10, {
      align: "right",
    });
  }

  return doc;
}

export async function generarPDF(
  datos: DatosPresupuesto,
  fechaGeneracion?: Date
): Promise<void> {
  const doc = await construirPDF(datos, fechaGeneracion);
  doc.save(`Presupuesto-${datos.cliente || "cliente"}.pdf`);
  mostrarToast("PDF descargado correctamente");
}
