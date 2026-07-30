/**
 * El mail con el código de activación.
 *
 * Es el ÚNICO lugar donde el cliente va a tener su licencia: no hay cuenta
 * de usuario ni panel donde volver a buscarla. De ahí las tres decisiones
 * del cuerpo: el código va en texto plano (copiable, no en una imagen ni
 * en un botón), va con las instrucciones al lado (para no tener que
 * volver al sitio), y el asunto lleva el nombre del comprador para que se
 * encuentre buscando dentro del correo dentro de seis meses.
 *
 * El mail dice que la activación es **sin internet** porque es cierto y es
 * una ventaja concreta: la app verifica la firma con la clave pública que
 * ya trae, sin llamar a ningún lado. Un kiosco con el módem caído puede
 * activar igual.
 */

export interface LicenseEmail {
  to: string;
  customer: string;
  licenseKey: string;
  from: string;
  apiKey: string;
  supportEmail: string;
}

export async function sendLicenseEmail(mail: LicenseEmail): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${mail.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: mail.from,
      to: [mail.to],
      reply_to: mail.supportEmail,
      subject: `Tu código de activación de kiOS — ${mail.customer}`,
      text: plainText(mail),
      html: html(mail),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend rechazó el envío (${response.status}): ${detail.slice(0, 300)}`);
  }
}

const STEPS = [
  "Abrí kiOS en tu computadora.",
  "Andá a Configuración → Licencia.",
  "Pegá el código y tocá Activar. No hace falta internet.",
];

function plainText({ customer, licenseKey, supportEmail }: LicenseEmail): string {
  return `¡Gracias por comprar kiOS, ${customer}!

Tu código de activación:

${licenseKey}

Cómo activarlo:
${STEPS.map((step, i) => `  ${i + 1}. ${step}`).join("\n")}

No vence: una vez activado, kiOS queda activado para siempre en esa
computadora, aunque después no tengas internet.

Guardá este mail — es el único lugar donde está el código.

¿Algún problema? Respondé este mail o escribinos a ${supportEmail}.
`;
}

function html({ customer, licenseKey, supportEmail }: LicenseEmail): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:32px 16px;background:#0b0a08;font-family:system-ui,'Segoe UI',Arial,sans-serif;color:#f2efe8;">
  <div style="max-width:560px;margin:0 auto;background:#16140f;border:1px solid #2a2620;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 8px;font-size:22px;color:#f8f6f1;">¡Gracias por comprar kiOS!</h1>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#b8b3a6;">
      Acá está tu código de activación, <strong style="color:#f2efe8;">${escapeHtml(customer)}</strong>.
      No vence y se activa sin internet.
    </p>

    <div style="background:#0b0a08;border:1px solid #2a2620;border-radius:12px;padding:18px;margin-bottom:28px;">
      <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8d8878;margin-bottom:10px;">
        Tu código
      </div>
      <!-- Monoespaciada y con word-break: son 250 caracteres y tiene que
           poder seleccionarse entero de un tirón en el celular. -->
      <code style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.7;color:#fdbf2d;word-break:break-all;">${escapeHtml(licenseKey)}</code>
    </div>

    <div style="font-size:15px;line-height:1.7;color:#b8b3a6;">
      <strong style="color:#f2efe8;">Cómo activarlo</strong>
      <ol style="margin:10px 0 0;padding-left:20px;">
        ${STEPS.map((step) => `<li style="margin-bottom:6px;">${escapeHtml(step)}</li>`).join("")}
      </ol>
    </div>

    <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #2a2620;font-size:13px;line-height:1.6;color:#6b6659;">
      Guardá este mail: es el único lugar donde está el código.<br>
      ¿Algún problema? Respondé este mail o escribinos a
      <a href="mailto:${escapeHtml(supportEmail)}" style="color:#fdbf2d;">${escapeHtml(supportEmail)}</a>.
    </p>
  </div>
</body></html>`;
}

/**
 * El nombre del negocio lo escribió el comprador en un formulario público.
 * Sin escapar, un `<script>` o un `"` mal puesto rompe el mail o algo peor
 * en el cliente que lo renderice.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
