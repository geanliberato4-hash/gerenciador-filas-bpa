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

/* ================= HISTÓRICO ================= */
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
db.ref(`unidades/${UNIDADE}/filas`).on("value", snapshot => {
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
});

/* ================= OUVIR SENHAS ================= */
db.ref(`unidades/${UNIDADE}/senhas`).on("value", snapshot => {
  document.querySelectorAll(".senha").forEach(el => el.remove());

  snapshot.forEach(snap => {
    const s = snap.val();
    if (!s || s.status !== "aguardando") return;

    const coluna = document.getElementById(s.atendimento);
    if (!coluna) return;

    const criadoEm = s.criadoEm || Date.now();

    const card = document.createElement("div");
    card.className = "senha normal";
    card.dataset.criado = criadoEm;

    card.innerHTML = `
      <strong>${s.nome}</strong><br>
      ${s.placa}
      <div class="tempo-espera">⏱️ Aguardando: 00:00</div>

      <button onclick="chamarSenha('${snap.key}')">CHAMAR</button>
      <button class="btn-remover" onclick="removerSenha('${snap.key}')">🗑️</button>
    `;

    coluna.appendChild(card);
  });

  atualizarTempos();
});

/* ================= CHAMAR ================= */
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
      guiche: guicheSelecionado
    });

    dadosAtual.innerHTML = `
      <strong>${senhaAtualDados.nome}</strong><br>
      ${senhaAtualDados.placa}<br>
      <strong>${guicheSelecionado}</strong>
    `;

    ativarGuiche();
    atualDiv.classList.remove("oculto");
  });
}

/* ================= AÇÕES ================= */
function rechamar() {
  if (!senhaAtualId) return;
  db.ref(`unidades/${UNIDADE}/senhas/${senhaAtualId}`).update({
    chamadoEm: Date.now()
  });
}

function voltarFila() {
  if (!senhaAtualId) return;
  db.ref(`unidades/${UNIDADE}/senhas/${senhaAtualId}`).update({
    status: "aguardando"
  });
  limparAtual();
}

function finalizar() {
  if (!senhaAtualId) return;

  db.ref(`unidades/${UNIDADE}/senhas/${senhaAtualId}`).once("value").then(snap => {
    if (!snap.exists()) return;
    const s = snap.val();

    db.ref(`unidades/${UNIDADE}/historico`).push({
      nome: s.nome,
      placa: s.placa,
      atendimento: s.atendimento,
      guiche: s.guiche,
      motivo: "finalizada",
      criadoEm: s.criadoEm,
      finalizadoEm: Date.now()
    });

    db.ref(`unidades/${UNIDADE}/senhas/${senhaAtualId}`).remove();
    limparAtual();
  });
}

function limparAtual() {
  senhaAtualId = null;
  senhaAtualDados = null;
  atualDiv.classList.add("oculto");
  dadosAtual.innerHTML = "";
}

/* ================= TEMPO ================= */
function atualizarTempos() {
  const agora = Date.now();

  document.querySelectorAll(".senha").forEach(card => {
    const criadoEm = Number(card.dataset.criado);
    if (!criadoEm) return;

    const diff = agora - criadoEm;
    const total = Math.floor(diff / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");

    const tempoEl = card.querySelector(".tempo-espera");
    if (tempoEl) tempoEl.innerText = `⏱️ Aguardando: ${m}:${s}`;
  });
}

setInterval(atualizarTempos, 1000);

/* ================= REMOVER ================= */
function removerSenha(id) {
  if (!confirm("Remover senha da fila?")) return;

  db.ref(`unidades/${UNIDADE}/senhas/${id}`).once("value").then(snap => {
    if (!snap.exists()) return;
    const s = snap.val();

    db.ref(`unidades/${UNIDADE}/historico`).push({
      nome: s.nome,
      placa: s.placa,
      atendimento: s.atendimento,
      motivo: "cancelada",
      criadoEm: s.criadoEm,
      finalizadoEm: Date.now()
    });

    db.ref(`unidades/${UNIDADE}/senhas/${id}`).remove();
  });
}
