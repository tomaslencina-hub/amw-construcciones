import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DatosPresupuesto } from "./formulario";
import { mostrarToast } from "./toast";

const COLOR_INK: [number, number, number] = [22, 50, 79];
const COLOR_AMBER: [number, number, number] = [226, 147, 47];
const COLOR_MUTED: [number, number, number] = [107, 122, 143];
const COLOR_BORDER: [number, number, number] = [220, 227, 234];
const COLOR_PAPER: [number, number, number] = [244, 246, 249];
const COLOR_TEXT: [number, number, number] = [27, 39, 51];

// Carga el logo que ya usa la app (src/assets/AMW-logo-header.jpeg)
// y lo devuelve como data URL para poder incrustarlo en el PDF.
async function cargarLogoDataURL(): Promise<string> {
  const logoUrl = new URL(
    "../assets/AMW-logo-header.jpeg",
    import.meta.url
  ).href;

  const response = await fetch(logoUrl);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Arma el documento PDF y lo devuelve SIN guardarlo ni descargarlo.
 * La usan tanto generarPDF() (descarga) como mostrarPreview() (vista previa),
 * así ambas muestran exactamente el mismo documento.
 */
export async function construirPDF(datos: DatosPresupuesto): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // --- Encabezado ---
  const logoSize = 18;
  let textStartX = margin;

  try {
    const logoDataUrl = await cargarLogoDataURL();
    doc.addImage(logoDataUrl, "JPEG", margin, 8, logoSize, logoSize);
    textStartX = margin + logoSize + 6;
  } catch (e) {
    // Si no se puede cargar el logo, el PDF se genera igual sin él
    console.warn("No se pudo cargar el logo para el PDF:", e);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLOR_INK);
  doc.text("A.M.W.", textStartX, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("Sistema de presupuestos", textStartX, 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLOR_INK);
  doc.text("PRESUPUESTO", pageWidth - margin, 20, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Fecha: ${datos.fecha || "-"}`, pageWidth - margin, 26, {
    align: "right",
  });

  doc.setDrawColor(...COLOR_AMBER);
  doc.setLineWidth(1);
  doc.line(margin, 33, pageWidth - margin, 33);

  // --- Franja de cliente ---
  doc.setFillColor(...COLOR_PAPER);
  doc.rect(margin, 40, contentWidth, 14, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("CLIENTE", margin + 4, 45.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(datos.cliente || "-", margin + 4, 51);

  let cursorY = 62;

  // Dibuja una sección con franja de título en navy y tabla en grilla.
  // La caja se traza DESPUÉS de la tabla, midiendo su alto real, así
  // nunca queda contenido afuera del marco ni espacio vacío de más.
  const dibujarSeccionTabla = (
    titulo: string,
    startY: number,
    body: (string | number)[][]
  ) => {
    doc.setFillColor(...COLOR_INK);
    doc.rect(margin, startY, contentWidth, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo, margin + 4, startY + 6.2);

    autoTable(doc, {
      startY: startY + 9,
      margin: { left: margin, right: margin },
      head: [["Descripción", "Cant", "Unidad", "Precio", "Total"]],
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        textColor: COLOR_TEXT,
        lineColor: COLOR_BORDER,
        lineWidth: 0.15,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: COLOR_PAPER,
        textColor: COLOR_MUTED,
        fontStyle: "bold",
        lineColor: COLOR_BORDER,
      },
      alternateRowStyles: { fillColor: [249, 250, 252] },
      columnStyles: {
        1: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.rect(margin, startY, contentWidth, finalY - startY);

    return finalY;
  };

  cursorY =
    dibujarSeccionTabla(
      "Mano de Obra",
      cursorY,
      datos.manoObra.map((i) => [
        i.descripcion || "-",
        i.cantidad,
        i.unidad || "-",
        `$ ${i.precio.toFixed(2)}`,
        `$ ${i.total.toFixed(2)}`,
      ])
    ) + 10;

  cursorY =
    dibujarSeccionTabla(
      "Materiales",
      cursorY,
      datos.materiales.map((i) => [
        i.descripcion || "-",
        i.cantidad,
        i.unidad || "-",
        `$ ${i.precio.toFixed(2)}`,
        `$ ${i.total.toFixed(2)}`,
      ])
    ) + 10;

  // --- Observaciones ---
  doc.setFillColor(...COLOR_INK);
  doc.rect(margin, cursorY, contentWidth, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Observaciones", margin + 4, cursorY + 6.2);

  const obsTexto = datos.observaciones?.trim() || "Sin observaciones.";
  const obsLineas = doc.splitTextToSize(obsTexto, contentWidth - 8) as string[];
  const obsAltoTexto = obsLineas.length * 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(obsLineas, margin + 4, cursorY + 9 + 6);

  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(margin, cursorY, contentWidth, 9 + obsAltoTexto + 8);

  cursorY = cursorY + 9 + obsAltoTexto + 8 + 12;

  // --- Total ---
  const totalBoxWidth = 80;
  const totalBoxHeight = 24;
  const totalBoxX = pageWidth - margin - totalBoxWidth;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(totalBoxX, cursorY, totalBoxWidth, totalBoxHeight, "FD");

  doc.setFillColor(...COLOR_AMBER);
  doc.rect(totalBoxX, cursorY, 2.2, totalBoxHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  doc.text("TOTAL", totalBoxX + totalBoxWidth - 6, cursorY + 9, {
    align: "right",
  });

  doc.setFontSize(19);
  doc.setTextColor(...COLOR_INK);
  doc.text(
    `$ ${datos.totalGeneral.toFixed(2)}`,
    totalBoxX + totalBoxWidth - 6,
    cursorY + 19,
    { align: "right" }
  );

  // --- Pie de página ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      `Generado el ${new Date().toLocaleDateString("es-AR")} · A.M.W.`,
      margin,
      pageHeight - 10
    );
    doc.text(`Página ${p} de ${pageCount}`, pageWidth - margin, pageHeight - 10, {
      align: "right",
    });
  }

  return doc;
}

export async function generarPDF(datos: DatosPresupuesto): Promise<void> {
  const doc = await construirPDF(datos);
  doc.save(`Presupuesto-${datos.cliente || "cliente"}.pdf`);
  mostrarToast("PDF descargado correctamente");
}