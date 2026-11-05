/* =========================================================
   PAINEL DO ATENDENTE • BPA
   ========================================================= */

const filasDiv = document.getElementById("filas");
const atualDiv = document.getElementById("atual");
const dadosAtual = document.getElementById("dadosAtual");
const painelHistorico = document.getElementById("painelHistorico");
const historicoLista = document.getElementById("listaHistorico");
const selectGuiche = document.getElementById("guiche");

const boxGuiche = document.getElementById("boxGuiche");
const statusGuiche = document.getElementById("statusGuiche");
const btnTrocarGuiche = document.getElementById("btnTrocarGuiche");
const totalAguardandoEl = document.getElementById("totalAguardando");
const conexaoEl = document.getElementById("conexao");
const avisoEl = document.getElementById("aviso");
const emAtendimentoDiv = document.getElementById("emAtendimento");
const ALERTA_ATENDIMENTO_MS = 5 * 60 * 1000; // fica vermelho depois de 5 min

const refBase = `unidades/${UNIDADE}`;

let senhaAtualId = null;
let senhaAtualDados = null;
let guicheTravado = false;

// Estado vindo do Firebase
let filas = [];          // [{ key, nome }]
let senhas = {};         // { id: dados }
let filasCarregadas = false;
let senhasCarregadas = false;
let restauracaoFeita = false;
const idsConhecidos = new Set(); // para detectar senhas novas

/* ================= UTILITÁRIOS ================= */

