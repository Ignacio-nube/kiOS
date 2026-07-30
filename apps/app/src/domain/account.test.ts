import { describe, expect, it } from "vitest";
import {
  accountBalance, availableCredit, balanceLabel, creditStatus, creditStatusAfter,
} from "./account";

describe("accountBalance", () => {
  it("suma el ledger: positivo debe, negativo a favor", () => {
    // fiado 1000, fiado 500, pagó 800 → debe 700
    expect(accountBalance([
      { deltaCents: 100000 }, { deltaCents: 50000 }, { deltaCents: -80000 },
    ])).toBe(70000);
  });

  it("cuenta vacía = 0", () => {
    expect(accountBalance([])).toBe(0);
  });

  it("pagar de más deja saldo a favor (negativo)", () => {
    expect(accountBalance([{ deltaCents: 50000 }, { deltaCents: -80000 }])).toBe(-30000);
  });
});

describe("creditStatus", () => {
  it("sin límite nunca opina", () => {
    expect(creditStatus(0, null)).toBe("none");
    expect(creditStatus(999999999, null)).toBe("none");
  });

  it("al día o a favor siempre es ok", () => {
    expect(creditStatus(0, 100000)).toBe("ok");
    expect(creditStatus(-50000, 100000)).toBe("ok");
  });

  it("near a partir del 80% del límite", () => {
    expect(creditStatus(79999, 100000)).toBe("ok");
    expect(creditStatus(80000, 100000)).toBe("near"); // borde exacto
    expect(creditStatus(99999, 100000)).toBe("near");
  });

  it("over al alcanzar el límite, aunque sea por un centavo", () => {
    expect(creditStatus(100000, 100000)).toBe("over"); // borde exacto
    expect(creditStatus(100001, 100000)).toBe("over");
  });

  it("límite 0 = cualquier deuda lo excede", () => {
    expect(creditStatus(1, 0)).toBe("over");
    expect(creditStatus(0, 0)).toBe("ok");
  });
});

describe("creditStatusAfter", () => {
  it("proyecta el estado con la venta que se está por cerrar", () => {
    // debe 50.000, límite 100.000, se lleva 60.000 → se pasa
    expect(creditStatusAfter(50000, 100000, 60000)).toBe("over");
    // la misma venta sin límite no dice nada
    expect(creditStatusAfter(50000, null, 60000)).toBe("none");
    // cae justo en la zona de aviso
    expect(creditStatusAfter(50000, 100000, 35000)).toBe("near");
  });
});

describe("availableCredit", () => {
  it("null sin límite", () => {
    expect(availableCredit(50000, null)).toBeNull();
  });

  it("lo que queda antes del límite", () => {
    expect(availableCredit(30000, 100000)).toBe(70000);
  });

  it("nunca negativo aunque esté excedido", () => {
    expect(availableCredit(150000, 100000)).toBe(0);
  });

  it("con saldo a favor puede fiar más que el límite", () => {
    expect(availableCredit(-20000, 100000)).toBe(120000);
  });
});

describe("balanceLabel", () => {
  it("traduce el signo a algo legible", () => {
    expect(balanceLabel(50000)).toBe("Debe");
    expect(balanceLabel(-50000)).toBe("A favor");
    expect(balanceLabel(0)).toBe("Al día");
  });
});
