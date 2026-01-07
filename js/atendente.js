const filasDiv = document.getElementById("filas");
const atualDiv = document.getElementById("atual");
const dadosAtual = document.getElementById("dadosAtual");
const painelHistorico = document.getElementById("painelHistorico");
const historicoLista = document.getElementById("listaHistorico");
const selectGuiche = document.getElementById("guiche");

let senhaAtualId = null;
let senhaAtualDados = null;

/* ================= HISTÓRICO ================= */
function toggleHistorico() {
  painelHistorico.classList.toggle("oculto");
}

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
      card.className = "senha normal";
      card.dataset.criado = s.criadoEm;

      card.innerHTML = `
        <strong>${s.nome}</strong><br>
        ${s.placa}
        <div class="tempo-espera">⏱️ Aguardando: 00:00</div>

       <div class="acoes-senha">
  <button onclick="chamarSenha('${snap.key}')">CHAMAR</button>

  <button class="btn-remover" onclick="removerSenha('${snap.key}')" title="Remover da fila">
  🗑️
</button>
</div>
      `;

      coluna.appendChild(card);
    });
  });
}

/* ================= CHAMAR ================= */
function chamarSenha(id) {
  const guiche = selectGuiche.value;
  if (!guiche) return;

  senhaAtualId = id;

  db.ref(`unidades/${UNIDADE}/senhas/${id}`).once("value").then(snap => {
    if (!snap.exists()) return;
    senhaAtualDados = snap.val();

    db.ref(`unidades/${UNIDADE}/senhas/${id}`).update({
      status: "chamando",
      chamadoEm: Date.now(),
      guiche
    });

    dadosAtual.innerHTML = `
      <strong>${senhaAtualDados.nome}</strong><br>
      ${senhaAtualDados.placa}<br>
      <strong>${guiche}</strong>
    `;

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
  if (!senhaAtualId || !senhaAtualDados) return;

  db.ref(`unidades/${UNIDADE}/historico`).push({
    nome: senhaAtualDados.nome,
    placa: senhaAtualDados.placa,
    atendimento: senhaAtualDados.atendimento,
    guiche: senhaAtualDados.guiche,
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

      const statusIcone = h.motivo === "cancelada" ? "❌" : "✔️";
      const statusTexto = h.motivo === "cancelada" ? "Cancelada" : "Finalizada";

      const item = document.createElement("div");
      item.className = `item-historico ${h.motivo === "cancelada" ? "cancelada" : "finalizada"}`;

      item.innerHTML = `
        <div class="hist-topo">
          <strong>${statusIcone} ${statusTexto}</strong>
        </div>

        <div class="hist-info">
          <span><strong>Nome:</strong> ${h.nome}</span>
          <span><strong>Placa:</strong> ${h.placa}</span>
          <span><strong>Fila:</strong> ${h.atendimento}</span>
          ${h.guiche ? `<span><strong>Guichê:</strong> ${h.guiche}</span>` : ""}
        </div>

        <button class="btn-voltar" onclick="voltarDoHistorico('${child.key}')">
          ↩️ Voltar para fila
        </button>
      `;

      historicoLista.prepend(item);
    });
  });
/* ================= TEMPO ================= */
function formatarTempo(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(t / 60)).padStart(2, "0");
  const s = String(t % 60).padStart(2, "0");
  return `${m}:${s}`;
}

setInterval(() => {
  const agora = Date.now();
  document.querySelectorAll(".senha").forEach(card => {
    const criado = Number(card.dataset.criado);
    const el = card.querySelector(".tempo-espera");
    if (el) el.innerText = `⏱️ Aguardando: ${formatarTempo(agora - criado)}`;
  });
}, 1000);

function removerSenha(id) {
  if (!confirm("Deseja remover esta senha da fila?")) return;

  db.ref(`unidades/${UNIDADE}/senhas/${id}`).once("value").then(snapshot => {
    if (!snapshot.exists()) return;
    const s = snapshot.val();

    // Salva no histórico como CANCELADA
    db.ref(`unidades/${UNIDADE}/historico`).push({
      nome: s.nome,
      placa: s.placa,
      atendimento: s.atendimento,
      guiche: s.guiche || null,
      motivo: "cancelada",
      criadoEm: s.criadoEm,
      finalizadoEm: Date.now()
    });

    // Remove sem chamar
    db.ref(`unidades/${UNIDADE}/senhas/${id}`).remove();
  });
}
