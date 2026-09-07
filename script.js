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
   GUARDAR Y CARGAR DATOS
   ========================= */

function guardarDatos() {

    localStorage.setItem(
        "horarios_copia",
        JSON.stringify(horarios)
    );
}


function cargarDatos() {

    const datos =
        localStorage.getItem("horarios_copia");

    if (!datos) {
        horarios = [];
        return;
    }

    try {

        const datosCargados =
            JSON.parse(datos);

        if (
            datosCargados &&
            !Array.isArray(datosCargados) &&
            datosCargados.A &&
            datosCargados.B
        ) {

            horarios = [
                ...datosCargados.A,
                ...datosCargados.B
            ];

        } else if (Array.isArray(datosCargados)) {

            horarios = datosCargados;

        } else {

            horarios = [];
        }

    } catch (error) {

        console.error(
            "Error al cargar los horarios:",
            error
        );

        horarios = [];
    }
}


/* =========================
   ARRASTRAR EVENTOS (RATÓN / HTML5)
   ========================= */

function iniciarArrastre(e, evento, elemento) {

    eventoArrastrado = {
        id: evento.id
    };

    arrastreRealizado = true;

    elemento.classList.add("arrastrando");

    e.dataTransfer.effectAllowed = "copyMove";

    e.dataTransfer.setData(
        "text/plain",
        String(evento.id)
    );
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

    if (!eventoArrastrado) {
        return;
    }

    const id = eventoArrastrado.id;

    eventoArrastrado = null;

    manejarSoltarEvento(id, nuevaFecha);
}


/* =========================
   ARRASTRAR EVENTOS (TÁCTIL / MÓVIL)
   ========================= */

const UMBRAL_MOVIMIENTO = 10;
const RETARDO_PULSACION = 300;

let toqueArrastre = null;


function iniciarToqueEvento(e, evento, elemento) {

    if (e.touches.length !== 1) {
        return;
    }

    const toque = e.touches[0];

    toqueArrastre = {
        evento: evento,
        elementoOriginal: elemento,
        startX: toque.clientX,
        startY: toque.clientY,
        dragging: false,
        moved: false,
        celdaActual: null,
        fantasma: null,
        timer: null
    };

    toqueArrastre.timer = setTimeout(() => {

        if (toqueArrastre && !toqueArrastre.moved) {

            iniciarArrastreTactil();
        }

    }, RETARDO_PULSACION);
}


function iniciarArrastreTactil() {

    if (!toqueArrastre) {
        return;
    }

    toqueArrastre.dragging = true;

    const original = toqueArrastre.elementoOriginal;

    original.classList.add("arrastrando");

    if (navigator.vibrate) {
        navigator.vibrate(15);
    }

    const fantasma = original.cloneNode(true);

    fantasma.classList.add("fantasma-arrastre");
    fantasma.classList.remove("arrastrando");

    const rect = original.getBoundingClientRect();

    fantasma.style.width = rect.width + "px";

    document.body.appendChild(fantasma);

    toqueArrastre.fantasma = fantasma;

    moverFantasma(
        toqueArrastre.startX,
        toqueArrastre.startY
    );
}


function moverFantasma(x, y) {

    if (!toqueArrastre || !toqueArrastre.fantasma) {
        return;
    }

    toqueArrastre.fantasma.style.left = x + "px";
    toqueArrastre.fantasma.style.top = y + "px";
}


function actualizarZonaDestinoTactil(x, y) {

    const elementoDebajo =
        document.elementFromPoint(x, y);

    const celda =
        elementoDebajo
            ? elementoDebajo.closest(".dia, .dia-mes")
            : null;

    document
        .querySelectorAll(".dia-destino")
        .forEach(el => el.classList.remove("dia-destino"));

    if (celda && celda.dataset.fecha) {

        celda.classList.add("dia-destino");
        toqueArrastre.celdaActual = celda;

    } else {

        toqueArrastre.celdaActual = null;
    }
}


function moverToqueEvento(e) {

    if (!toqueArrastre) {
        return;
    }

    const toque = e.touches[0];

    const dx = toque.clientX - toqueArrastre.startX;
    const dy = toque.clientY - toqueArrastre.startY;

    if (!toqueArrastre.dragging) {

        if (
            Math.abs(dx) > UMBRAL_MOVIMIENTO ||
            Math.abs(dy) > UMBRAL_MOVIMIENTO
        ) {

            toqueArrastre.moved = true;

            clearTimeout(toqueArrastre.timer);
        }

        return;
    }

    e.preventDefault();

    moverFantasma(toque.clientX, toque.clientY);

    actualizarZonaDestinoTactil(
        toque.clientX,
        toque.clientY
    );
}


