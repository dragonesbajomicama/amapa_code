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
  blancoOjoAmapa: document.getElementById("blancoOjoAmapa"),
  blancoOjo: document.getElementById("cabezaDelineadaPersonaje"),
  descargarSvg: document.getElementById("descargarSvg")
};

const controlLongitudCurva = document.getElementById("controlLongitudCurva");

function actualizarVisibilidadLongitudCurva() {
  if (controlLongitudCurva) {
    controlLongitudCurva.hidden = !controles.conectarLetras.checked;
  }
}

controles.conectarLetras.addEventListener("input", actualizarVisibilidadLongitudCurva);
actualizarVisibilidadLongitudCurva();

function ajustarCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", ajustarCanvas);
window.amapaResize = ajustarCanvas;
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
const curvasManuales = new Map();
const desplazamientoVista = { x: 0, y: 0 };
const puntosOjo = new Set();
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

function ojoBlancoActivo() {
  return controles.blancoOjoAmapa?.checked ?? controles.blancoOjo?.checked ?? true;
}

function curvasActivas() {
  return true;
}

function clavePunto(punto) {
  const objetivo = punto.controladoPor || {
    indiceLetra: punto.indiceLetra,
    indicePunto: punto.indicePunto
  };

  return `${objetivo.indiceLetra}:${objetivo.indicePunto}`;
}

function radioOjoPunto(punto) {
  if (!puntosOjo.has(clavePunto(punto))) {
    return 0;
  }

  const radio = Number(controles.tamanoPunto.value);
  return radio + Math.max(7, radio * 1.15);
}

function puntoDesdeBordeOjo(punto, hacia) {
  const radio = radioOjoPunto(punto);

  if (!radio) {
    return punto;
  }

  const dx = hacia.x - punto.x;
  const dy = hacia.y - punto.y;
  const largo = Math.max(Math.hypot(dx, dy), 1);

  return {
    ...punto,
    x: punto.x + (dx / largo) * radio,
    y: punto.y + (dy / largo) * radio
  };
}

