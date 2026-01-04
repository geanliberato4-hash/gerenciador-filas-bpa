const filasDiv = document.getElementById("filas");
const atualDiv = document.getElementById("atual");
const dadosAtual = document.getElementById("dadosAtual");
const painelHistorico = document.getElementById("painelHistorico");
const historicoLista = document.getElementById("listaHistorico");
const selectGuiche = document.getElementById("guiche");

const boxGuiche = document.getElementById("boxGuiche");
const statusGuiche = document.getElementById("statusGuiche");
const btnTrocarGuiche = document.getElementById("btnTrocarGuiche");

let senhaAtualId = null;
let senhaAtualDados = null;
let guicheTravado = false;

/* ================= TOGGLE HISTÓRICO ================= */
function toggleHistorico() {
  painelHistorico.classList.toggle("oculto");
}

/* ================= GUICHÊ ================= */
function ativarGuiche() {
  if (guicheTravado) return;

  guicheTravado = true;
  boxGuiche.classList.add("travado", "ativo");
  statusGuiche.classList.remove("oculto");
  btnTrocarGuiche.classList.remove("oculto");
}

btnTrocarGuiche.onclick = () => {
  guicheTravado = false;
  boxGuiche.classList.remove("travado", "ativo");
  statusGuiche.classList.add("oculto");
  btnTrocarGuiche.classList.add("oculto");
};

/* ================= CARREGAR FILAS ================= */
db.ref(`unidades/${UNIDADE}/filas`).once("value").then(snapshot => {
  filasDiv.innerHTML = "";

  snapshot.forEach(f => {
    const fila = f.val();
    if (!fila || !fila.ativa) return;

    const coluna = document.createElement("div");
    coluna.className = "coluna";
    coluna.id = f.key;
    coluna.innerHTML = `<h3>${fila.nome}</h3>`;

    filasDiv.appendChild(coluna);
  });

  ouvirSenhas();
});

/* ================= OUVIR SENHAS ================= */
function ouvirSenhas() {
  db.ref(`unidades/${UNIDADE}/senhas`).on("value", snapshot => {
    document.querySelectorAll(".senha").forEach(el => el.remove());

    snapshot.forEach(snap => {
      const s = snap.val();
      if (!s || s.status !== "aguardando") return;

      const coluna = document.getElementById(s.atendimento);
      if (!coluna) return;

      const card = document.createElement("div");
      card.className = "senha";
      card.innerHTML = `
        <strong>${s.nome}</strong><br>
        ${s.placa}
        <button onclick="chamarSenha('${snap.key}')">CHAMAR</button>
      `;

      coluna.appendChild(card);
    });
  });
}

/* ================= CHAMAR SENHA ================= */
function chamarSenha(id) {
  const guicheSelecionado = selectGuiche.value;
  if (!guicheSelecionado) return;

  senhaAtualId = id;

  db.ref(`unidades/${UNIDADE}/senhas/${id}`).once("value").then(snap => {
    if (!snap.exists()) return;

    senhaAtualDados = snap.val();

    db.ref(`unidades/${UNIDADE}/senhas/${id}`).update({
  status: "chamando",
  chamadoEm: Date.now(),
  guiche: guicheSelecionado,
  exibidoNaTV: false
});


    dadosAtual.innerHTML = `
      <strong>${senhaAtualDados.nome}</strong><br>
      ${senhaAtualDados.placa}<br>
      <small>${senhaAtualDados.atendimento}</small><br>
      <strong>${guicheSelecionado}</strong>
    `;

    ativarGuiche(); // ✅ AGORA FUNCIONA
    atualDiv.classList.remove("oculto");
  });
}

/* ================= AÇÕES ================= */
function rechamar() {
  if (!senhaAtualId) return;

  db.ref(`unidades/${UNIDADE}/senhas/${senhaAtualId}`).update({
    status: "chamando",
    chamadoEm: Date.now(),
    exibidoNaTV: false
  });
}


function voltarFila() {
  if (!senhaAtualId) return;

  db.ref(`unidades/${UNIDADE}/senhas/${senhaAtualId}`)
    .update({ status: "aguardando" });

  limparAtual();
}

function finalizar() {
  if (!senhaAtualId || !senhaAtualDados) return;

  db.ref(`unidades/${UNIDADE}/historico`).push({
    nome: senhaAtualDados.nome,
    placa: senhaAtualDados.placa,
    atendimento: senhaAtualDados.atendimento,
    guiche: selectGuiche.value,
    finalizadoEm: Date.now()
  });

  db.ref(`unidades/${UNIDADE}/senhas/${senhaAtualId}`).remove();
  limparAtual();
}

function limparAtual() {
  senhaAtualId = null;
  senhaAtualDados = null;
  atualDiv.classList.add("oculto");
  dadosAtual.innerHTML = "";
}

/* ================= HISTÓRICO ================= */
db.ref(`unidades/${UNIDADE}/historico`)
  .limitToLast(10)
  .on("value", snapshot => {
    historicoLista.innerHTML = "";

    snapshot.forEach(child => {
      const h = child.val();

      const item = document.createElement("div");
      item.className = "item-historico";
      item.innerHTML = `
        <strong>${h.nome}</strong><br>
        ${h.placa}<br>
        <small>${h.atendimento} • ${h.guiche}</small>
        <button onclick="voltarDoHistorico('${child.key}')">
          Voltar para fila
        </button>
      `;

      historicoLista.prepend(item);
    });
  });

function voltarDoHistorico(key) {
  db.ref(`unidades/${UNIDADE}/historico/${key}`).once("value").then(snap => {
    const h = snap.val();

    db.ref(`unidades/${UNIDADE}/senhas`).push({
      nome: h.nome,
      placa: h.placa,
      atendimento: h.atendimento,
      status: "aguardando",
      criadoEm: Date.now()
    });

    db.ref(`unidades/${UNIDADE}/historico/${key}`).remove();
  });
}
