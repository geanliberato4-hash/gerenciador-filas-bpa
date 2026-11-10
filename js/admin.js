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
    renderizarAoVivo();
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
    renderizarAoVivo();
  });

  refHistorico.on("value", snap => {
    historico = [];
    snap.forEach(c => { if (c.val()) historico.push(c.val()); });
    renderizarResumo();
  });

  montarDias();
  iniciarRecado();
  iniciarTesteTv();
  iniciarMidias();
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

  renderizarGraficoHoras();
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

/* =========================================================
   AGORA (ao vivo): quem está aguardando e em atendimento
   ========================================================= */
const aoVivoEl = document.getElementById("aoVivo");

function renderizarAoVivo() {
  if (!aoVivoEl) return;
  const agora = Date.now();
  const lista = Object.values(senhas).filter(s => s && (s.status === "aguardando" || s.status === "chamando"));
  const aguardando = lista.filter(s => s.status === "aguardando").length;
  const emAtend = lista.filter(s => s.status === "chamando").length;
  document.getElementById("aoVivoTotal").textContent = `${aguardando} aguardando • ${emAtend} em atendimento`;

  if (!lista.length) {
    aoVivoEl.innerHTML = `<p class="vazio">Ninguém na fila agora.</p>`;
    return;
  }

  const nomeFila = k => (filas.find(f => f.key === k) || {}).nome || k || "—";
  const grupos = {};
  lista.forEach(s => { (grupos[s.atendimento || "—"] = grupos[s.atendimento || "—"] || []).push(s); });
  const ordemFila = k => { const i = filas.findIndex(f => f.key === k); return i < 0 ? 999 : i; };

  aoVivoEl.innerHTML = Object.keys(grupos).sort((a, b) => ordemFila(a) - ordemFila(b)).map(k => {
    const itens = grupos[k].sort((a, b) => {
      if (a.status !== b.status) return a.status === "chamando" ? -1 : 1;
      return (a.criadoEm || 0) - (b.criadoEm || 0);
    });
    return `
      <div class="vivo-fila">
        <h3>${esc(nomeFila(k))} <span>${itens.length}</span></h3>
        ${itens.map(s => {
          const chamando = s.status === "chamando";
          const desde = chamando ? s.chamadoEm : s.criadoEm;
          const min = desde ? Math.max(0, Math.floor((agora - desde) / 60000)) : null;
          const cor = chamando ? (min >= 5 ? "alerta" : "chamando") : (min >= 10 ? "alerta" : min >= 5 ? "atencao" : "");
          return `
            <div class="vivo-item ${cor}">
              <b>${esc(s.placa || "—")}</b>
              <span class="vivo-nome">${esc(s.nome || "")}</span>
              <span class="vivo-estado">${chamando ? `📢 ${esc(s.guiche || "Guichê")}` : "⏳ aguardando"}</span>
              <span class="vivo-tempo">${min == null ? "" : min + " min"}</span>
            </div>`;
        }).join("")}
      </div>`;
  }).join("");
}
setInterval(renderizarAoVivo, 30000);

/* =========================================================
   SENHAS POR HORA (horário de pico) — usa o dia do resumo
   ========================================================= */
function renderizarGraficoHoras() {
  const el = document.getElementById("graficoHoras");
  if (!el || !diaResumo.value) return;
  const inicio = Number(diaResumo.value);
  const fim = inicio + 24 * 60 * 60 * 1000;

  const porHora = new Array(24).fill(0);
  const contar = t => { if (t >= inicio && t < fim) porHora[new Date(t).getHours()]++; };
  historico.forEach(h => contar(Number(h.criadoEm)));
  Object.values(senhas).forEach(s => contar(Number(s.criadoEm)));

  const total = porHora.reduce((a, b) => a + b, 0);
  const picoTexto = document.getElementById("picoTexto");
  if (!total) {
    el.innerHTML = `<p class="vazio">Nenhuma senha neste dia.</p>`;
    picoTexto.textContent = "";
    return;
  }

  let primeira = porHora.findIndex(n => n > 0);
  let ultima = 23 - [...porHora].reverse().findIndex(n => n > 0);
  primeira = Math.min(primeira, 6);
  ultima = Math.max(ultima, 18);
  const max = Math.max(...porHora);
  const horaPico = porHora.indexOf(max);
  picoTexto.textContent = `• pico às ${String(horaPico).padStart(2, "0")}h (${max} senha${max > 1 ? "s" : ""})`;

  const barras = [];
  for (let h = primeira; h <= ultima; h++) {
    const n = porHora[h];
    const alt = n ? Math.max(6, Math.round((n / max) * 100)) : 0;
    barras.push(`
      <div class="barra-hora ${n === max ? "pico" : ""}" title="${String(h).padStart(2, "0")}h: ${n} senha(s)">
        <span class="qtd">${n || ""}</span>
        <div class="barra"><div style="height:${alt}%"></div></div>
        <span class="hora">${String(h).padStart(2, "0")}h</span>
      </div>`);
  }
  el.innerHTML = barras.join("");
}

