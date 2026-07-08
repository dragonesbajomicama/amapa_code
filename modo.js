(() => {
  const botonesModo = document.querySelectorAll(".modo-boton");
  const controlesAmapa = document.getElementById("controlesAmapa");
  const controlesPersonajes = document.getElementById("controlesPersonajes");
  const canvasAmapa = document.getElementById("canvas");
  const canvasPersonaje = document.getElementById("canvasPersonaje");
  const contenedorLienzos = document.querySelector(".lienzos");
  const botonesDescarga = [document.getElementById("descargarSvg")].filter(Boolean);
  const colorFondo = document.getElementById("colorFondo");

  function numero(valor) {
    return Number(valor.toFixed(3));
  }

  function obtenerModoActivo() {
    return document.querySelector(".modo-boton.activo")?.dataset.modo || "amapa";
  }

  function obtenerColorFondo() {
    return colorFondo?.value || "#efeee8";
  }

  function aplicarColorFondo() {
    document.body.style.setProperty("--color-fondo", obtenerColorFondo());
  }

  function crearSvgVistaActual() {
    const modo = obtenerModoActivo();
    const usarAmapa = modo === "amapa" || modo === "ambos";
    const usarPersonajes = modo === "personajes" || modo === "ambos";
    const canvasBase = usarAmapa ? canvasAmapa : canvasPersonaje;
    const rect = canvasBase.getBoundingClientRect();
    const ancho = numero(rect.width);
    const alto = numero(rect.height);
    const paths = [];
    const puntos = [];

    if (usarAmapa && window.amapaSvgExport) {
      const partes = window.amapaSvgExport.crearPartes();
      paths.push(...partes.paths);
      puntos.push(...partes.puntos);
    }

    if (usarPersonajes && window.personajesSvgExport) {
      const partes = window.personajesSvgExport.crearPartes();
      paths.push(...partes.paths);
      puntos.push(...partes.puntos);
    }

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">`,
      `  <rect width="100%" height="100%" fill="${obtenerColorFondo()}" />`,
      '  <g id="lineas-negras">',
      ...paths,
      "  </g>",
      '  <g id="puntos-grises">',
      ...puntos,
      "  </g>",
      "</svg>"
    ].join("\n");
  }

  function descargarSvgVistaActual() {
    const blob = new Blob([crearSvgVistaActual()], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    const modo = obtenerModoActivo();

    enlace.href = url;
    enlace.download =
      modo === "personajes"
        ? "personaje-skate-export.svg"
        : modo === "ambos"
          ? "amapa-personaje-export.svg"
          : "amapa-export.svg";
    enlace.style.display = "none";
    document.body.appendChild(enlace);
    enlace.click();

    setTimeout(() => {
      enlace.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function cambiarModo(modo) {
    const esAmapa = modo === "amapa";
    const esPersonajes = modo === "personajes";
    const esAmbos = modo === "ambos";
    const mostrarAmapa = esAmapa || esAmbos;
    const mostrarPersonajes = esPersonajes || esAmbos;

    controlesAmapa.classList.toggle("activa", mostrarAmapa);
    controlesPersonajes.classList.toggle("activa", mostrarPersonajes);
    canvasAmapa.classList.toggle("activo", mostrarAmapa);
    canvasPersonaje.classList.toggle("activo", mostrarPersonajes);
    contenedorLienzos.classList.toggle("vista-ambos", esAmbos);

    botonesModo.forEach((boton) => {
      boton.classList.toggle("activo", boton.dataset.modo === modo);
    });

    requestAnimationFrame(() => {
      if (mostrarAmapa && window.amapaResize) {
        window.amapaResize();
      }

      if (mostrarPersonajes && window.personajesResize) {
        window.personajesResize();
      }
    });
  }

  botonesModo.forEach((boton) => {
    boton.addEventListener("click", () => cambiarModo(boton.dataset.modo));
  });

  botonesDescarga.forEach((boton) => {
    boton.addEventListener("click", descargarSvgVistaActual);
  });

  colorFondo?.addEventListener("input", aplicarColorFondo);
  aplicarColorFondo();
})();
