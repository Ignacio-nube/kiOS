/**
 * Ticket imprimible (rollo térmico de 80mm). Se monta UNA vez en el shell y
 * solo existe en el DOM mientras hay algo en la cola de impresión.
 *
 * Va en un portal a <body> porque el CSS de impresión (ver index.css) oculta
 * todos los hijos directos de body salvo #kios-print-root — así se imprime el
 * ticket y nada más, sin importar qué pantalla o modal esté abierto.
 *
 * Los colores están FIJOS en negro sobre blanco (no usa tokens de tema): en
 * papel el tema Negro imprimiría un rectángulo de tinta.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePrintStore } from "./print-store";
import { formatARS } from "../../domain/money";
import { PAYMENT_METHOD_LABELS } from "../../domain/ticket";
import { ticketItemCount } from "../../domain/ticket";

export function TicketPrintArea() {
  const sale = usePrintStore((s) => s.sale);
  const businessName = usePrintStore((s) => s.businessName);
  const creditInfo = usePrintStore((s) => s.creditInfo);
  const done = usePrintStore((s) => s.done);

  useEffect(() => {
    if (!sale) return;
    // useEffect ya corre con el DOM commiteado (el ticket está en el árbol),
    // y window.print() serializa el DOM actual: no hace falta esperar a que
    // pinte. Se usa setTimeout y NO requestAnimationFrame a propósito: con la
    // ventana minimizada u oculta el navegador PAUSA los rAF, y la impresión
    // se perdería en silencio; los timers siguen corriendo igual.
    const id = setTimeout(() => {
      try {
        window.print();
      } finally {
        // Pase lo que pase, se libera la cola: un fallo al imprimir no puede
        // dejar la app sin poder imprimir nunca más.
        done();
      }
    }, 0);
    return () => clearTimeout(id);
  }, [sale, done]);

  if (!sale) return null;

  const count = ticketItemCount(
    sale.items.map((i) => ({
      productId: i.productId, name: i.productName, unitPriceCents: i.unitPriceCents, qty: i.qty,
    })),
  );

  return createPortal(
    <div
      id="kios-print-root"
      style={{
        fontFamily: '"Consolas", "Courier New", monospace',
        color: "#000",
        background: "#fff",
        width: "72mm",
        fontSize: "11px",
        lineHeight: 1.45,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        <div style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "0.04em" }}>
          {businessName.trim() || "kiOS"}
        </div>
        <div style={{ fontSize: "10px" }}>
          {new Date(sale.createdAt).toLocaleString("es-AR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </div>
        {sale.cashierName && (
          <div style={{ fontSize: "10px" }}>Atendió: {sale.cashierName}</div>
        )}
      </div>

      {sale.voidedAt && (
        <div
          style={{
            textAlign: "center",
            border: "1.5px solid #000",
            padding: "3px",
            margin: "6px 0",
            fontWeight: 700,
            letterSpacing: "0.12em",
          }}
        >
          ANULADA
        </div>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id}>
              <td style={{ verticalAlign: "top", paddingBottom: "3px" }}>
                {item.productName}
                <div style={{ fontSize: "10px" }}>
                  {item.qty} × {formatARS(item.unitPriceCents)}
                </div>
              </td>
              <td
                style={{
                  verticalAlign: "top",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  paddingLeft: "6px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatARS(item.unitPriceCents * item.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
        <span>{count} artículo{count === 1 ? "" : "s"}</span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontWeight: 700,
          fontSize: "16px",
          marginTop: "3px",
        }}
      >
        <span>TOTAL</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatARS(sale.totalCents)}</span>
      </div>

      {sale.payments.map((p, i) => (
        <div
          key={i}
          style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginTop: "2px" }}
        >
          <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatARS(p.amountCents)}</span>
        </div>
      ))}

      {/* Comprobante de fiado: es lo que se lleva el cliente como constancia
          de cuánto quedó debiendo. Recuadrado para que no se confunda con un
          ticket pagado. */}
      {creditInfo && (
        <div
          style={{
            border: "1.5px solid #000",
            padding: "5px",
            marginTop: "6px",
            fontSize: "11px",
          }}
        >
          <div style={{ textAlign: "center", fontWeight: 700, letterSpacing: "0.1em" }}>FIADO</div>
          <div style={{ marginTop: "3px" }}>Cliente: {creditInfo.customerName}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Debe</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatARS(creditInfo.balanceCents)}
            </span>
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <div style={{ textAlign: "center", fontSize: "10px" }}>
        <div>{creditInfo ? "¡Gracias! Te esperamos." : "¡Gracias por su compra!"}</div>
        <div style={{ marginTop: "2px" }}>No válido como factura</div>
      </div>
    </div>,
    document.body,
  );
}
