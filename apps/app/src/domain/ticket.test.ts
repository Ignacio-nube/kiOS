import { describe, expect, it } from "vitest";
import {
  addToTicket, changeDue, removeFromTicket, setTicketQty, ticketItemCount, ticketTotal,
  type TicketLine,
} from "./ticket";

const alfajor = { id: "a", name: "Alfajor", priceCents: 800 };
const coca = { id: "c", name: "Coca", priceCents: 1500 };

describe("ticket", () => {
  it("agrega y mergea líneas del mismo producto", () => {
    let lines: TicketLine[] = [];
    lines = addToTicket(lines, alfajor);
    lines = addToTicket(lines, coca, 2);
    lines = addToTicket(lines, alfajor);
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.productId === "a")!.qty).toBe(2);
    expect(ticketItemCount(lines)).toBe(4);
  });

  it("setTicketQty con 0 elimina la línea", () => {
    let lines = addToTicket([], alfajor, 3);
    lines = setTicketQty(lines, "a", 0);
    expect(lines).toHaveLength(0);
  });

  it("remove saca la línea completa", () => {
    let lines = addToTicket(addToTicket([], alfajor), coca);
    lines = removeFromTicket(lines, "c");
    expect(lines.map((l) => l.productId)).toEqual(["a"]);
  });

  it("total = suma de precio × cantidad", () => {
    const lines = addToTicket(addToTicket([], alfajor, 3), coca, 1);
    expect(ticketTotal(lines)).toBe(3 * 800 + 1500);
    expect(ticketTotal([])).toBe(0);
  });

  it("changeDue: vuelto o null si no alcanza", () => {
    expect(changeDue(3900, 5000)).toBe(1100);
    expect(changeDue(3900, 3900)).toBe(0);
    expect(changeDue(3900, 3000)).toBeNull();
  });
});
