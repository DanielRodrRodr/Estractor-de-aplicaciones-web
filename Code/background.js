//Opera de fondo escuchando si se activa el disparador manual para realizar la lectura.
const SERVER_URL = "http://localhost:8000/api/guardar";
const API_KEY = "Mi-clave-secreta-2026";


// Crea la opción en el menú de clic derecho al instalar la extensión
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "enviar",
    title: "Enviar selección/página a mi servidor",
    contexts: ["page", "selection"]
  });
  browser.alarms.create("reintentarCola", { periodInMinutes: 2 });
});

// Disparador Manual A: Clic en el icono de la barra de herramientas
browser.action.onClicked.addListener((tab) => {
  activarCapturaManual(tab.id, "paginaA");
});

// Disparador Manual B: Clic en el menú contextual (botón derecho)
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "enviar") {
    activarCapturaManual(tab.id, "paginaB");
  }
});

// Función que envía la orden al script dentro de la pestaña
function activarCapturaManual(tabId, modo) {
  browser.tabs.sendMessage(tabId, {
    accion: "DISPARO_MANUAL",
    modo: modo
  }).catch((err) => console.warn("Pestaña no accesible:", err));
}

// Llama a la funcion que envía mensajes al servidor
browser.runtime.onMessage.addListener((mensaje) => {
  if (mensaje.tipo === "DATOS_CAPTURADOS") {
    enviarAlServidor(mensaje.payload);
  }
});

// Envía los mensajes al servidor
async function enviarAlServidor(paquete, esReintento = false) {
  try {
    const respuesta = await fetch(SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify(paquete)
    });

    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

    // Éxito: mostramos badge verde temporalmente
    mostrarEstado("✓", "#22c55e");
    console.log("Enviado y guardado en servidor:", paquete.origen);
    return true;

  } catch (error) {
    console.warn("Servidor no disponible, guardando en cola local:", error.message);
    mostrarEstado("!", "#f97316");
    if (!esReintento) {
      await guardarEnCola(paquete);
    }
    return false;
  }
}

// Guarda os mensajes si no se puede acceder al servidor
async function guardarEnCola(paquete) {
  const { colaPendientes = [] } = await browser.storage.local.get("colaPendientes");
  colaPendientes.push(paquete);
  await browser.storage.local.set({ colaPendientes });
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "reintentarCola") {
    const { colaPendientes = [] } = await browser.storage.local.get("colaPendientes");
    if (colaPendientes.length === 0) return;

    const restantes = [];
    for (const item of colaPendientes) {
      const enviado = await enviarAlServidor(item, true);
      if (!enviado) restantes.push(item);
    }
    await browser.storage.local.set({ colaPendientes: restantes });
  }
});

//Muestra el estado
function mostrarEstado(texto, color) {
  browser.action.setBadgeText({ text: texto });
  browser.action.setBadgeBackgroundColor({ color: color });
  setTimeout(() => browser.action.setBadgeText({ text: "" }), 3000);
}