function finalizarToqueEvento(e) {

    if (!toqueArrastre) {
        return;
    }

    clearTimeout(toqueArrastre.timer);

    const estabaArrastrando = toqueArrastre.dragging;
    const seMovio = toqueArrastre.moved;
    const evento = toqueArrastre.evento;
    const celda = toqueArrastre.celdaActual;
    const original = toqueArrastre.elementoOriginal;
    const fantasma = toqueArrastre.fantasma;

    if (fantasma) {
        fantasma.remove();
    }

    document
        .querySelectorAll(".dia-destino")
        .forEach(el => el.classList.remove("dia-destino"));

    if (estabaArrastrando) {

        terminarArrastre(original);

        if (celda && celda.dataset.fecha) {

            manejarSoltarEvento(
                evento.id,
                celda.dataset.fecha
            );
        }

    } else if (!seMovio) {

        e.preventDefault();

        editarEvento(evento);
    }

    toqueArrastre = null;
}


function cancelarToqueEvento() {

    if (!toqueArrastre) {
        return;
    }

    clearTimeout(toqueArrastre.timer);

    if (toqueArrastre.fantasma) {
        toqueArrastre.fantasma.remove();
    }

    if (toqueArrastre.dragging) {
        terminarArrastre(toqueArrastre.elementoOriginal);
    }

    document
        .querySelectorAll(".dia-destino")
        .forEach(el => el.classList.remove("dia-destino"));

    toqueArrastre = null;
}


/* =========================
   LÓGICA COMÚN DE SOLTAR
   ========================= */

function manejarSoltarEvento(idEvento, nuevaFecha) {

    const eventoOriginal =
        horarios.find(
            evento =>
                String(evento.id) === String(idEvento)
        );

    if (!eventoOriginal) {
        return;
    }

    if (eventoOriginal.fecha === nuevaFecha) {

        mostrarCalendario();

        return;
    }

    eventoPendiente = {
        evento: eventoOriginal,
        nuevaFecha: nuevaFecha
    };

    const modalArrastre =
        document.getElementById("modalArrastre");

    if (modalArrastre) {
        modalArrastre.classList.remove("oculto");
    }
}


/* =========================
   MOVER EVENTO
   ========================= */

function moverEventoArrastrado() {

    if (!eventoPendiente) {
        return;
    }

    eventoPendiente.evento.fecha =
        eventoPendiente.nuevaFecha;

    guardarDatos();

    cerrarModalArrastre();

    eventoPendiente = null;

    mostrarCalendario();
}


/* =========================
   COPIAR EVENTO
   ========================= */

function copiarEventoArrastrado() {

    if (!eventoPendiente) {
        return;
    }

    const original = eventoPendiente.evento;

    const copia = {

        ...original,

        id:
            Date.now() +
            Math.floor(Math.random() * 10000),

        fecha: eventoPendiente.nuevaFecha
    };

    horarios.push(copia);

    guardarDatos();

    cerrarModalArrastre();

    eventoPendiente = null;

    mostrarCalendario();
}


/* =========================
   CANCELAR ARRASTRE
   ========================= */

function cancelarEventoArrastrado() {

    cerrarModalArrastre();

    eventoPendiente = null;

    mostrarCalendario();
}


function cerrarModalArrastre() {

    const modalArrastre =
        document.getElementById("modalArrastre");

    if (modalArrastre) {
        modalArrastre.classList.add("oculto");
    }
}


/* =========================
   BOTONES ARRASTRE
   ========================= */

const botonMover = document.getElementById("botonMover");
const botonCopiar = document.getElementById("botonCopiar");
const botonCancelarArrastre =
    document.getElementById("botonCancelarArrastre");

if (botonMover) {
    botonMover.addEventListener("click", moverEventoArrastrado);
}

if (botonCopiar) {
    botonCopiar.addEventListener("click", copiarEventoArrastrado);
}

if (botonCancelarArrastre) {
    botonCancelarArrastre.addEventListener(
        "click",
        cancelarEventoArrastrado
    );
}


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

const esDispositivoTactil =
    ("ontouchstart" in window) ||
    (navigator.maxTouchPoints > 0);


