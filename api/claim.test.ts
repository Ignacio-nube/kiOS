import { describe, expect, it } from "vitest";
import { maskEmail } from "./claim";

/**
 * `/api/claim` responde a cualquiera que traiga un payment_id, así que su
 * respuesta no puede filtrar la casilla completa del comprador.
 */
describe("maskEmail", () => {
  it("deja ver la inicial y el dominio, nada más", () => {
    expect(maskEmail("vos@ejemplo.com")).toBe("v**@ejemplo.com");
    expect(maskEmail("nacho.marquez45@gmail.com")).toBe("n**************@gmail.com");
  });

  it("no delata el largo real cuando el usuario es de un solo carácter", () => {
    expect(maskEmail("a@b.com")).toBe("a*@b.com");
  });

  it("ante algo que no es un mail no devuelve el original", () => {
    expect(maskEmail("sin-arroba")).toBe("***");
    expect(maskEmail("")).toBe("***");
  });
});
