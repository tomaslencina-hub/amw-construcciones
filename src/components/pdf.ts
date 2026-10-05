import jsPDF from "jspdf";
import autoTable, { type CellDef, type UserOptions } from "jspdf-autotable";
import type { DatosPresupuesto, ItemPresupuesto } from "./formulario";
import type { Emisor } from "./emisor";
import { mostrarToast } from "./toast";

/**
 * Datos de la empresa que aparecen en el membrete y en el pie del PDF.
 * Los campos vacíos (o null) simplemente no se muestran.
 */
const EMPRESA = {
  nombre: "A.M.W.",
  titular: "Walter Raúl López",
  dni: "23.262.677",
  cuit: "20-23262677-2",
  descripcion: "",
  direccion: "",
  telefono: "3364565646",
  email: "",
  // Días de validez del presupuesto, ej: 15. null = no se muestra.
  validezDias: null as number | null,
};

type RGB = [number, number, number];

interface Tema {
  ink: RGB;
  inkDark: RGB;
  acento: RGB;
  muted: RGB;
  borde: RGB;
  papel: RGB;
  texto: RGB;
}

// Diseño de A.M.W.: azul y naranja de la marca
const TEMA_AMW: Tema = {
  ink: [22, 50, 79],
  inkDark: [16, 31, 51],
  acento: [226, 147, 47],
  muted: [107, 122, 143],
  borde: [220, 227, 234],
  papel: [244, 246, 249],
  texto: [27, 39, 51],
};

