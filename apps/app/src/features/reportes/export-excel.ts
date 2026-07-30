/**
 * Exportación de Reportes a Excel (.xlsx) con tablas prolijas: encabezados
 * con el ámbar de la marca, columnas dimensionadas, montos como NÚMEROS de
 * verdad (Excel los suma y ordena) con formato de pesos, y fila de encabezado
 * congelada. `exceljs` se importa dinámicamente: solo se descarga cuando el
 * usuario aprieta "Exportar", así no pesa en el arranque de la app.
 */
import type { Row, Worksheet } from "exceljs";
import { isCashInMethod, PAYMENT_METHOD_LABELS } from "../../domain/ticket";
import { formatDateTime } from "../../domain/dates";
import type {
  CashierClosingEntry, PaymentBreakdownEntry, SalesExport, TopProduct,
} from "../../data/types";

const BRAND = "FFFDBF2D"; // ámbar kiosco (ARGB para exceljs)
const BRAND_INK = "FF3D2E00"; // texto sobre ámbar
const MONEY_FMT = '"$"#,##0.00';
const INT_FMT = "#,##0";

export interface ReportExportInput {
  rangeLabel: string;
  paymentLabel: string;
  categoryLabel: string;
  cashierLabel: string;
  summary: { count: number; totalCents: number };
  breakdown: PaymentBreakdownEntry[];
  topProducts: TopProduct[];
  closing: CashierClosingEntry[];
  data: SalesExport;
}

/** Aplica el estilo de encabezado (fondo ámbar, negrita) a una fila. */
function styleHeader(row: Row): void {
  row.font = { bold: true, color: { argb: BRAND_INK } };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFE0E0E6" } },
    };
  });
  row.height = 20;
}

/** Bordes hairline en todas las celdas con datos + zebra sutil. */
function styleBody(sheet: Worksheet, firstDataRow: number): void {
  for (let r = firstDataRow; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const zebra = (r - firstDataRow) % 2 === 1;
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: "FFEDEDF2" } } };
      if (zebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7FA" } };
      }
    });
  }
}

