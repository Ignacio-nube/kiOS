/**
 * Una captura de la app dentro de un marco de ventana.
 *
 * El marco no es decoración: una captura a sangre sobre fondo oscuro se lee
 * como "imagen de stock". Con la barra de título y el nombre de la pantalla
 * se lee como "esto es un programa que corre en tu PC", que es exactamente
 * lo que se está vendiendo.
 *
 * El brillo ámbar detrás resuelve un problema concreto: la app en tema Claro
 * es casi blanca y, contra el negro de la landing, el borde corta como un
 * recorte de papel. El halo hace de transición.
 */
import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

interface AppShotProps {
  src: string;
  alt: string;
  /** Lo que dice la barra de título: "kiOS — Venta". */
  label: string;
  /** Inclinación 3D siguiendo el mouse. Solo para la pieza protagonista. */
  tilt?: boolean;
  className?: string;
  priority?: boolean;
}

export function AppShot({ src, alt, label, tilt = false, className = "", priority = false }: AppShotProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // -0.5..0.5 respecto del centro del elemento. Los hooks se llaman siempre
  // (regla de hooks); si el tilt está apagado, simplemente nadie los mueve.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [7, -7]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-9, 9]), { stiffness: 150, damping: 20 });

  const interactive = tilt && !reduced;

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!interactive || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    px.set((event.clientX - box.left) / box.width - 0.5);
    py.set((event.clientY - box.top) / box.height - 0.5);
  }

  function handleLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div className={`relative ${className}`} style={{ perspective: 1400 }}>
      {/* Halo ámbar. `blur-3xl` + baja opacidad: tiene que sentirse como luz
          derramada, no como un rectángulo de color detrás de la imagen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem] bg-brand/16 blur-3xl"
      />

      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={interactive ? { rotateX, rotateY, transformStyle: "preserve-3d" } : undefined}
        className="overflow-hidden rounded-xl border border-line bg-panel shadow-[0_40px_90px_-30px_rgb(0_0_0/0.85)]"
      >
        <div className="flex items-center gap-2 border-b border-line bg-raised px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="ml-2 text-[13px] text-dimmer">{label}</span>
        </div>
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="block w-full"
        />
      </motion.div>
    </div>
  );
}