function hacerArrastrable(elemento, evento) {

    if (!esDispositivoTactil) {

        /*
         * En Firefox para Android, un elemento con
         * draggable="true" activa el arrastre nativo
         * del navegador al tocarlo, que "roba" el toque
         * antes de que nuestro propio código táctil
         * pueda reaccionar. Por eso el arrastre HTML5
         * (ratón) solo se activa en dispositivos que
         * no son táctiles.
         */

        elemento.draggable = true;

        elemento.addEventListener("dragstart", function (e) {
            iniciarArrastre(e, evento, elemento);
        });

        elemento.addEventListener("dragend", function () {
            terminarArrastre(elemento);
        });

        elemento.addEventListener("click", function () {

            if (arrastreRealizado) {
                return;
            }

            editarEvento(evento);
        });

        return;
    }

    elemento.addEventListener(
        "touchstart",
        function (e) {
            iniciarToqueEvento(e, evento, elemento);
        },
        { passive: true }
    );

    elemento.addEventListener(
        "touchmove",
        moverToqueEvento,
        { passive: false }
    );

    elemento.addEventListener(
        "touchend",
        finalizarToqueEvento
    );

    elemento.addEventListener(
        "touchcancel",
        cancelarToqueEvento
    );
}


function hacerZonaDeSoltar(elemento, fechaTexto) {

    elemento.dataset.fecha = fechaTexto;

    elemento.addEventListener("dragover", permitirSoltar);

    elemento.addEventListener("dragleave", salirZonaSoltar);

    elemento.addEventListener("drop", function (e) {
        soltarEvento(e, fechaTexto);
    });
}


/* =========================
   VISTA SEMANAL
   ========================= */

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

    for (let dia = 1; dia <= 7; dia++) {

        const columna = document.createElement("div");

        columna.className = "dia";

        const fechaDia = new Date(lunes);

        fechaDia.setDate(lunes.getDate() + dia - 1);

        const año = fechaDia.getFullYear();

        const mes =
            String(fechaDia.getMonth() + 1).padStart(2, "0");

        const numero =
            String(fechaDia.getDate()).padStart(2, "0");

        const fechaTexto = `${año}-${mes}-${numero}`;

        hacerZonaDeSoltar(columna, fechaTexto);

        const nombre = document.createElement("div");

        nombre.className = "nombre-dia";

        nombre.textContent =
            `${nombresDias[fechaDia.getDay()]} ${fechaDia.getDate()}/${fechaDia.getMonth() + 1}`;

        const eventos = document.createElement("div");

        eventos.className = "eventos";

        const eventosDia =
            horarios.filter(
                evento => evento.fecha === fechaTexto
            );

        eventosDia.sort(function (a, b) {

            if (a.todoElDia && !b.todoElDia) {
                return -1;
            }

            if (!a.todoElDia && b.todoElDia) {
                return 1;
            }

            return (a.inicio || "").localeCompare(
                b.inicio || ""
            );
        });

        eventosDia.forEach(function (evento) {

            const elemento = document.createElement("div");

            elemento.className = "evento";

            elemento.style.background = evento.color;

            const horario =
                evento.todoElDia
                    ? "Todo el día"
                    : `${evento.inicio} - ${evento.fin}`;

            elemento.innerHTML = `
                <strong>${evento.nombre}</strong>
                <span>${horario}</span>
            `;

            hacerArrastrable(elemento, evento);

            eventos.appendChild(elemento);
        });

        columna.appendChild(nombre);
        columna.appendChild(eventos);

        contenedor.appendChild(columna);
    }

    calendario.appendChild(contenedor);
}


/* =========================
   VISTA MENSUAL
   ========================= */

function mostrarMes() {

    calendario.innerHTML = "";

    const año = fechaActual.getFullYear();
    const mes = fechaActual.getMonth();

    tituloCalendario.textContent =
        `${nombresMeses[mes]} ${año}`;

    const contenedor = document.createElement("div");

    contenedor.className = "calendario-mes";

    const diasSemana = [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo"
    ];

    diasSemana.forEach(function (dia) {

        const elemento = document.createElement("div");

        elemento.className = "cabecera-mes";

        elemento.textContent = dia;

        contenedor.appendChild(elemento);
    });

    let primerDia = new Date(año, mes, 1).getDay();

    if (primerDia === 0) {
        primerDia = 7;
    }

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

        const eventosDia =
            horarios.filter(
                evento => evento.fecha === fechaTexto
            );

        eventosDia.sort(function (a, b) {

            if (a.todoElDia && !b.todoElDia) {
                return -1;
            }

            if (!a.todoElDia && b.todoElDia) {
                return 1;
            }

            return (a.inicio || "").localeCompare(
                b.inicio || ""
            );
        });

        eventosDia.forEach(function (evento) {

            const eventoElemento =
                document.createElement("div");

            eventoElemento.className = "evento-mes";

            eventoElemento.style.background = evento.color;

            if (evento.todoElDia) {

                eventoElemento.innerHTML = `
                    ${evento.nombre}
                    <small>Todo el día</small>
                `;

            } else {

                eventoElemento.innerHTML = `
                    ${evento.inicio} ${evento.nombre}
                `;
            }

            hacerArrastrable(eventoElemento, evento);

            elemento.appendChild(eventoElemento);
        });

        contenedor.appendChild(elemento);
    }

    calendario.appendChild(contenedor);
}


