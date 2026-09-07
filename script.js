let horarioActual = "A";
let vistaActual = "semana";
let fechaActual = new Date();
let eventoEditando = null;

let horarios = {
    A: [],
    B: []
};

const calendario = document.getElementById("calendario");
const tituloCalendario = document.getElementById("tituloCalendario");
const modal = document.getElementById("modal");

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

function guardarDatos() {
    localStorage.setItem("horarios", JSON.stringify(horarios));
}

function cargarDatos() {
    const datos = localStorage.getItem("horarios");

    if (datos) {
        try {
            horarios = JSON.parse(datos);

            if (!horarios.A) horarios.A = [];
            if (!horarios.B) horarios.B = [];

        } catch (error) {
            console.error("Error al cargar los horarios:", error);

            horarios = {
                A: [],
                B: []
            };
        }
    }
}

/* Obtener los eventos que se deben mostrar */
function obtenerEventos() {

    if (horarioActual === "AMBOS") {

        return [
            ...horarios.A.map(evento => ({
                ...evento,
                horarioOrigen: "A"
            })),

            ...horarios.B.map(evento => ({
                ...evento,
                horarioOrigen: "B"
            }))
        ];

    }

    return horarios[horarioActual];
}

function mostrarCalendario() {

    if (vistaActual === "semana") {
        mostrarSemana();
    } else {
        mostrarMes();
    }
}

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

        const fechaTexto =
            fechaDia.toISOString().split("T")[0];

        const nombre = document.createElement("div");
        nombre.className = "nombre-dia";

        nombre.textContent =
            `${nombresDias[fechaDia.getDay()]} ${fechaDia.getDate()}/${fechaDia.getMonth() + 1}`;

        const eventos = document.createElement("div");
        eventos.className = "eventos";

        const eventosDia =
            obtenerEventos()
                .filter(evento => evento.fecha === fechaTexto);

        eventosDia.sort((a, b) => {

            if (a.todoElDia && !b.todoElDia) return -1;
            if (!a.todoElDia && b.todoElDia) return 1;

            return (a.inicio || "").localeCompare(b.inicio || "");
        });

        eventosDia.forEach(evento => {

            const elemento = document.createElement("div");

            elemento.className = "evento";
            elemento.style.background = evento.color;

            const creador =
                evento.horarioOrigen === "A"
                    ? "Bruno"
                    : "Mauro";

            const horario =
                evento.todoElDia
                    ? "Todo el día"
                    : `${evento.inicio} - ${evento.fin}`;

            elemento.innerHTML = `
                <strong>${evento.nombre}</strong>

                ${
                    horarioActual === "AMBOS"
                        ? `<small>${creador}</small>`
                        : ""
                }

                <span>${horario}</span>
            `;

            elemento.onclick = () =>
                editarEvento(evento);

            eventos.appendChild(elemento);
        });

        columna.appendChild(nombre);
        columna.appendChild(eventos);

        contenedor.appendChild(columna);
    }

    calendario.appendChild(contenedor);
}

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

    diasSemana.forEach(dia => {

        const elemento = document.createElement("div");

        elemento.className = "cabecera-mes";
        elemento.textContent = dia;

        contenedor.appendChild(elemento);
    });

    let primerDia =
        new Date(año, mes, 1).getDay();

    if (primerDia === 0) {
        primerDia = 7;
    }

    const diasMes =
        new Date(año, mes + 1, 0).getDate();

    for (let i = 1; i < primerDia; i++) {

        const vacio =
            document.createElement("div");

        vacio.className = "dia-mes";

        contenedor.appendChild(vacio);
    }

    for (let dia = 1; dia <= diasMes; dia++) {

        const elemento =
            document.createElement("div");

        elemento.className = "dia-mes";

        const numero =
            document.createElement("div");

        numero.className = "numero-dia";
        numero.textContent = dia;

        elemento.appendChild(numero);

        const mesTexto =
            String(mes + 1).padStart(2, "0");

        const diaTexto =
            String(dia).padStart(2, "0");

        const fechaTexto =
            `${año}-${mesTexto}-${diaTexto}`;

        const eventosDia =
            obtenerEventos()
                .filter(evento =>
                    evento.fecha === fechaTexto
                );

        eventosDia.sort((a, b) => {

            if (a.todoElDia && !b.todoElDia) return -1;
            if (!a.todoElDia && b.todoElDia) return 1;

            return (a.inicio || "").localeCompare(b.inicio || "");
        });

        eventosDia.forEach(evento => {

            const eventoElemento =
                document.createElement("div");

            eventoElemento.className =
                "evento-mes";

            eventoElemento.style.background =
                evento.color;

            const creador =
                evento.horarioOrigen === "A"
                    ? "Bruno"
                    : "Mauro";

            const horario =
                evento.todoElDia
                    ? "Todo el día"
                    : evento.inicio;

            eventoElemento.textContent =
                horarioActual === "AMBOS"
                    ? `${horario} ${evento.nombre} (${creador})`
                    : `${horario} ${evento.nombre}`;

            eventoElemento.onclick = () =>
                editarEvento(evento);

            elemento.appendChild(eventoElemento);
        });

        contenedor.appendChild(elemento);
    }

    calendario.appendChild(contenedor);
}

