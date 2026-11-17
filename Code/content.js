// Decide cuando hacer las capturas de la web en función de si es manual o automático
const DOMINIOS_AUTOMATICOS = [
  "web.whatsapp.com",
  "web.telegram.org"
];

const dominioActual = window.location.hostname;
const historialEnviados = new Set();

// Bandera para ignorar los mensajes antiguos que ya están en pantalla al abrir la web
let modoCalibracion = true;

// Guardamos el instante exacto en que empieza la transmisión (con 60s de margen por redondeo de minutos)
const timestampInicio = Date.now() - 60000;

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

// Comprueba si la hora extraída (ej. "12:54") es igual o posterior al inicio de la ejecución
function esMensajeMasReciente(horaTexto) {
  if (!horaTexto) return false;
  
  // Busca formato HH:MM (24h o 12h AM/PM). Si pone "Ayer", "lun." o fecha pasada, devuelve false
  const coincidencia = horaTexto.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!coincidencia) return false;

  let horas = parseInt(coincidencia[1], 10);
  const minutos = parseInt(coincidencia[2], 10);
  const periodo = coincidencia[3]?.toUpperCase();

  if (periodo === "PM" && horas < 12) horas += 12;
  if (periodo === "AM" && horas === 12) horas = 0;

  const fechaMensaje = new Date();
  fechaMensaje.setHours(horas, minutos, 0, 0);

  return fechaMensaje.getTime() >= timestampInicio;
}

// Modo automático
if (DOMINIOS_AUTOMATICOS.includes(dominioActual)) {
  console.log(`[Extractor] Calibrando mensajes previos en ${dominioActual} (inicio: ${obtenerHoraActual()})...`);
  iniciarVigilanteChat();

  // Tras 3.5 segundos de carga inicial, registramos todo lo antiguo y empezamos a capturar solo lo nuevo
  setTimeout(() => {
    escanearChats();
    modoCalibracion = false;
    console.log(`[Extractor] Vigilante activo en ${dominioActual}: capturando SOLO mensajes nuevos posteriores a ${obtenerHoraActual()}.`);
  }, 3500);
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
  // Lee el último mensaje de todos los chats en la lista izquierda
  document.querySelectorAll('[data-testid="cell-frame-container"]').forEach((fila) => {
    const contacto = fila.querySelector('[data-testid="cell-frame-title"]')?.innerText?.trim() || "";
    const ultimoMensaje = fila.querySelector('[data-testid="last-msg-status"]')?.innerText?.trim();
    const hora = fila.querySelector('[data-testid="chat-list-timestamp"]')?.innerText?.trim() || "";

    if (!ultimoMensaje) return;

    const idUnico = generarHuella(`wa_lista_${contacto}_${hora}_${ultimoMensaje}`);
    if (historialEnviados.has(idUnico)) return;
    historialEnviados.add(idUnico);

    if (modoCalibracion) return;
    if (!esMensajeMasReciente(hora)) return;

    console.log(`[WhatsApp Nuevo ${hora}]: ${ultimoMensaje}`);

    enviarAlBackground({
      tipo: "mensaje_chat",
      origen: dominioActual,
      contenido: ultimoMensaje,
      fecha: hora
    });
  });
}

function procesarTelegram() {
  // Lee el último mensaje de todos los chats en la lista izquierda (compatible con Telegram Web K y Web A)
  const filasChats = document.querySelectorAll('ul.chatlist li, .Chat, .chat-item-clickable');

  filasChats.forEach((fila) => {
    const contacto = fila.querySelector('.peer-title, .fullName, h3')?.innerText?.trim() || "";
    const ultimoMensaje = fila.querySelector('.user-last-message, .last-message, .dialog-subtitle')?.innerText?.trim();
    const hora = fila.querySelector('.message-time, .time')?.innerText?.trim() || "";

    if (!ultimoMensaje) return;

    const idUnico = generarHuella(`tg_lista_${contacto}_${hora}_${ultimoMensaje}`);
    if (historialEnviados.has(idUnico)) return;
    historialEnviados.add(idUnico);

    // 1. Ignorar durante la carga inicial
    if (modoCalibracion) return;

    // 2. Asegurar que la hora del mensaje sea igual o posterior al inicio de la transmisión
    if (!esMensajeMasReciente(hora)) return;

    console.log(`[Telegram Nuevo ${hora}]: ${ultimoMensaje}`);

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