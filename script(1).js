import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* =========================
   CONFIGURACIÓN DE FIREBASE
   ========================= */

const firebaseConfig = {
    apiKey: "AIzaSyDNLanoPTp76LIVO_CiiT3CZvlz6C0mNAk",
    authDomain: "horarios-42998.firebaseapp.com",
    databaseURL: "https://horarios-42998-default-rtdb.firebaseio.com",
    projectId: "horarios-42998",
    storageBucket: "horarios-42998.firebasestorage.app",
    messagingSenderId: "823146395738",
    appId: "1:823146395738:web:3d6255ab3999b618270063"
};

const appFirebase = initializeApp(firebaseConfig);
const db = getDatabase(appFirebase);
const horariosRef = ref(db, "horarios");
const asignaturasRef = ref(db, "asignaturas");

let vistaActual = "semana";
let fechaActual = new Date();
let eventoEditando = null;

let eventoArrastrado = null;
let eventoPendiente = null;
let arrastreRealizado = false;

let horarios = [];
let horariosCargados = false;

/* =========================
   ELEMENTOS
   ========================= */

const calendario = document.getElementById("calendario");
const tituloCalendario = document.getElementById("tituloCalendario");
const modal = document.getElementById("modal");

const todoElDia = document.getElementById("todoElDia");
const horaInicio = document.getElementById("horaInicio");
const horaFin = document.getElementById("horaFin");

const nombresDias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado"
];

const nombresMeses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
];

/* =========================
   GUARDAR Y ESCUCHAR DATOS (FIREBASE)
   ========================= */

function guardarDatos() {
    // Nunca se guarda hasta haber leído antes lo que hay en Firebase (evita pisar los datos con una lista vacía)
    if (!horariosCargados) {
        console.warn("Guardado cancelado: los eventos todavía no se han cargado.");
        return;
    }
    set(horariosRef, horarios).catch(function (error) {
        console.error("Error al guardar en Firebase:", error);
    });
}

function escucharDatos() {
    onValue(horariosRef, function (snapshot) {
        const datos = snapshot.val();
        horariosCargados = true;

        if (!datos) {
            horarios = [];
        } else if (Array.isArray(datos)) {
            horarios = datos;
        } else {
            horarios = Object.values(datos);
        }

        mostrarCalendario();
    }, function (error) {
        console.error("Error al leer de Firebase:", error);
    });
}

/* =========================
   TOGGLE COMPLETADO / TACHADO
   ========================= */

function alternarCompletado(evento) {
    evento.completado = !evento.completado;
    guardarDatos();
    mostrarCalendario();
}

/* =========================
   ARRASTRAR EVENTOS (RATÓN / HTML5)
   ========================= */

function iniciarArrastre(e, evento, elemento) {
    eventoArrastrado = { id: evento.id };
    arrastreRealizado = true;

    elemento.classList.add("arrastrando");
    e.dataTransfer.effectAllowed = "copyMove";
    e.dataTransfer.setData("text/plain", String(evento.id));
}

function terminarArrastre(elemento) {
    elemento.classList.remove("arrastrando");
    setTimeout(() => {
        arrastreRealizado = false;
    }, 100);
}

function permitirSoltar(e) {
    e.preventDefault();
    e.currentTarget.classList.add("dia-destino");
    e.dataTransfer.dropEffect = "move";
}

function salirZonaSoltar(e) {
    e.currentTarget.classList.remove("dia-destino");
}

function soltarEvento(e, nuevaFecha) {
    e.preventDefault();
    e.currentTarget.classList.remove("dia-destino");

    if (!eventoArrastrado) return;

    const id = eventoArrastrado.id;
    eventoArrastrado = null;

    manejarSoltarEvento(id, nuevaFecha);
}

/* =========================
   ARRASTRAR Y DOBLE TOQUE (TÁCTIL / MÓVIL)
   ========================= */

const UMBRAL_MOVIMIENTO = 8;
let toqueArrastre = null;
let ultimoToqueTiempo = 0;
let toqueTimer = null;

function iniciarToqueEvento(e, evento, elemento) {
    if (e.touches.length !== 1) return;

    const toque = e.touches[0];

    toqueArrastre = {
        evento: evento,
        elementoOriginal: elemento,
        startX: toque.clientX,
        startY: toque.clientY,
        dragging: false,
        moved: false,
        celdaActual: null,
        fantasma: null
    };
}

function iniciarArrastreTactil() {
    if (!toqueArrastre) return;

    toqueArrastre.dragging = true;
    const original = toqueArrastre.elementoOriginal;
    original.classList.add("arrastrando");

    if (navigator.vibrate) {
        navigator.vibrate(30);
    }

    const fantasma = original.cloneNode(true);
    fantasma.classList.add("fantasma-arrastre");
    fantasma.classList.remove("arrastrando");

    const rect = original.getBoundingClientRect();
    fantasma.style.width = rect.width + "px";

    document.body.appendChild(fantasma);
    toqueArrastre.fantasma = fantasma;

    moverFantasma(toqueArrastre.startX, toqueArrastre.startY);
}

function moverFantasma(x, y) {
    if (!toqueArrastre || !toqueArrastre.fantasma) return;
    toqueArrastre.fantasma.style.left = x + "px";
    toqueArrastre.fantasma.style.top = y + "px";
}

function actualizarZonaDestinoTactil(x, y) {
    const elementoDebajo = document.elementFromPoint(x, y);
    const celda = elementoDebajo ? elementoDebajo.closest(".dia, .dia-mes") : null;

    document.querySelectorAll(".dia-destino").forEach(el => el.classList.remove("dia-destino"));

    if (celda && celda.dataset.fecha) {
        celda.classList.add("dia-destino");
        toqueArrastre.celdaActual = celda;
    } else {
        toqueArrastre.celdaActual = null;
    }
}

function moverToqueEvento(e) {
    if (!toqueArrastre) return;

    const toque = e.touches[0];
    const dx = toque.clientX - toqueArrastre.startX;
    const dy = toque.clientY - toqueArrastre.startY;

    if (!toqueArrastre.dragging) {
        if (Math.abs(dx) > UMBRAL_MOVIMIENTO || Math.abs(dy) > UMBRAL_MOVIMIENTO) {
            toqueArrastre.moved = true;
            iniciarArrastreTactil();
        }
        return;
    }

    e.preventDefault();
    moverFantasma(toque.clientX, toque.clientY);
    actualizarZonaDestinoTactil(toque.clientX, toque.clientY);
}

function finalizarToqueEvento(e) {
    if (!toqueArrastre) return;

    const estabaArrastrando = toqueArrastre.dragging;
    const seMovio = toqueArrastre.moved;
    const evento = toqueArrastre.evento;
    const celda = toqueArrastre.celdaActual;
    const original = toqueArrastre.elementoOriginal;
    const fantasma = toqueArrastre.fantasma;

    if (fantasma) fantasma.remove();
    document.querySelectorAll(".dia-destino").forEach(el => el.classList.remove("dia-destino"));

    if (estabaArrastrando && celda && celda.dataset.fecha) {
        terminarArrastre(original);
        manejarSoltarEvento(evento.id, celda.dataset.fecha);
    } else if (!seMovio) {
        const ahora = Date.now();
        const diferenciaTiempo = ahora - ultimoToqueTiempo;

        if (diferenciaTiempo < 300 && diferenciaTiempo > 0) {
            if (toqueTimer) {
                clearTimeout(toqueTimer);
                toqueTimer = null;
            }
            e.preventDefault();
            alternarCompletado(evento);
            ultimoToqueTiempo = 0;
        } else {
            ultimoToqueTiempo = ahora;
            toqueTimer = setTimeout(() => {
                editarEvento(evento);
                toqueTimer = null;
            }, 300);
        }
    }

    toqueArrastre = null;
}

function cancelarToqueEvento() {
    if (!toqueArrastre) return;
    if (toqueArrastre.fantasma) toqueArrastre.fantasma.remove();
    if (toqueArrastre.dragging) terminarArrastre(toqueArrastre.elementoOriginal);

    document.querySelectorAll(".dia-destino").forEach(el => el.classList.remove("dia-destino"));
    toqueArrastre = null;
}

/* =========================
   LÓGICA COMÚN DE SOLTAR
   ========================= */

