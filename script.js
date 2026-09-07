/* =========================
   ELIMINAR EVENTO
   ========================= */

function eliminarEvento() {

    if (!eventoEditando) {
        return;
    }

    const origen =
        eventoEditando.horarioOrigen;

    const evento =
        horarios[origen].find(
            e =>
                e.id ===
                eventoEditando.id
        );

    if (!evento) {
        return;
    }

    const modalConfirmacion =
        document.getElementById(
            "modalConfirmacion"
        );

    const textoConfirmacion =
        document.getElementById(
            "textoConfirmacion"
        );

    if (!modalConfirmacion) {
        console.error(
            "No existe #modalConfirmacion en el HTML"
        );
        return;
    }

    if (textoConfirmacion) {
        textoConfirmacion.textContent =
            `¿Quieres eliminar "${evento.nombre}"?`;
    }

    modalConfirmacion.classList.remove(
        "oculto"
    );
}