export async function exportReportToExcel(input: ReportExportInput): Promise<void> {
  // Import dinámico: code-split, no entra al bundle de arranque.
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.creator = "kiOS";
  wb.created = new Date();

  const cents = (c: number) => c / 100;

  // ── Hoja: Resumen ──────────────────────────────────────────────────────
  const resumen = wb.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
  });
  resumen.columns = [{ width: 22 }, { width: 26 }];
  resumen.addRow(["kiOS — Reporte de ventas"]).font = { bold: true, size: 16 };
  resumen.addRow([]);
  resumen.addRow(["Período", input.rangeLabel]);
  resumen.addRow(["Medio de pago", input.paymentLabel]);
  resumen.addRow(["Categoría", input.categoryLabel]);
  resumen.addRow(["Cajero", input.cashierLabel]);
  resumen.addRow(["Generado", formatDateTime(new Date().toISOString())]);
  resumen.addRow([]);
  const kpiHeader = resumen.addRow(["Indicador", "Valor"]);
  styleHeader(kpiHeader);
  const ventasRow = resumen.addRow(["Ventas", input.summary.count]);
  ventasRow.getCell(2).numFmt = INT_FMT;
  const factRow = resumen.addRow(["Facturado", cents(input.summary.totalCents)]);
  factRow.getCell(2).numFmt = MONEY_FMT;
  const avgCents = input.summary.count > 0 ? input.summary.totalCents / input.summary.count : 0;
  const avgRow = resumen.addRow(["Ticket promedio", cents(avgCents)]);
  avgRow.getCell(2).numFmt = MONEY_FMT;
  // Etiquetas de la primera columna en negrita (las de la cabecera de filtros).
  for (let r = 3; r <= resumen.rowCount; r++) resumen.getRow(r).getCell(1).font = { bold: r < 8 };

  // ── Hoja: Ventas (una fila por venta) ──────────────────────────────────
  const ventas = wb.addWorksheet("Ventas", { views: [{ state: "frozen", ySplit: 1 }] });
  ventas.columns = [
    { header: "Fecha y hora", key: "fecha", width: 22 },
    { header: "Cajero", key: "cajero", width: 18 },
    { header: "Cliente", key: "cliente", width: 20 },
    { header: "Estado", key: "estado", width: 12 },
    { header: "Ítems", key: "items", width: 8 },
    { header: "Total", key: "total", width: 16 },
  ];
  // Cantidad de ítems por venta (agregada de las filas de detalle).
  const itemsBySale = new Map<string, number>();
  for (const it of input.data.items) {
    itemsBySale.set(it.saleId, (itemsBySale.get(it.saleId) ?? 0) + it.qty);
  }
  for (const sale of input.data.sales) {
    const names = input.data.cashierNames.get(sale.id);
    ventas.addRow({
      fecha: formatDateTime(sale.createdAt),
      cajero: names?.cashier ?? "",
      cliente: names?.customer ?? "",
      estado: sale.voidedAt ? "Anulada" : "OK",
      items: itemsBySale.get(sale.id) ?? 0,
      total: cents(sale.totalCents),
    });
  }
  ventas.getColumn("total").numFmt = MONEY_FMT;
  ventas.getColumn("items").numFmt = INT_FMT;
  styleHeader(ventas.getRow(1));
  styleBody(ventas, 2);

  // ── Hoja: Detalle (una fila por ítem vendido) ──────────────────────────
  const detalle = wb.addWorksheet("Detalle", { views: [{ state: "frozen", ySplit: 1 }] });
  detalle.columns = [
    { header: "Fecha y hora", key: "fecha", width: 22 },
    { header: "Producto", key: "producto", width: 34 },
    { header: "Cantidad", key: "qty", width: 12 },
    { header: "Precio unit.", key: "precio", width: 16 },
    { header: "Subtotal", key: "subtotal", width: 16 },
    { header: "Cajero", key: "cajero", width: 18 },
    { header: "Cliente", key: "cliente", width: 20 },
    { header: "Estado", key: "estado", width: 12 },
  ];
  for (const it of input.data.items) {
    const names = input.data.cashierNames.get(it.saleId);
    detalle.addRow({
      fecha: formatDateTime(it.saleCreatedAt),
      producto: it.productName,
      qty: it.qty,
      precio: cents(it.unitPriceCents),
      subtotal: cents(it.subtotalCents),
      cajero: names?.cashier ?? "",
      cliente: names?.customer ?? "",
      estado: it.saleVoidedAt ? "Anulada" : "OK",
    });
  }
  detalle.getColumn("qty").numFmt = INT_FMT;
  detalle.getColumn("precio").numFmt = MONEY_FMT;
  detalle.getColumn("subtotal").numFmt = MONEY_FMT;
  styleHeader(detalle.getRow(1));
  styleBody(detalle, 2);

  // ── Hoja: Medios de pago ───────────────────────────────────────────────
  const medios = wb.addWorksheet("Medios de pago", { views: [{ state: "frozen", ySplit: 1 }] });
  medios.columns = [
    { header: "Medio", key: "medio", width: 22 },
    { header: "Facturado", key: "total", width: 18 },
  ];
  for (const b of input.breakdown) {
    medios.addRow({ medio: PAYMENT_METHOD_LABELS[b.method], total: cents(b.totalCents) });
  }
  medios.getColumn("total").numFmt = MONEY_FMT;
  styleHeader(medios.getRow(1));
  styleBody(medios, 2);

  // ── Hoja: Cierre de caja ───────────────────────────────────────────────
  // Matriz cajero × medio, separando lo COBRADO (entró al cajón) de lo
  // facturado: una venta fiada factura pero no entra plata.
  const cierre = wb.addWorksheet("Cierre de caja", { views: [{ state: "frozen", ySplit: 1 }] });
  const cashMethods = [...new Set(
    input.closing.flatMap((c) => c.collectedByMethod.map((m) => m.method)),
  )].filter(isCashInMethod);
  cierre.columns = [
    { header: "Cajero", key: "cajero", width: 22 },
    ...cashMethods.map((m) => ({ header: PAYMENT_METHOD_LABELS[m], key: m, width: 16 })),
    { header: "Total cobrado", key: "cobrado", width: 18 },
    { header: "Facturado", key: "facturado", width: 16 },
    { header: "Fiado otorgado", key: "fiado", width: 18 },
    { header: "Cobros de deuda", key: "deuda", width: 18 },
    { header: "Ventas", key: "ventas", width: 10 },
  ];
  for (const c of input.closing) {
    const row: Record<string, string | number> = {
      cajero: c.cashierName ?? "Sin cajero",
      cobrado: cents(c.collectedTotalCents),
      facturado: cents(c.salesTotalCents),
      fiado: cents(c.creditGivenCents),
      deuda: cents(c.debtCollectedCents),
      ventas: c.saleCount,
    };
    for (const m of cashMethods) {
      row[m] = cents(c.collectedByMethod.find((x) => x.method === m)?.totalCents ?? 0);
    }
    cierre.addRow(row);
  }
  for (const key of [...cashMethods, "cobrado", "facturado", "fiado", "deuda"]) {
    cierre.getColumn(key).numFmt = MONEY_FMT;
  }
  cierre.getColumn("ventas").numFmt = INT_FMT;
  styleHeader(cierre.getRow(1));
  styleBody(cierre, 2);

  // ── Hoja: Más vendidos ─────────────────────────────────────────────────
  const top = wb.addWorksheet("Más vendidos", { views: [{ state: "frozen", ySplit: 1 }] });
  top.columns = [
    { header: "#", key: "pos", width: 6 },
    { header: "Producto", key: "producto", width: 34 },
    { header: "Unidades", key: "qty", width: 12 },
    { header: "Facturado", key: "total", width: 18 },
  ];
  input.topProducts.forEach((p, i) => {
    top.addRow({ pos: i + 1, producto: p.productName, qty: p.qty, total: cents(p.revenueCents) });
  });
  top.getColumn("qty").numFmt = INT_FMT;
  top.getColumn("total").numFmt = MONEY_FMT;
  styleHeader(top.getRow(1));
  styleBody(top, 2);

  // ── Descarga (funciona en la demo web y en el WebView de escritorio) ────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kiOS-reporte-${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se revoca en el próximo tick para no cortar la descarga en algunos WebView.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
