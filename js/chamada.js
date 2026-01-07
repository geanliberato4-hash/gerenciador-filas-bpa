const chamadaBox = document.getElementById("chamada");
const nomeEl = document.getElementById("nome");
const placaEl = document.getElementById("placa");
const guicheEl = document.getElementById("guiche");

let ultimoChamadoEm = 0;
let iniciado = false;
let timeoutOcultar = null;

// ================= OUVIR SENHAS =================
db.ref(`unidades/${UNIDADE}/senhas`)
  .on("value", snapshot => {

    // na primeira carga da página, apenas marca como iniciado
    if (!iniciado) {
      snapshot.forEach(snap => {
        const s = snap.val();
        if (s && s.status === "chamando" && s.chamadoEm) {
          if (s.chamadoEm > ultimoChamadoEm) {
            ultimoChamadoEm = s.chamadoEm;
          }
        }
      });
      iniciado = true;
      return; // 🚫 NÃO CHAMA NADA NO LOAD
    }

    let ultimaSenha = null;

    snapshot.forEach(snap => {
      const s = snap.val();
      if (!s) return;
      if (s.status !== "chamando") return;
      if (!s.chamadoEm) return;

      if (!ultimaSenha || s.chamadoEm > ultimaSenha.chamadoEm) {
        ultimaSenha = s;
      }
    });

    // só chama se for REALMENTE NOVO
    if (ultimaSenha && ultimaSenha.chamadoEm > ultimoChamadoEm) {
      ultimoChamadoEm = ultimaSenha.chamadoEm;
      mostrarChamada(ultimaSenha);
      falar(ultimaSenha);
    }
  });

// ================= UI =================
function mostrarChamada(s) {
  nomeEl.innerText = `Motorista ${s.nome}`;
  placaEl.innerText = `Placa ${s.placa}`;
  guicheEl.innerText = `Dirigir-se ao ${s.guiche}`;

  chamadaBox.style.display = "flex";

  clearTimeout(timeoutOcultar);
  timeoutOcultar = setTimeout(() => {
    chamadaBox.style.display = "none";
  }, 30000);
}

// ================= VOZ =================
function falar(s) {
  const texto = `Motorista ${s.nome}, placa ${s.placa}, dirigir-se ao ${s.guiche}`;

  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = 0.9;
  fala.pitch = 1;

  speechSynthesis.cancel();
  speechSynthesis.speak(fala);
}
