// Decide cuando hacer las capturas de la web en función de si es manual o automático
const DOMINIOS_AUTOMATICOS = [
  "web.whatsapp.com",
  "web.telegram.org"
];

const dominioActual = window.location.hostname;
const historialEnviados = new Set();

// Función auxiliar para crear una huella única rápida de cada texto
function generarHuella(texto) {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) - hash) + texto.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

// Modo automático
if (DOMINIOS_AUTOMATICOS.includes(dominioActual)) {
  console.log(`[Extractor] Vigilante de mensajes iniciado en ${dominioActual}`);
  iniciarVigilanteChat();
}

function iniciarVigilanteChat() {
  const observer = new MutationObserver(() => {
    if (dominioActual === "web.whatsapp.com") {
      procesarWhatsApp();
    } else if (dominioActual === "web.telegram.org") {
      procesarTelegram();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function procesarWhatsApp() {
  const chatActivo = document.querySelector('header span[title]')?.getAttribute('title') || "Chat WhatsApp";
  
  document.querySelectorAll('div.message-in, div.message-out').forEach((nodo) => {
    const texto = nodo.querySelector('span.selectable-text')?.innerText?.trim();
    if (!texto) return;

    const esSaliente = nodo.classList.contains('message-out');
    const idUnico = nodo.getAttribute('data-id') || generarHuella(`${chatActivo}_${texto}`);

    if (historialEnviados.has(idUnico)) return;
    historialEnviados.add(idUnico);

    enviarAlBackground({
      tipo: "mensaje_chat",
      origen: dominioActual,
      chat: chatActivo,
      direccion: esSaliente ? "enviado" : "recibido",
      contenido: texto,
      fecha: new Date().toISOString()
    });
  });
}

function procesarTelegram() {
  const chatActivo = document.querySelector('.chat-info .peer-title, .ChatInfo .title')?.innerText?.trim() || "Chat Telegram";

  document.querySelectorAll('.message, .Message').forEach((nodo) => {
    const texto = nodo.querySelector('.text-content, .message-content')?.innerText?.trim();
    if (!texto) return;

    const idUnico = nodo.getAttribute('data-mid') || nodo.id || generarHuella(`${chatActivo}_${texto}`);

    if (historialEnviados.has(idUnico)) return;
    historialEnviados.add(idUnico);

    enviarAlBackground({
      tipo: "mensaje_chat",
      origen: dominioActual,
      chat: chatActivo,
      direccion: nodo.classList.contains('is-out') || nodo.classList.contains('own') ? "enviado" : "recibido",
      contenido: texto,
      fecha: new Date().toISOString()
    });
  });
}

// Modo manual
browser.runtime.onMessage.addListener((mensaje) => {
  if (mensaje.accion === "DISPARO_MANUAL") {
    const seleccion = window.getSelection().toString().trim();
    
    // Si no hay texto seleccionado, busca el bloque principal (<article> o <main>) o usa el body
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