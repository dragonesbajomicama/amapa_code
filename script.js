const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const controles = {
  modoMovimiento: document.getElementById("modoMovimiento"),
  movimiento: document.getElementById("movimiento"),
  velocidad: document.getElementById("velocidad"),
  tamanoPunto: document.getElementById("tamanoPunto"),
  separacion: document.getElementById("separacion"),
  variacionLineas: document.getElementById("variacionLineas"),
  grosorLinea: document.getElementById("grosorLinea"),
  colorLinea: document.getElementById("colorLinea"),
  colorPunto: document.getElementById("colorPunto"),
  autoMovimiento: document.getElementById("autoMovimiento"),
  conectarLetras: document.getElementById("conectarLetras"),
  curvas: document.getElementById("curvas"),
  descargarSvg: document.getElementById("descargarSvg")
};

function ajustarCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", ajustarCanvas);
ajustarCanvas();

const formaA = {
  tipo: "A",
  ancho: 100,
  puntos: [
    [0, 150],
    [50, 0],
    [100, 150],
    [22, 85],
    [78, 85]
  ],
  lineas: [[0, 1], [1, 2], [3, 4]],
  puente: { izquierda: 0.43, derecha: 0.57 },
  puntosFijosEnLinea: [3, 4]
};

const letras = [
  formaA,
  {
    tipo: "M",
    ancho: 135,
    puntos: [
      [0, 150],
      [45, 0],
      [90, 150],
      [135, 0],
      [135, 150]
    ],
    lineas: [[0, 1], [1, 2], [2, 3], [3, 4]]
  },
  formaA,
  {
    tipo: "P",
    ancho: 82,
    puntos: [
      [0, 150],
      [0, 0],
      [75, 15],
      [82, 75],
      [0, 75]
    ],
    lineas: [[0, 1], [1, 2], [2, 3], [3, 4]],
    puntosOcultosConCurva: [2, 3],
    puntosRestringidosAlTronco: [4]
  },
  formaA
];

const nodosCompartidos = [
  { desde: [0, 2], hasta: [1, 0] },
  { desde: [1, 4], hasta: [2, 0] },
  { desde: [2, 2], hasta: [3, 0] }
];

const curvaPA = { desde: [3, 0], hasta: [4, 3] };

let tiempo = 0;
let tiempoCongelado = 0;
let mouse = { x: 0, y: 0 };
let puntosRenderizados = [];
let arrastre = null;
let ajustesEspeciales = {
  cruceUltimaA: { x: 0, y: 0 }
};

const ajustesManuales = letras.map((letra) =>
  letra.puntos.map(() => ({ x: 0, y: 0 }))
);

const parametrosLetra = letras.map((letra) => ({
  unionTronco: letra.tipo === "P" ? 0.5 : null,
  puenteIzquierda: letra.tipo === "A" ? letra.puente.izquierda : null,
  puenteDerecha: letra.tipo === "A" ? letra.puente.derecha : null
}));

function limitar(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

function obtenerGrosorLinea() {
  return Number(controles.grosorLinea.value);
}

function obtenerColorLinea() {
  return controles.colorLinea.value;
}

function obtenerColorPunto() {
  return controles.colorPunto.value;
}

function formatearNumero(valor) {
  return Number(valor.toFixed(3));
}

function obtenerPointer(evento) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: evento.clientX - rect.left,
    y: evento.clientY - rect.top
  };
}

function obtenerLayout() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  const separacion = Number(controles.separacion.value);
  const anchoBase = letras.reduce((total, letra) => total + letra.ancho, 0);
  const anchoTotal = anchoBase + separacion * (letras.length - 1);
  const escala = Math.min(w / (anchoTotal + 120), h / 280);
  const inicioX = (w - anchoTotal * escala) / 2;
  const inicioY = h / 2 - 75 * escala;

  return { escala, inicioX, inicioY, separacion };
}

