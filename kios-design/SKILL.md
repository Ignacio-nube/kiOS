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

- Marca: logo kiOS. **Fuente ÚNICA: `logo-kiOS.svg` en la RAÍZ del repo.**
  Todo lo demás (favicons `.ico`/PNG, apple-touch, set de íconos de
  escritorio Tauri, el SVG embebido en la app y en la landing) es DERIVADO
  por `npm run assets` (`scripts/generate-assets.mjs`, usa `sharp` + la CLI
  de Tauri). Si cambia el logo: se reemplaza ese archivo y se corre el
  comando — jamás se editan copias a mano. El monograma es un cuadrado
  ámbar autocontenido: mismo aspecto en los tres temas, sin recolorear.
  (El SVG viejo `kios_logo_final_color_variants.svg` quedó obsoleto.)
- **Ámbar kiosco `#FDBF2D`**: el amarillo de marquesina. Es EL acento y se
  gasta en una sola cosa por pantalla: la acción de dinero (Cobrar) y el
  anillo de foco. Si el ámbar aparece dos veces en una vista, sobra una.
  (El archivo del logo trae su propio ámbar `#FABA24`; el token de UI es
  `#FDBF2D` y es el que manda en pantalla.)
- Tinta `#0B0B0C` sobre gris de sistema `#F2F2F7` — paleta NEUTRA tipo
  Apple, no el papel cálido de antes. Superficies blancas.
- **Tres temas + Sistema** (Configuración → Apariencia, como el selector de
  X): Claro, Oscuro, Negro y "Sistema" (sigue el SO, resuelve a claro u
  oscuro). El ámbar y los mapeos semánticos NO cambian entre temas — solo
  la base (paper/surface/ink/line/muted-ink/estados). El tema Negro suma el
  material `glass` (ver "Material glass").

## Tokens (fuente de verdad: `apps/app/src/index.css`)

| Token | Claro | Oscuro | Negro | Uso |
|---|---|---|---|---|
| `--paper` | `#F2F2F7` | `#0B0B0C` | `#000000` | fondo de app |
| `--surface` | `#FFFFFF` | `#1C1C1E` | `#121212` | cards, inputs (sólida; el chrome de Negro usa `.glass`) |
| `--ink` | `#0B0B0C` | `#F2F2F7` | `#F2F2F7` | texto principal |
| `--ink-strong` | `#0B0B0C` | `#1A1A1C` | `#141414` | pizarra del ticket (ver abajo) |
| `--line` | `#E0E0E6` | `#2C2C2E` | `#2C2C2E` | bordes hairline |
| `--muted-ink` | `#6E6E73` | `#98989E` | `#98989E` | texto secundario |
| `--brand` | `#FDBF2D` | igual | igual | SOLO cobrar + foco + marca |
| `--brand-hover` | `#F0AE10` | igual | igual | hover del ámbar |
| `--brand-ink` | `#3D2E00` | igual | igual | texto sobre ámbar (SIEMPRE oscuro) |
| `--ok` / `--warn` / `--danger` | `#1F8A50`/`#B45309`/`#C0392F` | `#34C77B`/`#E08A3C`/`#E5564B` | igual que oscuro | semáforo, estados |

Radios: `rounded-lg`/`rounded-xl` (el logo usa rx ≈ 22%). Bordes 1px
`--line`; sombras casi nunca (una superficie sobre papel no flota).

**`--ink-strong` es un cartel siempre oscuro**: la pizarra del ticket
(abajo) es oscura en los tres temas (apenas varía para leerse como panel:
`#0B0B0C`/`#1A1A1C`/`#141414`). NO se usa como "botón que resalta", porque
en Oscuro/Negro ya no contrastaría contra el fondo. Para
eso existe `--primary`/`--primary-foreground` (mapeo semántico, en
Oscuro/Negro es el par `ink`/`paper` invertido: chip claro, texto oscuro).
El `Button` variant `primary` y cualquier "ítem activo" (nav rail, chips
de filtro) usan `bg-primary text-primary-foreground`, NUNCA
`bg-ink-strong text-white` directo — si necesitás ese patrón en un
componente nuevo, replicalo así o el contraste se rompe en Oscuro/Negro.

