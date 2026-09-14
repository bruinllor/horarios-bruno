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

        // APLICAR COLOR DEL BORDE SI HAY EVENTO TODO EL DÍA
        const eventoTodoElDia = eventosDia.find(evento => evento.todoElDia);
        if (eventoTodoElDia) {
            elemento.classList.add("dia-con-evento-todo-dia");
            elemento.style.setProperty("--color-borde-dia", eventoTodoElDia.color);
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