/* =========================
   TODO EL DÍA
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


/* =========================
   ABRIR MODAL
   ========================= */

function abrirModal() {

    eventoEditando = null;

    document.getElementById("tituloModal").textContent =
        "Añadir evento";

    document.getElementById("nombreEvento").value = "";

    document.getElementById("fechaEvento").value = "";

    horaInicio.value = "";

    horaFin.value = "";

    todoElDia.checked = false;

    actualizarHoras();

    document.getElementById("colorEvento").value =
        "#6366f1";

    document.getElementById("botonEliminar").style.display =
        "none";

    modal.classList.remove("oculto");
}


/* =========================
   CERRAR MODAL
   ========================= */

function cerrarModal() {

    modal.classList.add("oculto");

    eventoEditando = null;
}


/* =========================
   EDITAR EVENTO
   ========================= */

function editarEvento(evento) {

    eventoEditando = evento;

    document.getElementById("tituloModal").textContent =
        "Editar evento";

    document.getElementById("nombreEvento").value =
        evento.nombre;

    document.getElementById("fechaEvento").value =
        evento.fecha || "";

    horaInicio.value = evento.inicio || "";

    horaFin.value = evento.fin || "";

    todoElDia.checked = evento.todoElDia === true;

    actualizarHoras();

    document.getElementById("colorEvento").value =
        evento.color || "#6366f1";

    document.getElementById("botonEliminar").style.display =
        "block";

    modal.classList.remove("oculto");
}


/* =========================
   GUARDAR EVENTO
   ========================= */

function guardarEvento() {

    const nombre =
        document.getElementById("nombreEvento")
            .value.trim();

    const fecha =
        document.getElementById("fechaEvento").value;

    const inicio = horaInicio.value;

    const fin = horaFin.value;

    const color =
        document.getElementById("colorEvento").value;

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
            todoElDia: esTodoElDia
        });
    }

    guardarDatos();

    cerrarModal();

    mostrarCalendario();
}


/* =========================
   ELIMINAR EVENTO
   ========================= */

function eliminarEvento() {

    if (!eventoEditando) {
        return;
    }

    const id = eventoEditando.id;

    horarios = horarios.filter(evento => evento.id !== id);

    guardarDatos();

    cerrarModal();

    mostrarCalendario();
}


/* =========================
   BOTONES DEL MODAL
   ========================= */

document.getElementById("btnAnadirEvento").onclick =
    abrirModal;

document.getElementById("cancelarEvento").onclick =
    cerrarModal;

document.getElementById("guardarEvento").onclick =
    guardarEvento;

document.getElementById("botonEliminar").onclick =
    eliminarEvento;


/* =========================
   VISTAS
   ========================= */

document.getElementById("vistaSemana").onclick = function () {

    vistaActual = "semana";

    document.getElementById("vistaSemana")
        .classList.add("active");

    document.getElementById("vistaMes")
        .classList.remove("active");

    mostrarCalendario();
};

document.getElementById("vistaMes").onclick = function () {

    vistaActual = "mes";

    document.getElementById("vistaMes")
        .classList.add("active");

    document.getElementById("vistaSemana")
        .classList.remove("active");

    mostrarCalendario();
};


/* =========================
   NAVEGACIÓN
   ========================= */

document.getElementById("mesAnterior").onclick = function () {

    fechaActual.setMonth(fechaActual.getMonth() - 1);

    mostrarCalendario();
};

document.getElementById("mesSiguiente").onclick = function () {

    fechaActual.setMonth(fechaActual.getMonth() + 1);

    mostrarCalendario();
};


/* =========================
   INICIO
   ========================= */

cargarDatos();

mostrarCalendario();
