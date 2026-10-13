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
   CAMBIAR SECCIÓN + PANTALLA DIVIDIDA
   ========================================================= */

const SECCIONES = {
    calendario: { boton: "seccionCalendarioBtn", panel: "seccionCalendario", mostrar: mostrarCalendario },
    tablero:    { boton: "seccionTableroBtn",    panel: "seccionTablero",    mostrar: mostrarTablero },
    temario:    { boton: "seccionTemarioBtn",    panel: "seccionTemario",    mostrar: mostrarTemario }
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
   LISTA: ASIGNATURAS CON LISTA DE TEMAS Y ESTADO
   ========================================================= */

const temarioRef = ref(db, "temario");

const ESTADOS_TEMA = [
    { id: "porver", titulo: "Por ver" },
    { id: "leido", titulo: "Leído" },
    { id: "repasar", titulo: "Repasar/practicar solo" },
    { id: "terminado", titulo: "Terminado" }
];

let temario = [];
let temarioCargado = false;
let renderTemarioPendiente = false;
let contadorIdTemario = 0;
let asignaturaTemarioEditandoId = null;

let temasCerrados = leerLocal("temarioCerradas", []);
if (!Array.isArray(temasCerrados)) temasCerrados = [];

const seccionTemario = document.getElementById("seccionTemario");
const contenedorTemario = document.getElementById("temario");
/* Si el HTML no trae el modal de la lista (o le faltan piezas), se crea aquí */
function asegurarModalTemario() {
    const ids = [
        "modalTemario", "tituloModalTemario", "nombreAsignaturaTemario",
        "botonEliminarTemario", "cancelarModalTemario", "guardarModalTemario"
    ];

    if (ids.every(id => document.getElementById(id))) return;

    const viejo = document.getElementById("modalTemario");
    if (viejo) viejo.remove();

    const modalNuevo = document.createElement("div");
    modalNuevo.id = "modalTemario";
    modalNuevo.className = "modal oculto";
    modalNuevo.innerHTML = `
        <div class="modal-contenido">
            <h2 id="tituloModalTemario">Añadir asignatura</h2>
            <label for="nombreAsignaturaTemario">Nombre</label>
            <input type="text" id="nombreAsignaturaTemario" maxlength="80" placeholder="Nombre de la asignatura">
            <div class="acciones-modal">
                <button id="botonEliminarTemario" style="display:none">Eliminar</button>
                <button id="cancelarModalTemario">Cancelar</button>
                <button id="guardarModalTemario" class="guardar">Guardar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalNuevo);
}

asegurarModalTemario();

const modalTemario = document.getElementById("modalTemario");
const nombreTemarioInput = document.getElementById("nombreAsignaturaTemario");

function nuevoIdTemario() {
    contadorIdTemario++;
    return Date.now() * 1000 + (contadorIdTemario % 1000);
}

/* =========================
   GUARDAR Y ESCUCHAR (FIREBASE)
   ========================= */

function normalizarTemario(datos) {
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

function guardarTemario() {
    if (!temarioCargado) {
        console.warn("Guardado cancelado: la lista todavía no se ha cargado.");
        return;
    }
    set(temarioRef, temario).catch(function (error) {
        console.error("Error al guardar la lista en Firebase:", error);
    });
}

function guardarYMostrarTemario() {
    guardarTemario();
    mostrarTemario();
}

function hayEdicionTemarioEnCurso() {
    const activo = document.activeElement;
    return !!(activo && activo.tagName === "INPUT" && seccionTemario.contains(activo));
}

function escucharTemario() {
    onValue(temarioRef, function (snapshot) {
        temario = normalizarTemario(snapshot.val());
        temarioCargado = true;

        // Si estás escribiendo, no se redibuja hasta que sueltes el campo
        if (hayEdicionTemarioEnCurso()) {
            renderTemarioPendiente = true;
            return;
        }

        mostrarTemario();
    }, function (error) {
        console.error("Error al leer la lista de Firebase:", error);
        contenedorTemario.innerHTML = "";
        const aviso = document.createElement("p");
        aviso.className = "lista-vacia";
        aviso.textContent = "No se pudo leer la lista (" + (error && error.code ? error.code : "error") + "). Revisa las reglas de Firebase.";
        contenedorTemario.appendChild(aviso);
    });
}

seccionTemario.addEventListener("focusout", function () {
    if (!renderTemarioPendiente) return;

    setTimeout(function () {
        if (renderTemarioPendiente && !hayEdicionTemarioEnCurso()) {
            mostrarTemario();
        }
    }, 0);
});

/* =========================
   MODAL AÑADIR / EDITAR ASIGNATURA (LISTA)
   ========================= */

function buscarAsignaturaTemario(id) {
    return temario.find(a => String(a.id) === String(id));
}

function abrirModalTemario() {
    asignaturaTemarioEditandoId = null;
    document.getElementById("tituloModalTemario").textContent = "Añadir asignatura";
    nombreTemarioInput.value = "";
    document.getElementById("botonEliminarTemario").style.display = "none";
    modalTemario.classList.remove("oculto");
    setTimeout(() => nombreTemarioInput.focus(), 0);
}

function editarAsignaturaTemario(idAsignatura) {
    const asignatura = buscarAsignaturaTemario(idAsignatura);
    if (!asignatura) return;

    asignaturaTemarioEditandoId = asignatura.id;
    document.getElementById("tituloModalTemario").textContent = "Editar asignatura";
    nombreTemarioInput.value = asignatura.nombre;
    document.getElementById("botonEliminarTemario").style.display = "block";
    modalTemario.classList.remove("oculto");
    setTimeout(() => nombreTemarioInput.focus(), 0);
}

function cerrarModalTemario() {
    modalTemario.classList.add("oculto");
    asignaturaTemarioEditandoId = null;
}

function confirmarModalTemario() {
    const nombre = nombreTemarioInput.value.trim();

    if (!nombre) {
        alert("Ponle un nombre a la asignatura.");
        return;
    }

    if (asignaturaTemarioEditandoId !== null) {
        const asignatura = buscarAsignaturaTemario(asignaturaTemarioEditandoId);
        if (asignatura) asignatura.nombre = nombre;
    } else {
        temario.push({
            id: nuevoIdTemario(),
            nombre: nombre,
            temas: []
        });
    }

    guardarYMostrarTemario();
    cerrarModalTemario();
}

function eliminarAsignaturaTemario(idAsignatura) {
    const asignatura = buscarAsignaturaTemario(idAsignatura);
    if (!asignatura) return false;

    const confirmar = confirm(`¿Quieres eliminar "${asignatura.nombre}" y todos sus temas?`);
    if (!confirmar) return false;

    temario = temario.filter(a => String(a.id) !== String(idAsignatura));
    guardarYMostrarTemario();
    return true;
}

/* =========================
   ACCIONES SOBRE TEMAS
   ========================= */

function alternarAsignaturaTemario(idAsignatura) {
    const id = String(idAsignatura);

    if (temasCerrados.includes(id)) {
        temasCerrados = temasCerrados.filter(x => x !== id);
    } else {
        temasCerrados.push(id);
    }

    escribirLocal("temarioCerradas", temasCerrados);
    mostrarTemario();
}

function limpiarLineaTema(texto) {
    // Quita viñetas o numeración al pegar listas ("- tema", "1. tema", "2) tema")
    return texto.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, "").trim();
}

function anadirTemas(idAsignatura, textos) {
    const asignatura = buscarAsignaturaTemario(idAsignatura);
    if (!asignatura) return;

    const nombres = textos.map(limpiarLineaTema).filter(Boolean);
    if (nombres.length === 0) return;

    if (!asignatura.temas) asignatura.temas = [];

    nombres.forEach(function (nombre) {
        asignatura.temas.push({
            id: nuevoIdTemario(),
            nombre: nombre,
            estado: "porver"
        });
    });

    // Si estaba plegada, la desplegamos para ver lo añadido
    temasCerrados = temasCerrados.filter(x => x !== String(idAsignatura));
    escribirLocal("temarioCerradas", temasCerrados);

    guardarYMostrarTemario();

    const campo = contenedorTemario.querySelector(`[data-add-tema="${idAsignatura}"]`);
    if (campo) campo.focus();
}

function buscarTema(idAsignatura, idTema) {
    const asignatura = buscarAsignaturaTemario(idAsignatura);
    if (!asignatura || !asignatura.temas) return null;
    return asignatura.temas.find(t => String(t.id) === String(idTema)) || null;
}

function renombrarTema(idAsignatura, idTema, nombre) {
    const tema = buscarTema(idAsignatura, idTema);
    if (!tema) return;

    tema.nombre = nombre;
    guardarTemario();
}

function cambiarEstadoTema(idAsignatura, idTema, estado) {
    if (!ESTADOS_TEMA.some(e => e.id === estado)) return;

    const tema = buscarTema(idAsignatura, idTema);
    if (!tema) return;

    tema.estado = estado;
    guardarYMostrarTemario();
}

function eliminarTema(idAsignatura, idTema) {
    const asignatura = buscarAsignaturaTemario(idAsignatura);
    if (!asignatura || !asignatura.temas) return;

    asignatura.temas = asignatura.temas.filter(t => String(t.id) !== String(idTema));
    guardarYMostrarTemario();
}

/* =========================
   MOSTRAR LISTA
   ========================= */

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

function crearTarjetaTemario(asignatura) {
    const temas = asignatura.temas || [];
    const total = temas.length;
    const terminados = temas.filter(t => t.estado === "terminado").length;
    const porcentaje = total ? Math.round((terminados / total) * 100) : 0;
    const cerrada = temasCerrados.includes(String(asignatura.id));

    const tarjeta = document.createElement("div");
    tarjeta.className = "columna-tablero lista-asignatura";

    /* --- Cabecera (clic = plegar/desplegar) --- */
    const cabecera = document.createElement("div");
    cabecera.className = "cabecera-columna lista-cabecera";
    cabecera.title = cerrada ? "Desplegar" : "Plegar";

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
        editarAsignaturaTemario(asignatura.id);
    });

    cabecera.addEventListener("click", function () {
        alternarAsignaturaTemario(asignatura.id);
    });

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

function mostrarTemario() {
    renderTemarioPendiente = false;
    contenedorTemario.innerHTML = "";

    if (!temarioCargado) {
        const cargando = document.createElement("p");
        cargando.className = "lista-vacia";
        cargando.textContent = "Cargando...";
        contenedorTemario.appendChild(cargando);
        return;
    }

    if (temario.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "lista-vacia";
        vacio.textContent = "Todavía no hay asignaturas. Escribe una arriba para empezar.";
        contenedorTemario.appendChild(vacio);
        return;
    }

    temario.forEach(function (asignatura) {
        contenedorTemario.appendChild(crearTarjetaTemario(asignatura));
    });
}

/* =========================
   BARRA SUPERIOR: AÑADIR ASIGNATURA RÁPIDO
   ========================= */

escucharTemario();

try {
const barraLista = document.createElement("div");
barraLista.className = "lista-barra-superior";

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
    if (!nombre || !temarioCargado) return;

    temario.push({
        id: nuevoIdTemario(),
        nombre: nombre,
        temas: []
    });

    campoNuevaAsignatura.value = "";
    guardarYMostrarTemario();
    campoNuevaAsignatura.focus();
}

campoNuevaAsignatura.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        anadirAsignaturaRapida();
    }
});
botonNuevaAsignatura.addEventListener("click", anadirAsignaturaRapida);

barraLista.appendChild(campoNuevaAsignatura);
barraLista.appendChild(botonNuevaAsignatura);
contenedorTemario.parentNode.insertBefore(barraLista, contenedorTemario);
} catch (error) {
    console.error("Error al crear la barra de la lista:", error);
}

/* =========================
   EVENTOS Y ARRANQUE DE LA LISTA
   ========================= */

const botonAnadirTemarioViejo = document.getElementById("btnAnadirAsignaturaTemario");
if (botonAnadirTemarioViejo) botonAnadirTemarioViejo.onclick = abrirModalTemario;
document.getElementById("cancelarModalTemario").onclick = cerrarModalTemario;
document.getElementById("guardarModalTemario").onclick = confirmarModalTemario;

document.getElementById("botonEliminarTemario").onclick = function () {
    if (asignaturaTemarioEditandoId === null) return;
    if (eliminarAsignaturaTemario(asignaturaTemarioEditandoId)) {
        cerrarModalTemario();
    }
};

nombreTemarioInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        e.preventDefault();
        confirmarModalTemario();
    }
});

aplicarSecciones();

/* =========================
   INICIO
   ========================= */

escucharDatos();
escucharTablero();