function manejarSoltarEvento(idEvento, nuevaFecha) {
    const eventoOriginal = horarios.find(evento => String(evento.id) === String(idEvento));

    if (!eventoOriginal) return;

    if (eventoOriginal.fecha === nuevaFecha) {
        mostrarCalendario();
        return;
    }

    eventoPendiente = {
        evento: eventoOriginal,
        nuevaFecha: nuevaFecha
    };

    const modalArrastre = document.getElementById("modalArrastre");
    if (modalArrastre) modalArrastre.classList.remove("oculto");
}

/* =========================
   MOVER / COPIAR / CANCELAR EVENTO
   ========================= */

function moverEventoArrastrado() {
    if (!eventoPendiente) return;
    eventoPendiente.evento.fecha = eventoPendiente.nuevaFecha;
    guardarDatos();
    cerrarModalArrastre();
    eventoPendiente = null;
    mostrarCalendario();
}

function copiarEventoArrastrado() {
    if (!eventoPendiente) return;
    const original = eventoPendiente.evento;
    const copia = {
        ...original,
        id: Date.now() + Math.floor(Math.random() * 10000),
        fecha: eventoPendiente.nuevaFecha
    };
    horarios.push(copia);
    guardarDatos();
    cerrarModalArrastre();
    eventoPendiente = null;
    mostrarCalendario();
}

function cancelarEventoArrastrado() {
    cerrarModalArrastre();
    eventoPendiente = null;
    mostrarCalendario();
}

function cerrarModalArrastre() {
    const modalArrastre = document.getElementById("modalArrastre");
    if (modalArrastre) modalArrastre.classList.add("oculto");
}

const botonMover = document.getElementById("botonMover");
const botonCopiar = document.getElementById("botonCopiar");
const botonCancelarArrastre = document.getElementById("botonCancelarArrastre");

if (botonMover) botonMover.addEventListener("click", moverEventoArrastrado);
if (botonCopiar) botonCopiar.addEventListener("click", copiarEventoArrastrado);
if (botonCancelarArrastre) botonCancelarArrastre.addEventListener("click", cancelarEventoArrastrado);

/* =========================
   MOSTRAR CALENDARIO
   ========================= */

function mostrarCalendario() {
    if (vistaActual === "semana") {
        mostrarSemana();
    } else {
        mostrarMes();
    }
}

/* =========================
   ADJUNTAR EVENTOS A UN ELEMENTO ARRASTRABLE
   ========================= */

const esDispositivoTactil = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

function hacerArrastrable(elemento, evento) {
    if (!esDispositivoTactil) {
        elemento.draggable = true;
        let clickTimer = null;

        elemento.addEventListener("dragstart", function (e) {
            if (clickTimer) clearTimeout(clickTimer);
            iniciarArrastre(e, evento, elemento);
        });

        elemento.addEventListener("dragend", function () {
            terminarArrastre(elemento);
        });

        elemento.addEventListener("click", function () {
            if (arrastreRealizado) return;

            if (clickTimer === null) {
                clickTimer = setTimeout(() => {
                    clickTimer = null;
                    editarEvento(evento);
                }, 250);
            }
        });

        elemento.addEventListener("dblclick", function (e) {
            e.stopPropagation();
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }
            alternarCompletado(evento);
        });

        return;
    }

    elemento.addEventListener("touchstart", function (e) {
        iniciarToqueEvento(e, evento, elemento);
    }, { passive: true });

    elemento.addEventListener("touchmove", moverToqueEvento, { passive: false });
    elemento.addEventListener("touchend", finalizarToqueEvento);
    elemento.addEventListener("touchcancel", cancelarToqueEvento);
}

function hacerZonaDeSoltar(elemento, fechaTexto) {
    elemento.dataset.fecha = fechaTexto;
    elemento.addEventListener("dragover", permitirSoltar);
    elemento.addEventListener("dragleave", salirZonaSoltar);
    elemento.addEventListener("drop", function (e) {
        soltarEvento(e, fechaTexto);
    });
}

function horaAMinutos(horaTexto) {
    if (!horaTexto) return 0;
    const [h, m] = horaTexto.split(":").map(Number);
    return h * 60 + (m || 0);
}

/* =========================
   VISTA SEMANAL
   ========================= */

const ALTURA_HORA_PX = 90;

function mostrarSemana() {
    calendario.innerHTML = "";

    const d = new Date(fechaActual);
    const diaActual = d.getDay();
    let lunes = new Date(d);

    if (diaActual === 0) {
        lunes.setDate(d.getDate() - 6);
    } else {
        lunes.setDate(d.getDate() - (diaActual - 1));
    }

    tituloCalendario.textContent = `${nombresMeses[lunes.getMonth()]} ${lunes.getFullYear()}`;

    const contenedor = document.createElement("div");
    contenedor.className = "calendario-semana";

    const fechasSemana = [];
    for (let dia = 1; dia <= 7; dia++) {
        const fechaDia = new Date(lunes);
        fechaDia.setDate(lunes.getDate() + dia - 1);
        const año = fechaDia.getFullYear();
        const mes = String(fechaDia.getMonth() + 1).padStart(2, "0");
        const numero = String(fechaDia.getDate()).padStart(2, "0");
        fechasSemana.push({
            fechaTexto: `${año}-${mes}-${numero}`,
            fechaObjeto: fechaDia
        });
    }

    const eventosSemanaConHora = horarios.filter(evento => {
        return fechasSemana.some(f => f.fechaTexto === evento.fecha) && !evento.todoElDia && evento.inicio;
    });

    let horaInicioRango = 6;
    let horaFinRango = 18;

    if (eventosSemanaConHora.length > 0) {
        let minMinutos = 24 * 60;
        let maxMinutos = 0;

        eventosSemanaConHora.forEach(evento => {
            const minInicio = horaAMinutos(evento.inicio);
            const minFin = horaAMinutos(evento.fin);
            if (minInicio < minMinutos) minMinutos = minInicio;
            if (minFin > maxMinutos) maxMinutos = minFin;
        });

        const horaMin = Math.floor(minMinutos / 60);
        const horaMax = Math.ceil(maxMinutos / 60);

        if (horaMin < horaInicioRango) horaInicioRango = horaMin;
        if (horaMax > horaFinRango) horaFinRango = horaMax;
    }

    const totalHorasRango = horaFinRango - horaInicioRango;
    const alturaTotalPx = totalHorasRango * ALTURA_HORA_PX;

    // 1. COLUMNA IZQUIERDA (HORAS)
    const columnaHoras = document.createElement("div");
    columnaHoras.className = "columna-horas";

    const vacioHeader = document.createElement("div");
    vacioHeader.className = "header-hora-vacio";
    columnaHoras.appendChild(vacioHeader);

    const cuerpoHoras = document.createElement("div");
    cuerpoHoras.className = "cuerpo-horas";
    cuerpoHoras.style.height = `${alturaTotalPx}px`;

    for (let h = horaInicioRango; h < horaFinRango; h++) {
        const marcaHora = document.createElement("div");
        marcaHora.className = "marca-hora";
        marcaHora.style.height = `${ALTURA_HORA_PX}px`;
        marcaHora.textContent = `${String(h).padStart(2, "0")}:00`;
        cuerpoHoras.appendChild(marcaHora);
    }
    columnaHoras.appendChild(cuerpoHoras);
    contenedor.appendChild(columnaHoras);

    // 2. COLUMNAS DE DÍAS (LUNES A DOMINGO)
    fechasSemana.forEach(fInfo => {
        const columna = document.createElement("div");
        columna.className = "dia";

        hacerZonaDeSoltar(columna, fInfo.fechaTexto);

        const cabecera = document.createElement("div");
        cabecera.className = "cabecera-dia-semana";

        const nombre = document.createElement("div");
        nombre.className = "nombre-dia";
        nombre.textContent = `${nombresDias[fInfo.fechaObjeto.getDay()]} ${fInfo.fechaObjeto.getDate()}/${fInfo.fechaObjeto.getMonth() + 1}`;
        cabecera.appendChild(nombre);

        const areaTodoElDia = document.createElement("div");
        areaTodoElDia.className = "area-todo-el-dia";

        const rejillaHoras = document.createElement("div");
        rejillaHoras.className = "rejilla-horas";
        rejillaHoras.style.height = `${alturaTotalPx}px`;

        for (let h = horaInicioRango; h < horaFinRango; h++) {
            const lineaHora = document.createElement("div");
            lineaHora.className = "linea-hora";
            lineaHora.style.height = `${ALTURA_HORA_PX}px`;
            rejillaHoras.appendChild(lineaHora);
        }

        const eventosDia = horarios.filter(evento => evento.fecha === fInfo.fechaTexto);

        const eventoTodoElDia = eventosDia.find(evento => evento.todoElDia);
        if (eventoTodoElDia) {
            columna.classList.add("dia-con-evento-todo-dia");
            columna.style.setProperty("--color-borde-dia", eventoTodoElDia.color || "#6366f1");
        }

        eventosDia.forEach(function (evento) {
            const elemento = document.createElement("div");
            elemento.className = "evento";

            if (evento.completado) {
                elemento.classList.add("completado");
            }
            elemento.style.background = evento.color;

            if (evento.todoElDia) {
                elemento.classList.add("evento-todo-dia");
                elemento.innerHTML = `<strong>${evento.nombre}</strong>`;
                hacerArrastrable(elemento, evento);
                areaTodoElDia.appendChild(elemento);
            } else {
                elemento.classList.add("evento-posicionado");

                const minutosInicio = horaAMinutos(evento.inicio);
                const minutosFin = horaAMinutos(evento.fin);
                
                const minutosDesdeInicioRango = minutosInicio - (horaInicioRango * 60);
                const duracionMinutos = minutosFin - minutosInicio;

                const topPx = (minutosDesdeInicioRango / 60) * ALTURA_HORA_PX;
                const heightPx = Math.max((duracionMinutos / 60) * ALTURA_HORA_PX, 35);

                elemento.style.top = `${topPx}px`;
                elemento.style.height = `${heightPx}px`;

                const horario = `${evento.inicio} - ${evento.fin}`;
                elemento.innerHTML = `
                    <div class="evento-contenido">
                        <strong>${evento.nombre}</strong>
                        <span>${horario}</span>
                    </div>
                `;

                hacerArrastrable(elemento, evento);
                rejillaHoras.appendChild(elemento);
            }
        });

        cabecera.appendChild(areaTodoElDia);
        columna.appendChild(cabecera);
        columna.appendChild(rejillaHoras);
        contenedor.appendChild(columna);
    });

    calendario.appendChild(contenedor);
}