function actualizarHoras() {

    const todoElDia =
        document.getElementById("todoElDia");

    const horaInicio =
        document.getElementById("horaInicio");

    const horaFin =
        document.getElementById("horaFin");

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

function abrirModal() {

    if (horarioActual === "AMBOS") {

        alert(
            "Selecciona Bruno o Mauro para añadir un evento."
        );

        return;
    }

    eventoEditando = null;

    document.getElementById("tituloModal").textContent =
        "Añadir evento";

    document.getElementById("nombreEvento").value = "";

    document.getElementById("fechaEvento").value = "";

    document.getElementById("horaInicio").value = "";

    document.getElementById("horaFin").value = "";

    document.getElementById("todoElDia").checked = false;

    document.getElementById("colorEvento").value =
        "#6366f1";

    document.getElementById("botonEliminar").style.display =
        "none";

    actualizarHoras();

    modal.classList.remove("oculto");
}

function cerrarModal() {

    modal.classList.add("oculto");

    eventoEditando = null;
}

function editarEvento(evento) {

    eventoEditando = {
        id: evento.id,
        horarioOrigen: evento.horarioOrigen || horarioActual
    };

    document.getElementById("tituloModal").textContent =
        "Editar evento";

    document.getElementById("nombreEvento").value =
        evento.nombre;

    document.getElementById("fechaEvento").value =
        evento.fecha || "";

    document.getElementById("horaInicio").value =
        evento.inicio || "";

    document.getElementById("horaFin").value =
        evento.fin || "";

    document.getElementById("todoElDia").checked =
        evento.todoElDia === true;

    document.getElementById("colorEvento").value =
        evento.color;

    document.getElementById("botonEliminar").style.display =
        "block";

    actualizarHoras();

    modal.classList.remove("oculto");
}

function guardarEvento() {

    const nombre =
        document.getElementById("nombreEvento")
            .value.trim();

    const fecha =
        document.getElementById("fechaEvento")
            .value;

    const todoElDia =
        document.getElementById("todoElDia")
            .checked;

    const inicio =
        document.getElementById("horaInicio")
            .value;

    const fin =
        document.getElementById("horaFin")
            .value;

    const color =
        document.getElementById("colorEvento")
            .value;

    if (!nombre || !fecha) {

        alert("Completa todos los campos.");

        return;
    }

    if (!todoElDia && (!inicio || !fin)) {

        alert("Completa las horas.");

        return;
    }

    if (!todoElDia && inicio >= fin) {

        alert(
            "La hora de finalización debe ser posterior."
        );

        return;
    }

    if (eventoEditando) {

        const origen =
            eventoEditando.horarioOrigen;

        const eventos =
            horarios[origen];

        const evento =
            eventos.find(e =>
                e.id === eventoEditando.id
            );

        if (evento) {

            evento.nombre = nombre;
            evento.fecha = fecha;
            evento.inicio = todoElDia ? "" : inicio;
            evento.fin = todoElDia ? "" : fin;
            evento.todoElDia = todoElDia;
            evento.color = color;
        }

    } else {

        horarios[horarioActual].push({

            id: Date.now(),

            nombre: nombre,

            fecha: fecha,

            inicio: todoElDia ? "" : inicio,

            fin: todoElDia ? "" : fin,

            todoElDia: todoElDia,

            color: color
        });
    }

    guardarDatos();

    cerrarModal();

    mostrarCalendario();
}

function eliminarEvento() {

    if (!eventoEditando) {
        return;
    }

    const confirmar =
        confirm(
            `¿Quieres eliminar el evento?`
        );

    if (!confirmar) {
        return;
    }

    const origen =
        eventoEditando.horarioOrigen;

    const eventos =
        horarios[origen];

    horarios[origen] =
        eventos.filter(evento =>
            evento.id !== eventoEditando.id
        );

    guardarDatos();

    cerrarModal();

    mostrarCalendario();
}

/* Selector de horarios */

document.getElementById("horarioA").onclick = () => {

    horarioActual = "A";

    mostrarCalendario();
};

document.getElementById("horarioB").onclick = () => {

    horarioActual = "B";

    mostrarCalendario();
};

document.getElementById("horarioAmbos").onclick = () => {

    horarioActual = "AMBOS";

    mostrarCalendario();
};

/* Vistas */

document.getElementById("vistaSemana").onclick = () => {

    vistaActual = "semana";

    document.getElementById("vistaSemana")
        .classList.add("active");

    document.getElementById("vistaMes")
        .classList.remove("active");

    mostrarCalendario();
};

document.getElementById("vistaMes").onclick = () => {

    vistaActual = "mes";

    document.getElementById("vistaMes")
        .classList.add("active");

    document.getElementById("vistaSemana")
        .classList.remove("active");

    mostrarCalendario();
};

/* Modal */

document.getElementById("btnAnadirEvento").onclick =
    abrirModal;

document.getElementById("cancelarEvento").onclick =
    cerrarModal;

document.getElementById("guardarEvento").onclick =
    guardarEvento;

document.getElementById("botonEliminar").onclick =
    eliminarEvento;

document.getElementById("todoElDia").onchange =
    actualizarHoras;

/* Navegación del mes */

document.getElementById("mesAnterior").onclick = () => {

    fechaActual.setMonth(
        fechaActual.getMonth() - 1
    );

    mostrarCalendario();
};

document.getElementById("mesSiguiente").onclick = () => {

    fechaActual.setMonth(
        fechaActual.getMonth() + 1
    );

    mostrarCalendario();
};

cargarDatos();
mostrarCalendario();