/* =========================================================
   RECADO NAS TELAS
   ========================================================= */
const refConfig = db.ref(`${base}/config`);
const textoRecado = document.getElementById("textoRecado");
const statusRecado = document.getElementById("statusRecado");

function iniciarRecado() {
  refConfig.child("recado").on("value", snap => {
    const r = snap.val() || {};
    if (document.activeElement !== textoRecado) textoRecado.value = r.texto || "";
    const ativo = !!r.ativo && !!String(r.texto || "").trim();
    statusRecado.innerHTML = ativo
      ? `<span class="tag-on">● No ar</span> aparecendo no totem e na TV.`
      : `<span class="tag-off">○ Desligado</span> nenhum recado nas telas.`;
    document.getElementById("btnTirarRecado").disabled = !ativo;
  }, erroFirebase);
}

document.getElementById("btnMostrarRecado").onclick = () => {
  const texto = textoRecado.value.trim().replace(/\s+/g, " ");
  if (!texto) { mostrarAviso("Escreva o recado primeiro.", "erro"); textoRecado.focus(); return; }
  refConfig.child("recado").set({ texto, ativo: true, em: firebase.database.ServerValue.TIMESTAMP })
    .then(() => mostrarAviso("Recado no ar no totem e na TV."))
    .catch(erroFirebase);
};

document.getElementById("btnTirarRecado").onclick = () => {
  refConfig.child("recado/ativo").set(false)
    .then(() => mostrarAviso("Recado retirado das telas."))
    .catch(erroFirebase);
};

/* =========================================================
   TESTAR TV
   ========================================================= */
const statusTesteTv = document.getElementById("statusTesteTv");
let ultimaRespostaTv = undefined;   // valor de testeTvOk antes do pedido
let aguardandoTv = null;            // timeout enquanto espera a TV