/* =========================
   VISTA MENSUAL
   ========================= */

function mostrarMes() {
    calendario.innerHTML = "";
    const año = fechaActual.getFullYear();
    const mes = fechaActual.getMonth();

    tituloCalendario.textContent = `${nombresMeses[mes]} ${año}`;

    const contenedor = document.createElement("div");
    contenedor.className = "calendario-mes";

    const diasSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    diasSemana.forEach(function (dia) {
        const elemento = document.createElement("div");
        elemento.className = "cabecera-mes";
        elemento.textContent = dia;
        contenedor.appendChild(elemento);
    });

    let primerDia = new Date(año, mes, 1).getDay();
    if (primerDia === 0) primerDia = 7;

    const diasMes = new Date(año, mes + 1, 0).getDate();

    for (let i = 1; i < primerDia; i++) {
        const vacio = document.createElement("div");
        vacio.className = "dia-mes";
        contenedor.appendChild(vacio);
    }

    for (let dia = 1; dia <= diasMes; dia++) {
        const elemento = document.createElement("div");
        elemento.className = "dia-mes";

        const numero = document.createElement("div");
        numero.className = "numero-dia";
        numero.textContent = dia;
        elemento.appendChild(numero);

        const mesTexto = String(mes + 1).padStart(2, "0");
        const diaTexto = String(dia).padStart(2, "0");
        const fechaTexto = `${año}-${mesTexto}-${diaTexto}`;

        hacerZonaDeSoltar(elemento, fechaTexto);

        const eventosDia = horarios.filter(evento => evento.fecha === fechaTexto);

        const eventoTodoElDia = eventosDia.find(evento => evento.todoElDia);
        if (eventoTodoElDia) {
            elemento.classList.add("dia-con-evento-todo-dia");
            elemento.style.setProperty("--color-borde-dia", eventoTodoElDia.color || "#6366f1");
        }

        eventosDia.sort(function (a, b) {
            if (a.todoElDia && !b.todoElDia) return -1;
            if (!a.todoElDia && b.todoElDia) return 1;
            return (a.inicio || "").localeCompare(b.inicio || "");
        });

        eventosDia.forEach(function (evento) {
            const eventoElemento = document.createElement("div");
            eventoElemento.className = "evento-mes";

            if (evento.completado) {
                eventoElemento.classList.add("completado");
            }

            eventoElemento.style.background = evento.color;

            const texto = document.createElement("span");
            texto.className = "evento-mes-texto";

            if (evento.todoElDia) {
                texto.innerHTML = `${evento.nombre} <small>Todo el día</small>`;
            } else {
                texto.innerHTML = `${evento.inicio} ${evento.nombre}`;
            }

            eventoElemento.appendChild(texto);
            hacerArrastrable(eventoElemento, evento);
            elemento.appendChild(eventoElemento);
        });

        contenedor.appendChild(elemento);
    }

    calendario.appendChild(contenedor);
}

/* =========================
   AUTORRELLENADO INTELIGENTE DE HORAS Y TAB
   ========================= */

function normalizarHora(input) {
    let val = input.value.trim();
    if (!val) return;

    // Si escriben solo un número o dos (ej. "8" o "14") -> "08:00" o "14:00"
    if (/^\d{1,2}$/.test(val)) {
        input.value = val.padStart(2, "0") + ":00";
        return;
    }

    // Si escriben 3 dígitos (ej. "930") -> "09:30"
    if (/^\d{3}$/.test(val)) {
        input.value = "0" + val[0] + ":" + val.slice(1);
        return;
    }

    // Si escriben 4 dígitos (ej. "1430") -> "14:30"
    if (/^\d{4}$/.test(val)) {
        input.value = val.slice(0, 2) + ":" + val.slice(2);
        return;
    }

    // Si escriben con dos puntos (ej. "8:", "8:5", "08:3")
    if (val.includes(":")) {
        let partes = val.split(":");
        let h = partes[0].trim().padStart(2, "0") || "00";
        let m = partes[1].trim().padEnd(2, "0") || "00";
        input.value = h + ":" + m;
    }
}

horaInicio.addEventListener("keydown", function (e) {
    if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        normalizarHora(horaInicio);
        horaFin.focus();
    }
});

horaInicio.addEventListener("blur", function () {
    normalizarHora(this);
});

horaFin.addEventListener("blur", function () {
    normalizarHora(this);
});

/* =========================
   CONTROLES Y MODALES
   ========================= */

function actualizarHoras() {
    if (todoElDia.checked) {
        horaInicio.disabled = true;
        horaFin.disabled = true;
        horaInicio.value = "";
        horaFin.value = "";
    } else {
        horaInicio.disabled = false;
        horaFin.disabled = false;
    }
}

todoElDia.addEventListener("change", actualizarHoras);

function abrirModal() {
    eventoEditando = null;
    document.getElementById("tituloModal").textContent = "Añadir evento";
    document.getElementById("nombreEvento").value = "";
    document.getElementById("fechaEvento").value = "";
    horaInicio.value = "";
    horaFin.value = "";
    todoElDia.checked = false;
    actualizarHoras();
    document.getElementById("colorEvento").value = "#6366f1";
    document.getElementById("botonEliminar").style.display = "none";
    modal.classList.remove("oculto");
}

function cerrarModal() {
    modal.classList.add("oculto");
    eventoEditando = null;
}

function editarEvento(evento) {
    eventoEditando = evento;
    document.getElementById("tituloModal").textContent = "Editar evento";
    document.getElementById("nombreEvento").value = evento.nombre;
    document.getElementById("fechaEvento").value = evento.fecha || "";
    horaInicio.value = evento.inicio || "";
    horaFin.value = evento.fin || "";
    todoElDia.checked = evento.todoElDia === true;
    actualizarHoras();
    document.getElementById("colorEvento").value = evento.color || "#6366f1";
    document.getElementById("botonEliminar").style.display = "block";
    modal.classList.remove("oculto");
}