function ruidoDeterminista(valor) {
  const raw = Math.sin(valor * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

function ruidoSuave(valor) {
  const base = Math.floor(valor);
  const fraccion = valor - base;
  const curva = fraccion * fraccion * (3 - 2 * fraccion);

  return ruidoDeterminista(base) * (1 - curva) + ruidoDeterminista(base + 1) * curva;
}

function desplazamientoAutomatico(indiceLetra, indicePunto, x, y) {
  const intensidad = Number(controles.movimiento.value);
  const t = tiempoCongelado;
  const fase = t + indiceLetra * 0.9 + indicePunto * 1.37;

  if (controles.modoMovimiento.value === "onda") {
    const golpe = Math.sin(t * 2.2 + indiceLetra) * Math.sin(t * 0.71 + indicePunto);

    return {
      x: Math.sin(t * 1.4 + y * 0.035) * intensidad + golpe * intensidad * 0.45,
      y: Math.cos(t * 0.9 + x * 0.028) * intensidad * 0.65
    };
  }

  if (controles.modoMovimiento.value === "pulso") {
    const centroX = 50;
    const centroY = 75;
    const dx = x - centroX;
    const dy = y - centroY;
    const distancia = Math.max(Math.hypot(dx, dy), 1);
    const pulso =
      (Math.sin(t * 2 + indiceLetra) + Math.sin(t * 5.1 + indicePunto) * 0.35) *
      intensidad *
      0.75;

    return {
      x: (dx / distancia) * pulso + Math.sin(t * 3.3 + indicePunto) * intensidad * 0.18,
      y: (dy / distancia) * pulso + Math.cos(t * 2.8 + indiceLetra) * intensidad * 0.18
    };
  }

  if (controles.modoMovimiento.value === "temblor") {
    const semilla = indiceLetra * 31 + indicePunto * 17;
    const salto = Math.floor(t * 10 + ruidoDeterminista(semilla) * 6);
    const micro = Math.sin(t * 27 + semilla) * 0.28;

    return {
      x: (ruidoDeterminista(semilla + salto) - 0.5 + micro) * intensidad * 1.35,
      y: (ruidoDeterminista(semilla + salto + 8) - 0.5 - micro) * intensidad * 1.35
    };
  }

  const semilla = indiceLetra * 19 + indicePunto * 23;
  const derivaX = ruidoSuave(t * 0.9 + semilla) - 0.5;
  const derivaY = ruidoSuave(t * 0.73 + semilla + 20) - 0.5;

  return {
    x:
      Math.sin(fase * 1.35) * intensidad * 0.55 +
      derivaX * intensidad * 1.45,
    y:
      Math.cos(t * 0.92 + indicePunto * 1.3) * intensidad * 0.55 +
      derivaY * intensidad * 1.45
  };
}

function calcularPuntos() {
  const layout = obtenerLayout();
  let xLetra = layout.inicioX;

  puntosRenderizados = letras.map((letra, indiceLetra) => {
    const puntos = letra.puntos.map(([x, y], indicePunto) => {
      const manual = ajustesManuales[indiceLetra][indicePunto];
      const auto = desplazamientoAutomatico(indiceLetra, indicePunto, x, y);
      const baseX = xLetra + (x + manual.x) * layout.escala;
      const baseY = layout.inicioY + (y + manual.y) * layout.escala;

      return {
        x: baseX + auto.x,
        y: baseY + auto.y,
        baseX,
        baseY,
        indiceLetra,
        indicePunto
      };
    });

    if (letra.tipo === "A") {
      const izquierda = interpolarPunto(
        puntos[0],
        puntos[1],
        parametrosLetra[indiceLetra].puenteIzquierda
      );
      const derecha = interpolarPunto(
        puntos[1],
        puntos[2],
        parametrosLetra[indiceLetra].puenteDerecha
      );
      puntos[3] = {
        ...puntos[3],
        x: izquierda.x,
        y: izquierda.y,
        baseX: izquierda.x,
        baseY: izquierda.y,
        fijoEnLinea: true,
        handleInvisible: "puenteAIzquierda"
      };
      puntos[4] = {
        ...puntos[4],
        x: derecha.x,
        y: derecha.y,
        baseX: derecha.x,
        baseY: derecha.y,
        fijoEnLinea: true,
        handleInvisible: "puenteADerecha"
      };
    }

    if (letra.tipo === "P") {
      const unionTronco = interpolarPunto(
        puntos[1],
        puntos[0],
        parametrosLetra[indiceLetra].unionTronco
      );
      puntos[4] = {
        ...puntos[4],
        x: unionTronco.x,
        y: unionTronco.y,
        baseX: unionTronco.x,
        baseY: unionTronco.y,
        restringidoAlTronco: true
      };
    }

    xLetra += (letra.ancho + layout.separacion) * layout.escala;
    return puntos;
  });

  if (controles.conectarLetras.checked) {
    unirNodosCompartidos();
  }

  return layout;
}

function unirNodosCompartidos() {
  nodosCompartidos.forEach((conexion) => {
    const [letraOrigen, puntoOrigen] = conexion.desde;
    const [letraDestino, puntoDestino] = conexion.hasta;
    const origen = puntosRenderizados[letraOrigen][puntoOrigen];
    const destino = puntosRenderizados[letraDestino][puntoDestino];

    destino.x = origen.x;
    destino.y = origen.y;
    destino.baseX = origen.baseX;
    destino.baseY = origen.baseY;
    destino.compartido = true;
    destino.controladoPor = {
      indiceLetra: letraOrigen,
      indicePunto: puntoOrigen
    };
  });

  letras.forEach((letra, indiceLetra) => {
    const puntos = puntosRenderizados[indiceLetra];

    if (letra.tipo === "A") {
      const izquierda = interpolarPunto(
        puntos[0],
        puntos[1],
        parametrosLetra[indiceLetra].puenteIzquierda
      );
      const derecha = interpolarPunto(
        puntos[1],
        puntos[2],
        parametrosLetra[indiceLetra].puenteDerecha
      );
      puntos[3].x = izquierda.x;
      puntos[3].y = izquierda.y;
      puntos[4].x = derecha.x;
      puntos[4].y = derecha.y;
    }

    if (letra.tipo === "P") {
      const unionTronco = interpolarPunto(
        puntos[1],
        puntos[0],
        parametrosLetra[indiceLetra].unionTronco
      );
      puntos[4].x = unionTronco.x;
      puntos[4].y = unionTronco.y;
      puntos[4].baseX = unionTronco.x;
      puntos[4].baseY = unionTronco.y;
    }
  });

  pegarUltimaAALaCurva();
}

function interpolarPunto(inicio, fin, t) {
  return {
    x: inicio.x + (fin.x - inicio.x) * t,
    y: inicio.y + (fin.y - inicio.y) * t
  };
}

function obtenerControlCurva(a, b, indice) {
  const longitud = Number(controles.variacionLineas.value);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distancia = Math.max(Math.hypot(dx, dy), 1);
  const nx = -dy / distancia;
  const ny = dx / distancia;

  if (indice === 3) {
    return {
      x: a.x + dx * 0.42,
      y: Math.max(a.y, b.y) + longitud
    };
  }

  const arco = Math.sin(tiempo * 0.8 + indice * 1.7) * longitud;

  return {
    x: a.x + dx * 0.5 + nx * arco,
    y: a.y + dy * 0.5 + ny * arco
  };
}

function puntoEnCurvaCuadratica(a, control, b, t) {
  const inv = 1 - t;

  return {
    x: inv * inv * a.x + 2 * inv * t * control.x + t * t * b.x,
    y: inv * inv * a.y + 2 * inv * t * control.y + t * t * b.y
  };
}

function obtenerControlCurvaPA(origen, cruce, punta) {
  const longitud = Number(controles.variacionLineas.value);
  const dx = punta.x - cruce.x;
  const dy = punta.y - cruce.y;
  const distancia = Math.max(Math.hypot(dx, dy), 1);
  const extension = 34 + longitud * 0.72;

  return {
    x: cruce.x - (dx / distancia) * extension,
    y: cruce.y - (dy / distancia) * extension
  };
}

function pegarUltimaAALaCurva() {
  const [letraOrigen, puntoOrigen] = curvaPA.desde;
  const letraDestino = 4;
  const origen = puntosRenderizados[letraOrigen][puntoOrigen];
  const puntosA = puntosRenderizados[letraDestino];
  const punta = puntosA[1];
  const baseDerecha = puntosA[2];
  const izquierdaRecta = interpolarPunto(puntosA[0], punta, 0.55);
  const derecha = interpolarPunto(
    punta,
    baseDerecha,
    parametrosLetra[letraDestino].puenteDerecha
  );
  puntosA[0].pataReemplazada = true;
  puntosA[3].x = izquierdaRecta.x + ajustesEspeciales.cruceUltimaA.x;
  puntosA[3].y = izquierdaRecta.y + ajustesEspeciales.cruceUltimaA.y;
  puntosA[3].baseX = puntosA[3].x;
  puntosA[3].baseY = puntosA[3].y;
  puntosA[3].handleInvisible = "cruceUltimaA";
  puntosA[4].x = derecha.x;
  puntosA[4].y = derecha.y;
  puntosA[4].baseX = derecha.x;
  puntosA[4].baseY = derecha.y;
}

function dibujarLineaVariable(a, b, indice, curvaForzada = false) {
  const medio = obtenerControlCurva(a, b, indice);

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  if (curvaForzada && controles.curvas.checked) {
    ctx.quadraticCurveTo(medio.x, medio.y, b.x, b.y);
  } else {
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

function dibujarConexiones() {
  if (!controles.conectarLetras.checked) {
    return;
  }

  ctx.lineWidth = obtenerGrosorLinea();
  ctx.lineCap = "round";
  ctx.strokeStyle = obtenerColorLinea();

  const [letraOrigen, puntoOrigen] = curvaPA.desde;
  const [letraDestino, puntoDestino] = curvaPA.hasta;
  const origen = puntosRenderizados[letraOrigen][puntoOrigen];
  const destino = puntosRenderizados[letraDestino][puntoDestino];
  const punta = puntosRenderizados[letraDestino][1];

  if (controles.curvas.checked) {
    const control = obtenerControlCurvaPA(origen, destino, punta);

    ctx.beginPath();
    ctx.moveTo(origen.x, origen.y);
    ctx.quadraticCurveTo(control.x, control.y, destino.x, destino.y);
    ctx.stroke();
    return;
  }

  dibujarLineaVariable(origen, destino, 3, true);
}

function esUltimaAConectada(indiceLetra) {
  return (
    controles.conectarLetras.checked &&
    indiceLetra === letras.length - 1
  );
}

function dibujarTrazoLetra(letra, puntos, indiceLetra) {
  if (letra.tipo === "P" && controles.curvas.checked) {
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, puntos[0].y);
    ctx.lineTo(puntos[1].x, puntos[1].y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(puntos[1].x, puntos[1].y);
    ctx.bezierCurveTo(
      puntos[2].x,
      puntos[2].y,
      puntos[3].x,
      puntos[3].y,
      puntos[4].x,
      puntos[4].y
    );
    ctx.stroke();
    return;
  }

  letra.lineas.forEach(([a, b]) => {
    if (esUltimaAConectada(indiceLetra) && a === 0 && b === 1) {
      ctx.beginPath();
      ctx.moveTo(puntos[3].x, puntos[3].y);
      ctx.lineTo(puntos[1].x, puntos[1].y);
      ctx.stroke();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(puntos[a].x, puntos[a].y);
    ctx.lineTo(puntos[b].x, puntos[b].y);
    ctx.stroke();
  });
}

function puntoVisible(letra, punto) {
  if (punto.fijoEnLinea || punto.compartido || punto.pataReemplazada) {
    return false;
  }

  return !(
    letra.tipo === "P" &&
    controles.curvas.checked &&
    letra.puntosOcultosConCurva.includes(punto.indicePunto)
  );
}

function puntoInteractivo(letra, punto) {
  return (
    puntoVisible(letra, punto) ||
    Boolean(punto.controladoPor) ||
    Boolean(punto.handleInvisible)
  );
}

function dibujarTrazosLetras() {
  ctx.lineWidth = obtenerGrosorLinea();
  ctx.lineCap = "round";
  ctx.strokeStyle = obtenerColorLinea();

  letras.forEach((letra, indiceLetra) => {
    const puntos = puntosRenderizados[indiceLetra];

    dibujarTrazoLetra(letra, puntos, indiceLetra);
  });
}

function dibujarPuntos() {
  const tamanoPunto = Number(controles.tamanoPunto.value);
  ctx.fillStyle = obtenerColorPunto();

  letras.forEach((letra, indiceLetra) => {
    const puntos = puntosRenderizados[indiceLetra];

    puntos.forEach((punto) => {
      if (!puntoVisible(letra, punto)) {
        return;
      }

      ctx.beginPath();
      ctx.arc(punto.x, punto.y, tamanoPunto, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function comandoMover(punto) {
  return `M ${formatearNumero(punto.x)} ${formatearNumero(punto.y)}`;
}

function comandoLinea(punto) {
  return `L ${formatearNumero(punto.x)} ${formatearNumero(punto.y)}`;
}

function comandoCurvaCuadratica(control, fin) {
  return [
    "Q",
    formatearNumero(control.x),
    formatearNumero(control.y),
    formatearNumero(fin.x),
    formatearNumero(fin.y)
  ].join(" ");
}

function comandoCurvaBezier(controlA, controlB, fin) {
  return [
    "C",
    formatearNumero(controlA.x),
    formatearNumero(controlA.y),
    formatearNumero(controlB.x),
    formatearNumero(controlB.y),
    formatearNumero(fin.x),
    formatearNumero(fin.y)
  ].join(" ");
}

function crearPathLetra(letra, puntos, indiceLetra) {
  const comandos = [];

  if (letra.tipo === "P" && controles.curvas.checked) {
    comandos.push(
      comandoMover(puntos[0]),
      comandoLinea(puntos[1]),
      comandoMover(puntos[1]),
      comandoCurvaBezier(puntos[2], puntos[3], puntos[4])
    );
    return comandos.join(" ");
  }

  letra.lineas.forEach(([a, b]) => {
    if (esUltimaAConectada(indiceLetra) && a === 0 && b === 1) {
      comandos.push(comandoMover(puntos[3]), comandoLinea(puntos[1]));
      return;
    }

    comandos.push(comandoMover(puntos[a]), comandoLinea(puntos[b]));
  });

  return comandos.join(" ");
}

function crearPathConexionPA() {
  const [letraOrigen, puntoOrigen] = curvaPA.desde;
  const [letraDestino, puntoDestino] = curvaPA.hasta;
  const origen = puntosRenderizados[letraOrigen][puntoOrigen];
  const destino = puntosRenderizados[letraDestino][puntoDestino];
  const punta = puntosRenderizados[letraDestino][1];
  const control = controles.curvas.checked
    ? obtenerControlCurvaPA(origen, destino, punta)
    : interpolarPunto(origen, destino, 0.5);

  return [
    comandoMover(origen),
    comandoCurvaCuadratica(control, destino)
  ].join(" ");
}

function crearElementoPath(d) {
  return `    <path d="${d}" stroke="${obtenerColorLinea()}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${formatearNumero(obtenerGrosorLinea())}" />`;
}

function crearElementoCirculo(punto) {
  const radio = formatearNumero(Number(controles.tamanoPunto.value));

  return `    <circle cx="${formatearNumero(punto.x)}" cy="${formatearNumero(punto.y)}" r="${radio}" fill="${obtenerColorPunto()}" stroke="none" />`;
}

function crearCirculosPuntosVisibles() {
  return letras.flatMap((letra, indiceLetra) =>
    puntosRenderizados[indiceLetra]
      .filter((punto) => puntoVisible(letra, punto))
      .map(crearElementoCirculo)
  );
}

function crearSvgActual() {
  const rect = canvas.getBoundingClientRect();
  const ancho = formatearNumero(rect.width);
  const alto = formatearNumero(rect.height);

  tiempoCongelado = tiempo;
  calcularPuntos();

  const paths = letras.map((letra, indiceLetra) =>
    crearElementoPath(crearPathLetra(letra, puntosRenderizados[indiceLetra], indiceLetra))
  );

  if (controles.conectarLetras.checked) {
    paths.push(crearElementoPath(crearPathConexionPA()));
  }

  const puntos = crearCirculosPuntosVisibles();

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">`,
    '  <g id="lineas-negras">',
    ...paths,
    "  </g>",
    '  <g id="puntos-grises">',
    ...puntos,
    "  </g>",
    "</svg>"
  ].join("\n");
}

function descargarSvgActual() {
  const svg = crearSvgActual();
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = "amapa-export.svg";
  enlace.style.display = "none";
  document.body.appendChild(enlace);
  enlace.click();

  setTimeout(() => {
    enlace.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

controles.descargarSvg.addEventListener("click", descargarSvgActual);

function encontrarPuntoCercano(posicion) {
  let cercano = null;
  let distanciaMinima = Infinity;

  puntosRenderizados.flat().forEach((punto) => {
    const letra = letras[punto.indiceLetra];

    if (!puntoInteractivo(letra, punto)) {
      return;
    }

    const distancia = Math.hypot(posicion.x - punto.x, posicion.y - punto.y);

    if (distancia < distanciaMinima) {
      distanciaMinima = distancia;
      cercano = punto;
    }
  });

  return distanciaMinima <= Math.max(Number(controles.tamanoPunto.value) * 2.4, 18)
    ? cercano
    : null;
}

function crearArrastreDesdePunto(punto, posicion, escala) {
  if (punto.handleInvisible === "cruceUltimaA") {
    return {
      tipo: "cruceUltimaA",
      x: posicion.x,
      y: posicion.y,
      escala
    };
  }

  if (
    punto.handleInvisible === "puenteAIzquierda" ||
    punto.handleInvisible === "puenteADerecha"
  ) {
    return {
      tipo: "puenteA",
      lado: punto.handleInvisible === "puenteAIzquierda" ? "izquierda" : "derecha",
      indiceLetra: punto.indiceLetra,
      x: posicion.x,
      y: posicion.y,
      escala
    };
  }

  const objetivo = punto.controladoPor || {
    indiceLetra: punto.indiceLetra,
    indicePunto: punto.indicePunto
  };

  return {
    tipo: "punto",
    indiceLetra: objetivo.indiceLetra,
    indicePunto: objetivo.indicePunto,
    x: posicion.x,
    y: posicion.y,
    escala
  };
}

function actualizarPuenteA(posicion) {
  if (arrastre.tipo !== "puenteA") {
    return false;
  }

  const puntos = puntosRenderizados[arrastre.indiceLetra];
  const inicio = arrastre.lado === "izquierda" ? puntos[0] : puntos[1];
  const fin = arrastre.lado === "izquierda" ? puntos[1] : puntos[2];
  const dx = fin.x - inicio.x;
  const dy = fin.y - inicio.y;
  const largo = Math.max(dx * dx + dy * dy, 1);
  const t = ((posicion.x - inicio.x) * dx + (posicion.y - inicio.y) * dy) / largo;
  const parametro = arrastre.lado === "izquierda" ? "puenteIzquierda" : "puenteDerecha";

  parametrosLetra[arrastre.indiceLetra][parametro] = limitar(t, 0.16, 0.86);
  return true;
}

function actualizarPuntoRestringidoAlTronco(posicion) {
  const letra = letras[arrastre.indiceLetra];

  if (letra.tipo !== "P" || arrastre.indicePunto !== 4) {
    return false;
  }

  const puntos = puntosRenderizados[arrastre.indiceLetra];
  const arriba = puntos[1];
  const abajo = puntos[0];
  const dx = abajo.x - arriba.x;
  const dy = abajo.y - arriba.y;
  const largo = Math.max(dx * dx + dy * dy, 1);
  const t = ((posicion.x - arriba.x) * dx + (posicion.y - arriba.y) * dy) / largo;

  parametrosLetra[arrastre.indiceLetra].unionTronco = limitar(t, 0.08, 0.92);
  return true;
}

canvas.addEventListener("pointerdown", (evento) => {
  mouse = obtenerPointer(evento);

  const punto = encontrarPuntoCercano(mouse);

  if (!punto) {
    return;
  }

  const layout = obtenerLayout();
  arrastre = crearArrastreDesdePunto(punto, mouse, layout.escala);
  canvas.setPointerCapture(evento.pointerId);
  canvas.style.cursor = "grabbing";
});

canvas.addEventListener("pointermove", (evento) => {
  mouse = obtenerPointer(evento);

  if (!arrastre) {
    return;
  }

  if (arrastre.tipo === "cruceUltimaA") {
    ajustesEspeciales.cruceUltimaA.x += mouse.x - arrastre.x;
    ajustesEspeciales.cruceUltimaA.y += mouse.y - arrastre.y;
    arrastre.x = mouse.x;
    arrastre.y = mouse.y;
    return;
  }

  if (actualizarPuenteA(mouse)) {
    arrastre.x = mouse.x;
    arrastre.y = mouse.y;
    return;
  }

  if (actualizarPuntoRestringidoAlTronco(mouse)) {
    arrastre.x = mouse.x;
    arrastre.y = mouse.y;
    return;
  }

  const ajuste = ajustesManuales[arrastre.indiceLetra][arrastre.indicePunto];
  ajuste.x += (mouse.x - arrastre.x) / arrastre.escala;
  ajuste.y += (mouse.y - arrastre.y) / arrastre.escala;
  arrastre.x = mouse.x;
  arrastre.y = mouse.y;
});

canvas.addEventListener("pointerup", (evento) => {
  if (!arrastre) {
    return;
  }

  arrastre = null;
  if (canvas.hasPointerCapture(evento.pointerId)) {
    canvas.releasePointerCapture(evento.pointerId);
  }
  canvas.style.cursor = "grab";
});

canvas.addEventListener("pointercancel", () => {
  arrastre = null;
  canvas.style.cursor = "grab";
});

function dibujar() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  ctx.clearRect(0, 0, w, h);
  tiempoCongelado = tiempo;
  calcularPuntos();
  dibujarTrazosLetras();
  dibujarConexiones();
  dibujarPuntos();

  if (controles.autoMovimiento.checked) {
    tiempo += Number(controles.velocidad.value) / 1000;
  }

  requestAnimationFrame(dibujar);
}

dibujar();
