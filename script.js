let horarioActual = "A";
let vistaActual = "semana";
let fechaActual = new Date();
let eventoEditando = null;

let eventoArrastrado = null;
let eventoPendiente = null;
let arrastreRealizado = false;

let horarios = {
    A: [],
    B: []
};

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
        return;
    }

    try {

        horarios = JSON.parse(datos);

        if (!horarios.A) {
            horarios.A = [];
        }

        if (!horarios.B) {
            horarios.B = [];
        }

    } catch (error) {

        console.error(
            "Error al cargar los horarios:",
            error
        );

        horarios = {
            A: [],
            B: []
        };
    }
}


/* =========================
   OBTENER EVENTOS
   ========================= */

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

    return horarios[horarioActual] || [];
}


/* =========================
   ARRASTRAR EVENTOS
   ========================= */

function iniciarArrastre(e, evento, elemento) {

    const origen =
        evento.horarioOrigen || horarioActual;

    if (origen === "AMBOS") {
        return;
    }

    eventoArrastrado = {
        id: evento.id,
        origen: origen
    };

    arrastreRealizado = true;

    elemento.classList.add("arrastrando");

    e.dataTransfer.effectAllowed = "copyMove";

    e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
            id: evento.id,
            origen: origen
        })
    );
}

function terminarArrastre(elemento) {

    elemento.classList.remove(
        "arrastrando"
    );

    setTimeout(() => {
        arrastreRealizado = false;
    }, 100);
}

function permitirSoltar(e) {

    e.preventDefault();

    e.currentTarget.classList.add(
        "dia-destino"
    );

    e.dataTransfer.dropEffect = "move";
}

function salirZonaSoltar(e) {

    e.currentTarget.classList.remove(
        "dia-destino"
    );
}

function soltarEvento(e, nuevaFecha) {

    e.preventDefault();

    e.currentTarget.classList.remove(
        "dia-destino"
    );

    if (!eventoArrastrado) {
        return;
    }

    const id =
        eventoArrastrado.id;

    const origen =
        eventoArrastrado.origen;

    const listaOrigen =
        horarios[origen];

    if (!listaOrigen) {

        eventoArrastrado = null;

        return;
    }

    const eventoOriginal =
        listaOrigen.find(
            evento => evento.id === id
        );

    if (!eventoOriginal) {

        eventoArrastrado = null;

        return;
    }

    /* Si se suelta en el mismo día */

    if (
        eventoOriginal.fecha === nuevaFecha
    ) {

        eventoArrastrado = null;

        mostrarCalendario();

        return;
    }

    eventoPendiente = {

        evento: eventoOriginal,

        origen: origen,

        nuevaFecha: nuevaFecha

    };

    eventoArrastrado = null;

    const modalArrastre =
        document.getElementById(
            "modalArrastre"
        );

    if (modalArrastre) {

        modalArrastre.classList.remove(
            "oculto"
        );

    } else {

        console.error(
            "No existe #modalArrastre en el HTML"
        );
    }
}


/* =========================
   MOVER EVENTO
   ========================= */

function moverEventoArrastrado() {

    if (!eventoPendiente) {
        return;
    }

    const evento =
        eventoPendiente.evento;

    evento.fecha =
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

    const original =
        eventoPendiente.evento;

    const copia = {

        ...original,

        id:
            Date.now() +
            Math.floor(
                Math.random() * 10000
            ),

        fecha:
            eventoPendiente.nuevaFecha

    };

    horarios[
        eventoPendiente.origen
    ].push(copia);

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
        document.getElementById(
            "modalArrastre"
        );

    if (modalArrastre) {

        modalArrastre.classList.add(
            "oculto"
        );
    }
}


/* =========================
   BOTONES DEL MODAL ARRASTRE
   ========================= */

const botonMover =
    document.getElementById(
        "botonMover"
    );

const botonCopiar =
    document.getElementById(
        "botonCopiar"
    );

const botonCancelarArrastre =
    document.getElementById(
        "botonCancelarArrastre"
    );

if (botonMover) {

    botonMover.addEventListener(
        "click",
        moverEventoArrastrado
    );
}

