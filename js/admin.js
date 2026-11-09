/* =========================================================
   ADMINISTRAÇÃO • BPA
   Só o e-mail abaixo pode alterar filas e guichês (as regras
   do Firebase também conferem isso no servidor).
   ========================================================= */
const ADMIN_EMAIL = "gean.liberato.4@gmail.com";

const auth = firebase.auth();
const base = `unidades/${UNIDADE}`;
const refFilas = db.ref(`${base}/filas`);
const refGuiches = db.ref(`${base}/guiches`);
const refSenhas = db.ref(`${base}/senhas`);
const refHistorico = db.ref(`${base}/historico`);

const avisoEl = document.getElementById("aviso");

let filas = [];        // [{ key, nome, ativo, ordem }]
let guiches = [];
let senhas = {};       // { id: dados }
let historico = [];    // [dados]
let iniciado = false;

/* ================= UTILITÁRIOS ================= */
function esc(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let avisoTimeout = null;
function mostrarAviso(texto, tipo = "ok") {
  avisoEl.textContent = texto;
  avisoEl.className = `aviso ${tipo}`;
  clearTimeout(avisoTimeout);
  avisoTimeout = setTimeout(() => avisoEl.classList.add("oculto"), 3500);
}

function erroFirebase(err) {
  console.error(err);
  if (err && String(err.code || err.message).toLowerCase().includes("permission")) {
    mostrarAviso("Sem permissão para alterar. Confira se as regras do Firebase foram publicadas.", "erro");
  } else {
    mostrarAviso("Não foi possível salvar. Verifique a conexão.", "erro");
  }
}

function minutos(ms) {
  if (ms == null || isNaN(ms)) return "—";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min`;
}

function media(lista) {
  const v = lista.filter(n => typeof n === "number" && n >= 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/* ================= LOGIN ================= */
auth.onAuthStateChanged(user => {
  if (!user) {
    location.replace("admin-login.html");
    return;
  }
  document.body.classList.remove("verificando");
  document.getElementById("usuario").textContent = user.email;

  const ehAdmin = (user.email || "").toLowerCase() === ADMIN_EMAIL;
  document.getElementById("semPermissao").classList.toggle("oculto", ehAdmin);
  document.getElementById("areaAdmin").classList.toggle("oculto", !ehAdmin);
  if (ehAdmin && !iniciado) iniciar();
});

document.getElementById("btnSair").onclick = () => auth.signOut();

/* =========================================================
   LISTA EDITÁVEL (usada para filas e para guichês)
   ========================================================= */
function criarLista(cfg) {
  // cfg: { ref, listaEl, formEl, inputEl, campoAtivo, maxNome, rotulo, rotuloAtivo, rotuloInativo, obterItens, definirItens, contar, avisoDesativar }
  const { ref, listaEl, formEl, inputEl, campoAtivo } = cfg;

  function chave(nome) {
    const baseKey = nome.normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || cfg.rotulo;
    let k = baseKey, n = 2;
    while (cfg.obterItens().some(i => i.key === k)) k = `${baseKey}-${n++}`;
    return k;
  }

  function renderizar() {
    const itens = cfg.obterItens();
    if (!itens.length) {
      listaEl.innerHTML = `<p class="vazio">Nada cadastrado.</p>`;
      return;
    }
    // não redesenha enquanto o admin digita um nome
    if (document.activeElement && listaEl.contains(document.activeElement) && document.activeElement.classList.contains("nome-fila")) return;

    listaEl.innerHTML = itens.map((it, i) => `
      <div class="fila ${it.ativo ? "" : "inativa"}" data-key="${esc(it.key)}">
        <div class="ordem">
          <button type="button" data-acao="subir" title="Mover para cima" ${i === 0 ? "disabled" : ""}>▲</button>
          <button type="button" data-acao="descer" title="Mover para baixo" ${i === itens.length - 1 ? "disabled" : ""}>▼</button>
        </div>
        <input class="nome-fila" type="text" maxlength="${cfg.maxNome}" value="${esc(it.nome)}" data-original="${esc(it.nome)}">
        <span class="esperando">${esc(cfg.contar(it))}</span>
        <button type="button" class="status ${it.ativo ? "on" : "off"}" data-acao="alternar">
          ${it.ativo ? "● " + cfg.rotuloAtivo : "○ " + cfg.rotuloInativo}
        </button>
      </div>`).join("");
  }

  listaEl.addEventListener("click", e => {
    const btn = e.target.closest("button[data-acao]");
    if (!btn) return;
    const itens = cfg.obterItens();
    const i = itens.findIndex(it => it.key === btn.closest(".fila").dataset.key);
    if (i < 0) return;
    const it = itens[i];

    if (btn.dataset.acao === "alternar") {
      if (it.ativo) {
        const msg = cfg.avisoDesativar(it);
        if (msg && !confirm(msg)) return;
      }
      ref.child(it.key).update({ [campoAtivo]: !it.ativo })
        .then(() => mostrarAviso(`${it.nome}: ${it.ativo ? cfg.rotuloInativo.toLowerCase() : cfg.rotuloAtivo.toLowerCase()}.`))
        .catch(erroFirebase);
    }
    if (btn.dataset.acao === "subir" && i > 0) mover(i, i - 1);
    if (btn.dataset.acao === "descer" && i < itens.length - 1) mover(i, i + 1);
  });

  function mover(de, para) {
    const nova = cfg.obterItens().slice();
    const [item] = nova.splice(de, 1);
    nova.splice(para, 0, item);
    const updates = {};
    nova.forEach((it, idx) => { updates[`${it.key}/ordem`] = idx + 1; });
    ref.update(updates).catch(erroFirebase);
  }

  listaEl.addEventListener("keydown", e => {
    if (!e.target.classList.contains("nome-fila")) return;
    if (e.key === "Enter") e.target.blur();
    if (e.key === "Escape") { e.target.value = e.target.dataset.original; e.target.blur(); }
  });

  listaEl.addEventListener("focusout", e => {
    const input = e.target;
    if (!input.classList.contains("nome-fila")) return;
    const key = input.closest(".fila").dataset.key;
    const nome = input.value.trim().replace(/\s+/g, " ");
    const original = input.dataset.original;

    if (!nome) {
      input.value = original;
      mostrarAviso("O nome não pode ficar vazio.", "erro");
      setTimeout(renderizar, 0);
      return;
    }
    if (nome === original) { setTimeout(renderizar, 0); return; }
    if (cfg.obterItens().some(it => it.key !== key && it.nome.toLowerCase() === nome.toLowerCase())) {
      input.value = original;
      mostrarAviso(`Já existe "${nome}".`, "erro");
      setTimeout(renderizar, 0);
      return;
    }

    ref.child(key).update({ nome })
      .then(() => { mostrarAviso(`Nome alterado para "${nome}".`); renderizar(); })
      .catch(err => { input.value = original; erroFirebase(err); });
  });

  formEl.addEventListener("submit", e => {
    e.preventDefault();
    const nome = inputEl.value.trim().replace(/\s+/g, " ");
    if (!nome) { inputEl.focus(); return; }
    const itens = cfg.obterItens();
    if (itens.some(it => it.nome.toLowerCase() === nome.toLowerCase())) {
      mostrarAviso(`Já existe "${nome}".`, "erro");
      return;
    }
    const key = chave(nome);
    // numera os atuais na ordem em que aparecem e coloca o novo no final
    const updates = {};
    itens.forEach((it, idx) => { updates[`${it.key}/ordem`] = idx + 1; });
    updates[key] = { nome, [campoAtivo]: true, ordem: itens.length + 1 };

    ref.update(updates)
      .then(() => { inputEl.value = ""; mostrarAviso(`"${nome}" criado. Já aparece no ${cfg.ondeAparece}.`); })
      .catch(erroFirebase);
  });

  return { renderizar };
}

function lerLista(snap, campoAtivo) {
  const lista = [];
  snap.forEach(c => {
    const v = c.val() || {};
    lista.push({ key: c.key, nome: v.nome || c.key, ativo: !!v[campoAtivo], ordem: typeof v.ordem === "number" ? v.ordem : 999 });
  });
  return lista.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}

/* ================= INÍCIO ================= */
let listaFilas, listaGuiches;

function iniciar() {
  iniciado = true;

  listaFilas = criarLista({
    ref: refFilas,
    listaEl: document.getElementById("listaFilas"),
    formEl: document.getElementById("formNovaFila"),
    inputEl: document.getElementById("nomeNovaFila"),
    campoAtivo: "ativa",
    maxNome: 40,
    rotulo: "fila",
    rotuloAtivo: "Ativa",
    rotuloInativo: "Desativada",
    ondeAparece: "totem e no painel",
    obterItens: () => filas,
    contar: f => `${contarSenhas(s => s.atendimento === f.key && s.status === "aguardando")} aguardando`,
    avisoDesativar: f => {
      const n = contarSenhas(s => s.atendimento === f.key && s.status === "aguardando");
      return n
        ? `A fila "${f.nome}" tem ${n} motorista(s) aguardando.\n\nSe desativar, ela some do totem e do painel, e essas senhas não aparecem mais até a fila ser ativada de novo.\n\nDesativar mesmo assim?`
        : `Desativar a fila "${f.nome}"?\n\nEla some do totem e do painel na hora.`;
    }
  });

  listaGuiches = criarLista({
    ref: refGuiches,
    listaEl: document.getElementById("listaGuiches"),
    formEl: document.getElementById("formNovoGuiche"),
    inputEl: document.getElementById("nomeNovoGuiche"),
    campoAtivo: "ativo",
    maxNome: 30,
    rotulo: "guiche",
    rotuloAtivo: "Ativo",
    rotuloInativo: "Desativado",
    ondeAparece: "painel dos atendentes",
    obterItens: () => guiches,
    contar: g => `${contarSenhas(s => s.guiche === g.nome && s.status === "chamando")} em atendimento`,
    avisoDesativar: g => {
      const n = contarSenhas(s => s.guiche === g.nome && s.status === "chamando");
      return n
        ? `O ${g.nome} está com ${n} atendimento(s) em andamento.\n\nO atendente consegue terminar, mas o guichê some da lista do painel.\n\nDesativar mesmo assim?`
        : `Desativar o ${g.nome}?\n\nEle some da lista de guichês do painel.`;
    }
  });

  refFilas.on("value", snap => {
    filas = lerLista(snap, "ativa");
    listaFilas.renderizar();
    montarSelectLimpar();
    renderizarResumo();
  }, erroFirebase);

  let primeiraLeituraGuiches = true;
  refGuiches.on("value", snap => {
    guiches = lerLista(snap, "ativo");
    // primeira vez: cadastra os guichês que já existiam no sistema
    if (primeiraLeituraGuiches && !guiches.length) {
      refGuiches.update({
        "guiche-1": { nome: "Guichê 1", ativo: true, ordem: 1 },
        "guiche-2": { nome: "Guichê 2", ativo: true, ordem: 2 }
      }).catch(erroFirebase);
    }
    primeiraLeituraGuiches = false;
    listaGuiches.renderizar();
  }, erroFirebase);

  refSenhas.on("value", snap => {
    senhas = {};
    snap.forEach(c => { if (c.val()) senhas[c.key] = c.val(); });
    listaFilas.renderizar();
    listaGuiches.renderizar();
    atualizarPreviaLimpar();
    renderizarResumo();
  });

  refHistorico.on("value", snap => {
    historico = [];
    snap.forEach(c => { if (c.val()) historico.push(c.val()); });
    renderizarResumo();
  });

  montarDias();
}

function contarSenhas(filtro) {
  return Object.values(senhas).filter(filtro).length;
}

/* ================= RESUMO ================= */
const diaResumo = document.getElementById("diaResumo");

function montarDias() {
  const opcoes = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const rotulo = i === 0 ? "Hoje" : i === 1 ? "Ontem" : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    opcoes.push(`<option value="${d.getTime()}">${rotulo}</option>`);
  }
  diaResumo.innerHTML = opcoes.join("");
  diaResumo.onchange = renderizarResumo;
  renderizarResumo();
}

function renderizarResumo() {
  if (!diaResumo.value) return;
  const inicio = Number(diaResumo.value);
  const fim = inicio + 24 * 60 * 60 * 1000;
  const doDia = historico.filter(h => h.finalizadoEm >= inicio && h.finalizadoEm < fim);
  const finalizadas = doDia.filter(h => h.motivo !== "cancelada");
  const canceladas = doDia.filter(h => h.motivo === "cancelada");

  const espera = h => (h.chamadoEm && h.criadoEm) ? h.chamadoEm - h.criadoEm : null;
  const atendimento = h => (h.finalizadoEm && h.chamadoEm) ? h.finalizadoEm - h.chamadoEm : null;

  const ehHoje = diaResumo.selectedIndex === 0;
  const cartoes = [
    ["Atendidos", finalizadas.length],
    ["Cancelados", canceladas.length],
    ["Espera média", minutos(media(finalizadas.map(espera)))],
    ["Atendimento médio", minutos(media(finalizadas.map(atendimento)))]
  ];
  if (ehHoje) {
    cartoes.push(["Aguardando agora", contarSenhas(s => s.status === "aguardando")]);
    cartoes.push(["Em atendimento agora", contarSenhas(s => s.status === "chamando")]);
  }
  document.getElementById("numeros").innerHTML = cartoes.map(([r, v]) =>
    `<div class="numero"><strong>${esc(v)}</strong><span>${esc(r)}</span></div>`).join("");

  // por fila
  const nomeFila = k => (filas.find(f => f.key === k) || {}).nome || k || "—";
  const porFila = {};
  doDia.forEach(h => {
    const k = h.atendimento || "—";
    porFila[k] = porFila[k] || { at: [], canc: 0 };
    if (h.motivo === "cancelada") porFila[k].canc++; else porFila[k].at.push(h);
  });
  document.getElementById("tabFilas").innerHTML = Object.keys(porFila).length
    ? `<tr><th>Fila</th><th>Atendidos</th><th>Cancelados</th><th>Espera média</th></tr>` +
      Object.entries(porFila).sort((a, b) => b[1].at.length - a[1].at.length).map(([k, v]) =>
        `<tr><td>${esc(nomeFila(k))}</td><td>${v.at.length}</td><td>${v.canc}</td><td>${minutos(media(v.at.map(espera)))}</td></tr>`).join("")
    : `<tr><td class="vazio">Sem atendimentos neste dia.</td></tr>`;

  // por guichê
  const porGuiche = {};
  finalizadas.forEach(h => {
    const g = h.guiche || "—";
    (porGuiche[g] = porGuiche[g] || []).push(h);
  });
  document.getElementById("tabGuiches").innerHTML = Object.keys(porGuiche).length
    ? `<tr><th>Guichê</th><th>Atendidos</th><th>Atendimento médio</th></tr>` +
      Object.entries(porGuiche).sort((a, b) => b[1].length - a[1].length).map(([g, lista]) =>
        `<tr><td>${esc(g)}</td><td>${lista.length}</td><td>${minutos(media(lista.map(atendimento)))}</td></tr>`).join("")
    : `<tr><td class="vazio">Sem atendimentos neste dia.</td></tr>`;
}

/* ================= LIMPAR FILA ================= */
const limparFila = document.getElementById("limparFila");
const limparTipo = document.getElementById("limparTipo");
const previaLimpar = document.getElementById("previaLimpar");

function montarSelectLimpar() {
  const atual = limparFila.value;
  limparFila.innerHTML = `<option value="*">Todas as filas</option>` +
    filas.map(f => `<option value="${esc(f.key)}">${esc(f.nome)}${f.ativo ? "" : " (desativada)"}</option>`).join("");
  if ([...limparFila.options].some(o => o.value === atual)) limparFila.value = atual;
  atualizarPreviaLimpar();
}

function senhasParaLimpar() {
  const fila = limparFila.value || "*";
  const tipo = limparTipo.value;
  return Object.entries(senhas).filter(([, s]) => {
    if (fila !== "*" && s.atendimento !== fila) return false;
    if (tipo === "aguardando") return s.status === "aguardando";
    if (tipo === "chamando") return s.status === "chamando";
    return true; // ambos: tudo que está na fila, inclusive registros quebrados
  });
}

function atualizarPreviaLimpar() {
  const n = senhasParaLimpar().length;
  previaLimpar.textContent = n ? `${n} senha(s) serão apagadas.` : "Nenhuma senha para apagar com essa escolha.";
  document.getElementById("btnLimpar").disabled = !n;
}

limparFila.onchange = atualizarPreviaLimpar;
limparTipo.onchange = atualizarPreviaLimpar;

document.getElementById("btnLimpar").onclick = () => {
  const lista = senhasParaLimpar();
  if (!lista.length) return;
  const nomeFila = limparFila.value === "*" ? "todas as filas" : `a fila "${limparFila.options[limparFila.selectedIndex].text}"`;
  const tipo = limparTipo.options[limparTipo.selectedIndex].text.toLowerCase();
  if (!confirm(`Apagar ${lista.length} senha(s) de ${nomeFila} (${tipo})?\n\nIsso não pode ser desfeito.`)) return;

  const updates = {};
  lista.forEach(([id]) => { updates[id] = null; });
  refSenhas.update(updates)
    .then(() => mostrarAviso(`${lista.length} senha(s) apagadas.`))
    .catch(erroFirebase);
};
