//Opera de fondo escuchando si se activa el disparador manual para realizar la lectura.
const SERVER_URL = "http://localhost:8000/api/guardar";
const API_KEY = "MI.Clave.Secreta.2004";

// Clave compartida de EXACTAMENTE 32 caracteres (debe ser idéntica en servidor.py)
const CLAVE_TRANSPORTE = "!!ClaveSecretaDe32Caracteres2015";

// Cifra el paquete con AES-GCM antes de enviarlo por red
async function cifrarPaquete(objeto) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(CLAVE_TRANSPORTE),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datosPlanos = enc.encode(JSON.stringify(objeto));

  const cifradoBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    keyMaterial,
    datosPlanos
  );

  return {
    iv: btoa(String.fromCharCode(...iv)),
    payload_cifrado: btoa(String.fromCharCode(...new Uint8Array(cifradoBuffer)))
  };
}

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
    const sobreCifrado = await cifrarPaquete(paquete);

    const respuesta = await fetch(SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify(sobreCifrado)
    });

    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

    // Éxito: mostramos badge verde temporalmente
    mostrarEstado("✓", "#22c55e");
    console.log("Enviado (cifrado) y guardado en servidor:", paquete.origen);
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