function guardarEvento() {
    normalizarHora(horaInicio);
    normalizarHora(horaFin);

    const nombre = document.getElementById("nombreEvento").value.trim();
    const fecha = document.getElementById("fechaEvento").value;
    const inicio = horaInicio.value;
    const fin = horaFin.value;
    const color = document.getElementById("colorEvento").value;
    const esTodoElDia = todoElDia.checked;

    if (!nombre || !fecha) {
        alert("Completa el nombre y la fecha.");
        return;
    }

    if (!esTodoElDia && (!inicio || !fin)) {
        alert("Introduce las horas o marca 'Todo el día'.");
        return;
    }

    if (!esTodoElDia && inicio >= fin) {
        alert("La hora de finalización debe ser posterior.");
        return;
    }

    if (eventoEditando) {
        eventoEditando.nombre = nombre;
        eventoEditando.fecha = fecha;
        eventoEditando.inicio = esTodoElDia ? "" : inicio;
        eventoEditando.fin = esTodoElDia ? "" : fin;
        eventoEditando.color = color;
        eventoEditando.todoElDia = esTodoElDia;
    } else {
        horarios.push({
            id: Date.now(),
            nombre: nombre,
            fecha: fecha,
            inicio: esTodoElDia ? "" : inicio,
            fin: esTodoElDia ? "" : fin,
            color: color,
            todoElDia: esTodoElDia,
            completado: false
        });
    }

    guardarDatos();
    cerrarModal();
    mostrarCalendario();
}

function eliminarEvento() {
    if (!eventoEditando) return;
    const id = eventoEditando.id;
    horarios = horarios.filter(evento => evento.id !== id);
    guardarDatos();
    cerrarModal();
    mostrarCalendario();
}

document.getElementById("btnAnadirEvento").onclick = abrirModal;
document.getElementById("cancelarEvento").onclick = cerrarModal;
document.getElementById("guardarEvento").onclick = guardarEvento;
document.getElementById("botonEliminar").onclick = eliminarEvento;

document.getElementById("vistaSemana").onclick = function () {
    vistaActual = "semana";
    document.getElementById("vistaSemana").classList.add("active");
    document.getElementById("vistaMes").classList.remove("active");
    mostrarCalendario();
};

document.getElementById("vistaMes").onclick = function () {
    vistaActual = "mes";
    document.getElementById("vistaMes").classList.add("active");
    document.getElementById("vistaSemana").classList.remove("active");
    mostrarCalendario();
};

/* =========================
   NAVEGACIÓN COORDINADA (SEMANA / MES)
   ========================= */

document.getElementById("mesAnterior").onclick = function () {
    if (vistaActual === "semana") {
        fechaActual.setDate(fechaActual.getDate() - 7);
    } else {
        fechaActual.setMonth(fechaActual.getMonth() - 1);
    }
    mostrarCalendario();
};

document.getElementById("mesSiguiente").onclick = function () {
    if (vistaActual === "semana") {
        fechaActual.setDate(fechaActual.getDate() + 7);
    } else {
        fechaActual.setMonth(fechaActual.getMonth() + 1);
    }
    mostrarCalendario();
};

/* =========================================================
   PESTAÑA "NOTAS": se crea copiando la de "Lista"
   ========================================================= */

let listaTemario = null;
let listaNotas = null;

function mostrarTemario() {
    if (listaTemario) listaTemario.mostrar();
}

function mostrarNotas() {
    if (listaNotas) listaNotas.mostrar();
}

(function crearPestanaNotas() {
    const botonLista = document.getElementById("seccionTemarioBtn");
    const panelLista = document.getElementById("seccionTemario");

    if (!botonLista || !panelLista || document.getElementById("seccionNotas")) return;

    // Quita cualquier campo suelto "Nueva asignatura" que hubiera ya en la página
    document.querySelectorAll('input[placeholder^="Nueva asignatura"]').forEach(function (campo) {
        const padre = campo.parentElement;
        campo.remove();
        if (padre && padre.children.length === 0 && padre !== document.body && padre !== panelLista) {
            padre.remove();
        }
    });

    // Botón de la pestaña
    const botonNotas = botonLista.cloneNode(true);
    botonNotas.id = "seccionNotasBtn";
    botonNotas.textContent = "Notas";
    botonNotas.classList.remove("active");
    botonLista.after(botonNotas);

    // Panel de la pestaña (copia del de Lista, con otros ids)
    const panelNotas = panelLista.cloneNode(true);

    const botonAnadirViejo = panelNotas.querySelector("#btnAnadirAsignaturaTemario");
    if (botonAnadirViejo) botonAnadirViejo.remove();

    const cambiosDeId = {};
    panelNotas.querySelectorAll("[id]").forEach(function (el) {
        const idViejo = el.id;
        let idNuevo;

        if (idViejo === "temario") {
            idNuevo = "notas";
        } else if (idViejo.includes("Temario")) {
            idNuevo = idViejo.replace("Temario", "Notas");
        } else {
            idNuevo = idViejo + "Notas";
        }

        cambiosDeId[idViejo] = idNuevo;
        el.id = idNuevo;
    });

    panelNotas.querySelectorAll("label[for]").forEach(function (label) {
        const nuevo = cambiosDeId[label.getAttribute("for")];
        if (nuevo) label.setAttribute("for", nuevo);
    });

    panelNotas.id = "seccionNotas";

    const contenedorNotas = panelNotas.querySelector("#notas");
    if (contenedorNotas) contenedorNotas.innerHTML = "";

    panelLista.after(panelNotas);
})();

/* =========================================================
   CAMBIAR SECCIÓN + PANTALLA DIVIDIDA
   ========================================================= */

const SECCIONES = {
    calendario: { boton: "seccionCalendarioBtn", panel: "seccionCalendario", mostrar: mostrarCalendario },
    tablero:    { boton: "seccionTableroBtn",    panel: "seccionTablero",    mostrar: mostrarTablero },
    temario:    { boton: "seccionTemarioBtn",    panel: "seccionTemario",    mostrar: mostrarTemario },
    notas:      { boton: "seccionNotasBtn",      panel: "seccionNotas",      mostrar: mostrarNotas }
};

const ORDEN_SECCIONES = Object.keys(SECCIONES);
const MAX_SECCIONES_DIVIDIDAS = 2;

let pantallaDividida = false;
let seccionesVisibles = ["calendario"];

function leerLocal(clave, porDefecto) {
    try {
        const valor = localStorage.getItem(clave);
        return valor ? JSON.parse(valor) : porDefecto;
    } catch (error) {
        return porDefecto;
    }
}

function escribirLocal(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor));
    } catch (error) {
        /* sin almacenamiento local: no pasa nada */
    }
}

function cargarVistaGuardada() {
    const guardada = leerLocal("vistaSecciones", null);
    if (!guardada || !guardada.dividida || !Array.isArray(guardada.visibles)) return;

    const validas = guardada.visibles
        .filter(id => SECCIONES[id])
        .slice(0, MAX_SECCIONES_DIVIDIDAS);

    if (validas.length < 2) return;

    pantallaDividida = true;
    seccionesVisibles = validas;
}

cargarVistaGuardada();

function aplicarSecciones() {
    ORDEN_SECCIONES.forEach(function (id) {
        const visible = seccionesVisibles.includes(id);
        document.getElementById(SECCIONES[id].panel).classList.toggle("seccion-oculta", !visible);
        document.getElementById(SECCIONES[id].boton).classList.toggle("active", visible);
    });

    document.body.classList.toggle("dividida", pantallaDividida && seccionesVisibles.length > 1);
    document.getElementById("btnDividir").classList.toggle("active", pantallaDividida);
    document.getElementById("avisoDividir").hidden = !pantallaDividida;

    // Los botones Semana / Mes solo se ven si el calendario está en pantalla
    const botonSemana = document.getElementById("vistaSemana");
    const contenedorVistas = document.querySelector(".vistas") || (botonSemana && botonSemana.parentElement);
    if (contenedorVistas) {
        if (seccionesVisibles.includes("calendario")) {
            contenedorVistas.style.removeProperty("display");
        } else {
            contenedorVistas.style.setProperty("display", "none", "important");
        }
    }

    seccionesVisibles.forEach(id => SECCIONES[id].mostrar());

    escribirLocal("vistaSecciones", {
        dividida: pantallaDividida,
        visibles: seccionesVisibles
    });
}

