/* =========================================================
   TOTEM COMO APP
   - registra o service worker (permite "instalar" no tablet);
   - se estiver aberto no navegador comum (não instalado),
     entra em tela cheia no primeiro toque;
   - bloqueia o menu de toque longo e a seleção de texto,
     para o motorista não abrir opções do navegador;
   - tela de dados: se ninguém tocar por 120 s, apaga o que foi
     digitado e volta para "Selecione o atendimento";
   - mostra um aviso grande quando o tablet fica sem internet;
   - campo da placa sem corretor automático e em maiúsculas.
   ========================================================= */
(function () {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  const instalado = window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (!instalado) {
    const telaCheia = () => {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    };
    ["click", "touchend"].forEach(ev => document.addEventListener(ev, telaCheia, { passive: true }));
  }

  document.addEventListener("contextmenu", e => {
    if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault();
  });
  const estilo = document.createElement("style");
  estilo.textContent = "body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}input,textarea{-webkit-user-select:text;user-select:text}";
  document.head.appendChild(estilo);

  /* ---------- placa: sem corretor, sempre maiúscula ---------- */
  function ajustarCampos() {
    const placa = document.getElementById("placa");
    if (placa) {
      placa.setAttribute("autocapitalize", "characters");
      placa.setAttribute("autocorrect", "off");
      placa.setAttribute("autocomplete", "off");
      placa.setAttribute("spellcheck", "false");
      placa.style.textTransform = "uppercase";
    }
    const nome = document.getElementById("nome");
    if (nome) {
      nome.setAttribute("autocorrect", "off");
      nome.setAttribute("autocomplete", "off");
      nome.setAttribute("spellcheck", "false");
    }
  }

  /* ---------- volta sozinho para o início (tela de dados) ---------- */
  const LIMITE_PARADO = 120 * 1000;   // 120 segundos sem tocar
  const AVISO_ANTES = 15 * 1000;      // avisa nos últimos 15 segundos
  let ultimoToque = Date.now();
  let faixaVolta = null;

  function voltarAoInicio() {
    document.querySelectorAll("input").forEach(i => { i.value = ""; });
    try {
      localStorage.removeItem("atendimentoKey");
      localStorage.removeItem("atendimentoNome");
    } catch (e) {}
    location.replace("senha.html");
  }

  function vigiarParado() {
    if (!document.getElementById("formSenha")) return; // só na tela de nome/placa
    ["click", "touchstart", "keydown", "input"].forEach(ev =>
      document.addEventListener(ev, () => {
        ultimoToque = Date.now();
        if (faixaVolta) faixaVolta.classList.remove("visivel");
      }, { passive: true, capture: true })
    );
    faixaVolta = document.createElement("div");
    faixaVolta.className = "totem-faixa-volta";
    document.body.appendChild(faixaVolta);

    setInterval(() => {
      const confirmado = document.getElementById("cardOk") &&
        !document.getElementById("cardOk").classList.contains("oculto");
      const gerando = document.getElementById("btnGerar") && document.getElementById("btnGerar").disabled;
      if (confirmado || gerando) { ultimoToque = Date.now(); return; }

      const parado = Date.now() - ultimoToque;
      if (parado >= LIMITE_PARADO) { voltarAoInicio(); return; }
      if (parado >= LIMITE_PARADO - AVISO_ANTES) {
        const falta = Math.ceil((LIMITE_PARADO - parado) / 1000);
        faixaVolta.textContent = `Voltando ao início em ${falta} s • toque na tela para continuar`;
        faixaVolta.classList.add("visivel");
      }
    }, 1000);
  }

  /* ---------- aviso de "sem internet" ---------- */
  let avisoRede = null;
  let timerQueda = null;
  let conectado = true;

  function mostrarSemRede(mostrar) {
    if (!avisoRede) {
      avisoRede = document.createElement("div");
      avisoRede.className = "totem-sem-rede";
      avisoRede.innerHTML = '<div><div class="totem-sem-rede-icone">📡</div>' +
        "<strong>Totem sem conexão com a internet</strong>" +
        "<span>Procure o atendimento.<br>Tentando reconectar…</span></div>";
      document.body.appendChild(avisoRede);
    }
    avisoRede.classList.toggle("visivel", mostrar);
  }

  // espera 8 s antes de avisar: quedas rápidas não assustam o motorista
  function mudouConexao(online) {
    conectado = online;
    clearTimeout(timerQueda);
    if (online) { mostrarSemRede(false); return; }
    timerQueda = setTimeout(() => { if (!conectado) mostrarSemRede(true); }, 8000);
  }

  function vigiarRede() {
    window.addEventListener("offline", () => mudouConexao(false));
    window.addEventListener("online", () => mudouConexao(navigator.onLine));
    if (window.db) {
      let primeira = true;
      window.db.ref(".info/connected").on("value", snap => {
        const ok = snap.val() === true;
        // ao abrir a tela o Firebase começa "desconectado" por um instante: ignora
        if (primeira && !ok) { primeira = false; timerQueda = setTimeout(() => mudouConexao(false), 4000); return; }
        primeira = false;
        mudouConexao(ok);
      });
    } else if (!navigator.onLine) {
      mudouConexao(false);
    }
  }

  const estiloExtra = document.createElement("style");
  estiloExtra.textContent = `
    .totem-faixa-volta {
      position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 30px);
      opacity: 0; visibility: hidden;
      max-width: calc(100% - 32px); padding: 14px 22px; border-radius: 14px;
      background: #f5c400; color: #1a1a1a; font-weight: 600; font-size: 1.05rem;
      text-align: center; box-shadow: 0 8px 24px rgba(0,0,0,.4);
      transition: transform .3s ease, opacity .3s ease, visibility .3s;
      z-index: 9998; pointer-events: none;
    }
    .totem-faixa-volta.visivel { transform: translate(-50%, 0); opacity: 1; visibility: visible; }
    .totem-sem-rede {
      position: fixed; inset: 0; z-index: 9999; display: none;
      align-items: center; justify-content: center; padding: 24px;
      background: rgba(120, 0, 0, .92); color: #fff; text-align: center;
    }
    .totem-sem-rede.visivel { display: flex; }
    .totem-sem-rede strong { display: block; font-size: 1.7rem; margin: 12px 0 10px; }
    .totem-sem-rede span { font-size: 1.15rem; opacity: .9; }
    .totem-sem-rede-icone { font-size: 4rem; animation: totemPisca 1.6s ease-in-out infinite; }
    @keyframes totemPisca { 50% { opacity: .35; } }`;
  document.head.appendChild(estiloExtra);

  function iniciar() { ajustarCampos(); vigiarParado(); vigiarRede(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
