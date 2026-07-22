---
name: kios-design
description: Design system de kiOS (POS para kioscos argentinos). Leer SIEMPRE antes de crear o modificar UI en apps/app o apps/landing — define tokens, componentes, reglas de color/tipografía y patrones de pantalla.
---

# kios-design — el sistema visual de kiOS

kiOS se usa parado, apurado y con gente esperando. Cada decisión visual
sirve a eso: legibilidad a un metro, targets grandes, foco obvio, cero
decoración que no informe. La estética es "herramienta de mostrador con
identidad", no dashboard de startup.

## Cuándo usar

Antes de escribir o revisar CUALQUIER UI de kiOS (pantallas, componentes,
landing). Si un cambio contradice este documento, el documento gana o se
actualiza el documento — nunca se ignora en silencio.

## Identidad

- Marca: monograma "k" con punto (`kios_logo_final_color_variants.svg`).
- **Ámbar kiosco `#FDBF2D`**: el amarillo de marquesina. Es EL acento y se
  gasta en una sola cosa por pantalla: la acción de dinero (Cobrar) y el
  anillo de foco. Si el ámbar aparece dos veces en una vista, sobra una.
- Tinta `#0B0B0C` / `#141413` sobre papel `#FAF9F7`. Superficies blancas.
- Solo tema claro en v1 (mostradores con luz). Los tokens ya están
  centralizados por si algún día hay tema oscuro.

## Tokens (fuente de verdad: `apps/app/src/index.css`)

| Token | Valor | Uso |
|---|---|---|
| `--paper` | `#FAF9F7` | fondo de app |
| `--surface` | `#FFFFFF` | cards, paneles, inputs |
| `--ink` | `#141413` | texto principal |
| `--ink-strong` | `#0B0B0C` | pizarra del ticket, botón primario |
| `--line` | `#E4E3E0` | bordes hairline |
| `--muted-ink` | `#6F6E69` | texto secundario |
| `--brand` | `#FDBF2D` | SOLO cobrar + foco + marca |
| `--brand-hover` | `#F0AE10` | hover del ámbar |
| `--brand-ink` | `#3D2E00` | texto sobre ámbar |
| `--ok` / `--warn` / `--danger` | `#1F8A50` / `#B45309` / `#C0392F` | semáforo de stock, estados |

Radios: `rounded-lg`/`rounded-xl` (el logo usa rx ≈ 22%). Bordes 1px
`--line`; sombras casi nunca (una superficie sobre papel no flota).

## Tipografía

- Stack del sistema (`system-ui, "Segoe UI", …`). NO SF Pro, NO webfonts
  en la app (licencia y arranque instantáneo).
- La personalidad sale del CONTRASTE DE PESO Y TAMAÑO, no de la familia:
  títulos 600-700 tracking apretado; cuerpo 400/500 en 14px; etiquetas
  11-12px uppercase con letterspacing.
- **Dinero y cantidades SIEMPRE con clase `tnum`** (tabular-nums): las
  columnas de números no bailan. Sin excepciones.
- Dinero siempre desde centavos enteros con `formatARS`/`formatARSWhole`
  (`src/domain/money.ts`); jamás formateo manual.

## Elemento firma: la pizarra

El panel del ticket en la pantalla de venta es una "pizarra" `--ink-strong`
con el TOTAL enorme en blanco (`<Money size="display">`), como los carteles
de precio de los kioscos. Es el único elemento oscuro de la app y el botón
Cobrar (ámbar, `size="xl"`) vive dentro. Nada más compite con él.

## Componentes

Propios (en `apps/app/src/ui/`, NUNCA reemplazar por shadcn):
- `Button` — variants: `primary` (tinta), `accent` (ámbar, solo dinero),
  `outline`, `ghost`, `danger`; sizes `sm|md|lg|xl` (xl = Cobrar).
- `Card` (+ `CardHeader/CardTitle/CardBody`), `Input` (foco ámbar,
  `size="lg"` para el buscador de venta), `Badge` (tones `ok|warn|danger|
  neutral|brand` — semáforo de stock), `ListRow` (+ Main/Title/Detail,
  min-h 48px), `Money`, `Kbd`, `EmptyState`.

shadcn PERMITIDOS (en `apps/app/src/ui/shadcn/`, agregados por CLI):
Dialog, Popover, Select, DropdownMenu, Tooltip, Sonner (toast), Command.
**Nada más de shadcn**: Button/Card/Input/Badge/filas son siempre propios.

Íconos: Lucide (`lucide-react`), tamaño 16/20/24, stroke por defecto.
NO SF Symbols. Animación: Motion (`motion/react`), con moderación: el
"pop" del total al escanear, transiciones de diálogo, y poco más.
`prefers-reduced-motion` ya se respeta globalmente desde index.css.

## Patrones de pantalla

- Layout: rail de navegación izquierdo angosto (íconos + etiqueta),
  contenido a la derecha. La app ABRE en Venta.
- Venta: dos columnas — izquierda buscador/scanner (input `lg`, SIEMPRE
  enfocado) + resultados; derecha la pizarra del ticket.
- Estados vacíos: siempre `EmptyState` con acción concreta ("Cargá tu
  primer producto"), nunca un hueco.
- Errores: qué pasó + cómo seguir, voz de la interfaz, sin disculpas.
  Toasts con sonner; éxito breve ("Venta registrada").
- Copy: es-AR, voseo, verbos directos ("Cobrar", "Reponer", "Anular").
  El botón dice exactamente lo que hace y mantiene su nombre en todo el
  flujo (Cobrar → toast "Venta registrada", no "Éxito").
- Teclado primero: atajos visibles con `<Kbd>`; Enter confirma, Esc
  cancela; el lector de barras es un teclado más.
- Demo web: banner superior fijo honesto ("Demo: los datos no se guardan
  de forma confiable") en `--brand`/20 con texto tinta.

## Accesibilidad (piso, no techo)

Foco visible ámbar en TODO control; contraste AA mínimo (tinta sobre papel
y sobre ámbar ya cumplen); targets ≥ 40px en flujo de venta; responsive
hasta 1024px (netbooks de kiosco); `prefers-reduced-motion` respetado.