// Diseño de otro emisor: neutro, en grises, sin nada de la marca A.M.W.
const TEMA_NEUTRO: Tema = {
  ink: [38, 41, 46],
  inkDark: [38, 41, 46],
  acento: [38, 41, 46],
  muted: [112, 116, 122],
  borde: [205, 208, 212],
  papel: [243, 244, 245],
  texto: [30, 32, 36],
};

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
  // El emisor define el diseño: el de A.M.W. (logo y colores de la marca)
  // o el neutro, con los datos de otra persona.
  const emisor: Emisor = datos.emisor ?? { tipo: "amw" };
  const esAMW = emisor.tipo === "amw";
  const tema = esAMW ? TEMA_AMW : TEMA_NEUTRO;

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

  // "DNI ...  ·  CUIT ...  ·  Tel. ..." con los datos que estén cargados
  const lineaDatos = (d: { dni: string; cuit: string; telefono: string }) =>
    [
      d.dni && `DNI ${d.dni}`,
      d.cuit && `CUIT ${d.cuit}`,
      d.telefono && `Tel. ${d.telefono}`,
    ]
      .filter(Boolean)
      .join("  ·  ");

  // --- Membrete ---
  let finMembreteY: number;

  if (emisor.tipo === "amw") {
    // El logo ya incluye el nombre de la empresa. Si no se puede cargar,
    // se escribe el nombre en texto para que el PDF no quede sin membrete.
    const logoY = 12;
    const logoAlto = 21;
    finMembreteY = logoY + logoAlto;

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
      doc.setTextColor(...tema.ink);
      doc.text(EMPRESA.nombre, margin, 23);
      finMembreteY = 26;
    }

    // Datos del titular y de contacto (los que estén cargados), debajo del
    // logo: el nombre destacado y el resto en líneas grises más chicas
    const lineasEmpresa = [
      EMPRESA.titular,
      EMPRESA.descripcion,
      lineaDatos(EMPRESA),
      [EMPRESA.direccion, EMPRESA.email].filter(Boolean).join("  ·  "),
    ].filter(Boolean);

    lineasEmpresa.forEach((linea, i) => {
      const esTitular = linea === EMPRESA.titular;

      doc.setFont("helvetica", esTitular ? "bold" : "normal");
      doc.setFontSize(esTitular ? 9.5 : 8.5);
      doc.setTextColor(...(esTitular ? tema.texto : tema.muted));
      doc.text(linea, margin, finMembreteY + 5.5 + i * 4.4);
    });

    if (lineasEmpresa.length > 0) {
      finMembreteY += 5.5 + (lineasEmpresa.length - 1) * 4.4;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...tema.ink);
    doc.text("PRESUPUESTO", derecha, 23, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...tema.muted);
    doc.text(`Fecha de emisión: ${fechaEmision}`, derecha, 29, {
      align: "right",
    });

    if (EMPRESA.validezDias) {
      doc.text(`Validez: ${EMPRESA.validezDias} días`, derecha, 33.5, {
        align: "right",
      });
    }
  } else {
    // Otro emisor: sin logo. El nombre de la persona hace de membrete,
    // con sus datos debajo, y "PRESUPUESTO" más chico a la derecha.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.setTextColor(...tema.ink);
    const nombreEmisor = doc.splitTextToSize(
      emisor.nombre || "-",
      contentWidth - 60
    )[0] as string;
    doc.text(nombreEmisor, margin, 24);
    finMembreteY = 24;

    const datosEmisor = lineaDatos(emisor);

    if (datosEmisor) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...tema.muted);
      doc.text(datosEmisor, margin, 30.5);
      finMembreteY = 30.5;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...tema.muted);
    doc.text("PRESUPUESTO", derecha, 20, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(fechaEmision, derecha, 25.5, { align: "right" });
  }

  // La línea divisoria baja si hay datos debajo del logo. En el diseño
  // neutro es una línea oscura y gruesa en lugar de la gris fina.
  const separadorY = esAMW
    ? Math.max(40, finMembreteY + 6)
    : finMembreteY + 6;

  doc.setDrawColor(...(esAMW ? tema.borde : tema.ink));
  doc.setLineWidth(esAMW ? 0.3 : 0.9);
  doc.line(margin, separadorY, derecha, separadorY);

  // --- Cliente ---
  const panelY = separadorY + 6;
  const panelAlto = esAMW ? 24 : 17;

  const nombreCliente = (ancho: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...tema.texto);
    return doc.splitTextToSize(datos.cliente || "-", ancho)[0] as string;
  };

  if (esAMW) {
    // Panel gris claro con la barrita naranja a la izquierda
    doc.setFillColor(...tema.papel);
    doc.rect(margin, panelY, contentWidth, panelAlto, "F");
    doc.setFillColor(...tema.acento);
    doc.rect(margin, panelY, 1.4, panelAlto, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...tema.acento);
    doc.text("PREPARADO PARA", margin + 7, panelY + 8.5);

    doc.text(nombreCliente(contentWidth - 14), margin + 7, panelY + 17);
  } else {
    // Sin panel: rótulo, nombre y una línea fina debajo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...tema.muted);
    doc.text("CLIENTE", margin, panelY + 3.5);

    doc.text(nombreCliente(contentWidth), margin, panelY + 10.5);

    doc.setDrawColor(...tema.borde);
    doc.setLineWidth(0.3);
    doc.line(margin, panelY + panelAlto - 2, derecha, panelY + panelAlto - 2);
  }

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
    // A.M.W.: tabla liviana, solo con líneas entre filas.
    // Otro emisor: grilla completa con encabezado oscuro.
    theme: esAMW ? "plain" : "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: tema.texto,
      cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 },
      lineColor: tema.borde,
      lineWidth: esAMW ? { bottom: 0.15 } : 0.15,
    },
    headStyles: esAMW
      ? {
          fillColor: tema.papel,
          textColor: tema.muted,
          fontStyle: "bold",
          fontSize: 7.5,
          lineWidth: 0,
        }
      : {
          fillColor: tema.ink,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
          lineColor: tema.ink,
        },
    footStyles: esAMW
      ? {
          textColor: tema.ink,
          fontStyle: "bold",
          fontSize: 9.5,
          lineColor: tema.ink,
          lineWidth: { top: 0.35 },
        }
      : {
          fillColor: tema.papel,
          textColor: tema.ink,
          fontStyle: "bold",
          fontSize: 9.5,
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
    doc.setTextColor(...tema.muted);
    doc.text(titulo.toUpperCase(), margin + 2.5, startY + 4.5);

    autoTable(doc, { ...opciones, startY: startY + ALTO_TITULO_SECCION });

    return (doc as any).lastAutoTable.finalY as number;
  };

  // A.M.W.: "01  Demolición" con una línea fina debajo.
  // Otro emisor: el número dentro de un cuadradito oscuro, sin línea.
  const dibujarTituloTarea = (numero: number, nombre: string, y: number) => {
    const etiqueta = String(numero).padStart(2, "0");

    doc.setFont("helvetica", "bold");

    if (esAMW) {
      doc.setFontSize(11.5);
      doc.setTextColor(...tema.acento);
      doc.text(etiqueta, margin, y + 6);
    } else {
      doc.setFillColor(...tema.ink);
      doc.rect(margin, y + 0.8, 7.5, 7.5, "F");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(etiqueta, margin + 3.75, y + 5.8, { align: "center" });
    }

    doc.setFontSize(11.5);
    doc.setTextColor(...tema.ink);
    const titulo = doc.splitTextToSize(
      nombre || "Sin nombre",
      contentWidth - 12
    )[0] as string;
    doc.text(titulo, margin + (esAMW ? 9 : 11), y + 6);

    if (esAMW) {
      doc.setDrawColor(...tema.ink);
      doc.setLineWidth(0.35);
      doc.line(margin, y + 9.5, derecha, y + 9.5);
    }
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
  doc.setTextColor(...tema.muted);
  doc.text("OBSERVACIONES", margin + 2.5, cursorY + 4.5);

  const cajaObsY = cursorY + ALTO_ROTULO_OBS;

  doc.setDrawColor(...tema.borde);
  doc.setLineWidth(0.3);
  doc.rect(margin, cajaObsY, contentWidth, altoCajaObs);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...(obsTexto ? tema.texto : tema.muted));
  doc.text(obsLineas, margin + 5, cajaObsY + 6.8);

  cursorY = cajaObsY + altoCajaObs + separacionObsTotal;

  const filasTotales: [string, number][] = [
    ["Mano de obra", datos.subtotalMano],
    ["Materiales", datos.subtotalMateriales],
  ];

  // Un solo panel con los subtotales, una línea fina y el total destacado
  // solo con tipografía. A.M.W.: gris claro con la barrita naranja (como el
  // del cliente). Otro emisor: recuadro con borde, sin relleno.
  if (esAMW) {
    doc.setFillColor(...tema.papel);
    doc.rect(totalesX, cursorY, anchoTotales, altoTotales, "F");
    doc.setFillColor(...tema.acento);
    doc.rect(totalesX, cursorY, 1.4, altoTotales, "F");
  } else {
    doc.setDrawColor(...tema.ink);
    doc.setLineWidth(0.4);
    doc.rect(totalesX, cursorY, anchoTotales, altoTotales);
  }

  filasTotales.forEach(([etiqueta, monto], i) => {
    const y = cursorY + 7.5 + i * altoFilaTotal;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...tema.muted);
    doc.text(etiqueta, totalesX + 7, y);

    doc.setTextColor(...tema.texto);
    doc.text(formatearMonto(monto), derecha - 6, y, { align: "right" });
  });

  const lineaY = cursorY + 18.5;

  doc.setDrawColor(...tema.borde);
  doc.setLineWidth(0.3);
  doc.line(totalesX + 7, lineaY, derecha - 6, lineaY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...tema.acento);
  doc.text("TOTAL", totalesX + 7, lineaY + 7.3);

  doc.setFontSize(13);
  doc.setTextColor(...tema.ink);
  doc.text(formatearMonto(datos.totalGeneral), derecha - 6, lineaY + 7.5, {
    align: "right",
  });

  // --- Pie en todas las páginas (y franja superior, solo en el de A.M.W.) ---
  const pageCount = doc.getNumberOfPages();

  const nombrePie = emisor.tipo === "amw" ? EMPRESA.nombre : emisor.nombre;
  const telefonoPie =
    emisor.tipo === "amw" ? EMPRESA.telefono : emisor.telefono;

  const contacto = [
    telefonoPie && `Tel. ${telefonoPie}`,
    esAMW && EMPRESA.email,
  ]
    .filter(Boolean)
    .join("  ·  ");

  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);

    if (esAMW) {
      doc.setFillColor(...tema.inkDark);
      doc.rect(0, 0, pageWidth, 4, "F");
      doc.setFillColor(...tema.acento);
      doc.rect(0, 4, pageWidth, 0.8, "F");
    }

    doc.setDrawColor(...tema.borde);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 15, derecha, pageHeight - 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...tema.muted);

    const pieIzquierdo = [
      `${nombrePie} · Presupuesto emitido el ${formatearFecha(fechaGeneracion)}`,
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
