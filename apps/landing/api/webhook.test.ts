/**
 * `external_reference` es el único canal por el que el nombre y el mail del
 * comprador sobreviven hasta el webhook (no hay base de datos). Si el
 * parseo falla, la compra se cobra y la licencia no sale.
 */
import { describe, expect, it } from "vitest";
import { parseExternalReference } from "./webhook";

describe("parseExternalReference", () => {
  it("separa nombre y mail", () => {
    expect(parseExternalReference("kios|Kiosco La Esquina|vos@ejemplo.com")).toEqual({
      name: "Kiosco La Esquina",
      email: "vos@ejemplo.com",
    });
  });

  it("no se confunde con nombres que traen espacios o acentos", () => {
    expect(parseExternalReference("kios|Almacén Doña Rocío|a@b.com")?.name).toBe(
      "Almacén Doña Rocío",
    );
  });

  it("devuelve null ante cualquier cosa que no sea nuestro formato", () => {
    for (const bad of [
      null,
      "",
      "kios",
      "kios|solo-nombre",
      "otro|Nombre|a@b.com",
      "kios||a@b.com",
      "kios|   |a@b.com",
      "kios|Nombre|sin-arroba",
      // Un `|` de más significa que el nombre traía el separador: mejor
      // fallar y revisarlo a mano que mandarle la licencia a "b.com".
      "kios|Nombre|a@b.com|extra",
    ]) {
      expect(parseExternalReference(bad)).toBeNull();
    }
  });
});