function pulsarSeccion(id) {
    if (!pantallaDividida) {
        seccionesVisibles = [id];
    } else if (seccionesVisibles.includes(id)) {
        // En pantalla dividida, pulsar una pestaña visible la quita (siempre queda al menos una)
        if (seccionesVisibles.length > 1) {
            seccionesVisibles = seccionesVisibles.filter(x => x !== id);
        }
    } else {
        seccionesVisibles.push(id);
        if (seccionesVisibles.length > MAX_SECCIONES_DIVIDIDAS) {
            seccionesVisibles.shift();
        }
    }

    aplicarSecciones();
}

ORDEN_SECCIONES.forEach(function (id) {
    document.getElementById(SECCIONES[id].boton).onclick = function () {
        pulsarSeccion(id);
    };
});

document.getElementById("btnDividir").onclick = function () {
    pantallaDividida = !pantallaDividida;

    if (pantallaDividida) {
        if (seccionesVisibles.length < 2) {
            const otra = ORDEN_SECCIONES.find(id => !seccionesVisibles.includes(id));
            seccionesVisibles.unshift(otra);
        }
    } else {
        // Al salir de la división nos quedamos con la última pestaña pulsada
        seccionesVisibles = [seccionesVisibles[seccionesVisibles.length - 1]];
    }

    aplicarSecciones();
};

/* =========================================================
   TABLERO DE ASIGNATURAS
   ========================================================= */

let asignaturas = [];
let tableroCargado = false;
let asignaturaEditando = null;
let asignaturaArrastrada = null;

const columnasTablero = [
    { id: "espera", titulo: "En espera" },
    { id: "empezado", titulo: "Empezado" },
    { id: "repasar", titulo: "Solo repasar" },
    { id: "terminado", titulo: "Terminado" }
];

const modalAsignatura = document.getElementById("modalAsignatura");
const nombreAsignaturaInput = document.getElementById("nombreAsignatura");
const descripcionAsignaturaInput = document.getElementById("descripcionAsignatura");
const progresoAsignaturaInput = document.getElementById("progresoAsignatura");
const valorProgresoAsignatura = document.getElementById("valorProgresoAsignatura");

/* =========================
   GUARDAR Y ESCUCHAR TABLERO (FIREBASE)
   ========================= */

function guardarTablero() {
    if (!tableroCargado) {
        console.warn("Guardado cancelado: el tablero todavía no se ha cargado.");
        return;
    }
    set(asignaturasRef, asignaturas).catch(function (error) {
        console.error("Error al guardar el tablero en Firebase:", error);
    });
}

function escucharTablero() {
    onValue(asignaturasRef, function (snapshot) {
        const datos = snapshot.val();
        tableroCargado = true;

        if (!datos) {
            asignaturas = [];
        } else if (Array.isArray(datos)) {
            asignaturas = datos;
        } else {
            asignaturas = Object.values(datos);
        }

        mostrarTablero();
    }, function (error) {
        console.error("Error al leer el tablero de Firebase:", error);
    });
}

/* =========================
   MOSTRAR TABLERO
   ========================= */

function mostrarTablero() {
    const contenedorTablero = document.getElementById("tablero");
    contenedorTablero.innerHTML = "";

    columnasTablero.forEach(function (columna) {
        const columnaElemento = document.createElement("div");
        columnaElemento.className = "columna-tablero";

        const cabecera = document.createElement("div");
        cabecera.className = "cabecera-columna";
        cabecera.textContent = columna.titulo;
        columnaElemento.appendChild(cabecera);

        const listaTarjetas = document.createElement("div");
        listaTarjetas.className = "lista-tarjetas";

        const asignaturasColumna = asignaturas
            .filter(a => a.columna === columna.id)
            .sort((a, b) => a.orden - b.orden);

        asignaturasColumna.forEach(function (asignatura) {
            listaTarjetas.appendChild(crearTarjetaAsignatura(asignatura));
        });

        listaTarjetas.addEventListener("dragover", function (e) {
            e.preventDefault();
            listaTarjetas.classList.add("columna-destino");
        });

        listaTarjetas.addEventListener("dragleave", function () {
            listaTarjetas.classList.remove("columna-destino");
        });

        listaTarjetas.addEventListener("drop", function (e) {
            e.preventDefault();
            listaTarjetas.classList.remove("columna-destino");
            soltarAsignaturaAlFinal(columna.id);
        });

        columnaElemento.appendChild(listaTarjetas);
        contenedorTablero.appendChild(columnaElemento);
    });
}

/* =========================
   CREAR TARJETA
   ========================= */

function crearTarjetaAsignatura(asignatura) {
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-asignatura";
    tarjeta.draggable = true;

    const contenido = document.createElement("div");
    contenido.className = "tarjeta-contenido";

    const nombre = document.createElement("strong");
    nombre.textContent = asignatura.nombre;
    contenido.appendChild(nombre);

    if (asignatura.descripcion) {
        const descripcion = document.createElement("p");
        descripcion.className = "tarjeta-descripcion";
        descripcion.textContent = asignatura.descripcion;
        contenido.appendChild(descripcion);
    }

    tarjeta.appendChild(contenido);

    if (asignatura.columna === "empezado") {
        const barra = document.createElement("div");
        barra.className = "barra-progreso-vertical";

        const relleno = document.createElement("div");
        relleno.className = "relleno-progreso";
        relleno.style.height = (asignatura.progreso || 0) + "%";
        barra.appendChild(relleno);

        const porcentaje = document.createElement("span");
        porcentaje.className = "porcentaje-progreso";
        porcentaje.textContent = (asignatura.progreso || 0) + "%";

        tarjeta.appendChild(barra);
        tarjeta.appendChild(porcentaje);
    }

    let arrastreEnCurso = false;

    tarjeta.addEventListener("click", function () {
        if (arrastreEnCurso) return;
        editarAsignatura(asignatura);
    });

    tarjeta.addEventListener("dragstart", function (e) {
        asignaturaArrastrada = asignatura.id;
        arrastreEnCurso = true;
        tarjeta.classList.add("arrastrando-tarjeta");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(asignatura.id));
    });

    tarjeta.addEventListener("dragend", function () {
        tarjeta.classList.remove("arrastrando-tarjeta");
        setTimeout(function () {
            arrastreEnCurso = false;
        }, 50);
        asignaturaArrastrada = null;
    });

    tarjeta.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (asignaturaArrastrada === null || asignaturaArrastrada === asignatura.id) {
            return;
        }

        const rect = tarjeta.getBoundingClientRect();
        const mitad = rect.top + rect.height / 2;
        const antes = e.clientY < mitad;

        moverAsignaturaJuntoA(asignaturaArrastrada, asignatura.id, antes);
    });

    tarjeta.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
    });

    return tarjeta;
}

/* =========================
   MOVER / REORDENAR TARJETAS
   ========================= */

function moverAsignaturaJuntoA(idArrastrada, idReferencia, antes) {
    if (idArrastrada === idReferencia) return;

    const indiceArrastrada = asignaturas.findIndex(a => a.id === idArrastrada);
    const indiceReferencia = asignaturas.findIndex(a => a.id === idReferencia);

    if (indiceArrastrada === -1 || indiceReferencia === -1) return;

    const posicionDeseada = antes ? indiceReferencia : indiceReferencia + 1;

    if (posicionDeseada === indiceArrastrada || posicionDeseada === indiceArrastrada + 1) {
        return;
    }

    const arrastrada = asignaturas[indiceArrastrada];
    const referencia = asignaturas[indiceReferencia];

    asignaturas.splice(indiceArrastrada, 1);

    const nuevoIndiceReferencia = asignaturas.findIndex(a => a.id === idReferencia);
    const indiceInsercion = antes ? nuevoIndiceReferencia : nuevoIndiceReferencia + 1;

    arrastrada.columna = referencia.columna;

    asignaturas.splice(indiceInsercion, 0, arrastrada);

    reindexarOrdenTablero();
    mostrarTablero();
}

function soltarAsignaturaAlFinal(columnaId) {
    if (!asignaturaArrastrada) return;

    const arrastrada = asignaturas.find(a => a.id === asignaturaArrastrada);
    if (!arrastrada) return;

    asignaturas = asignaturas.filter(a => a.id !== asignaturaArrastrada);
    arrastrada.columna = columnaId;
    asignaturas.push(arrastrada);

    reindexarOrdenTablero();
    mostrarTablero();
}

function reindexarOrdenTablero() {
    columnasTablero.forEach(function (columna) {
        let contador = 0;
        asignaturas
            .filter(a => a.columna === columna.id)
            .forEach(function (a) {
                a.orden = contador;
                contador++;
            });
    });

    guardarTablero();
}