function iniciarTesteTv() {
  refConfig.child("testeTvOk").on("value", snap => {
    const r = snap.val();
    const marca = r ? r.em : null;
    if (ultimaRespostaTv === undefined) { ultimaRespostaTv = marca; return; }
    if (!aguardandoTv || !r || marca === ultimaRespostaTv) return;
    clearTimeout(aguardandoTv);
    aguardandoTv = null;
    ultimaRespostaTv = marca;
    document.getElementById("btnTestarTv").disabled = false;
    const hora = new Date(r.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    statusTesteTv.innerHTML = r.som
      ? `<span class="tag-on">✓ A TV respondeu</span> às ${hora}, com o som ligado.`
      : `<span class="tag-alerta">⚠ A TV respondeu, mas o som está bloqueado.</span> Toque na tela da TV uma vez (ou abra pelo atalho "abrir-tela-chamada").`;
  });
}

document.getElementById("btnTestarTv").onclick = () => {
  const btn = document.getElementById("btnTestarTv");
  btn.disabled = true;
  statusTesteTv.textContent = "Pedido enviado… aguardando a TV responder.";
  clearTimeout(aguardandoTv);
  aguardandoTv = setTimeout(() => {
    aguardandoTv = null;
    btn.disabled = false;
    statusTesteTv.innerHTML = `<span class="tag-alerta">✗ A TV não respondeu.</span> Confira se ela está ligada, com internet e com a tela de chamada aberta.`;
  }, 45000);
  refConfig.child("testeTv").set(firebase.database.ServerValue.TIMESTAMP).catch(err => {
    clearTimeout(aguardandoTv);
    aguardandoTv = null;
    btn.disabled = false;
    statusTesteTv.textContent = "";
    erroFirebase(err);
  });
};

/* =========================================================
   IMAGENS E VÍDEO DAS TELAS
   ========================================================= */
const TELAS_MIDIA = [
  { tela: "totem",  nome: "Totem dos motoristas", desc: "Escolha da fila e tela de nome e placa", tipo: "imagem" },
  { tela: "painel", nome: "Painel do atendente",  desc: "Tela dos guichês", tipo: "imagem" },
  { tela: "admin",  nome: "Administração",        desc: "Esta área e a tela de login", tipo: "imagem" },
  { tela: "tv",     nome: "TV (tela de chamada)", desc: "Vídeo de fundo, sem som, repetindo", tipo: "video" }
];
const VIDEO_MAX_MB = 20;
const PARTE_BYTES = 384 * 1024;     // cada pedaço vira ~512 KB de texto no Firebase
const midiasEl = document.getElementById("midias");
const refMidia = db.ref(`${base}/midia`);
const refMidiaDados = db.ref(`${base}/midiaDados`);
let midiaMeta = {};
const previaCache = {};             // tela -> { versao, url }
const enviando = {};                // tela -> texto de progresso

function tamanhoTexto(bytes) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function renderizarMidias() {
  midiasEl.innerHTML = TELAS_MIDIA.map(t => {
    const m = midiaMeta[t.tela];
    const personalizada = !!(m && m.versao);
    const quando = personalizada && m.em ? new Date(m.em).toLocaleDateString("pt-BR") : "";
    let previa;
    if (t.tipo === "video") {
      previa = personalizada
        ? `<div class="previa-midia previa-video">🎬<small>${esc(m.nome || "vídeo")}<br>${tamanhoTexto(m.tamanho)}</small></div>`
        : `<video class="previa-midia" src="video/fundo.mp4" muted loop autoplay playsinline></video>`;
    } else {
      const url = personalizada ? (previaCache[t.tela] && previaCache[t.tela].versao === m.versao ? previaCache[t.tela].url : "") : "img/fundo.jpg";
      previa = url
        ? `<div class="previa-midia" style="background-image:url('${url}')"></div>`
        : `<div class="previa-midia previa-carregando">carregando…</div>`;
    }
    const progresso = enviando[t.tela];
    return `
      <div class="midia" data-tela="${t.tela}">
        ${previa}
        <div class="midia-info">
          <strong>${esc(t.nome)}</strong>
          <small>${esc(t.desc)}</small>
          <span class="midia-estado">${personalizada
            ? `<span class="tag-on">● Personalizada</span> desde ${esc(quando)}`
            : `<span class="tag-off">○ Original</span>`}</span>
          ${progresso ? `<span class="midia-progresso">${esc(progresso)}</span>` : ""}
          <div class="linha-botoes">
            <label class="btn-pri ${progresso ? "desativado" : ""}">
              ${t.tipo === "video" ? "Trocar vídeo" : "Trocar imagem"}
              <input type="file" accept="${t.tipo === "video" ? "video/mp4,video/webm" : "image/*"}" data-tela="${t.tela}" hidden ${progresso ? "disabled" : ""}>
            </label>
            <button class="btn-sec" type="button" data-voltar="${t.tela}" ${personalizada && !progresso ? "" : "disabled"}>Voltar ao original</button>
          </div>
        </div>
      </div>`;
  }).join("");

  // carrega a miniatura das imagens personalizadas (uma vez por versão)
  TELAS_MIDIA.filter(t => t.tipo === "imagem").forEach(t => {
    const m = midiaMeta[t.tela];
    if (!m || !m.versao) return;
    if (previaCache[t.tela] && previaCache[t.tela].versao === m.versao) return;
    previaCache[t.tela] = { versao: m.versao, url: "" };
    baixarMidia(t.tela, m).then(blob => {
      if (!blob) return;
      previaCache[t.tela] = { versao: m.versao, url: URL.createObjectURL(blob) };
      renderizarMidias();
    });
  });
}

async function baixarMidia(tela, meta) {
  const d = (await refMidiaDados.child(tela).once("value")).val();
  if (!d || d.versao !== meta.versao || !d.partes) return null;
  const partes = Object.keys(d.partes).sort((a, b) => a - b).map(k => d.partes[k]);
  return new Blob(partes.map(b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0))), { type: meta.tipo });
}

function paraBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// imagem: diminui para no máximo 1920 px e salva em JPEG (fica leve para todos os aparelhos)
function prepararImagem(arquivo) {
  return new Promise((ok, erro) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * escala), h = Math.round(img.naturalHeight * escala);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const tentar = q => canvas.toBlob(b => {
        if (!b) return erro(new Error("imagem"));
        if (b.size > 900 * 1024 && q > 0.55) return tentar(q - 0.1);
        ok(b);
      }, "image/jpeg", q);
      tentar(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error("imagem")); };
    img.src = url;
  });
}

async function enviarMidia(tela, arquivo) {
  const cfg = TELAS_MIDIA.find(t => t.tela === tela);
  let blob, tipo;
  if (cfg.tipo === "video") {
    if (!/^video\/(mp4|webm)$/.test(arquivo.type)) {
      mostrarAviso("Use um vídeo MP4 (ou WebM).", "erro");
      return;
    }
    if (arquivo.size > VIDEO_MAX_MB * 1024 * 1024) {
      mostrarAviso(`O vídeo tem ${tamanhoTexto(arquivo.size)}. O máximo é ${VIDEO_MAX_MB} MB.`, "erro");
      return;
    }
    blob = arquivo; tipo = arquivo.type;
  } else {
    if (!/^image\//.test(arquivo.type)) { mostrarAviso("Escolha um arquivo de imagem (JPG ou PNG).", "erro"); return; }
    enviando[tela] = "Preparando a imagem…"; renderizarMidias();
    try { blob = await prepararImagem(arquivo); } catch (e) {
      delete enviando[tela]; renderizarMidias();
      mostrarAviso("Não consegui abrir essa imagem. Tente outra (JPG ou PNG).", "erro");
      return;
    }
    tipo = "image/jpeg";
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const total = Math.ceil(bytes.length / PARTE_BYTES);
  const versao = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  try {
    enviando[tela] = "Enviando… 0%"; renderizarMidias();
    await refMidiaDados.child(tela).set({ versao, total, tipo });
    for (let i = 0; i < total; i++) {
      const parte = paraBase64(bytes.subarray(i * PARTE_BYTES, (i + 1) * PARTE_BYTES));
      await refMidiaDados.child(`${tela}/partes/${i}`).set(parte);
      enviando[tela] = `Enviando… ${Math.round(((i + 1) / total) * 100)}%`;
      renderizarMidias();
    }
    await refMidia.child(tela).set({
      versao, tipo,
      nome: String(arquivo.name || "").slice(0, 100),
      tamanho: bytes.length,
      em: firebase.database.ServerValue.TIMESTAMP
    });
    previaCache[tela] = { versao, url: cfg.tipo === "imagem" ? URL.createObjectURL(blob) : "" };
    delete enviando[tela];
    renderizarMidias();
    mostrarAviso(`${cfg.nome}: ${cfg.tipo === "video" ? "vídeo" : "imagem"} trocado(a). Os aparelhos atualizam sozinhos.`);
  } catch (err) {
    delete enviando[tela];
    renderizarMidias();
    erroFirebase(err);
  }
}

midiasEl.addEventListener("change", e => {
  const input = e.target.closest("input[type=file]");
  if (!input || !input.files || !input.files[0]) return;
  enviarMidia(input.dataset.tela, input.files[0]);
  input.value = "";
});

midiasEl.addEventListener("click", e => {
  const btn = e.target.closest("button[data-voltar]");
  if (!btn) return;
  const tela = btn.dataset.voltar;
  const cfg = TELAS_MIDIA.find(t => t.tela === tela);
  if (!confirm(`Voltar ${cfg.tipo === "video" ? "o vídeo" : "a imagem"} original em "${cfg.nome}"?`)) return;
  refMidia.child(tela).remove()
    .then(() => refMidiaDados.child(tela).remove())
    .then(() => mostrarAviso(`${cfg.nome}: voltou ao original.`))
    .catch(erroFirebase);
});

function iniciarMidias() {
  renderizarMidias();
  refMidia.on("value", snap => {
    midiaMeta = snap.val() || {};
    renderizarMidias();
  }, erroFirebase);
}
