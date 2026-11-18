// Decide cuando hacer las capturas de la web en función de si es manual o automático
const DOMINIOS_AUTOMATICOS = [
  "web.whatsapp.com",
  "web.telegram.org"
];

const dominioActual = window.location.hostname;
const historialEnviados = new Set();

// Durante los primeros segundos solo captura los chats marcados como "sin leer"
let esPrimeraPasada = true;

// Función auxiliar para crear una huella única rápida de cada texto
function generarHuella(texto) {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) - hash) + texto.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

function obtenerHoraActual() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Modo automático
if (DOMINIOS_AUTOMATICOS.includes(dominioActual)) {
  console.log(`[Extractor] Iniciando lectura de no leídos y vigilancia en ${dominioActual}...`);
  iniciarVigilanteChat();

  // Tras 3 segundos de carga inicial, pasamos a capturar cualquier mensaje nuevo que llegue
  setTimeout(() => {
    escanearChats();
    esPrimeraPasada = false;
    console.log(`[Extractor] Vigilancia en tiempo real activa en ${dominioActual}.`);
  }, 3000);
}

function escanearChats() {
  if (dominioActual === "web.whatsapp.com") {
    procesarWhatsApp();
  } else if (dominioActual === "web.telegram.org") {
    procesarTelegram();
  }
}

function iniciarVigilanteChat() {
  const observer = new MutationObserver(() => {
    escanearChats();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function procesarWhatsApp() {
  document.querySelectorAll('[data-testid="cell-frame-container"]').forEach((fila) => {
    const contacto = fila.querySelector('[data-testid="cell-frame-title"]')?.innerText?.trim() || "";
    const ultimoMensaje = fila.querySelector('[data-testid="last-msg-status"]')?.innerText?.trim();
    const hora = fila.querySelector('[data-testid="chat-list-timestamp"]')?.innerText?.trim() || obtenerHoraActual();

    if (!ultimoMensaje) return;

    const idUnico = generarHuella(`wa_lista_${contacto}_${hora}_${ultimoMensaje}`);
    if (historialEnviados.has(idUnico)) return;
    historialEnviados.add(idUnico);

    // Detecta el globo de mensajes sin leer en WhatsApp (por testid o aria-label)
    const tieneSinLeer = Boolean(
      fila.querySelector('[data-testid="icon-unread-count"], span[aria-label*="no leído"], span[aria-label*="unread"]')
    );

    // En la carga inicial, ignoramos los chats que ya estaban leídos
    if (esPrimeraPasada && !tieneSinLeer) return;

    console.log(`[WhatsApp ${tieneSinLeer ? 'Sin leer' : 'Nuevo'} ${hora}]: ${ultimoMensaje}`);

    enviarAlBackground({
      tipo: "mensaje_chat",
      origen: dominioActual,
      contenido: ultimoMensaje,
      fecha: hora
    });
  });
}

function procesarTelegram() {
  const filasChats = document.querySelectorAll('a.chatlist-chat[data-peer-id], ul.chatlist li, .Chat, .chat-item-clickable');

  filasChats.forEach((fila) => {
    const peerId = fila.getAttribute('data-peer-id') || "";
    const contacto = fila.querySelector('.peer-title, .fullName, h3')?.innerText?.trim() || "";
    const ultimoMensaje = fila.querySelector('.dialog-subtitle-span-last, .dialog-subtitle-parts, .user-last-message, .last-message')?.innerText?.trim();
    const hora = fila.querySelector('.message-time, .time')?.innerText?.trim() || obtenerHoraActual();

    if (!ultimoMensaje) return;

    const idUnico = generarHuella(`tg_lista_${peerId || contacto}_${hora}_${ultimoMensaje}`);
    if (historialEnviados.has(idUnico)) return;
    historialEnviados.add(idUnico);

    // Detecta el globo de mensajes sin leer (en Telegram Web K usa .dialog-subtitle-badge-unread.is-visible)
    const badgeSinLeer = fila.querySelector('.dialog-subtitle-badge-unread.is-visible, .dialog-subtitle-badge.unread, .Badge, .unread');
    const tieneSinLeer = Boolean(badgeSinLeer && badgeSinLeer.innerText.trim() !== "");

    // En la carga inicial, ignoramos los chats que ya estaban leídos
    if (esPrimeraPasada && !tieneSinLeer) return;

    console.log(`[Telegram ${tieneSinLeer ? 'Sin leer' : 'Nuevo'} ${hora}]: ${ultimoMensaje}`);

    enviarAlBackground({
      tipo: "mensaje_chat",
      origen: dominioActual,
      contenido: ultimoMensaje,
      fecha: hora
    });
  });
}

// Modo manual
browser.runtime.onMessage.addListener((mensaje) => {
  if (mensaje.accion === "DISPARO_MANUAL") {
    const seleccion = window.getSelection().toString().trim();
    
    let contenidoExtraido = seleccion;
    if (!contenidoExtraido) {
      const contenedorPrincipal = document.querySelector('article, main, [role="main"]') || document.body;
      contenidoExtraido = contenedorPrincipal.innerText.trim();
    }

    enviarAlBackground({
      tipo: seleccion ? "seleccion_web" : "pagina_web",
      origen: dominioActual,
      url: window.location.href,
      titulo: document.title,
      contenido: contenidoExtraido,
      fecha: new Date().toISOString()
    });
  }
});

// Función para enviar a background.js
function enviarAlBackground(paquete) {
  browser.runtime.sendMessage({
    tipo: "DATOS_CAPTURADOS",
    payload: paquete
  });
}