// Evita que nomes/placas digitados pelos motoristas virem código na página
function esc(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatarTempo(ms) {
  if (!ms || ms < 0) ms = 0;
  const totalSegundos = Math.floor(ms / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = String(Math.floor((totalSegundos % 3600) / 60)).padStart(2, "0");
  const segundos = String(totalSegundos % 60).padStart(2, "0");
  return horas > 0 ? `${horas}:${minutos}:${segundos}` : `${minutos}:${segundos}`;
}

function formatarHora(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

let avisoTimeout = null;
function mostrarAviso(texto, tipo = "info") {
  avisoEl.textContent = texto;
  avisoEl.className = `aviso ${tipo}`;
  clearTimeout(avisoTimeout);
  avisoTimeout = setTimeout(() => avisoEl.classList.add("oculto"), 3500);
}

function nomeDaFila(key) {
  const f = filas.find(f => f.key === key);
  return f ? f.nome : key;
}

/* ================= CONEXÃO ================= */
db.ref(".info/connected").on("value", snap => {
  const online = snap.val() === true;
  conexaoEl.textContent = online ? "● Online" : "● Sem conexão";
  conexaoEl.classList.toggle("offline", !online);
});

/* ================= HISTÓRICO (abrir/fechar) ================= */
function toggleHistorico() {
  painelHistorico.classList.toggle("oculto");
}

/* ================= GUICHÊ ================= */

// Lembra o guichê escolhido neste computador
try {
  const salvo = localStorage.getItem("guicheAtendente");
  if (salvo && [...selectGuiche.options].some(o => o.value === salvo)) {
    selectGuiche.value = salvo;
  }
} catch (e) { /* sem localStorage */ }

selectGuiche.addEventListener("change", () => {
  try { localStorage.setItem("guicheAtendente", selectGuiche.value); } catch (e) {}
});

function ativarGuiche() {
  if (guicheTravado) return;
  guicheTravado = true;
  selectGuiche.disabled = true;
  boxGuiche.classList.add("travado", "ativo");
  statusGuiche.classList.remove("oculto");
  btnTrocarGuiche.classList.remove("oculto");
}

btnTrocarGuiche.onclick = () => {
  if (senhaAtualId) {
    mostrarAviso("Encerre ou devolva o atendimento atual antes de trocar de guichê.", "erro");
    return;
  }
  guicheTravado = false;
  selectGuiche.disabled = false;
  boxGuiche.classList.remove("travado", "ativo");
  statusGuiche.classList.add("oculto");
  btnTrocarGuiche.classList.add("oculto");
};

/* ================= CARREGAR FILAS ================= */
db.ref(`${refBase}/filas`).on("value", snapshot => {
  filas = [];
  snapshot.forEach(f => {
    const fila = f.val();
    if (!fila || !fila.ativa) return;
    filas.push({ key: f.key, nome: fila.nome || f.key });
  });
  filasCarregadas = true;
  renderizar();
});

/* ================= OUVIR SENHAS ================= */
db.ref(`${refBase}/senhas`).on("value", snapshot => {
  senhas = {};
  snapshot.forEach(snap => {
    if (snap.val()) senhas[snap.key] = snap.val();
  });
  verificarSenhasNovas();
  senhasCarregadas = true;

  restaurarAtendimento();
  verificarAtendimentoAtual();
  renderizar();
});

/* ================= DESENHAR COLUNAS + SENHAS ================= */
function renderizar() {
  if (!filasCarregadas) return;

  if (filas.length === 0) {
    filasDiv.innerHTML = `<p class="vazio-geral">Nenhuma fila ativa cadastrada.</p>`;
    totalAguardandoEl.textContent = "0";
    return;
  }

  // agrupa as senhas aguardando por fila, da mais antiga para a mais nova
  const porFila = {};
  filas.forEach(f => (porFila[f.key] = []));

  Object.entries(senhas)
    .filter(([, s]) => s.status === "aguardando" && porFila[s.atendimento])
    .sort(([, a], [, b]) => (a.criadoEm || 0) - (b.criadoEm || 0))
    .forEach(([id, s]) => porFila[s.atendimento].push({ id, ...s }));

  let total = 0;

  filasDiv.innerHTML = filas.map(f => {
    const lista = porFila[f.key];
    total += lista.length;

    const cards = lista.length
      ? lista.map((s, i) => `
          <div class="senha normal" data-criado="${Number(s.criadoEm) || ""}">
            <span class="posicao">${i + 1}º</span>
            <strong>${esc(s.nome)}</strong>
            <span class="placa">${esc(s.placa)}</span>
            <div class="tempo-espera">⏱️ Aguardando: --:--</div>
            <button type="button" class="btn-chamar" data-acao="chamar" data-id="${esc(s.id)}">CHAMAR</button>
            <button type="button" class="btn-remover" data-acao="remover" data-id="${esc(s.id)}" title="Remover da fila">🗑️</button>
          </div>`).join("")
      : `<p class="vazio">Ninguém aguardando</p>`;

    return `
      <div class="coluna" id="${esc(f.key)}">
        <h3>${esc(f.nome)} <span class="contador">${lista.length}</span></h3>
        ${cards}
      </div>`;
  }).join("");

  totalAguardandoEl.textContent = total;
  renderizarEmAtendimento();
  atualizarTemposAtendimento();
  document.title = total > 0 ? `(${total}) Painel do Atendente • BPA` : "Painel do Atendente • BPA";

  atualizarTempos();
}

// Um único "ouvinte" para todos os botões das senhas
filasDiv.addEventListener("click", e => {
  const btn = e.target.closest("button[data-acao]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.acao === "chamar") chamarSenha(id, btn);
  if (btn.dataset.acao === "remover") removerSenha(id);
});

/* ================= EM ATENDIMENTO (todos os guichês) =================
   Mostra para todos os atendentes as senhas que foram chamadas e ainda
   não foram encerradas. Qualquer atendente pode encerrar ou devolver
   (ex.: o colega fechou o navegador sem encerrar).
   Fica vermelha depois de 5 minutos.
*/

function renderizarEmAtendimento() {
  const lista = Object.entries(senhas)
    .filter(([, s]) => s.status === "chamando")
    .sort(([, a], [, b]) => (a.chamadoEm || 0) - (b.chamadoEm || 0));

  if (!lista.length) {
    emAtendimentoDiv.classList.add("oculto");
    emAtendimentoDiv.innerHTML = "";
    return;
  }

  const meuGuiche = selectGuiche.value;
  emAtendimentoDiv.classList.remove("oculto");
  emAtendimentoDiv.innerHTML = `
    <h3>Em atendimento <span class="contador">${lista.length}</span></h3>
    <div class="em-lista">
      ${lista.map(([id, s]) => `
        <div class="em-item ${s.guiche === meuGuiche ? "meu" : ""}" data-chamado="${Number(s.chamadoEm) || ""}">
          <div class="em-dados">
            <strong>${esc(s.nome)}</strong>
            <span class="placa">${esc(s.placa)}</span>
            <small>${esc(s.guiche || "Sem guichê")} • ${esc(nomeDaFila(s.atendimento))}</small>
            <small class="em-tempo">⏱️ --:--</small>
          </div>
          <div class="em-acoes">
            <button type="button" class="em-encerrar" data-em="encerrar" data-id="${esc(id)}">Encerrar</button>
            <button type="button" class="em-devolver" data-em="devolver" data-id="${esc(id)}">Devolver</button>
          </div>
        </div>`).join("")}
    </div>`;
}

emAtendimentoDiv.addEventListener("click", e => {
  const btn = e.target.closest("button[data-em]");
  if (!btn) return;
  const id = btn.dataset.id;
  const s = senhas[id];
  if (!s) return;

  const deOutro = s.guiche && s.guiche !== selectGuiche.value;
  if (btn.dataset.em === "encerrar") {
    if (deOutro && !confirm(`Encerrar o atendimento de ${s.nome} (${s.placa}) no ${s.guiche}?`)) return;
    encerrarSenha(id);
  } else {
    if (deOutro && !confirm(`Devolver ${s.nome} (${s.placa}) para a fila?`)) return;
    devolverParaFila(id);
  }
});

/* ================= ATENDIMENTO ATUAL ================= */

// Depois de recarregar a página, recupera a senha que este guichê estava atendendo
function restaurarAtendimento() {
  if (restauracaoFeita || senhaAtualId) return;
  restauracaoFeita = true;

  const guiche = selectGuiche.value;
  const emAndamento = Object.entries(senhas)
    .filter(([, s]) => s.status === "chamando" && s.guiche === guiche)
    .sort(([, a], [, b]) => (b.chamadoEm || 0) - (a.chamadoEm || 0))[0];

  if (emAndamento) {
    mostrarAtual(emAndamento[0], emAndamento[1]);
  }
}

// Se a senha atual foi removida/alterada em outro lugar, atualiza o balão
function verificarAtendimentoAtual() {
  if (!senhaAtualId) return;
  const s = senhas[senhaAtualId];
  if (!s || s.status !== "chamando") {
    limparAtual();
    return;
  }
  senhaAtualDados = s;
}

function mostrarAtual(id, s) {
  senhaAtualId = id;
  senhaAtualDados = s;

  dadosAtual.innerHTML = `
    <strong class="atual-nome">${esc(s.nome)}</strong>
    <span class="atual-placa">${esc(s.placa)}</span>
    <span class="atual-info">${esc(nomeDaFila(s.atendimento))} • ${esc(s.guiche)}</span>
  `;

  ativarGuiche();
  atualDiv.classList.remove("oculto");
}

/* ================= CHAMAR ================= */
function chamarSenha(id, botao) {
  const guicheSelecionado = selectGuiche.value;
  if (!guicheSelecionado) return;

  if (senhaAtualId) {
    mostrarAviso("Você já tem um atendimento em andamento. Encerre ou devolva para a fila antes de chamar outro.", "erro");
    return;
  }

  if (botao) botao.disabled = true;

  // transação: garante que dois guichês não chamem a mesma senha ao mesmo tempo
  db.ref(`${refBase}/senhas/${id}`).transaction(atual => {
    if (!atual || atual.status !== "aguardando") return; // cancela
    return {
      ...atual,
      status: "chamando",
      chamadoEm: Date.now(),
      guiche: guicheSelecionado
    };
  }).then(resultado => {
    if (!resultado.committed || !resultado.snapshot.exists()) {
      mostrarAviso("Essa senha já foi chamada por outro guichê.", "erro");
      return;
    }
    mostrarAtual(id, resultado.snapshot.val());
  }).catch(err => {
    console.error(err);
    mostrarAviso("Não foi possível chamar a senha. Verifique a conexão.", "erro");
  }).finally(() => {
    if (botao) botao.disabled = false;
  });
}

/* ================= AÇÕES ================= */
function rechamar() {
  if (!senhaAtualId) return;
  db.ref(`${refBase}/senhas/${senhaAtualId}`).update({
    chamadoEm: Date.now()
  }).then(() => mostrarAviso("Senha chamada novamente no painel."));
}

function voltarFila() {
  if (!senhaAtualId) return;
  devolverParaFila(senhaAtualId);
}

function devolverParaFila(id) {
  db.ref(`${refBase}/senhas/${id}`).update({
    status: "aguardando",
    guiche: null,
    chamadoEm: null
  });
  if (id === senhaAtualId) limparAtual();
}

function finalizar() {
  if (!senhaAtualId) return;
  encerrarSenha(senhaAtualId);
}

function encerrarSenha(id) {
  db.ref(`${refBase}/senhas/${id}`).once("value").then(snap => {
    if (!snap.exists()) { if (id === senhaAtualId) limparAtual(); return; }
    const s = snap.val();

    return db.ref(`${refBase}/historico`).push({
      nome: s.nome,
      placa: s.placa,
      atendimento: s.atendimento,
      guiche: s.guiche || null,
      motivo: "finalizada",
      criadoEm: s.criadoEm || null,
      chamadoEm: s.chamadoEm || null,
      finalizadoEm: Date.now()
    }).then(() => db.ref(`${refBase}/senhas/${id}`).remove());
  }).then(() => {
    if (id === senhaAtualId) limparAtual();
  }).catch(err => {
    console.error(err);
    mostrarAviso("Não foi possível encerrar. Verifique a conexão.", "erro");
  });
}

function limparAtual() {
  senhaAtualId = null;
  senhaAtualDados = null;
  atualDiv.classList.add("oculto");
  dadosAtual.innerHTML = "";
}

/* ================= REMOVER ================= */
function removerSenha(id) {
  const s = senhas[id];
  const nome = s ? `${s.nome} (${s.placa})` : "esta senha";
  if (!confirm(`Remover ${nome} da fila?`)) return;

  db.ref(`${refBase}/senhas/${id}`).once("value").then(snap => {
    if (!snap.exists()) return;
    const s = snap.val();

    return db.ref(`${refBase}/historico`).push({
      nome: s.nome,
      placa: s.placa,
      atendimento: s.atendimento,
      motivo: "cancelada",
      criadoEm: s.criadoEm || null,
      finalizadoEm: Date.now()
    }).then(() => db.ref(`${refBase}/senhas/${id}`).remove());
  });
}

/* ================= TEMPO DE ESPERA (CORES) ================= */
function atualizarTempos() {
  const agora = Date.now();

  document.querySelectorAll(".senha").forEach(card => {
    const criadoEm = Number(card.dataset.criado);
    if (!criadoEm) return;

    const diff = agora - criadoEm;

    const tempoEl = card.querySelector(".tempo-espera");
    if (tempoEl) tempoEl.textContent = `⏱️ Aguardando: ${formatarTempo(diff)}`;

    card.classList.remove("normal", "atencao", "critico");
    if (diff < 5 * 60 * 1000) {
      card.classList.add("normal");   // 🟢 até 5 min
    } else if (diff < 10 * 60 * 1000) {
      card.classList.add("atencao");  // 🟡 5 a 10 min
    } else {
      card.classList.add("critico");  // 🔴 acima de 10 min
    }
  });
}

setInterval(atualizarTempos, 1000);

function atualizarTemposAtendimento() {
  const agora = Date.now();
  document.querySelectorAll(".em-item").forEach(item => {
    const chamado = Number(item.dataset.chamado);
    if (!chamado) return;
    const diff = agora - chamado;
    const el = item.querySelector(".em-tempo");
    if (el) el.textContent = `⏱️ Chamado há ${formatarTempo(diff)}`;
    item.classList.toggle("atrasado", diff >= ALERTA_ATENDIMENTO_MS);
  });
}
setInterval(atualizarTemposAtendimento, 1000);

/* ================= HISTÓRICO – ÚLTIMAS CHAMADAS ================= */
db.ref(`${refBase}/historico`)
  .limitToLast(10)
  .on("value", snapshot => {
    if (!snapshot.exists()) {
      historicoLista.innerHTML = "<p class='vazio'>Sem histórico</p>";
      return;
    }

    const itens = [];
    snapshot.forEach(child => {
      const h = child.val();
      if (!h) return;
      const cancelada = h.motivo === "cancelada";

      itens.unshift(`
        <div class="item-historico ${cancelada ? "cancelada" : "finalizada"}">
          <strong>${esc(h.nome)}</strong>
          <span>${esc(h.placa)}</span>
          <small>${esc(nomeDaFila(h.atendimento))}${h.guiche ? " • " + esc(h.guiche) : ""}</small>
          <small>${cancelada ? "❌ Cancelada" : "✔️ Finalizada"} ${formatarHora(h.finalizadoEm)}</small>
          <button type="button" data-key="${esc(child.key)}">Voltar para fila</button>
        </div>`);
    });

    historicoLista.innerHTML = itens.join("");
  });

historicoLista.addEventListener("click", e => {
  const btn = e.target.closest("button[data-key]");
  if (btn) voltarDoHistorico(btn.dataset.key);
});

/* ================= VOLTAR DO HISTÓRICO ================= */
function voltarDoHistorico(key) {
  db.ref(`${refBase}/historico/${key}`)
    .once("value")
    .then(snapshot => {
      if (!snapshot.exists()) return;
      const h = snapshot.val();

      // não duplica: a placa já tem senha ativa?
      const placaH = String(h.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const jaAtiva = Object.values(senhas).some(s =>
        (s.status === "aguardando" || s.status === "chamando") &&
        String(s.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === placaH);
      if (jaAtiva) {
        mostrarAviso(`A placa ${h.placa} já está na fila.`, "erro");
        return Promise.reject("duplicada");
      }

      return db.ref(`${refBase}/senhas`).push({
        nome: h.nome,
        placa: h.placa,
        atendimento: h.atendimento,
        status: "aguardando",
        criadoEm: Date.now()
      }).then(() => db.ref(`${refBase}/historico/${key}`).remove());
    })
    .then(() => mostrarAviso("Senha devolvida para a fila."))
    .catch(err => {
      if (err !== "duplicada") mostrarAviso("Não foi possível devolver a senha para a fila.", "erro");
    });
}

/* =========================================================
   AVISO DE SENHA NOVA (quando o atendente está em outra tela)
   ========================================================= */
const btnAvisos = document.getElementById("btnAvisos");
const TITULO_PADRAO = "Painel do Atendente • BPA";
let audioCtx = null;
let piscarTitulo = null;
let novasNaoVistas = 0;

function suportaNotificacao() {
  return "Notification" in window;
}

function atualizarBotaoAvisos() {
  if (!suportaNotificacao()) {
    btnAvisos.textContent = "🔔 Avisos com som";
    btnAvisos.classList.toggle("ligado", !!audioCtx);
    return;
  }
  const p = Notification.permission;
  btnAvisos.classList.toggle("ligado", p === "granted");
  btnAvisos.classList.toggle("bloqueado", p === "denied");
  btnAvisos.textContent =
    p === "granted" ? "🔔 Avisos ativos" :
    p === "denied"  ? "🔕 Avisos bloqueados" :
                      "🔔 Ativar avisos";
}

function prepararSom() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) { audioCtx = null; }
}

// o navegador só libera som depois de um clique na página
document.addEventListener("click", prepararSom, { once: true });

btnAvisos.addEventListener("click", () => {
  prepararSom();
  if (!suportaNotificacao()) { atualizarBotaoAvisos(); return; }

  if (Notification.permission === "denied") {
    mostrarAviso("Os avisos estão bloqueados. Clique no cadeado ao lado do endereço do site e permita Notificações.", "erro");
    return;
  }
  Notification.requestPermission().then(p => {
    atualizarBotaoAvisos();
    if (p === "granted") {
      mostrarAviso("Avisos ativados! Você será avisado de senhas novas mesmo em outra tela.");
    }
  });
});

atualizarBotaoAvisos();

function telaEmSegundoPlano() {
  return document.hidden || !document.hasFocus();
}

function verificarSenhasNovas() {
  const novas = [];

  Object.entries(senhas).forEach(([id, s]) => {
    if (idsConhecidos.has(id)) return;
    idsConhecidos.add(id);
    // na primeira carga só registra o que já existia
    if (senhasCarregadas && s.status === "aguardando") novas.push(s);
  });

  if (novas.length && telaEmSegundoPlano()) {
    avisarSenhasNovas(novas);
  }
}

function avisarSenhasNovas(novas) {
  novasNaoVistas += novas.length;
  tocarSom();
  iniciarPiscarTitulo();

  if (!suportaNotificacao() || Notification.permission !== "granted") return;

  const s = novas[novas.length - 1];
  const corpo = novas.length === 1
    ? `${s.nome} • ${s.placa}\nFila: ${nomeDaFila(s.atendimento)}`
    : `${novas.length} senhas novas. Última: ${s.nome} • ${s.placa}`;

  try {
    const n = new Notification("🔔 Nova senha na fila", {
      body: corpo,
      tag: "nova-senha-bpa",
      renotify: true,
      requireInteraction: true
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (e) { /* alguns navegadores não deixam criar notificação aqui */ }
}

function tocarSom() {
  if (!audioCtx || audioCtx.state !== "running") return;
  try {
    const t = audioCtx.currentTime;
    [660, 880, 1100].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.35, t + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.17);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.18);
    });
  } catch (e) {}
}

function iniciarPiscarTitulo() {
  if (piscarTitulo) return;
  let alterna = false;
  piscarTitulo = setInterval(() => {
    alterna = !alterna;
    document.title = alterna
      ? `🔔 ${novasNaoVistas} senha${novasNaoVistas > 1 ? "s" : ""} nova${novasNaoVistas > 1 ? "s" : ""}!`
      : tituloAtual();
  }, 1000);
}

function tituloAtual() {
  const total = Number(totalAguardandoEl.textContent) || 0;
  return total > 0 ? `(${total}) ${TITULO_PADRAO}` : TITULO_PADRAO;
}

function pararPiscarTitulo() {
  clearInterval(piscarTitulo);
  piscarTitulo = null;
  novasNaoVistas = 0;
  document.title = tituloAtual();
}

// quando o atendente volta para a tela, para de piscar
window.addEventListener("focus", pararPiscarTitulo);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && document.hasFocus()) pararPiscarTitulo();
});

