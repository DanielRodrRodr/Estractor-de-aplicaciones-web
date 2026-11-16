//Opera de fondo escuchando si se activa el disparador manual para realizar la lectura.

// Crea la opción en el menú de clic derecho al instalar la extensión
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "enviar",
    title: "Enviar selección/página a mi servidor",
    contexts: ["page", "selection"]
  });
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
  }).catch((err) => {
    console.warn("No se puede leer esta pestaña:", err);
  });
}

// Receptor temporal para verificar en consola que el disparador funciona
browser.runtime.onMessage.addListener((mensaje) => {
  if (mensaje.tipo === "DATOS_CAPTURADOS") {
    console.log("Disparador activado con éxito:", mensaje.payload);
  }
});