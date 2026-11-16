const DOMINIOS_AUTOMATICOS = [
  "web.whatsapp.com",
  "web.telegram.org"
];

const dominioActual = window.location.hostname;

// Modo automático
if (DOMINIOS_AUTOMATICOS.includes(dominioActual)) {
  console.log(`[Extractor] Modo AUTOMÁTICO activado en ${dominioActual}`);
  iniciarVigilanteAutomatico();
} else {
  console.log(`[Extractor] En reposo (Modo MANUAL) en ${dominioActual}`);
}

function iniciarVigilanteAutomatico() {
  const observer = new MutationObserver((mutaciones) => {
    // Solo dispara si realmente se añadieron nodos HTML nuevos a la página
    const hayNodosNuevos = mutaciones.some(m => m.addedNodes.length > 0);
    if (!hayNodosNuevos) return;

    // Aquí conectaremos el Paso 2 (lectura y limpieza de mensajes)
    browser.runtime.sendMessage({
      tipo: "DATOS_CAPTURADOS",
      payload: {
        disparador: "automatico_dom",
        origen: dominioActual,
        timestamp: new Date().toISOString()
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Modo manual
browser.runtime.onMessage.addListener((mensaje) => {
  if (mensaje.accion === "DISPARO_MANUAL") {
    const textoSeleccionado = window.getSelection().toString().trim();

    // Aquí conectaremos el Paso 2 (lectura completa de artículo o HTML)
    browser.runtime.sendMessage({
      tipo: "DATOS_CAPTURADOS",
      payload: {
        disparador: `manual_${mensaje.modo}`,
        origen: dominioActual,
        url: window.location.href,
        tieneSeleccion: textoSeleccionado.length > 0,
        vistaPrevia: textoSeleccionado || document.title,
        timestamp: new Date().toISOString()
      }
    });
  }
});