/* =========================================================
   LIMPEZA AUTOMÁTICA DO HISTÓRICO
   Apaga atendimentos encerrados há mais de 7 dias.
   Roda ao abrir o painel e depois a cada hora.
   ========================================================= */
const DIAS_HISTORICO = 7;

function limparHistoricoAntigo() {
  const limite = Date.now() - DIAS_HISTORICO * 24 * 60 * 60 * 1000;

  db.ref(`${refBase}/historico`)
    .orderByChild("finalizadoEm")
    .endAt(limite)
    .limitToFirst(500)
    .once("value")
    .then(snap => {
      const apagar = {};
      snap.forEach(c => {
        const h = c.val();
        // também apaga registros antigos sem data
        if (!h || !h.finalizadoEm || h.finalizadoEm <= limite) apagar[c.key] = null;
      });
      const total = Object.keys(apagar).length;
      if (!total) return;
      return db.ref(`${refBase}/historico`).update(apagar).then(() => {
        console.log(`Histórico: ${total} registro(s) com mais de ${DIAS_HISTORICO} dias apagado(s).`);
        if (total === 500) setTimeout(limparHistoricoAntigo, 2000); // ainda tem mais
      });
    })
    .catch(err => console.warn("Limpeza do histórico não executada:", err));
}

setTimeout(limparHistoricoAntigo, 5000);
setInterval(limparHistoricoAntigo, 60 * 60 * 1000);
