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

      // 🔐 REGRA DE OURO DO TEMPO
      let criadoEm = s.criadoEm;
      if (!criadoEm) {
        criadoEm = Date.now();
        db.ref(`unidades/${UNIDADE}/senhas/${snap.key}/criadoEm`).set(criadoEm);
      }

      const card = document.createElement("div");
      card.className = "senha normal";
      card.dataset.criado = criadoEm;

      card.innerHTML = `
        <strong>${s.nome}</strong><br>
        ${s.placa}
        <div class="tempo-espera">⏱️ Aguardando: 00:00</div>

        <button onclick="chamarSenha('${snap.key}')">CHAMAR</button>
        <button class="btn-remover" onclick="removerSenha('${snap.key}')">Remover</button>
      `;

      coluna.appendChild(card);
    });
  });
}

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
      guiche: guicheSelecionado,
      exibidoNaTV: false
    });

    dadosAtual.innerHTML = `
      <strong>${senhaAtualDados.nome}</strong><br>
      ${senhaAtualDados.placa}<br>
      <small>${senhaAtualDados.atendimento}</small><br>
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
    chamadoEm: Date.now(),
    exibidoNaTV: false
  });
}

function voltarFila() {
  if (!senhaAtualId) return;
  db.ref(`unidades/${UNIDADE}/senhas/${senhaAtualId}`).update({ status: "aguardando" });
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

/* ================= TEMPO DE ESPERA ================= */
function formatarTempo(ms) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function atualizarTempos() {
  const agora = Date.now();

  document.querySelectorAll(".senha").forEach(card => {
    const criadoEm = Number(card.dataset.criado);
    if (!criadoEm) return;

    const diff = agora - criadoEm;
    const tempoEl = card.querySelector(".tempo-espera");
    if (tempoEl) tempoEl.innerText = `⏱️ Aguardando: ${formatarTempo(diff)}`;

    card.classList.remove("normal", "atencao", "critico");

    if (diff < 5 * 60 * 1000) card.classList.add("normal");
    else if (diff < 10 * 60 * 1000) card.classList.add("atencao");
    else card.classList.add("critico");
  });
}

setInterval(atualizarTempos, 1000);

/* ================= REMOVER SENHA ================= */
function removerSenha(id) {
  if (!confirm("Deseja remover esta senha da fila?")) return;

  db.ref(`unidades/${UNIDADE}/senhas/${id}`).once("value").then(snapshot => {
    if (!snapshot.exists()) return;
    const s = snapshot.val();

    db.ref(`unidades/${UNIDADE}/historico`).push({
      nome: s.nome,
      placa: s.placa,
      atendimento: s.atendimento,
      guiche: s.guiche || null,
      motivo: "cancelada",
      criadoEm: s.criadoEm,
      finalizadoEm: Date.now()
    });

    db.ref(`unidades/${UNIDADE}/senhas/${id}`).remove();
  });
}
