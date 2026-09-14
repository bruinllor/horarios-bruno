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

let vistaActual = "semana";
let fechaActual = new Date();
let eventoEditando = null;

let eventoArrastrado = null;
let eventoPendiente = null;
let arrastreRealizado = false;

let horarios = [];

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
    set(horariosRef, horarios).catch(function (error) {
        console.error("Error al guardar en Firebase:", error);
    });
}

function escucharDatos() {
    onValue(horariosRef, function (snapshot) {
        const datos = snapshot.val();

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
   VISTA SEMANAL DINÁMICA
   ========================= */

const ALTURA_HORA_PX = 90; // Aumentado a 90px por hora para dar más altura a las tarjetas

function mostrarSemana() {
    calendario.innerHTML = "";
    tituloCalendario.textContent = "Horario semanal";

    const contenedor = document.createElement("div");
    contenedor.className = "calendario-semana";

    const hoy = new Date();
    const diaActual = hoy.getDay();
    let lunes = new Date(hoy);

    if (diaActual === 0) {
        lunes.setDate(hoy.getDate() - 6);
    } else {
        lunes.setDate(hoy.getDate() - (diaActual - 1));
    }

    // Calcular las fechas de la semana actual
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

    // Filtrar eventos de la semana que NO son de "todo el día"
    const eventosSemanaConHora = horarios.filter(evento => {
        return fechasSemana.some(f => f.fechaTexto === evento.fecha) && !evento.todoElDia && evento.inicio;
    });

    // Rango base predeterminado: 6:00 a 18:00
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

    for (let h = horaInicioRango; h <= horaFinRango; h++) {
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

        // Cabecera del día
        const cabecera = document.createElement("div");
        cabecera.className = "cabecera-dia-semana";

        const nombre = document.createElement("div");
        nombre.className = "nombre-dia";
        nombre.textContent = `${nombresDias[fInfo.fechaObjeto.getDay()]} ${fInfo.fechaObjeto.getDate()}/${fInfo.fechaObjeto.getMonth() + 1}`;
        cabecera.appendChild(nombre);

        // Sección "Todo el día" (arriba)
        const areaTodoElDia = document.createElement("div");
        areaTodoElDia.className = "area-todo-el-dia";

        // Rejilla de horas
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
                
                // Desplazamiento desde el inicio del rango ajustado
                const minutosDesdeInicioRango = minutosInicio - (horaInicioRango * 60);
                const duracionMinutos = minutosFin - minutosInicio;

                const topPx = (minutosDesdeInicioRango / 60) * ALTURA_HORA_PX;
                const heightPx = Math.max((duracionMinutos / 60) * ALTURA_HORA_PX, 35); // Mínimo 35px para legibilidad

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

document.getElementById("mesAnterior").onclick = function () {
    fechaActual.setMonth(fechaActual.getMonth() - 1);
    mostrarCalendario();
};

document.getElementById("mesSiguiente").onclick = function () {
    fechaActual.setMonth(fechaActual.getMonth() + 1);
    mostrarCalendario();
};

escucharDatos();