function extremosDesdeOjos(a, b) {
  return {
    inicio: puntoDesdeBordeOjo(a, b),
    fin: puntoDesdeBordeOjo(b, a)
  };
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
  const rectCanvas = canvas.getBoundingClientRect();
  const w = rectCanvas.width;
  const h = rectCanvas.height;
  const separacion = Number(controles.separacion.value);
  const anchoBase = letras.reduce((total, letra) => total + letra.ancho, 0);
  const anchoTotal = anchoBase + separacion * (letras.length - 1);
  const panel = document.querySelector(".panel");
  const rectPanel = panel?.getBoundingClientRect();
  let centroX = w / 2;
  let centroY = h / 2;
  let anchoDisponible = w;
  let altoDisponible = h;

  if (rectPanel && window.innerWidth > 700) {
    const limiteIzquierdo = Math.min(rectPanel.right - rectCanvas.left + 24, w * 0.46);
    centroX = limiteIzquierdo + (w - limiteIzquierdo) / 2;
    anchoDisponible = w - limiteIzquierdo;
  } else if (rectPanel) {
    const limiteSuperior = Math.min(rectPanel.bottom - rectCanvas.top + 20, h * 0.4);
    centroY = limiteSuperior + (h - limiteSuperior) / 2;
    altoDisponible = h - limiteSuperior;
  }

  const escala = Math.min(anchoDisponible / (anchoTotal + 80), altoDisponible / 240);
  const inicioX = centroX - (anchoTotal * escala) / 2 + desplazamientoVista.x;
  const inicioY = centroY - 75 * escala + desplazamientoVista.y;

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
  const intensidad = Number(controles.movimiento.value) * 0.46;
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
      actualizarPuentesA(indiceLetra, puntos, true);
    }

    if (letra.tipo === "P") {
      actualizarUnionP(indiceLetra, puntos, true);
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
      actualizarPuentesA(indiceLetra, puntos);
    }

    if (letra.tipo === "P") {
      actualizarUnionP(indiceLetra, puntos);
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

function puntoSobreLadoA(indiceLetra, indiceInicio, indiceFin, inicio, fin, t) {
  const clave = claveSegmento(indiceLetra, indiceInicio, indiceFin);
  const control = obtenerCurvaManual(clave, inicio, fin);

  return control
    ? puntoEnCurvaCuadratica(inicio, control, fin, t)
    : interpolarPunto(inicio, fin, t);
}

function actualizarPuentesA(indiceLetra, puntos, inicializar = false) {
  const izquierda = puntoSobreLadoA(
    indiceLetra,
    0,
    1,
    puntos[0],
    puntos[1],
    parametrosLetra[indiceLetra].puenteIzquierda
  );
  const derecha = puntoSobreLadoA(
    indiceLetra,
    1,
    2,
    puntos[1],
    puntos[2],
    parametrosLetra[indiceLetra].puenteDerecha
  );

  Object.assign(puntos[3], {
    x: izquierda.x,
    y: izquierda.y,
    baseX: izquierda.x,
    baseY: izquierda.y,
    ...(inicializar ? { fijoEnLinea: true, handleInvisible: "puenteAIzquierda" } : {})
  });
  Object.assign(puntos[4], {
    x: derecha.x,
    y: derecha.y,
    baseX: derecha.x,
    baseY: derecha.y,
    ...(inicializar ? { fijoEnLinea: true, handleInvisible: "puenteADerecha" } : {})
  });
}

function actualizarUnionP(indiceLetra, puntos, inicializar = false) {
  const clave = claveSegmento(indiceLetra, 0, 1);
  const control = obtenerCurvaManual(clave, puntos[0], puntos[1]);
  const t = parametrosLetra[indiceLetra].unionTronco;
  const unionTronco = control
    ? puntoEnCurvaCuadratica(puntos[1], control, puntos[0], t)
    : interpolarPunto(puntos[1], puntos[0], t);

  Object.assign(puntos[4], {
    x: unionTronco.x,
    y: unionTronco.y,
    baseX: unionTronco.x,
    baseY: unionTronco.y,
    ...(inicializar ? { restringidoAlTronco: true } : {})
  });
}

function claveSegmento(indiceLetra, a, b) {
  return `${indiceLetra}:${a}:${b}`;
}

function obtenerCurvaManual(clave, a, b) {
  const curva = curvasManuales.get(clave);

  if (!curva) {
    return null;
  }

  return {
    x: (a.x + b.x) / 2 + curva.dx,
    y: (a.y + b.y) / 2 + curva.dy
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
  const inicio = puntoDesdeBordeOjo(a, curvaForzada && curvasActivas() ? medio : b);
  const fin = puntoDesdeBordeOjo(b, curvaForzada && curvasActivas() ? medio : a);

  ctx.beginPath();
  ctx.moveTo(inicio.x, inicio.y);
  if (curvaForzada && curvasActivas()) {
    ctx.quadraticCurveTo(medio.x, medio.y, fin.x, fin.y);
  } else {
    ctx.lineTo(fin.x, fin.y);
  }
  ctx.stroke();
}

function dibujarSegmentoLetra(a, b, clave = null) {
  const extremos = extremosDesdeOjos(a, b);
  const controlManual = clave ? obtenerCurvaManual(clave, a, b) : null;

  ctx.beginPath();
  ctx.moveTo(extremos.inicio.x, extremos.inicio.y);
  if (controlManual) {
    ctx.quadraticCurveTo(controlManual.x, controlManual.y, extremos.fin.x, extremos.fin.y);
  } else {
    ctx.lineTo(extremos.fin.x, extremos.fin.y);
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

  if (curvasActivas()) {
    const control = obtenerControlCurvaPA(origen, destino, punta);
    const inicio = puntoDesdeBordeOjo(origen, control);
    const fin = puntoDesdeBordeOjo(destino, control);

    ctx.beginPath();
    ctx.moveTo(inicio.x, inicio.y);
    ctx.quadraticCurveTo(control.x, control.y, fin.x, fin.y);
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
  if (letra.tipo === "P" && curvasActivas()) {
    const inicioCurva = puntoDesdeBordeOjo(puntos[1], puntos[2]);
    const finCurva = puntoDesdeBordeOjo(puntos[4], puntos[3]);

    dibujarSegmentoLetra(puntos[0], puntos[1], claveSegmento(indiceLetra, 0, 1));

    ctx.beginPath();
    ctx.moveTo(inicioCurva.x, inicioCurva.y);
    ctx.bezierCurveTo(
      puntos[2].x,
      puntos[2].y,
      puntos[3].x,
      puntos[3].y,
      finCurva.x,
      finCurva.y
    );
    ctx.stroke();
    return;
  }

  letra.lineas.forEach(([a, b]) => {
    const clave = claveSegmento(indiceLetra, a, b);
    if (esUltimaAConectada(indiceLetra) && a === 0 && b === 1) {
      dibujarSegmentoLetra(puntos[3], puntos[1], clave);
      return;
    }

    dibujarSegmentoLetra(puntos[a], puntos[b], clave);
  });
}

function dibujarControlesCurva() {
  const radio = Math.max(5, Number(controles.tamanoPunto.value) * 0.72);

  obtenerSegmentosInteractivos().forEach((segmento) => {
    const control = obtenerCurvaManual(segmento.clave, segmento.a, segmento.b);
    if (
      !control ||
      arrastre?.tipo !== "controlCurva" ||
      arrastre.clave !== segmento.clave
    ) {
      return;
    }

    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = obtenerColorPunto();
    ctx.beginPath();
    ctx.moveTo((segmento.a.x + segmento.b.x) / 2, (segmento.a.y + segmento.b.y) / 2);
    ctx.lineTo(control.x, control.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = obtenerColorPunto();
    ctx.beginPath();
    ctx.arc(control.x, control.y, radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function puntoVisible(letra, punto) {
  if (punto.fijoEnLinea || punto.compartido || punto.pataReemplazada) {
    return false;
  }

  return !(
    letra.tipo === "P" &&
    curvasActivas() &&
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
  const separacionOjo = Math.max(7, tamanoPunto * 1.15);
  ctx.fillStyle = obtenerColorPunto();

  letras.forEach((letra, indiceLetra) => {
    const puntos = puntosRenderizados[indiceLetra];

    puntos.forEach((punto) => {
      if (!puntoVisible(letra, punto)) {
        return;
      }

      if (puntosOjo.has(clavePunto(punto))) {
        const blancoOjo = ojoBlancoActivo();
        const fillAnterior = ctx.fillStyle;
        const strokeAnterior = ctx.strokeStyle;
        const anchoAnterior = ctx.lineWidth;

        ctx.beginPath();
        ctx.arc(punto.x, punto.y, tamanoPunto + separacionOjo, 0, Math.PI * 2);
        ctx.strokeStyle = obtenerColorLinea();
        ctx.lineWidth = obtenerGrosorLinea();
        if (blancoOjo) {
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }
        ctx.stroke();
        ctx.fillStyle = fillAnterior;
        ctx.strokeStyle = strokeAnterior;
        ctx.lineWidth = anchoAnterior;
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

function comandosSegmentoLetra(a, b, clave = null) {
  const extremos = extremosDesdeOjos(a, b);
  const comandos = [comandoMover(extremos.inicio)];
  const controlManual = clave ? obtenerCurvaManual(clave, a, b) : null;

  if (controlManual) {
    comandos.push(comandoCurvaCuadratica(controlManual, extremos.fin));
  } else {
    comandos.push(comandoLinea(extremos.fin));
  }

  return comandos;
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

  if (letra.tipo === "P" && curvasActivas()) {
    const inicioCurva = puntoDesdeBordeOjo(puntos[1], puntos[2]);
    const finCurva = puntoDesdeBordeOjo(puntos[4], puntos[3]);

    comandos.push(
      ...comandosSegmentoLetra(puntos[0], puntos[1], claveSegmento(indiceLetra, 0, 1)),
      comandoMover(inicioCurva),
      comandoCurvaBezier(puntos[2], puntos[3], finCurva)
    );
    return comandos.join(" ");
  }

  letra.lineas.forEach(([a, b]) => {
    const clave = claveSegmento(indiceLetra, a, b);
    if (esUltimaAConectada(indiceLetra) && a === 0 && b === 1) {
      comandos.push(...comandosSegmentoLetra(puntos[3], puntos[1], clave));
      return;
    }

    comandos.push(...comandosSegmentoLetra(puntos[a], puntos[b], clave));
  });

  return comandos.join(" ");
}

function crearPathConexionPA() {
  const [letraOrigen, puntoOrigen] = curvaPA.desde;
  const [letraDestino, puntoDestino] = curvaPA.hasta;
  const origen = puntosRenderizados[letraOrigen][puntoOrigen];
  const destino = puntosRenderizados[letraDestino][puntoDestino];
  const punta = puntosRenderizados[letraDestino][1];
  const control = curvasActivas()
    ? obtenerControlCurvaPA(origen, destino, punta)
    : interpolarPunto(origen, destino, 0.5);
  const inicio = puntoDesdeBordeOjo(origen, curvasActivas() ? control : destino);
  const fin = puntoDesdeBordeOjo(destino, curvasActivas() ? control : origen);

  return [
    comandoMover(inicio),
    comandoCurvaCuadratica(control, fin)
  ].join(" ");
}

function crearElementoPath(d) {
  return `    <path d="${d}" stroke="${obtenerColorLinea()}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${formatearNumero(obtenerGrosorLinea())}" />`;
}

function crearElementoCirculo(punto) {
  const radio = formatearNumero(Number(controles.tamanoPunto.value));

  return `    <circle cx="${formatearNumero(punto.x)}" cy="${formatearNumero(punto.y)}" r="${radio}" fill="${obtenerColorPunto()}" stroke="none" />`;
}

function crearElementosPunto(punto) {
  const radio = Number(controles.tamanoPunto.value);

  if (!puntosOjo.has(clavePunto(punto))) {
    return [crearElementoCirculo(punto)];
  }

  const separacionOjo = Math.max(7, radio * 1.15);
  const fillOjo = ojoBlancoActivo() ? "#ffffff" : "none";

  return [
    `    <circle cx="${formatearNumero(punto.x)}" cy="${formatearNumero(punto.y)}" r="${formatearNumero(radio + separacionOjo)}" fill="${fillOjo}" stroke="${obtenerColorLinea()}" stroke-width="${formatearNumero(obtenerGrosorLinea())}" />`,
    crearElementoCirculo(punto)
  ];
}

function crearCirculosPuntosVisibles() {
  return letras.flatMap((letra, indiceLetra) =>
    puntosRenderizados[indiceLetra]
      .filter((punto) => puntoVisible(letra, punto))
      .flatMap(crearElementosPunto)
  );
}

function crearPartesSvgAmapa() {
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

  return { ancho, alto, paths, puntos };
}

function crearSvgActual() {
  const partes = crearPartesSvgAmapa();

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${partes.ancho}" height="${partes.alto}" viewBox="0 0 ${partes.ancho} ${partes.alto}">`,
    '  <g id="lineas-negras">',
    ...partes.paths,
    "  </g>",
    '  <g id="puntos-grises">',
    ...partes.puntos,
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

window.amapaSvgExport = {
  crearPartes: crearPartesSvgAmapa,
  descargar: descargarSvgActual
};

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

function encontrarPuntoVisibleCercano(posicion) {
  let cercano = null;
  let distanciaMinima = Infinity;

  puntosRenderizados.flat().forEach((punto) => {
    const letra = letras[punto.indiceLetra];

    if (!puntoVisible(letra, punto)) {
      return;
    }

    const distancia = Math.hypot(posicion.x - punto.x, posicion.y - punto.y);

    if (distancia < distanciaMinima) {
      distanciaMinima = distancia;
      cercano = punto;
    }
  });

  return distanciaMinima <= Math.max(Number(controles.tamanoPunto.value) * 2.8, 20)
    ? cercano
    : null;
}

function distanciaAPiezaRecta(posicion, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo = Math.max(dx * dx + dy * dy, 1);
  const t = limitar(((posicion.x - a.x) * dx + (posicion.y - a.y) * dy) / largo, 0, 1);
  const x = a.x + dx * t;
  const y = a.y + dy * t;

  return Math.hypot(posicion.x - x, posicion.y - y);
}

function obtenerSegmentosInteractivos() {
  return letras.flatMap((letra, indiceLetra) => {
    if (letra.tipo === "P" && curvasActivas()) {
      return [{
        clave: claveSegmento(indiceLetra, 0, 1),
        indiceLetra,
        a: puntosRenderizados[indiceLetra][0],
        b: puntosRenderizados[indiceLetra][1]
      }];
    }

    return letra.lineas.map(([a, b]) => ({
      clave: claveSegmento(indiceLetra, a, b),
      indiceLetra,
      a: esUltimaAConectada(indiceLetra) && a === 0 && b === 1
        ? puntosRenderizados[indiceLetra][3]
        : puntosRenderizados[indiceLetra][a],
      b: puntosRenderizados[indiceLetra][b]
    }));
  });
}

function distanciaACurvaCuadratica(posicion, a, control, b) {
  let minima = Infinity;
  let anterior = a;

  for (let paso = 1; paso <= 24; paso += 1) {
    const actual = puntoEnCurvaCuadratica(a, control, b, paso / 24);
    minima = Math.min(minima, distanciaAPiezaRecta(posicion, anterior, actual));
    anterior = actual;
  }

  return minima;
}

function encontrarControlCurvaCercano(posicion) {
  let resultado = null;
  let minima = Infinity;

  obtenerSegmentosInteractivos().forEach((segmento) => {
    const control = obtenerCurvaManual(segmento.clave, segmento.a, segmento.b);
    if (!control) return;
    const distancia = Math.hypot(posicion.x - control.x, posicion.y - control.y);
    if (distancia < minima) {
      minima = distancia;
      resultado = { ...segmento, control };
    }
  });

  return minima <= Math.max(Number(controles.tamanoPunto.value) * 2, 15) ? resultado : null;
}

function encontrarManejadorCurvaP(posicion) {
  if (!curvasActivas()) {
    return null;
  }

  let resultado = null;
  let distanciaMinima = Infinity;

  letras.forEach((letra, indiceLetra) => {
    if (letra.tipo !== "P") {
      return;
    }

    const puntos = puntosRenderizados[indiceLetra];
    const [inicio, controlA, controlB, fin] = [puntos[1], puntos[2], puntos[3], puntos[4]];
    const t = 0.5;
    const inv = 1 - t;
    const manejador = {
      x:
        inv ** 3 * inicio.x +
        3 * inv ** 2 * t * controlA.x +
        3 * inv * t ** 2 * controlB.x +
        t ** 3 * fin.x,
      y:
        inv ** 3 * inicio.y +
        3 * inv ** 2 * t * controlA.y +
        3 * inv * t ** 2 * controlB.y +
        t ** 3 * fin.y
    };
    const distancia = Math.hypot(posicion.x - manejador.x, posicion.y - manejador.y);

    if (distancia < distanciaMinima) {
      distanciaMinima = distancia;
      resultado = { indiceLetra, manejador };
    }
  });

  return distanciaMinima <= Math.max(Number(controles.tamanoPunto.value) * 2.4, 20)
    ? resultado
    : null;
}

function encontrarSegmentoCercano(posicion) {
  let resultado = null;
  let minima = Infinity;

  obtenerSegmentosInteractivos().forEach((segmento) => {
    const control = obtenerCurvaManual(segmento.clave, segmento.a, segmento.b);
    const distancia = control
      ? distanciaACurvaCuadratica(posicion, segmento.a, control, segmento.b)
      : distanciaAPiezaRecta(posicion, segmento.a, segmento.b);
    if (distancia < minima) {
      minima = distancia;
      resultado = segmento;
    }
  });

  return minima <= Math.max(Number(controles.grosorLinea.value) * 3, 12) ? resultado : null;
}

function obtenerSegmentosLetra(letra, puntos, indiceLetra) {
  if (letra.tipo === "P" && curvasActivas()) {
    return [[puntos[0], puntos[1]], [puntos[1], puntos[4]]];
  }

  return letra.lineas.map(([a, b]) => {
    if (esUltimaAConectada(indiceLetra) && a === 0 && b === 1) {
      return [puntos[3], puntos[1]];
    }

    return [puntos[a], puntos[b]];
  });
}

function posicionDentroDeLetra(posicion, puntos) {
  const xs = puntos.map((punto) => punto.x);
  const ys = puntos.map((punto) => punto.y);
  const margen = Math.max(Number(controles.tamanoPunto.value) * 2, 18);
  const minX = Math.min(...xs) - margen;
  const maxX = Math.max(...xs) + margen;
  const minY = Math.min(...ys) - margen;
  const maxY = Math.max(...ys) + margen;

  return posicion.x >= minX && posicion.x <= maxX && posicion.y >= minY && posicion.y <= maxY;
}

function encontrarLetraCercana(posicion) {
  let indiceCercano = null;
  let distanciaMinima = Infinity;
  const umbralLinea = Math.max(Number(controles.grosorLinea.value) * 3.5, 16);

  letras.forEach((letra, indiceLetra) => {
    const puntos = puntosRenderizados[indiceLetra];

    obtenerSegmentosLetra(letra, puntos, indiceLetra).forEach(([a, b]) => {
      const distancia = distanciaAPiezaRecta(posicion, a, b);

      if (distancia < distanciaMinima) {
        distanciaMinima = distancia;
        indiceCercano = indiceLetra;
      }
    });

    if (distanciaMinima > umbralLinea && posicionDentroDeLetra(posicion, puntos)) {
      indiceCercano = indiceLetra;
      distanciaMinima = umbralLinea;
    }
  });

  return distanciaMinima <= umbralLinea ? indiceCercano : null;
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

function crearArrastreDesdeLetra(indiceLetra, posicion, escala) {
  return {
    tipo: controles.conectarLetras.checked ? "palabra" : "letra",
    indiceLetra,
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

function moverLetraCompleta(indiceLetra, dx, dy, escala) {
  const deltaX = dx / escala;
  const deltaY = dy / escala;
  const movidos = new Set();

  function moverAjuste(indice, punto) {
    const clave = `${indice}:${punto}`;

    if (movidos.has(clave)) {
      return;
    }

    ajustesManuales[indice][punto].x += deltaX;
    ajustesManuales[indice][punto].y += deltaY;
    movidos.add(clave);
  }

  ajustesManuales[indiceLetra].forEach((_, indicePunto) => {
    moverAjuste(indiceLetra, indicePunto);
  });

  puntosRenderizados[indiceLetra].forEach((punto) => {
    if (punto.controladoPor) {
      moverAjuste(punto.controladoPor.indiceLetra, punto.controladoPor.indicePunto);
    }
  });
}

function iniciarArrastreAmapa(posicion) {
  mouse = posicion;
  const controlCurva = encontrarControlCurvaCercano(posicion);

  if (controlCurva) {
    arrastre = {
      tipo: "controlCurva",
      clave: controlCurva.clave,
      x: posicion.x,
      y: posicion.y
    };
    canvas.style.cursor = "grabbing";
    return arrastre.tipo;
  }

  const manejadorCurvaP = encontrarManejadorCurvaP(posicion);

  if (manejadorCurvaP) {
    arrastre = {
      tipo: "curvaP",
      indiceLetra: manejadorCurvaP.indiceLetra,
      x: posicion.x,
      y: posicion.y,
      escala: obtenerLayout().escala
    };
    canvas.style.cursor = "grabbing";
    return arrastre.tipo;
  }

  const punto = encontrarPuntoCercano(posicion);

  if (!punto) {
    const segmentoCurvo = encontrarSegmentoCercano(posicion);

    if (segmentoCurvo && curvasManuales.has(segmentoCurvo.clave)) {
      arrastre = {
        tipo: "controlCurva",
        clave: segmentoCurvo.clave,
        x: posicion.x,
        y: posicion.y
      };
      canvas.style.cursor = "grabbing";
      return arrastre.tipo;
    }

    const layout = obtenerLayout();
    const indiceLetra = encontrarLetraCercana(posicion);

    if (indiceLetra !== null) {
      arrastre = crearArrastreDesdeLetra(indiceLetra, posicion, layout.escala);
      canvas.style.cursor = "grabbing";
      return arrastre.tipo;
    }

    arrastre = {
      tipo: "vista",
      x: posicion.x,
      y: posicion.y
    };
    canvas.style.cursor = "grabbing";
    return arrastre.tipo;
  }

  const layout = obtenerLayout();
  arrastre = crearArrastreDesdePunto(punto, posicion, layout.escala);
  canvas.style.cursor = "grabbing";
  return arrastre.tipo;
}

function moverArrastreAmapa(posicion) {
  mouse = posicion;

  if (!arrastre) {
    return;
  }

  if (arrastre.tipo === "vista") {
    desplazamientoVista.x += mouse.x - arrastre.x;
    desplazamientoVista.y += mouse.y - arrastre.y;
    arrastre.x = mouse.x;
    arrastre.y = mouse.y;
    return;
  }

  if (arrastre.tipo === "letra") {
    moverLetraCompleta(
      arrastre.indiceLetra,
      mouse.x - arrastre.x,
      mouse.y - arrastre.y,
      arrastre.escala
    );
    arrastre.x = mouse.x;
    arrastre.y = mouse.y;
    return;
  }

  if (arrastre.tipo === "palabra") {
    desplazamientoVista.x += mouse.x - arrastre.x;
    desplazamientoVista.y += mouse.y - arrastre.y;
    arrastre.x = mouse.x;
    arrastre.y = mouse.y;
    return;
  }

  if (arrastre.tipo === "curvaP") {
    const deltaX = (mouse.x - arrastre.x) / arrastre.escala;
    const deltaY = (mouse.y - arrastre.y) / arrastre.escala;

    [2, 3].forEach((indicePunto) => {
      ajustesManuales[arrastre.indiceLetra][indicePunto].x += deltaX;
      ajustesManuales[arrastre.indiceLetra][indicePunto].y += deltaY;
    });

    arrastre.x = mouse.x;
    arrastre.y = mouse.y;
    return;
  }

  if (arrastre.tipo === "controlCurva") {
    const curva = curvasManuales.get(arrastre.clave);
    curva.dx += mouse.x - arrastre.x;
    curva.dy += mouse.y - arrastre.y;
    arrastre.x = mouse.x;
    arrastre.y = mouse.y;
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
}

function terminarArrastreAmapa() {
  if (!arrastre) {
    return;
  }

  arrastre = null;
  canvas.style.cursor = "grab";
}

canvas.addEventListener("pointerdown", (evento) => {
  iniciarArrastreAmapa(obtenerPointer(evento));
  canvas.setPointerCapture(evento.pointerId);
});

canvas.addEventListener("pointermove", (evento) => {
  moverArrastreAmapa(obtenerPointer(evento));
});

canvas.addEventListener("pointerup", (evento) => {
  terminarArrastreAmapa();
  if (canvas.hasPointerCapture(evento.pointerId)) {
    canvas.releasePointerCapture(evento.pointerId);
  }
});

canvas.addEventListener("pointercancel", () => {
  terminarArrastreAmapa();
});

function alternarOjoAmapa(posicion) {
  const punto = encontrarPuntoVisibleCercano(posicion);

  if (!punto) {
    return false;
  }

  const clave = clavePunto(punto);

  if (puntosOjo.has(clave)) {
    puntosOjo.delete(clave);
  } else {
    puntosOjo.add(clave);
  }

  return true;
}

canvas.addEventListener("dblclick", (evento) => {
  const posicion = obtenerPointer(evento);
  if (!alternarOjoAmapa(posicion)) {
    return;
  }

  evento.preventDefault();
});

window.amapaPointerProxy = {
  down: iniciarArrastreAmapa,
  move: moverArrastreAmapa,
  up: terminarArrastreAmapa,
  doubleClick(posicion) {
    return alternarOjoAmapa(posicion);
  }
};

function dibujar() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  ctx.clearRect(0, 0, w, h);
  tiempoCongelado = tiempo;
  calcularPuntos();
  dibujarTrazosLetras();
  dibujarConexiones();
  dibujarControlesCurva();
  dibujarPuntos();

  if (controles.autoMovimiento.checked) {
    tiempo += Number(controles.velocidad.value) / 1800;
  }

  requestAnimationFrame(dibujar);
}

dibujar();
