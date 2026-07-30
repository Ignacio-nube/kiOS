/**
 * La landing entera, en orden de lectura: qué es → cómo se ve funcionando →
 * qué más hace → cómo se empieza → cuánto sale → probalo.
 *
 * El grano va acá, una sola vez, sobre TODO el fondo. Los degradés grandes
 * en pantalla oscura muestran banding; el ruido lo rompe. `fixed` y no
 * `absolute` para que no tenga que redibujarse al scrollear.
 */
import { Gracias } from "./components/Gracias";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Marquee } from "./components/Marquee";
import { Features } from "./components/Features";
import { Showcase } from "./components/Showcase";
import { Extras } from "./components/Extras";
import { Steps } from "./components/Steps";
import { Pricing } from "./components/Pricing";
import { FinalCta } from "./components/FinalCta";
import { Footer } from "./components/Footer";

export default function App() {
  // Dos páginas no justifican un router (react-router pesa más que toda
  // esta landing). `/gracias` es el destino de vuelta de Mercado Pago y se
  // resuelve leyendo el pathname una vez: no hay navegación entre ellas.
  const isGracias = window.location.pathname.replace(/\/$/, "") === "/gracias";

  return (
    <>
      <div
        aria-hidden
        className="grain-layer pointer-events-none fixed inset-0 z-0 opacity-[0.035] mix-blend-overlay"
      />

      {isGracias ? (
        <div className="relative z-10">
          <Gracias />
        </div>
      ) : (
        <div className="relative z-10">
          <Nav />
          <main>
            <Hero />
            <Marquee />
            <Features />
            <Showcase />
            <Extras />
            <Steps />
            <Pricing />
            <FinalCta />
          </main>
          <Footer />
        </div>
      )}
    </>
  );
}
