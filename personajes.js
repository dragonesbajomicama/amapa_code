(() => {
  const canvasPersonaje = document.getElementById("canvasPersonaje");

  if (!canvasPersonaje) {
    return;
  }

  const ctxPersonaje = canvasPersonaje.getContext("2d");
  const controles = {
    modoMovimiento: document.getElementById("modoMovimiento"),
    movimiento: document.getElementById("movimiento"),
    velocidad: document.getElementById("velocidad"),
    autoMovimiento: document.getElementById("autoMovimiento"),
    doblarTabla: document.getElementById("doblarTablaPersonaje"),
    modoTabla: document.getElementById("modoTablaPersonaje"),
    cabezaDelineada: document.getElementById("cabezaDelineadaPersonaje"),
    extremidadesCurvas: document.getElementById("extremidadesCurvasPersonaje"),
    tamanoPunto: document.getElementById("tamanoPunto"),
    grosorLinea: document.getElementById("grosorLinea"),
    colorPunto: document.getElementById("colorPunto"),
    colorLinea: document.getElementById("colorLinea"),
    colorFondo: document.getElementById("colorFondo"),
    random: document.getElementById("randomPersonaje"),
    botonesTabla: document.querySelectorAll(".tabla-boton")
  };

  const nodosBase = {
    cabeza: { x: 0, y: -104 },
    hombroIzq: { x: -32, y: -88 },
    hombroDer: { x: 32, y: -88 },
    pecho: { x: 0, y: -64 },
    coxis: { x: 0, y: -24 },
    codoIzq: { x: -58, y: -58 },
    codoDer: { x: 58, y: -58 },
    rodillaIzq: { x: -34, y: 20 },
    rodillaDer: { x: 34, y: 20 },
    pieIzq: { x: -52, y: 62 },
    pieDer: { x: 52, y: 62 },
    tablaIzq: { x: -86, y: 82 },
    tablaBiciA: { x: -90, y: 12 },
    tablaBiciB: { x: -58, y: 66 },
    tablaBiciC: { x: -26, y: 39 },
    tablaDer: { x: 66, y: 76 },
    peloIzq: { x: -18, y: -132 },
    peloCentro: { x: 0, y: -140 },
    peloDer: { x: 18, y: -132 }
  };

  const lineas = [
    ["hombroIzq", "pecho"],
    ["hombroDer", "pecho"],
    ["pecho", "coxis"],
    ["hombroIzq", "codoIzq"],
    ["hombroDer", "codoDer"],
    ["coxis", "rodillaIzq"],
    ["rodillaIzq", "pieIzq"],
    ["coxis", "rodillaDer"],
    ["rodillaDer", "pieDer"]
  ];
  const nodosPelo = ["peloIzq", "peloCentro", "peloDer"];
  const largoPelo = 24;
  const separacionPelo = 0.42;
  const intensidadDobladoPatineta = 0.85;
  const intensidadDobladoBici = 0.1;
  const nodosInvisibles = new Set(["pecho", "coxis", "tablaBiciA", "tablaBiciB", "tablaBiciC", ...nodosPelo]);
  const escalaPersonaje = 0.84;

  const estado = {
    nodos: clonarNodos(nodosBase),
    tiempo: 0,
    arrastre: null,
    vista: { x: 0, y: 0 },
    pelosActivos: false,
    anguloPelo: -Math.PI / 2,
    formas: { paths: [], circles: [] },
    mapaRender: {}
  };

  function clonarNodos(origen) {
    const copia = {};
    Object.entries(origen).forEach(([nombre, punto]) => {
      copia[nombre] = { x: punto.x, y: punto.y };
    });
    return copia;
  }

  function sincronizarBiciConTabla() {
    const baseIzq = nodosBase.tablaIzq;
    const baseDer = nodosBase.tablaDer;
    const actualIzq = estado.nodos.tablaIzq;
    const actualDer = estado.nodos.tablaDer;
    const baseDx = baseDer.x - baseIzq.x;
    const baseDy = baseDer.y - baseIzq.y;
    const actualDx = actualDer.x - actualIzq.x;
    const actualDy = actualDer.y - actualIzq.y;
    const largoBase2 = Math.max(baseDx * baseDx + baseDy * baseDy, 1);

    ["tablaBiciA", "tablaBiciB", "tablaBiciC"].forEach((nombre) => {
      const puntoBase = nodosBase[nombre];
      const relativoX = puntoBase.x - baseIzq.x;
      const relativoY = puntoBase.y - baseIzq.y;
      const avance = (relativoX * baseDx + relativoY * baseDy) / largoBase2;
      const lateral = (relativoX * -baseDy + relativoY * baseDx) / largoBase2;

      estado.nodos[nombre] = {
        x: actualIzq.x + avance * actualDx - lateral * actualDy,
        y: actualIzq.y + avance * actualDy + lateral * actualDx
      };
    });
  }

  function numero(valor) {
    return Number(valor.toFixed(3));
  }

  function ajustarCanvasPersonaje() {
    const rect = canvasPersonaje.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasPersonaje.width = rect.width * dpr;
    canvasPersonaje.height = rect.height * dpr;
    ctxPersonaje.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function obtenerLayout() {
    const rect = canvasPersonaje.getBoundingClientRect();
    const panel = document.querySelector(".panel");
    const rectPanel = panel?.getBoundingClientRect();
    let origenX = rect.width / 2;
    let origenY = rect.height / 2 + 30;
    let anchoDisponible = rect.width;
    let altoDisponible = rect.height;

    if (rectPanel && window.innerWidth > 700) {
      const limiteIzquierdo = Math.min(rectPanel.right - rect.left + 24, rect.width * 0.46);
      origenX = limiteIzquierdo + (rect.width - limiteIzquierdo) / 2;
      anchoDisponible = rect.width - limiteIzquierdo;
    } else if (rectPanel) {
      const limiteSuperior = Math.min(rectPanel.bottom - rect.top + 20, rect.height * 0.4);
      origenY = limiteSuperior + (rect.height - limiteSuperior) / 2 + 30;
      altoDisponible = rect.height - limiteSuperior;
    }

    return {
      ancho: rect.width,
      alto: rect.height,
      escala: Math.min(anchoDisponible / 480, altoDisponible / 390) * escalaPersonaje,
      origenX: origenX + estado.vista.x,
      origenY: origenY + estado.vista.y
    };
  }

  function ruido(nombre, eje) {
    let total = eje === "x" ? 17 : 29;
    for (let i = 0; i < nombre.length; i += 1) {
      total += nombre.charCodeAt(i) * (i + 5);
    }
    return total;
  }

  function proyectar(nombre, layout) {
    const base = estado.nodos[nombre];
    const intensidad = Number(controles.movimiento.value) * 0.46;
    const faseX = estado.tiempo * 1.25 + ruido(nombre, "x") * 0.04;
    const faseY = estado.tiempo * 1.1 + ruido(nombre, "y") * 0.05;
    let x = Math.sin(faseX) * intensidad * 0.75;
    let y = Math.cos(faseY) * intensidad * 0.65;

    if (controles.modoMovimiento.value === "onda") {
      const golpe = Math.sin(estado.tiempo * 2.1 + ruido(nombre, "x") * 0.03) * intensidad * 0.35;
      x = Math.sin(estado.tiempo * 1.6 + base.y * 0.04) * intensidad + golpe;
      y = Math.cos(estado.tiempo * 1.1 + base.x * 0.035) * intensidad * 0.65;
    }

    if (controles.modoMovimiento.value === "pulso") {
      const distancia = Math.max(Math.hypot(base.x, base.y), 1);
      const pulso = Math.sin(estado.tiempo * 2 + ruido(nombre, "x")) * intensidad * 0.9;
      x = (base.x / distancia) * pulso;
      y = (base.y / distancia) * pulso;
    }

    if (controles.modoMovimiento.value === "temblor") {
      x = Math.sin(estado.tiempo * 18 + ruido(nombre, "x")) * intensidad * 1.1;
      y = Math.cos(estado.tiempo * 19 + ruido(nombre, "y")) * intensidad * 1.1;
    }

    return {
      x: layout.origenX + base.x * layout.escala + x,
      y: layout.origenY + base.y * layout.escala + y
    };
  }

  function desproyectar(posicion, layout) {
    return {
      x: (posicion.x - layout.origenX) / layout.escala,
      y: (posicion.y - layout.origenY) / layout.escala
    };
  }

  function crearPuntosRenderizados(layout) {
    const puntos = {};
    Object.keys(estado.nodos).forEach((nombre) => {
      puntos[nombre] = proyectar(nombre, layout);
    });

    if (estado.pelosActivos) {
      const largo = largoPeloActual(layout) * layout.escala;
      nodosPelo.forEach((nombre) => {
        const angulo = estado.anguloPelo + offsetPelo(nombre);
        puntos[nombre] = {
          x: puntos.cabeza.x + Math.cos(angulo) * largo,
          y: puntos.cabeza.y + Math.sin(angulo) * largo
        };
      });
    }

    return puntos;
  }

  function comandoM(p) {
    return `M ${numero(p.x)} ${numero(p.y)}`;
  }

  function comandoL(p) {
    return `L ${numero(p.x)} ${numero(p.y)}`;
  }

  function comandoQ(c, p) {
    return `Q ${numero(c.x)} ${numero(c.y)} ${numero(p.x)} ${numero(p.y)}`;
  }

  function dibujarLinea(formas, a, b) {
    ctxPersonaje.beginPath();
    ctxPersonaje.moveTo(a.x, a.y);
    formas.paths.push(`${comandoM(a)} ${comandoL(b)}`);
    ctxPersonaje.lineTo(b.x, b.y);
    ctxPersonaje.stroke();
  }

  function dibujarCurvaDirecta(formas, a, control, b) {
    formas.paths.push(`${comandoM(a)} ${comandoQ(control, b)}`);
    ctxPersonaje.beginPath();
    ctxPersonaje.moveTo(a.x, a.y);
    ctxPersonaje.quadraticCurveTo(control.x, control.y, b.x, b.y);
    ctxPersonaje.stroke();
  }

  function dibujarCurvaArticulada(formas, a, control, b) {
    dibujarCurvaDirecta(formas, a, controlArticulado(a, control, b), b);
  }

  function dibujarCurvaSuave(formas, puntos) {
    const comandos = [comandoM(puntos[0])];

    ctxPersonaje.beginPath();
    ctxPersonaje.moveTo(puntos[0].x, puntos[0].y);

    for (let i = 0; i < puntos.length - 1; i += 1) {
      const p0 = puntos[Math.max(i - 1, 0)];
      const p1 = puntos[i];
      const p2 = puntos[i + 1];
      const p3 = puntos[Math.min(i + 2, puntos.length - 1)];
      const c1 = {
        x: p1.x + (p2.x - p0.x) / 6,
        y: p1.y + (p2.y - p0.y) / 6
      };
      const c2 = {
        x: p2.x - (p3.x - p1.x) / 6,
        y: p2.y - (p3.y - p1.y) / 6
      };

      comandos.push(
        `C ${numero(c1.x)} ${numero(c1.y)} ${numero(c2.x)} ${numero(c2.y)} ${numero(p2.x)} ${numero(p2.y)}`
      );
      ctxPersonaje.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p2.x, p2.y);
    }

    formas.paths.push(comandos.join(" "));
    ctxPersonaje.stroke();
  }

  function desplazarHacia(origen, destino, distancia) {
    const dx = destino.x - origen.x;
    const dy = destino.y - origen.y;
    const largo = Math.max(Math.hypot(dx, dy), 1);

    return {
      x: origen.x + (dx / largo) * distancia,
      y: origen.y + (dy / largo) * distancia
    };
  }

  function dibujarCirculo(formas, centro, radio, fill = true, stroke = false, fillColor = null) {
    formas.circles.push({ x: centro.x, y: centro.y, r: radio, fill, stroke, fillColor });
    ctxPersonaje.beginPath();
    ctxPersonaje.arc(centro.x, centro.y, radio, 0, Math.PI * 2);
    if (fill) {
      const fillAnterior = ctxPersonaje.fillStyle;
      if (fillColor) {
        ctxPersonaje.fillStyle = fillColor;
      }
      ctxPersonaje.fill();
      ctxPersonaje.fillStyle = fillAnterior;
    }
    if (stroke) {
      ctxPersonaje.stroke();
    }
  }

  function configurarTrazo() {
    ctxPersonaje.lineWidth = Number(controles.grosorLinea.value);
    ctxPersonaje.lineCap = "round";
    ctxPersonaje.lineJoin = "round";
    ctxPersonaje.strokeStyle = controles.colorLinea.value;
    ctxPersonaje.fillStyle = controles.colorPunto.value;
  }

  function obtenerRadioPunto() {
    return Number(controles.tamanoPunto.value);
  }

  function obtenerColorFondo() {
    return controles.colorFondo?.value || "#efeee8";
  }

  function radioOjo() {
    const radio = obtenerRadioPunto();
    return radio + Math.max(7, radio * 1.15);
  }

  function largoPeloActual(layout = obtenerLayout()) {
    const extensionVisible = Math.max(12, obtenerRadioPunto() * 1.35);
    return Math.max(
      largoPelo,
      (radioOjo() + extensionVisible) / Math.max(layout.escala, 0.001)
    );
  }

  function offsetPelo(nombre) {
    if (nombre === "peloIzq") {
      return -separacionPelo;
    }

    if (nombre === "peloDer") {
      return separacionPelo;
    }

    return 0;
  }

  function actualizarPelosDesdeCabeza() {
    const cabeza = estado.nodos.cabeza;
    const largo = largoPeloActual();

    nodosPelo.forEach((nombre) => {
      const angulo = estado.anguloPelo + offsetPelo(nombre);
      estado.nodos[nombre] = {
        x: cabeza.x + Math.cos(angulo) * largo,
        y: cabeza.y + Math.sin(angulo) * largo
      };
    });
  }

  function acomodarPelosDesdeCabeza() {
    estado.anguloPelo = -Math.PI / 2;
    actualizarPelosDesdeCabeza();
  }

  function cabezaCercana(posicion) {
    const cabeza = estado.mapaRender.cabeza;

    if (!cabeza) {
      return false;
    }

    return Math.hypot(posicion.x - cabeza.x, posicion.y - cabeza.y) <= radioOjo() + 12;
  }

  function drawHair(formas, puntos) {
    if (!estado.pelosActivos) {
      return;
    }

    nodosPelo.forEach((nombre) => {
      const punta = puntos[nombre];

      if (!punta) {
        return;
      }

      const inicio = desplazarHacia(puntos.cabeza, punta, radioOjo());
      dibujarLinea(formas, inicio, punta);
    });
  }

  function drawSkeleton(formas, puntos) {
    if (controles.extremidadesCurvas.checked) {
      dibujarLinea(formas, puntos.pecho, puntos.coxis);

      [
        ["pecho", "hombroIzq", "codoIzq"],
        ["pecho", "hombroDer", "codoDer"],
        ["coxis", "rodillaIzq", "pieIzq"],
        ["coxis", "rodillaDer", "pieDer"]
      ].forEach(([inicio, control, fin]) => {
        dibujarCurvaArticulada(formas, puntos[inicio], puntos[control], puntos[fin]);
      });
      return;
    }

    lineas.forEach(([inicio, fin]) => {
      dibujarLinea(formas, puntos[inicio], puntos[fin]);
    });
  }

  function drawBoard(formas, puntos, escala) {
    const curva = Number(controles.doblarTabla.value);
    const radio = obtenerRadioPunto();
    const separacionOjo = Math.max(7, radio * 1.15);
    const margenNodo = radio + separacionOjo;
    const centroA = puntos.tablaIzq;
    const centroB = puntos.tablaDer;

    if (controles.modoTabla.value === "bici") {
      const a = desplazarHacia(centroA, puntos.tablaBiciA, margenNodo);
      const b = desplazarHacia(centroB, puntos.tablaBiciC, margenNodo);
      const direccion = curva * intensidadDobladoBici * escala;
      dibujarCurvaSuave(formas, [
        a,
        { x: puntos.tablaBiciA.x, y: puntos.tablaBiciA.y - direccion },
        puntos.tablaBiciB,
        { x: puntos.tablaBiciC.x, y: puntos.tablaBiciC.y - direccion },
        b
      ]);
      return;
    }

    const a = desplazarHacia(centroA, centroB, margenNodo);
    const b = desplazarHacia(centroB, centroA, margenNodo);
    const control = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2 - curva * intensidadDobladoPatineta * escala
    };

    if (curva === 0) {
      dibujarLinea(formas, a, b);
    } else {
      dibujarCurvaDirecta(formas, a, control, b);
    }
  }

  function drawNodes(formas, puntos, escala) {
    const radio = obtenerRadioPunto();
    const nodosExtremidad = new Set(["hombroIzq", "hombroDer", "rodillaIzq", "rodillaDer"]);

    Object.keys(estado.nodos).forEach((nombre) => {
      if (nodosInvisibles.has(nombre) || (controles.extremidadesCurvas.checked && nodosExtremidad.has(nombre))) {
        return;
      }

      if (
        (nombre === "cabeza" || nombre === "tablaIzq" || nombre === "tablaDer")
      ) {
        const separacionOjo = Math.max(7, radio * 1.15);
        const fillOjo = controles.cabezaDelineada.checked ? "#ffffff" : obtenerColorFondo();
        dibujarCirculo(formas, puntos[nombre], radio + separacionOjo, true, true, fillOjo);
        dibujarCirculo(formas, puntos[nombre], radio, true);
        return;
      }

      dibujarCirculo(formas, puntos[nombre], radio, true);
    });
  }

  function renderPersonaje() {
    const layout = obtenerLayout();

    if (!layout.ancho || !layout.alto) {
      return;
    }

    const formas = { paths: [], circles: [] };
    const puntos = crearPuntosRenderizados(layout);

    ctxPersonaje.clearRect(0, 0, layout.ancho, layout.alto);
    configurarTrazo();

    drawSkeleton(formas, puntos);
    drawHair(formas, puntos);
    drawBoard(formas, puntos, layout.escala);
    drawNodes(formas, puntos, layout.escala);

    estado.formas = formas;
    estado.mapaRender = puntos;
  }

  function animarPersonaje() {
    if (!estado.arrastre && controles.autoMovimiento.checked) {
      estado.tiempo += Number(controles.velocidad.value) / 1800;
    }
    renderPersonaje();
    requestAnimationFrame(animarPersonaje);
  }

  function obtenerPointer(evento) {
    const rect = canvasPersonaje.getBoundingClientRect();
    return {
      x: evento.clientX - rect.left,
      y: evento.clientY - rect.top
    };
  }

  function nodoCercano(posicion) {
    let elegido = null;
    let distanciaMinima = Infinity;
    const nodosSoloBici = new Set(["tablaBiciA", "tablaBiciB", "tablaBiciC"]);

    Object.entries(estado.mapaRender).forEach(([nombre, punto]) => {
      if (nodosSoloBici.has(nombre) && controles.modoTabla.value !== "bici") {
        return;
      }

      if (nodosPelo.includes(nombre) && !estado.pelosActivos) {
        return;
      }

      const distancia = Math.hypot(posicion.x - punto.x, posicion.y - punto.y);
      if (distancia < distanciaMinima) {
        distanciaMinima = distancia;
        elegido = nombre;
      }
    });

    return distanciaMinima <= 20 ? elegido : null;
  }

  function distanciaASegmento(posicion, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const largo = Math.max(dx * dx + dy * dy, 1);
    const t = Math.min(Math.max(((posicion.x - a.x) * dx + (posicion.y - a.y) * dy) / largo, 0), 1);
    const x = a.x + dx * t;
    const y = a.y + dy * t;

    return Math.hypot(posicion.x - x, posicion.y - y);
  }

  function distanciaACurva(posicion, a, control, b) {
    let distanciaMinima = Infinity;
    let anterior = a;

    for (let i = 1; i <= 24; i += 1) {
      const t = i / 24;
      const inv = 1 - t;
      const punto = {
        x: inv * inv * a.x + 2 * inv * t * control.x + t * t * b.x,
        y: inv * inv * a.y + 2 * inv * t * control.y + t * t * b.y
      };

      distanciaMinima = Math.min(distanciaMinima, distanciaASegmento(posicion, anterior, punto));
      anterior = punto;
    }

    return distanciaMinima;
  }

  function controlArticulado(a, control, b) {
    const medio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    return {
      x: medio.x + (control.x - medio.x) * 1.55,
      y: medio.y + (control.y - medio.y) * 1.55
    };
  }

  function distanciaAPolilineaSuave(posicion, puntos) {
    let distanciaMinima = Infinity;
    let anterior = puntos[0];

    for (let i = 0; i < puntos.length - 1; i += 1) {
      const p0 = puntos[Math.max(i - 1, 0)];
      const p1 = puntos[i];
      const p2 = puntos[i + 1];
      const p3 = puntos[Math.min(i + 2, puntos.length - 1)];
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };

      for (let paso = 1; paso <= 12; paso += 1) {
        const t = paso / 12;
        const inv = 1 - t;
        const punto = {
          x:
            inv * inv * inv * p1.x +
            3 * inv * inv * t * c1.x +
            3 * inv * t * t * c2.x +
            t * t * t * p2.x,
          y:
            inv * inv * inv * p1.y +
            3 * inv * inv * t * c1.y +
            3 * inv * t * t * c2.y +
            t * t * t * p2.y
        };

        distanciaMinima = Math.min(distanciaMinima, distanciaASegmento(posicion, anterior, punto));
        anterior = punto;
      }
    }

    return distanciaMinima;
  }

  function obtenerCurvaTabla() {
    const curva = Number(controles.doblarTabla.value);
    const radio = obtenerRadioPunto();
    const separacionOjo = Math.max(7, radio * 1.15);
    const margenNodo = radio + separacionOjo;
    const centroA = estado.mapaRender.tablaIzq;
    const centroB = estado.mapaRender.tablaDer;

    if (!centroA || !centroB) {
      return null;
    }

    const esBici = controles.modoTabla.value === "bici";
    const a = esBici
      ? desplazarHacia(centroA, estado.mapaRender.tablaBiciA, margenNodo)
      : desplazarHacia(centroA, centroB, margenNodo);
    const b = esBici
      ? desplazarHacia(centroB, estado.mapaRender.tablaBiciC, margenNodo)
      : desplazarHacia(centroB, centroA, margenNodo);
    const control = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2 - curva * intensidadDobladoPatineta * obtenerLayout().escala
    };
    const direccion = curva * intensidadDobladoBici * obtenerLayout().escala;
    const puntosBici = [
      a,
      { x: estado.mapaRender.tablaBiciA.x, y: estado.mapaRender.tablaBiciA.y - direccion },
      estado.mapaRender.tablaBiciB,
      { x: estado.mapaRender.tablaBiciC.x, y: estado.mapaRender.tablaBiciC.y - direccion },
      b
    ];

    return {
      a,
      b,
      curva,
      control,
      puntosBici
    };
  }

  function dentroDeGrupo(posicion, nombres, margen = 22) {
    const puntos = nombres.map((nombre) => estado.mapaRender[nombre]).filter(Boolean);
    const xs = puntos.map((punto) => punto.x);
    const ys = puntos.map((punto) => punto.y);

    if (!puntos.length) {
      return false;
    }

    return (
      posicion.x >= Math.min(...xs) - margen &&
      posicion.x <= Math.max(...xs) + margen &&
      posicion.y >= Math.min(...ys) - margen &&
      posicion.y <= Math.max(...ys) + margen
    );
  }

  function tablaCercana(posicion) {
    const tabla = obtenerCurvaTabla();
    const umbral = Math.max(Number(controles.grosorLinea.value) * 4, 18);

    if (!tabla) {
      return false;
    }

    const distancia =
      controles.modoTabla.value === "bici"
        ? distanciaAPolilineaSuave(posicion, tabla.puntosBici)
        : tabla.curva === 0
        ? distanciaASegmento(posicion, tabla.a, tabla.b)
        : distanciaACurva(posicion, tabla.a, tabla.control, tabla.b);

    return distancia <= umbral;
  }

  function personajeCercano(posicion) {
    const umbral = Math.max(Number(controles.grosorLinea.value) * 4, 18);
    const enLinea = controles.extremidadesCurvas.checked
      ? [["pecho", "coxis"]].some(([inicio, fin]) =>
          distanciaASegmento(posicion, estado.mapaRender[inicio], estado.mapaRender[fin]) <= umbral
        ) ||
        [
          ["pecho", "hombroIzq", "codoIzq"],
          ["pecho", "hombroDer", "codoDer"],
          ["coxis", "rodillaIzq", "pieIzq"],
          ["coxis", "rodillaDer", "pieDer"]
        ].some(([inicio, control, fin]) =>
          distanciaACurva(
            posicion,
            estado.mapaRender[inicio],
            controlArticulado(
              estado.mapaRender[inicio],
              estado.mapaRender[control],
              estado.mapaRender[fin]
            ),
            estado.mapaRender[fin]
          ) <= umbral
        )
      : lineas.some(([inicio, fin]) =>
          distanciaASegmento(posicion, estado.mapaRender[inicio], estado.mapaRender[fin]) <= umbral
        );
    const enCentro = dentroDeGrupo(
      posicion,
      ["hombroIzq", "hombroDer", "pecho", "coxis", "codoIzq", "codoDer", "rodillaIzq", "rodillaDer", "pieIzq", "pieDer"],
      umbral
    );

    return enLinea || enCentro;
  }

  function moverNodos(nombres, dx, dy, layout) {
    nombres.forEach((nombre) => {
      estado.nodos[nombre].x += dx / layout.escala;
      estado.nodos[nombre].y += dy / layout.escala;
    });
  }

  function vistaAmbosActiva() {
    return document.querySelector(".lienzos")?.classList.contains("vista-ambos");
  }

  function aleatorio(minimo, maximo) {
    return minimo + Math.random() * (maximo - minimo);
  }

  function mezclarPersonaje() {
    const anclaActual = {
      x: (estado.nodos.pecho.x + estado.nodos.coxis.x) / 2,
      y: (estado.nodos.pecho.y + estado.nodos.coxis.y) / 2
    };
    const tablaActual = clonarNodos({
      tablaIzq: estado.nodos.tablaIzq,
      tablaBiciA: estado.nodos.tablaBiciA,
      tablaBiciB: estado.nodos.tablaBiciB,
      tablaBiciC: estado.nodos.tablaBiciC,
      tablaDer: estado.nodos.tablaDer
    });
    const direccion = Math.random() > 0.5 ? 1 : -1;
    const posesSkate = [
      {
        nombre: "ollie",
        inclinacion: aleatorio(12, 25) * direccion,
        compresion: aleatorio(12, 24),
        apertura: aleatorio(46, 62),
        rodillas: [aleatorio(24, 36), aleatorio(42, 58)],
        piesY: [aleatorio(58, 72), aleatorio(72, 88)],
        brazosY: [aleatorio(-46, -22), aleatorio(2, 30)]
      },
      {
        nombre: "salto",
        inclinacion: aleatorio(-10, 10),
        compresion: aleatorio(24, 34),
        apertura: aleatorio(28, 44),
        rodillas: [aleatorio(16, 28), aleatorio(18, 32)],
        piesY: [aleatorio(38, 54), aleatorio(40, 56)],
        brazosY: [aleatorio(-54, -30), aleatorio(-48, -20)]
      },
      {
        nombre: "grab",
        inclinacion: aleatorio(16, 30) * direccion,
        compresion: aleatorio(20, 32),
        apertura: aleatorio(34, 50),
        rodillas: [aleatorio(18, 30), aleatorio(22, 36)],
        piesY: [aleatorio(44, 60), aleatorio(48, 64)],
        brazosY: [aleatorio(24, 42), aleatorio(-34, -12)]
      },
      {
        nombre: "aterrizaje",
        inclinacion: aleatorio(-14, 14),
        compresion: aleatorio(30, 42),
        apertura: aleatorio(52, 70),
        rodillas: [aleatorio(34, 48), aleatorio(34, 50)],
        piesY: [aleatorio(78, 92), aleatorio(78, 92)],
        brazosY: [aleatorio(-22, 8), aleatorio(-18, 12)]
      }
    ];
    const pose = posesSkate[Math.floor(Math.random() * posesSkate.length)];
    const inclinacion = pose.inclinacion;
    const compresion = pose.compresion;
    const apertura = pose.apertura;
    const centroX = aleatorio(-6, 6);
    const centroY = aleatorio(-3, 4);
    const pecho = {
      x: centroX + inclinacion * 0.25,
      y: -64 + centroY + compresion * 0.18
    };
    const coxis = {
      x: centroX - inclinacion * 0.25,
      y: -24 + centroY + compresion
    };
    const ejeX = pecho.x - coxis.x;
    const ejeY = pecho.y - coxis.y;

    estado.nodos = {
      cabeza: {
        x: pecho.x + ejeX * 0.38 + aleatorio(-3, 3),
        y: pecho.y + ejeY * 0.38 - aleatorio(14, 21)
      },
      hombroIzq: {
        x: pecho.x - aleatorio(28, 38) + inclinacion * 0.08,
        y: pecho.y - aleatorio(16, 24)
      },
      hombroDer: {
        x: pecho.x + aleatorio(28, 38) + inclinacion * 0.08,
        y: pecho.y - aleatorio(16, 24)
      },
      pecho,
      coxis,
      codoIzq: {
        x: pecho.x - aleatorio(54, 86),
        y: pecho.y + pose.brazosY[0]
      },
      codoDer: {
        x: pecho.x + aleatorio(54, 86),
        y: pecho.y + pose.brazosY[1]
      },
      rodillaIzq: {
        x: coxis.x - apertura * 0.42 + direccion * aleatorio(-12, 16),
        y: coxis.y + pose.rodillas[0]
      },
      rodillaDer: {
        x: coxis.x + apertura * 0.42 + direccion * aleatorio(-16, 12),
        y: coxis.y + pose.rodillas[1]
      },
      pieIzq: {
        x: coxis.x - apertura + direccion * aleatorio(-10, 10),
        y: coxis.y + pose.piesY[0]
      },
      pieDer: {
        x: coxis.x + apertura + direccion * aleatorio(-10, 10),
        y: coxis.y + pose.piesY[1]
      },
      ...tablaActual,
      peloIzq: { x: 0, y: 0 },
      peloCentro: { x: 0, y: 0 },
      peloDer: { x: 0, y: 0 }
    };

    const anclaNueva = {
      x: (estado.nodos.pecho.x + estado.nodos.coxis.x) / 2,
      y: (estado.nodos.pecho.y + estado.nodos.coxis.y) / 2
    };
    const ajusteX = anclaActual.x - anclaNueva.x;
    const ajusteY = anclaActual.y - anclaNueva.y;

    [
      "cabeza",
      "hombroIzq",
      "hombroDer",
      "pecho",
      "coxis",
      "codoIzq",
      "codoDer",
      "rodillaIzq",
      "rodillaDer",
      "pieIzq",
      "pieDer"
    ].forEach((nombre) => {
      estado.nodos[nombre].x += ajusteX;
      estado.nodos[nombre].y += ajusteY;
    });

    acomodarPelosDesdeCabeza();
    renderPersonaje();
  }

  function crearSvgPersonaje() {
    const layout = obtenerLayout();
    const ancho = numero(layout.ancho);
    const alto = numero(layout.alto);
    const partes = crearPartesSvgPersonaje();

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">`,
      '  <g id="lineas-negras">',
      ...partes.paths,
      "  </g>",
      '  <g id="puntos-grises">',
      ...partes.puntos,
      "  </g>",
      "</svg>"
    ].join("\n");
  }

  function crearPartesSvgPersonaje() {
    renderPersonaje();
    const paths = estado.formas.paths.map(
      (d) =>
        `    <path d="${d}" stroke="${controles.colorLinea.value}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${numero(Number(controles.grosorLinea.value))}" />`
    );
    const circles = estado.formas.circles.map((c) => {
      const fill = c.fill ? c.fillColor || controles.colorPunto.value : "none";
      const stroke = c.stroke ? controles.colorLinea.value : "none";
      return `    <circle cx="${numero(c.x)}" cy="${numero(c.y)}" r="${numero(c.r)}" fill="${fill}" stroke="${stroke}" stroke-width="${numero(Number(controles.grosorLinea.value))}" />`;
    });

    return { paths, puntos: circles };
  }

  function descargarSvgPersonaje() {
    const blob = new Blob([crearSvgPersonaje()], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = "personaje-skate-export.svg";
    enlace.style.display = "none";
    document.body.appendChild(enlace);
    enlace.click();

    setTimeout(() => {
      enlace.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }

  canvasPersonaje.addEventListener("pointerdown", (evento) => {
    const posicion = obtenerPointer(evento);
    const nodo = nodoCercano(posicion);

    if (!nodo) {
      if (tablaCercana(posicion)) {
        estado.arrastre = {
          tipo: "tabla",
          x: posicion.x,
          y: posicion.y
        };
        canvasPersonaje.setPointerCapture(evento.pointerId);
        canvasPersonaje.style.cursor = "grabbing";
        return;
      }

      if (personajeCercano(posicion)) {
        estado.arrastre = {
          tipo: "personaje",
          x: posicion.x,
          y: posicion.y
        };
        canvasPersonaje.setPointerCapture(evento.pointerId);
        canvasPersonaje.style.cursor = "grabbing";
        return;
      }

      if (vistaAmbosActiva() && window.amapaPointerProxy) {
        const tipoAmapa = window.amapaPointerProxy.down(posicion);
        estado.arrastre = {
          tipo: tipoAmapa === "vista" ? "vistaCompuesta" : "amapa",
          x: posicion.x,
          y: posicion.y
        };
        canvasPersonaje.setPointerCapture(evento.pointerId);
        canvasPersonaje.style.cursor = "grabbing";
        return;
      }

      estado.arrastre = {
        tipo: "vista",
        x: posicion.x,
        y: posicion.y
      };
      canvasPersonaje.setPointerCapture(evento.pointerId);
      canvasPersonaje.style.cursor = "grabbing";
      return;
    }

    estado.arrastre = {
      tipo: "nodo",
      nombre: nodo,
      x: posicion.x,
      y: posicion.y
    };
    canvasPersonaje.setPointerCapture(evento.pointerId);
    canvasPersonaje.style.cursor = "grabbing";
  });

  canvasPersonaje.addEventListener("pointermove", (evento) => {
    const posicion = obtenerPointer(evento);

    if (!estado.arrastre) {
      canvasPersonaje.style.cursor = "grab";
      return;
    }

    if (estado.arrastre.tipo === "vista") {
      estado.vista.x += posicion.x - estado.arrastre.x;
      estado.vista.y += posicion.y - estado.arrastre.y;
      estado.arrastre.x = posicion.x;
      estado.arrastre.y = posicion.y;
      renderPersonaje();
      return;
    }

    if (estado.arrastre.tipo === "vistaCompuesta") {
      estado.vista.x += posicion.x - estado.arrastre.x;
      estado.vista.y += posicion.y - estado.arrastre.y;
      estado.arrastre.x = posicion.x;
      estado.arrastre.y = posicion.y;
      window.amapaPointerProxy?.move(posicion);
      renderPersonaje();
      return;
    }

    if (estado.arrastre.tipo === "amapa") {
      window.amapaPointerProxy?.move(posicion);
      return;
    }

    if (estado.arrastre.tipo === "tabla") {
      moverNodos(
        ["tablaIzq", "tablaBiciA", "tablaBiciB", "tablaBiciC", "tablaDer"],
        posicion.x - estado.arrastre.x,
        posicion.y - estado.arrastre.y,
        obtenerLayout()
      );
      estado.arrastre.x = posicion.x;
      estado.arrastre.y = posicion.y;
      renderPersonaje();
      return;
    }

    if (estado.arrastre.tipo === "personaje") {
      moverNodos(
        ["cabeza", "hombroIzq", "hombroDer", "pecho", "coxis", "codoIzq", "codoDer", "rodillaIzq", "rodillaDer", "pieIzq", "pieDer", ...nodosPelo],
        posicion.x - estado.arrastre.x,
        posicion.y - estado.arrastre.y,
        obtenerLayout()
      );
      estado.arrastre.x = posicion.x;
      estado.arrastre.y = posicion.y;
      renderPersonaje();
      return;
    }

    const layout = obtenerLayout();
    const nuevoPunto = desproyectar(posicion, layout);

    if (nodosPelo.includes(estado.arrastre.nombre)) {
      const cabeza = estado.mapaRender.cabeza;
      estado.anguloPelo =
        Math.atan2(posicion.y - cabeza.y, posicion.x - cabeza.x) - offsetPelo(estado.arrastre.nombre);
      actualizarPelosDesdeCabeza();
      estado.arrastre.x = posicion.x;
      estado.arrastre.y = posicion.y;
      renderPersonaje();
      return;
    }

    estado.nodos[estado.arrastre.nombre] = nuevoPunto;
    if (estado.arrastre.nombre === "cabeza" && estado.pelosActivos) {
      actualizarPelosDesdeCabeza();
    }
    renderPersonaje();
  });

  canvasPersonaje.addEventListener("pointerup", (evento) => {
    if (estado.arrastre?.tipo === "amapa" || estado.arrastre?.tipo === "vistaCompuesta") {
      window.amapaPointerProxy?.up();
    }
    estado.arrastre = null;
    if (canvasPersonaje.hasPointerCapture(evento.pointerId)) {
      canvasPersonaje.releasePointerCapture(evento.pointerId);
    }
    canvasPersonaje.style.cursor = "grab";
  });

  canvasPersonaje.addEventListener("pointercancel", () => {
    if (estado.arrastre?.tipo === "amapa" || estado.arrastre?.tipo === "vistaCompuesta") {
      window.amapaPointerProxy?.up();
    }
    estado.arrastre = null;
    canvasPersonaje.style.cursor = "grab";
  });

  canvasPersonaje.addEventListener("dblclick", (evento) => {
    const posicion = obtenerPointer(evento);

    if (cabezaCercana(posicion)) {
      estado.pelosActivos = !estado.pelosActivos;
      if (estado.pelosActivos) {
        acomodarPelosDesdeCabeza();
      }
      renderPersonaje();
      evento.preventDefault();
      return;
    }

    if (!vistaAmbosActiva() || !window.amapaPointerProxy) {
      return;
    }

    if (nodoCercano(posicion)) {
      return;
    }

    if (window.amapaPointerProxy.doubleClick(posicion)) {
      evento.preventDefault();
    }
  });

  controles.movimiento.addEventListener("input", renderPersonaje);
  controles.velocidad.addEventListener("input", renderPersonaje);
  controles.autoMovimiento.addEventListener("input", renderPersonaje);
  controles.modoMovimiento.addEventListener("input", renderPersonaje);
  controles.doblarTabla.addEventListener("input", renderPersonaje);
  controles.modoTabla.addEventListener("input", () => {
    if (controles.modoTabla.value === "bici") {
      sincronizarBiciConTabla();
    }
    renderPersonaje();
  });
  controles.botonesTabla.forEach((boton) => {
    boton.addEventListener("click", () => {
      controles.modoTabla.value = boton.dataset.tabla;
      controles.botonesTabla.forEach((opcion) => {
        const activa = opcion === boton;
        opcion.classList.toggle("activo", activa);
        opcion.setAttribute("aria-pressed", String(activa));
      });
      controles.modoTabla.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
  controles.cabezaDelineada.addEventListener("input", renderPersonaje);
  controles.extremidadesCurvas.addEventListener("input", renderPersonaje);
  controles.tamanoPunto.addEventListener("input", renderPersonaje);
  controles.grosorLinea.addEventListener("input", renderPersonaje);
  controles.colorPunto.addEventListener("input", renderPersonaje);
  controles.colorLinea.addEventListener("input", renderPersonaje);
  controles.random.addEventListener("click", mezclarPersonaje);
  window.personajesSvgExport = {
    crearPartes: crearPartesSvgPersonaje,
    descargar: descargarSvgPersonaje
  };
  window.addEventListener("resize", ajustarCanvasPersonaje);
  window.personajesResize = () => {
    ajustarCanvasPersonaje();
    renderPersonaje();
  };

  ajustarCanvasPersonaje();
  animarPersonaje();
})();