/* =========================
   MODAL ASIGNATURA
   ========================= */

progresoAsignaturaInput.addEventListener("input", function () {
    valorProgresoAsignatura.textContent = progresoAsignaturaInput.value + "%";
});

function abrirModalAsignatura() {
    asignaturaEditando = null;
    document.getElementById("tituloModalAsignatura").textContent = "Añadir asignatura";
    nombreAsignaturaInput.value = "";
    descripcionAsignaturaInput.value = "";
    progresoAsignaturaInput.value = 0;
    valorProgresoAsignatura.textContent = "0%";
    document.getElementById("botonEliminarAsignatura").style.display = "none";
    modalAsignatura.classList.remove("oculto");
}

function editarAsignatura(asignatura) {
    asignaturaEditando = asignatura;
    document.getElementById("tituloModalAsignatura").textContent = "Editar asignatura";
    nombreAsignaturaInput.value = asignatura.nombre;
    descripcionAsignaturaInput.value = asignatura.descripcion || "";
    progresoAsignaturaInput.value = asignatura.progreso || 0;
    valorProgresoAsignatura.textContent = (asignatura.progreso || 0) + "%";
    document.getElementById("botonEliminarAsignatura").style.display = "block";
    modalAsignatura.classList.remove("oculto");
}

function cerrarModalAsignatura() {
    modalAsignatura.classList.add("oculto");
    asignaturaEditando = null;
}

function guardarAsignatura() {
    const nombre = nombreAsignaturaInput.value.trim();
    const descripcion = descripcionAsignaturaInput.value.trim();
    const progreso = Number(progresoAsignaturaInput.value);

    if (!nombre) {
        alert("Ponle un nombre a la asignatura.");
        return;
    }

    if (asignaturaEditando) {
        asignaturaEditando.nombre = nombre;
        asignaturaEditando.descripcion = descripcion;
        asignaturaEditando.progreso = progreso;
    } else {
        const enEspera = asignaturas.filter(a => a.columna === "espera");

        asignaturas.push({
            id: Date.now() + Math.floor(Math.random() * 10000),
            nombre: nombre,
            descripcion: descripcion,
            columna: "espera",
            progreso: progreso,
            orden: enEspera.length
        });
    }

    guardarTablero();
    cerrarModalAsignatura();
    mostrarTablero();
}

function eliminarAsignatura() {
    if (!asignaturaEditando) return;

    const confirmar = confirm(`¿Quieres eliminar "${asignaturaEditando.nombre}"?`);
    if (!confirmar) return;

    asignaturas = asignaturas.filter(a => a.id !== asignaturaEditando.id);

    reindexarOrdenTablero();
    cerrarModalAsignatura();
    mostrarTablero();
}

document.getElementById("btnAnadirAsignatura").onclick = abrirModalAsignatura;
document.getElementById("cancelarAsignatura").onclick = cerrarModalAsignatura;
document.getElementById("guardarAsignatura").onclick = guardarAsignatura;
document.getElementById("botonEliminarAsignatura").onclick = eliminarAsignatura;

/* =========================================================
   LISTAS CON TEMAS Y ESTADO (pestañas "Lista" y "Notas")
   ========================================================= */

const ESTADOS_TEMA = [
    { id: "porver", titulo: "Por ver" },
    { id: "leido", titulo: "Leído" },
    { id: "repasar", titulo: "Repasar/practicar solo" },
    { id: "terminado", titulo: "Terminado" }
];

let contadorIdLista = 0;

function nuevoIdLista() {
    contadorIdLista++;
    return Date.now() * 1000 + (contadorIdLista % 1000);
}

function limpiarLineaTema(texto) {
    // Quita viñetas o numeración al pegar listas ("- tema", "1. tema", "2) tema")
    return texto.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, "").trim();
}

function normalizarLista(datos) {
    const lista = !datos ? [] : (Array.isArray(datos) ? datos : Object.values(datos));

    return lista.filter(Boolean).map(function (asignatura) {
        // Firebase no guarda arrays vacíos: si no hay temas, "temas" llega sin definir
        const temasBrutos = asignatura.temas
            ? (Array.isArray(asignatura.temas) ? asignatura.temas : Object.values(asignatura.temas))
            : [];

        return {
            ...asignatura,
            temas: temasBrutos.filter(Boolean)
        };
    });
}