**Wash de color + texto fijo = riesgo de contraste.** Un fondo tipo
`bg-brand/20` (wash translúcido) combinado con un texto de color FIJO
(`text-brand-ink`, que no cambia entre temas) puede volverse ilegible en
Oscuro/Negro. La regla: si el texto no se adapta al tema, el fondo tiene
que ser sólido (`bg-brand`, no `bg-brand/20`) — así el `Badge` tone
`brand` usa ámbar sólido, no wash. Si el texto SÍ es un token adaptable
(`text-ink`, `text-muted-ink`), un wash como `bg-brand/20` es seguro (ver
`DemoBanner`).

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
de precio de los kioscos. En tema Claro es el único elemento oscuro de la
app; en Oscuro/Negro sigue siendo el mismo cartel (ink-strong no cambia),
apenas distinguible del fondo por diseño — es marca, no jerarquía. El botón
Cobrar (ámbar, `size="xl"`) vive dentro. Nada más compite con él.

## Temas: mecanismo

`next-themes` (`ThemeProvider` en `App.tsx`, `attribute="class"`,
`enableSystem`, `themes={["light","dark","black"]}`,
`storageKey="kios-theme"`, `defaultTheme="light"`). Es preferencia de ESTE
dispositivo (como el idioma del teclado), no dato de negocio: vive en
`localStorage`, nunca en la tabla `meta` sincronizable. La opción "Sistema"
(`setTheme("system")`) sigue `prefers-color-scheme` y resuelve a Claro u
Oscuro — NUNCA a Negro (Negro es elección manual). Script anti-flash en
`index.html`: lee `localStorage` antes de montar React; si el valor es
`dark`/`black` agrega esa clase a `<html>`, y si es `system` consulta
`matchMedia("(prefers-color-scheme: dark)")` para decidir.

El monograma (`KiosMark` en `App.tsx`) es un `<img>` del logo derivado
(`src/assets/logo.svg`, copia de la fuente única — ver Identidad): cuadrado
ámbar autocontenido, mismo aspecto en los tres temas sin swap.

## Material glass (SOLO tema Negro, SOLO chrome)

Vidrio esmerilado tipo Liquid Glass (NO el gloss Aqua de los 2000: sin
gradiente diagonal ni brillo especular). Vive en la clase `.glass`
(`index.css`) y se opta-in poniéndola EN LUGAR de `bg-surface`:

- En Claro y Oscuro `.glass` es una superficie sólida normal (`var(--surface)`),
  sin costo de blur.
- En Negro (`.black .glass`): tinte de blanco ~10% sobre el negro +
  `backdrop-filter: blur(20px) saturate(180%)` + filo de luz 1px en el
  borde superior (`inset 0 1px 0`). Bajo `prefers-reduced-transparency`
  vuelve a superficie sólida.

**Dónde va**: chrome — nav rail (`App.tsx`) y modales/sheets
(`DialogContent`). **Dónde NO, sin excepción**: la pantalla de venta. Ahí
las superficies quedan sólidas y opacas incluso en Negro — el presupuesto
es 150ms/repintado y `backdrop-filter` cuesta por frame. Si sumás glass a
un componente nuevo, que sea chrome, y medí el costo en el WebView de Tauri
(WebView2) antes de aplicarlo ancho: puede rendir distinto a Chrome normal.

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
- Selector de tema (Configuración → Apariencia): swatches clickeables con
  preview real de color (paper + surface), no un `<Select>` de texto —
  igual patrón que un color picker, el usuario ve el tema antes de tocarlo.
  Cuatro: Claro/Oscuro/Negro + "Sistema" (preview partido en diagonal
  claro/oscuro con ícono `Monitor`).

## Accesibilidad (piso, no techo)

Foco visible ámbar en TODO control; contraste AA mínimo (tinta sobre papel
y sobre ámbar ya cumplen); targets ≥ 40px en flujo de venta; responsive
hasta 1024px (netbooks de kiosco); `prefers-reduced-motion` respetado.
