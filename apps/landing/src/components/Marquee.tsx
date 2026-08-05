/**
 * Marquesina de productos de kiosco.
 *
 * Cumple dos funciones: separa el hero de las funciones sin meter un
 * separador vacío, y le pone acento local a la página — son los productos
 * reales que trae kiOS de ejemplo, no "Item 1, Item 2". Alguien que atiende
 * un kiosco reconoce su góndola en esa fila.
 *
 * El truco del loop infinito: la lista va DUPLICADA y la animación corre de
 * 0 a -50%. Al llegar, la segunda copia está exactamente donde arrancó la
 * primera y el salto no se ve.
 */
const PRODUCTS = [
  "Alfajor triple",
  "Gaseosa cola 500ml",
  "Cigarrillos 20u",
  "Chicles menta",
  "Yerba 1kg",
  "Agua mineral 500ml",
  "Turrón de maní",
  "Pilas AA x2",
  "Café instantáneo",
  "Galletitas de agua",
  "Encendedor",
  "Caramelos surtidos",
  "Cerveza lata 473ml",
  "Papel higiénico x4",
];

export function Marquee() {
  return (
    <div
      className="relative flex overflow-hidden border-y border-line-soft bg-pit/60 py-4 select-none"
      aria-hidden
    >
      {/* Degradés a los costados: sin esto los renglones aparecen y
          desaparecen de golpe contra el borde. `via-void` además de `from`
          para que el ámbar del punto separador termine de apagarse antes
          del filo — con un degradé lineal simple todavía se veía asomar. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-40 bg-gradient-to-r from-void via-void/85 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-40 bg-gradient-to-l from-void via-void/85 to-transparent" />

      <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10">
        {[...PRODUCTS, ...PRODUCTS].map((product, index) => (
          <span key={index} className="flex shrink-0 items-center gap-10 text-[15px] text-faint">
            {product}
            <span className="size-1 rounded-full bg-brand/50" />
          </span>
        ))}
      </div>
    </div>
  );
}