/* Si el HTML no trae el modal (o le faltan piezas), se crea aquí */
function asegurarModalLista(m) {
    const ids = Object.values(m);
    if (ids.every(id => document.getElementById(id))) return;

    const viejo = document.getElementById(m.modal);
    if (viejo) viejo.remove();

    const modalNuevo = document.createElement("div");
    modalNuevo.id = m.modal;
    modalNuevo.className = "modal oculto";
    modalNuevo.innerHTML = `
        <div class="modal-contenido">
            <h2 id="${m.titulo}">Añadir asignatura</h2>
            <label for="${m.nombre}">Nombre</label>
            <input type="text" id="${m.nombre}" maxlength="80" placeholder="Nombre de la asignatura">
            <div class="acciones-modal">
                <button id="${m.eliminar}" style="display:none">Eliminar</button>
                <button id="${m.cancelar}">Cancelar</button>
                <button id="${m.guardar}" class="guardar">Guardar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalNuevo);
}

function conectarEdicionTexto(input, alGuardar) {
    const original = input.value;

    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            input.blur();
        } else if (e.key === "Escape") {
            input.value = original;
            input.blur();
        }
    });

    input.addEventListener("change", function () {
        const nuevo = input.value.trim();

        if (!nuevo || nuevo === original) {
            input.value = original;
            return;
        }

        alGuardar(nuevo);
    });
}

/* Crea una lista completa (datos en Firebase, tarjetas, modal y barra de arriba) */
function crearLista(config) {
    const listaRef = ref(db, config.nodo);
    const m = config.modal;

    asegurarModalLista(m);

    const seccion = document.getElementById(config.panelId);
    const contenedor = document.getElementById(config.contenedorId);
    const modalLista = document.getElementById(m.modal);
    const nombreInput = document.getElementById(m.nombre);

    let datos = [];
    let cargado = false;
    let renderPendiente = false;
    let editandoId = null;
    let arrastrando = false;

    let cerradas = leerLocal(config.claveCerradas, []);
    if (!Array.isArray(cerradas)) cerradas = [];

    /* ---------- Firebase ---------- */

    function guardar() {
        // Nunca se guarda hasta haber leído antes lo que hay en Firebase
        if (!cargado) {
            console.warn("Guardado cancelado: " + config.nodo + " todavía no se ha cargado.");
            return;
        }

        set(listaRef, datos).catch(function (error) {
            console.error("Error al guardar " + config.nodo + " en Firebase:", error);
        });
    }

    function guardarYMostrar() {
        guardar();
        mostrar();
    }

    function hayEdicionEnCurso() {
        const activo = document.activeElement;
        return !!(activo && activo.tagName === "INPUT" && seccion.contains(activo));
    }

    function escuchar() {
        onValue(listaRef, function (snapshot) {
            datos = normalizarLista(snapshot.val());
            cargado = true;

            // Si estás escribiendo o arrastrando, no se redibuja hasta que termines
            if (arrastrando || hayEdicionEnCurso()) {
                renderPendiente = true;
                return;
            }

            mostrar();
        }, function (error) {
            console.error("Error al leer " + config.nodo + " de Firebase:", error);
            contenedor.innerHTML = "";
            const aviso = document.createElement("p");
            aviso.className = "lista-vacia";
            aviso.textContent = "No se pudo leer (" + (error && error.code ? error.code : "error") + "). Revisa las reglas de Firebase.";
            contenedor.appendChild(aviso);
        });
    }

    seccion.addEventListener("focusout", function () {
        if (!renderPendiente) return;

        setTimeout(function () {
            if (renderPendiente && !hayEdicionEnCurso()) {
                mostrar();
            }
        }, 0);
    });

    /* ---------- Modal añadir / editar asignatura ---------- */

    function buscarAsignatura(id) {
        return datos.find(a => String(a.id) === String(id));
    }

    function abrirModal() {
        editandoId = null;
        document.getElementById(m.titulo).textContent = "Añadir asignatura";
        nombreInput.value = "";
        document.getElementById(m.eliminar).style.display = "none";
        modalLista.classList.remove("oculto");
        setTimeout(() => nombreInput.focus(), 0);
    }

    function editarAsignatura(idAsignatura) {
        const asignatura = buscarAsignatura(idAsignatura);
        if (!asignatura) return;

        editandoId = asignatura.id;
        document.getElementById(m.titulo).textContent = "Editar asignatura";
        nombreInput.value = asignatura.nombre;
        document.getElementById(m.eliminar).style.display = "block";
        modalLista.classList.remove("oculto");
        setTimeout(() => nombreInput.focus(), 0);
    }

    function cerrarModal() {
        modalLista.classList.add("oculto");
        editandoId = null;
    }

    function confirmarModal() {
        const nombre = nombreInput.value.trim();

        if (!nombre) {
            alert("Ponle un nombre a la asignatura.");
            return;
        }

        if (editandoId !== null) {
            const asignatura = buscarAsignatura(editandoId);
            if (asignatura) asignatura.nombre = nombre;
        } else {
            datos.push({
                id: nuevoIdLista(),
                nombre: nombre,
                temas: []
            });
        }

        guardarYMostrar();
        cerrarModal();
    }

    function eliminarAsignatura(idAsignatura) {
        const asignatura = buscarAsignatura(idAsignatura);
        if (!asignatura) return false;

        const confirmar = confirm(`¿Quieres eliminar "${asignatura.nombre}" y todos sus temas?`);
        if (!confirmar) return false;

        datos = datos.filter(a => String(a.id) !== String(idAsignatura));
        guardarYMostrar();
        return true;
    }

    /* ---------- Acciones sobre temas ---------- */

    function alternarAsignatura(idAsignatura) {
        const id = String(idAsignatura);

        if (cerradas.includes(id)) {
            cerradas = cerradas.filter(x => x !== id);
        } else {
            cerradas.push(id);
        }

        escribirLocal(config.claveCerradas, cerradas);
        mostrar();
    }

    function anadirTemas(idAsignatura, textos) {
        const asignatura = buscarAsignatura(idAsignatura);
        if (!asignatura) return;

        const nombres = textos.map(limpiarLineaTema).filter(Boolean);
        if (nombres.length === 0) return;

        if (!asignatura.temas) asignatura.temas = [];

        nombres.forEach(function (nombre) {
            asignatura.temas.push({
                id: nuevoIdLista(),
                nombre: nombre,
                estado: "porver"
            });
        });

        // Si estaba plegada, la desplegamos para ver lo añadido
        cerradas = cerradas.filter(x => x !== String(idAsignatura));
        escribirLocal(config.claveCerradas, cerradas);

        guardarYMostrar();

        const campo = contenedor.querySelector(`[data-add-tema="${idAsignatura}"]`);
        if (campo) campo.focus();
    }

    function buscarTema(idAsignatura, idTema) {
        const asignatura = buscarAsignatura(idAsignatura);
        if (!asignatura || !asignatura.temas) return null;
        return asignatura.temas.find(t => String(t.id) === String(idTema)) || null;
    }

    function renombrarTema(idAsignatura, idTema, nombre) {
        const tema = buscarTema(idAsignatura, idTema);
        if (!tema) return;

        tema.nombre = nombre;
        guardar();
    }

    function cambiarEstadoTema(idAsignatura, idTema, estado) {
        if (!ESTADOS_TEMA.some(e => e.id === estado)) return;

        const tema = buscarTema(idAsignatura, idTema);
        if (!tema) return;

        tema.estado = estado;
        guardarYMostrar();
    }

    function eliminarTema(idAsignatura, idTema) {
        const asignatura = buscarAsignatura(idAsignatura);
        if (!asignatura || !asignatura.temas) return;

        asignatura.temas = asignatura.temas.filter(t => String(t.id) !== String(idTema));
        guardarYMostrar();
    }

    /* ---------- Ordenar asignaturas arrastrando el asa ---------- */

    function conectarAsa(asa, tarjeta) {
        let ultimaY = 0;
        let temporizadorScroll = null;

        function tarjetasActuales() {
            return Array.from(contenedor.children).filter(el => el.classList.contains("lista-asignatura"));
        }

        function colocarTarjeta(y) {
            const otras = tarjetasActuales().filter(t => t !== tarjeta);

            for (const t of otras) {
                const caja = t.getBoundingClientRect();
                if (y < caja.top + caja.height / 2) {
                    if (tarjeta.nextElementSibling !== t) contenedor.insertBefore(tarjeta, t);
                    return;
                }
            }

            if (otras.length > 0 && tarjeta !== contenedor.lastElementChild) {
                contenedor.appendChild(tarjeta);
            }
        }

        function terminar(cancelado) {
            clearInterval(temporizadorScroll);
            temporizadorScroll = null;
            document.body.style.userSelect = "";
            tarjeta.classList.remove("arrastrando-lista");

            if (!cancelado) {
                const orden = tarjetasActuales().map(t => t.dataset.id);
                const actual = datos.map(a => String(a.id));

                if (orden.join("|") !== actual.join("|")) {
                    const porId = new Map(datos.map(a => [String(a.id), a]));
                    const nuevos = orden.map(id => porId.get(id)).filter(Boolean);

                    // Por si llegó alguna asignatura nueva mientras se arrastraba
                    datos.forEach(function (a) {
                        if (!nuevos.includes(a)) nuevos.push(a);
                    });

                    datos = nuevos;
                    guardar();
                }
            }

            arrastrando = false;
            mostrar();
        }

        asa.addEventListener("click", function (e) {
            e.stopPropagation();
        });

        asa.addEventListener("pointerdown", function (e) {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            if (arrastrando) return;

            e.preventDefault();
            e.stopPropagation();

            const idPuntero = e.pointerId;

            arrastrando = true;
            ultimaY = e.clientY;
            tarjeta.classList.add("arrastrando-lista");
            document.body.style.userSelect = "none";

            // Se escucha en todo el documento: al reordenar, la tarjeta se mueve en el DOM
            // y el navegador deja de enviar los eventos al asa.
            function alMover(ev) {
                if (ev.pointerId !== idPuntero) return;
                ultimaY = ev.clientY;
                colocarTarjeta(ev.clientY);
            }

            function quitarEscuchas() {
                document.removeEventListener("pointermove", alMover);
                document.removeEventListener("pointerup", alSoltar);
                document.removeEventListener("pointercancel", alCancelar);
            }

            function alSoltar(ev) {
                if (ev.pointerId !== idPuntero) return;
                quitarEscuchas();
                terminar(false);
            }

            function alCancelar(ev) {
                if (ev.pointerId !== idPuntero) return;
                quitarEscuchas();
                terminar(true);
            }

            document.addEventListener("pointermove", alMover);
            document.addEventListener("pointerup", alSoltar);
            document.addEventListener("pointercancel", alCancelar);

            // Desplazamiento automático al acercarse al borde de la pantalla
            temporizadorScroll = setInterval(function () {
                const margen = 70;
                if (ultimaY < margen) {
                    window.scrollBy(0, -14);
                    colocarTarjeta(ultimaY);
                } else if (ultimaY > window.innerHeight - margen) {
                    window.scrollBy(0, 14);
                    colocarTarjeta(ultimaY);
                }
            }, 16);
        });
    }

    /* ---------- Dibujar ---------- */

    function crearFilaTema(idAsignatura, tema) {
        const estado = ESTADOS_TEMA.some(e => e.id === tema.estado) ? tema.estado : "porver";

        const fila = document.createElement("div");
        fila.className = "tema-fila";
        fila.dataset.estado = estado;

        const nombre = document.createElement("input");
        nombre.type = "text";
        nombre.className = "tema-nombre-input";
        nombre.value = tema.nombre;
        nombre.maxLength = 120;
        conectarEdicionTexto(nombre, function (nuevo) {
            renombrarTema(idAsignatura, tema.id, nuevo);
        });

        const selector = document.createElement("select");
        selector.className = "tema-estado";

        ESTADOS_TEMA.forEach(function (e) {
            const opcion = document.createElement("option");
            opcion.value = e.id;
            opcion.textContent = e.titulo;
            opcion.selected = e.id === estado;
            selector.appendChild(opcion);
        });

        selector.addEventListener("change", function () {
            cambiarEstadoTema(idAsignatura, tema.id, selector.value);
        });

        const borrar = document.createElement("button");
        borrar.className = "tema-borrar";
        borrar.textContent = "✕";
        borrar.title = "Eliminar tema";
        borrar.addEventListener("click", function () {
            eliminarTema(idAsignatura, tema.id);
        });

        fila.appendChild(nombre);
        fila.appendChild(selector);
        fila.appendChild(borrar);

        return fila;
    }

    function crearTarjeta(asignatura) {
        const temas = asignatura.temas || [];
        const total = temas.length;
        const terminados = temas.filter(t => t.estado === "terminado").length;
        const porcentaje = total ? Math.round((terminados / total) * 100) : 0;
        const cerrada = cerradas.includes(String(asignatura.id));

        const tarjeta = document.createElement("div");
        tarjeta.className = "columna-tablero lista-asignatura";
        tarjeta.dataset.id = asignatura.id;

        /* --- Cabecera (clic = plegar/desplegar) --- */
        const cabecera = document.createElement("div");
        cabecera.className = "cabecera-columna lista-cabecera";
        cabecera.title = cerrada ? "Desplegar" : "Plegar";

        const asa = document.createElement("span");
        asa.className = "lista-asa";
        asa.textContent = "⋮⋮";
        asa.title = "Arrastra para ordenar";
        conectarAsa(asa, tarjeta);

        const flecha = document.createElement("span");
        flecha.className = "lista-flecha";
        flecha.textContent = cerrada ? "▸" : "▾";

        const titulo = document.createElement("span");
        titulo.className = "lista-titulo";
        titulo.textContent = asignatura.nombre;

        const resumen = document.createElement("span");
        resumen.className = "lista-resumen";
        resumen.textContent = total ? `${terminados}/${total}` : "Sin temas";
        resumen.title = "Temas terminados";

        const editar = document.createElement("button");
        editar.className = "lista-editar";
        editar.textContent = "✎";
        editar.title = "Editar asignatura";
        editar.addEventListener("click", function (e) {
            e.stopPropagation();
            editarAsignatura(asignatura.id);
        });

        cabecera.addEventListener("click", function () {
            alternarAsignatura(asignatura.id);
        });

        cabecera.appendChild(asa);
        cabecera.appendChild(flecha);
        cabecera.appendChild(titulo);
        cabecera.appendChild(resumen);
        cabecera.appendChild(editar);
        tarjeta.appendChild(cabecera);

        /* --- Barra de progreso (temas terminados) --- */
        const barra = document.createElement("div");
        barra.className = "lista-barra";

        const relleno = document.createElement("div");
        relleno.className = "lista-barra-relleno";
        relleno.style.width = porcentaje + "%";
        barra.appendChild(relleno);
        tarjeta.appendChild(barra);

        if (cerrada) return tarjeta;

        /* --- Cuerpo: temas + añadir --- */
        const cuerpo = document.createElement("div");
        cuerpo.className = "lista-cuerpo";

        if (total === 0) {
            const vacio = document.createElement("p");
            vacio.className = "lista-sin-temas";
            vacio.textContent = "Aún no hay temas.";
            cuerpo.appendChild(vacio);
        } else {
            const lista = document.createElement("div");
            lista.className = "lista-temas";
            temas.forEach(t => lista.appendChild(crearFilaTema(asignatura.id, t)));
            cuerpo.appendChild(lista);
        }

        const filaNuevo = document.createElement("div");
        filaNuevo.className = "lista-nuevo-tema";

        const campoNuevo = document.createElement("input");
        campoNuevo.type = "text";
        campoNuevo.placeholder = "Añadir tema (Enter). Puedes pegar una lista";
        campoNuevo.maxLength = 120;
        campoNuevo.dataset.addTema = asignatura.id;

        const botonNuevo = document.createElement("button");
        botonNuevo.className = "lista-btn-add";
        botonNuevo.textContent = "+";
        botonNuevo.title = "Añadir tema";

        function confirmarNuevoTema() {
            const texto = campoNuevo.value;
            campoNuevo.value = "";
            anadirTemas(asignatura.id, [texto]);
        }

        campoNuevo.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                confirmarNuevoTema();
            }
        });

        // Pegar varias líneas = añadir varios temas de golpe
        campoNuevo.addEventListener("paste", function (e) {
            const portapapeles = e.clipboardData || window.clipboardData;
            const texto = portapapeles ? portapapeles.getData("text") : "";

            if (texto && /[\r\n]/.test(texto.trim())) {
                e.preventDefault();
                anadirTemas(asignatura.id, texto.split(/\r?\n/));
            }
        });

        botonNuevo.addEventListener("click", confirmarNuevoTema);

        filaNuevo.appendChild(campoNuevo);
        filaNuevo.appendChild(botonNuevo);
        cuerpo.appendChild(filaNuevo);

        tarjeta.appendChild(cuerpo);

        return tarjeta;
    }

    function mostrar() {
        renderPendiente = false;
        contenedor.innerHTML = "";

        if (!cargado) {
            const cargando = document.createElement("p");
            cargando.className = "lista-vacia";
            cargando.textContent = "Cargando...";
            contenedor.appendChild(cargando);
            return;
        }

        if (datos.length === 0) {
            const vacio = document.createElement("p");
            vacio.className = "lista-vacia";
            vacio.textContent = "Todavía no hay asignaturas. Escribe una arriba para empezar.";
            contenedor.appendChild(vacio);
            return;
        }

        datos.forEach(function (asignatura) {
            contenedor.appendChild(crearTarjeta(asignatura));
        });
    }

    /* ---------- Barra de arriba: añadir asignatura rápido ---------- */

    const barraSuperior = document.createElement("div");
    barraSuperior.className = "lista-barra-superior";

    const campoNuevaAsignatura = document.createElement("input");
    campoNuevaAsignatura.type = "text";
    campoNuevaAsignatura.placeholder = "Nueva asignatura (Enter para añadir)";
    campoNuevaAsignatura.maxLength = 80;

    const botonNuevaAsignatura = document.createElement("button");
    botonNuevaAsignatura.className = "lista-btn-add";
    botonNuevaAsignatura.textContent = "+";
    botonNuevaAsignatura.title = "Añadir asignatura";

    function anadirAsignaturaRapida() {
        const nombre = campoNuevaAsignatura.value.trim();
        if (!nombre || !cargado) return;

        datos.push({
            id: nuevoIdLista(),
            nombre: nombre,
            temas: []
        });

        campoNuevaAsignatura.value = "";
        guardarYMostrar();
        campoNuevaAsignatura.focus();
    }

    campoNuevaAsignatura.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            anadirAsignaturaRapida();
        }
    });
    botonNuevaAsignatura.addEventListener("click", anadirAsignaturaRapida);

    barraSuperior.appendChild(campoNuevaAsignatura);
    barraSuperior.appendChild(botonNuevaAsignatura);
    contenedor.parentNode.insertBefore(barraSuperior, contenedor);

    /* ---------- Eventos del modal y arranque ---------- */

    document.getElementById(m.cancelar).onclick = cerrarModal;
    document.getElementById(m.guardar).onclick = confirmarModal;

    document.getElementById(m.eliminar).onclick = function () {
        if (editandoId === null) return;
        if (eliminarAsignatura(editandoId)) {
            cerrarModal();
        }
    };

    nombreInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            confirmarModal();
        }
    });

    escuchar();

    return { mostrar: mostrar };
}

listaTemario = crearLista({
    nodo: "temario",
    panelId: "seccionTemario",
    contenedorId: "temario",
    claveCerradas: "temarioCerradas",
    modal: {
        modal: "modalTemario",
        titulo: "tituloModalTemario",
        nombre: "nombreAsignaturaTemario",
        eliminar: "botonEliminarTemario",
        cancelar: "cancelarModalTemario",
        guardar: "guardarModalTemario"
    }
});

listaNotas = crearLista({
    nodo: "notas",
    panelId: "seccionNotas",
    contenedorId: "notas",
    claveCerradas: "notasCerradas",
    modal: {
        modal: "modalNotas",
        titulo: "tituloModalNotas",
        nombre: "nombreAsignaturaNotas",
        eliminar: "botonEliminarNotas",
        cancelar: "cancelarModalNotas",
        guardar: "guardarModalNotas"
    }
});

aplicarSecciones();

/* =========================
   INICIO
   ========================= */

escucharDatos();
escucharTablero();