if (botonCopiar) {

    botonCopiar.addEventListener(
        "click",
        copiarEventoArrastrado
    );
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
   VISTA SEMANAL
   ========================= */

function mostrarSemana() {

    calendario.innerHTML = "";

    tituloCalendario.textContent =
        "Horario semanal";

    const contenedor =
        document.createElement("div");

    contenedor.className =
        "calendario-semana";

    const hoy = new Date();

    const diaActual =
        hoy.getDay();

    let lunes =
        new Date(hoy);

    if (diaActual === 0) {

        lunes.setDate(
            hoy.getDate() - 6
        );

    } else {

        lunes.setDate(
            hoy.getDate() -
            (diaActual - 1)
        );
    }

    for (
        let dia = 1;
        dia <= 7;
        dia++
    ) {

        const columna =
            document.createElement("div");

        columna.className =
            "dia";

        const fechaDia =
            new Date(lunes);

        fechaDia.setDate(
            lunes.getDate() +
            dia - 1
        );

        const año =
            fechaDia.getFullYear();

        const mes =
            String(
                fechaDia.getMonth() + 1
            ).padStart(2, "0");

        const numero =
            String(
                fechaDia.getDate()
            ).padStart(2, "0");

        const fechaTexto =
            `${año}-${mes}-${numero}`;


        /* ZONA DE SOLTAR */

        columna.addEventListener(
            "dragover",
            permitirSoltar
        );

        columna.addEventListener(
            "dragleave",
            salirZonaSoltar
        );

        columna.addEventListener(
            "drop",
            function(e) {

                soltarEvento(
                    e,
                    fechaTexto
                );
            }
        );


        const nombre =
            document.createElement("div");

        nombre.className =
            "nombre-dia";

        nombre.textContent =
            `${nombresDias[fechaDia.getDay()]} ${fechaDia.getDate()}/${fechaDia.getMonth() + 1}`;


        const eventos =
            document.createElement("div");

        eventos.className =
            "eventos";


        const eventosDia =
            obtenerEventos()
                .filter(evento =>
                    evento.fecha === fechaTexto
                );


        eventosDia.sort(
            function(a, b) {

                if (
                    a.todoElDia &&
                    !b.todoElDia
                ) {
                    return -1;
                }

                if (
                    !a.todoElDia &&
                    b.todoElDia
                ) {
                    return 1;
                }

                return (
                    a.inicio || ""
                ).localeCompare(
                    b.inicio || ""
                );
            }
        );


        eventosDia.forEach(
            function(evento) {

                const elemento =
                    document.createElement("div");

                elemento.className =
                    "evento";

                elemento.style.background =
                    evento.color;

                elemento.draggable =
                    true;


                const creador =
                    evento.horarioOrigen === "A"
                        ? "Bruno"
                        : "Mauro";


                const horario =
                    evento.todoElDia
                        ? "Todo el día"
                        : `${evento.inicio} - ${evento.fin}`;


                elemento.innerHTML = `

                    <strong>
                        ${evento.nombre}
                    </strong>

                    ${
                        horarioActual === "AMBOS"
                            ? `<small>${creador}</small>`
                            : ""
                    }

                    <span>
                        ${horario}
                    </span>

                `;


                elemento.addEventListener(
                    "dragstart",
                    function(e) {

                        iniciarArrastre(
                            e,
                            evento,
                            elemento
                        );
                    }
                );


                elemento.addEventListener(
                    "dragend",
                    function() {

                        terminarArrastre(
                            elemento
                        );
                    }
                );


                elemento.addEventListener(
                    "click",
                    function() {

                        if (arrastreRealizado) {
                            return;
                        }

                        editarEvento(evento);
                    }
                );


                eventos.appendChild(
                    elemento
                );
            }
        );


        columna.appendChild(
            nombre
        );

        columna.appendChild(
            eventos
        );

        contenedor.appendChild(
            columna
        );
    }

    calendario.appendChild(
        contenedor
    );
}


/* =========================
   VISTA MENSUAL
   ========================= */

function mostrarMes() {

    calendario.innerHTML = "";

    const año =
        fechaActual.getFullYear();

    const mes =
        fechaActual.getMonth();

    tituloCalendario.textContent =
        `${nombresMeses[mes]} ${año}`;


    const contenedor =
        document.createElement("div");

    contenedor.className =
        "calendario-mes";


    const diasSemana = [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo"
    ];


    diasSemana.forEach(
        function(dia) {

            const elemento =
                document.createElement("div");

            elemento.className =
                "cabecera-mes";

            elemento.textContent =
                dia;

            contenedor.appendChild(
                elemento
            );
        }
    );


    let primerDia =
        new Date(
            año,
            mes,
            1
        ).getDay();


    if (primerDia === 0) {
        primerDia = 7;
    }


    const diasMes =
        new Date(
            año,
            mes + 1,
            0
        ).getDate();


    for (
        let i = 1;
        i < primerDia;
        i++
    ) {

        const vacio =
            document.createElement("div");

        vacio.className =
            "dia-mes";

        contenedor.appendChild(
            vacio
        );
    }


    for (
        let dia = 1;
        dia <= diasMes;
        dia++
    ) {

        const elemento =
            document.createElement("div");

        elemento.className =
            "dia-mes";


        const numero =
            document.createElement("div");

        numero.className =
            "numero-dia";

        numero.textContent =
            dia;

        elemento.appendChild(
            numero
        );


        const mesTexto =
            String(mes + 1)
                .padStart(2, "0");

        const diaTexto =
            String(dia)
                .padStart(2, "0");


        const fechaTexto =
            `${año}-${mesTexto}-${diaTexto}`;


        /* ZONA DE SOLTAR */

        elemento.addEventListener(
            "dragover",
            permitirSoltar
        );

        elemento.addEventListener(
            "dragleave",
            salirZonaSoltar
        );

        elemento.addEventListener(
            "drop",
            function(e) {

                soltarEvento(
                    e,
                    fechaTexto
                );
            }
        );


        const eventosDia =
            obtenerEventos()
                .filter(evento =>
                    evento.fecha === fechaTexto
                );


        eventosDia.sort(
            function(a, b) {

                if (
                    a.todoElDia &&
                    !b.todoElDia
                ) {
                    return -1;
                }

                if (
                    !a.todoElDia &&
                    b.todoElDia
                ) {
                    return 1;
                }

                return (
                    a.inicio || ""
                ).localeCompare(
                    b.inicio || ""
                );
            }
        );


        eventosDia.forEach(
            function(evento) {

                const eventoElemento =
                    document.createElement("div");

                eventoElemento.className =
                    "evento-mes";

                eventoElemento.style.background =
                    evento.color;

                eventoElemento.draggable =
                    true;


                const creador =
                    evento.horarioOrigen === "A"
                        ? "Bruno"
                        : "Mauro";


                if (evento.todoElDia) {

                    eventoElemento.innerHTML = `

                        ${evento.nombre}

                        <small>

                            Todo el día

                            ${
                                horarioActual === "AMBOS"
                                    ? `(${creador})`
                                    : ""
                            }

                        </small>

                    `;

                } else {

                    eventoElemento.innerHTML = `

                        ${evento.inicio}
                        ${evento.nombre}

                        ${
                            horarioActual === "AMBOS"
                                ? `<small>(${creador})</small>`
                                : ""
                        }

                    `;
                }


                eventoElemento.addEventListener(
                    "dragstart",
                    function(e) {

                        iniciarArrastre(
                            e,
                            evento,
                            eventoElemento
                        );
                    }
                );


                eventoElemento.addEventListener(
                    "dragend",
                    function() {

                        terminarArrastre(
                            eventoElemento
                        );
                    }
                );


                eventoElemento.addEventListener(
                    "click",
                    function() {

                        if (arrastreRealizado) {
                            return;
                        }

                        editarEvento(evento);
                    }
                );


                elemento.appendChild(
                    eventoElemento
                );
            }
        );


        contenedor.appendChild(
            elemento
        );
    }


    calendario.appendChild(
        contenedor
    );
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

todoElDia.addEventListener(
    "change",
    actualizarHoras
);


/* =========================
   ABRIR MODAL
   ========================= */

function abrirModal() {

    if (horarioActual === "AMBOS") {

        alert(
            "Selecciona Bruno o Mauro para añadir un evento."
        );

        return;
    }

    eventoEditando = null;


    document.getElementById(
        "tituloModal"
    ).textContent =
        "Añadir evento";


    document.getElementById(
        "nombreEvento"
    ).value = "";


    document.getElementById(
        "fechaEvento"
    ).value = "";


    horaInicio.value = "";

    horaFin.value = "";

    todoElDia.checked = false;


    actualizarHoras();


    document.getElementById(
        "colorEvento"
    ).value =
        "#6366f1";


    document.getElementById(
        "botonEliminar"
    ).style.display =
        "none";


    modal.classList.remove(
        "oculto"
    );
}


/* =========================
   CERRAR MODAL
   ========================= */

function cerrarModal() {

    modal.classList.add(
        "oculto"
    );

    eventoEditando = null;
}


/* =========================
   EDITAR EVENTO
   ========================= */

function editarEvento(evento) {

    eventoEditando = {

        id: evento.id,

        horarioOrigen:
            evento.horarioOrigen ||
            horarioActual

    };


    document.getElementById(
        "tituloModal"
    ).textContent =
        "Editar evento";


    document.getElementById(
        "nombreEvento"
    ).value =
        evento.nombre;


    document.getElementById(
        "fechaEvento"
    ).value =
        evento.fecha || "";


    horaInicio.value =
        evento.inicio || "";


    horaFin.value =
        evento.fin || "";


    todoElDia.checked =
        evento.todoElDia === true;


    actualizarHoras();


    document.getElementById(
        "colorEvento"
    ).value =
        evento.color;


    document.getElementById(
        "botonEliminar"
    ).style.display =
        "block";


    modal.classList.remove(
        "oculto"
    );
}


/* =========================
   GUARDAR EVENTO
   ========================= */

function guardarEvento() {

    const nombre =
        document.getElementById(
            "nombreEvento"
        ).value.trim();


    const fecha =
        document.getElementById(
            "fechaEvento"
        ).value;


    const inicio =
        horaInicio.value;


    const fin =
        horaFin.value;


    const color =
        document.getElementById(
            "colorEvento"
        ).value;


    const esTodoElDia =
        todoElDia.checked;


    if (!nombre || !fecha) {

        alert(
            "Completa el nombre y la fecha."
        );

        return;
    }


    if (
        !esTodoElDia &&
        (!inicio || !fin)
    ) {

        alert(
            "Introduce las horas o marca 'Todo el día'."
        );

        return;
    }


    if (
        !esTodoElDia &&
        inicio >= fin
    ) {

        alert(
            "La hora de finalización debe ser posterior."
        );

        return;
    }


    if (eventoEditando) {

        const origen =
            eventoEditando.horarioOrigen;

        const evento =
            horarios[origen].find(
                e =>
                    e.id ===
                    eventoEditando.id
            );


        if (evento) {

            evento.nombre =
                nombre;

            evento.fecha =
                fecha;

            evento.inicio =
                esTodoElDia
                    ? ""
                    : inicio;

            evento.fin =
                esTodoElDia
                    ? ""
                    : fin;

            evento.color =
                color;

            evento.todoElDia =
                esTodoElDia;
        }

    } else {

        horarios[horarioActual].push({

            id: Date.now(),

            nombre: nombre,

            fecha: fecha,

            inicio:
                esTodoElDia
                    ? ""
                    : inicio,

            fin:
                esTodoElDia
                    ? ""
                    : fin,

            color: color,

            todoElDia:
                esTodoElDia
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


    const confirmar =
        confirm(
            `¿Quieres eliminar "${eventoEditando.id}"?`
        );


    if (!confirmar) {
        return;
    }


    const origen =
        eventoEditando.horarioOrigen;


    horarios[origen] =
        horarios[origen].filter(
            evento =>
                evento.id !==
                eventoEditando.id
        );


    guardarDatos();

    cerrarModal();

    mostrarCalendario();
}


/* =========================
   SELECTOR BRUNO / MAURO / AMBOS
   ========================= */

document.getElementById(
    "horarioA"
).onclick = function() {

    horarioActual = "A";

    document.getElementById(
        "horarioA"
    ).classList.add("active");

    document.getElementById(
        "horarioB"
    ).classList.remove("active");

    document.getElementById(
        "horarioAmbos"
    ).classList.remove("active");

    mostrarCalendario();
};


document.getElementById(
    "horarioB"
).onclick = function() {

    horarioActual = "B";

    document.getElementById(
        "horarioB"
    ).classList.add("active");

    document.getElementById(
        "horarioA"
    ).classList.remove("active");

    document.getElementById(
        "horarioAmbos"
    ).classList.remove("active");

    mostrarCalendario();
};


document.getElementById(
    "horarioAmbos"
).onclick = function() {

    horarioActual = "AMBOS";

    document.getElementById(
        "horarioAmbos"
    ).classList.add("active");

    document.getElementById(
        "horarioA"
    ).classList.remove("active");

    document.getElementById(
        "horarioB"
    ).classList.remove("active");

    mostrarCalendario();
};


/* =========================
   VISTAS
   ========================= */

document.getElementById(
    "vistaSemana"
).onclick = function() {

    vistaActual = "semana";

    document.getElementById(
        "vistaSemana"
    ).classList.add("active");

    document.getElementById(
        "vistaMes"
    ).classList.remove("active");

    mostrarCalendario();
};


document.getElementById(
    "vistaMes"
).onclick = function() {

    vistaActual = "mes";

    document.getElementById(
        "vistaMes"
    ).classList.add("active");

    document.getElementById(
        "vistaSemana"
    ).classList.remove("active");

    mostrarCalendario();
};


/* =========================
   BOTONES MODAL
   ========================= */

document.getElementById(
    "btnAnadirEvento"
).onclick =
    abrirModal;


document.getElementById(
    "cancelarEvento"
).onclick =
    cerrarModal;


document.getElementById(
    "guardarEvento"
).onclick =
    guardarEvento;


document.getElementById(
    "botonEliminar"
).onclick =
    eliminarEvento;


/* =========================
   NAVEGACIÓN DEL MES
   ========================= */

document.getElementById(
    "mesAnterior"
).onclick = function() {

    fechaActual.setMonth(
        fechaActual.getMonth() - 1
    );

    mostrarCalendario();
};


document.getElementById(
    "mesSiguiente"
).onclick = function() {

    fechaActual.setMonth(
        fechaActual.getMonth() + 1
    );

    mostrarCalendario();
};


/* =========================
   INICIO
   ========================= */

cargarDatos();

mostrarCalendario();
