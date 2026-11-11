/* =========================================================
   TOTEM COMO APP
   - registra o service worker (permite "instalar" no tablet);
   - se estiver aberto no navegador comum (não instalado),
     entra em tela cheia no primeiro toque;
   - bloqueia o menu de toque longo e a seleção de texto,
     para o motorista não abrir opções do navegador.
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
})();
