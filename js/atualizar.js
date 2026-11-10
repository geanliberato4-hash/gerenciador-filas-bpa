/* =========================================================
   ATUALIZAÇÃO AUTOMÁTICA DAS TELAS
   A cada 3 minutos a tela confere se os arquivos do site
   mudaram (nova versão publicada). Se mudaram, ela recarrega
   sozinha — mas só num momento seguro:
   - ninguém mexendo na tela há pelo menos 30 segundos;
   - nenhum campo com texto sendo digitado;
   - TV: sem chamada sendo anunciada (e só se o som liga sozinho,
     senão ela ficaria muda até alguém tocar na tela);
   - Administração: sem envio de imagem/vídeo em andamento.
   Uso: <script src="js/atualizar.js" data-tela="totem|painel|tv|admin"></script>
   ========================================================= */
(function () {
  const script = document.currentScript;
  const TELA = (script && script.dataset.tela) || "";
  const INTERVALO = 3 * 60 * 1000;
  const PARADO_MS = 30 * 1000;

  let assinaturaInicial = null;
  let assinaturaNova = null;    // precisa aparecer 2 vezes seguidas (evita alarme falso)
  let ultimoToque = Date.now();
  let aguardandoMomento = false;

  ["click", "touchstart", "keydown", "input", "mousemove"].forEach(ev =>
    document.addEventListener(ev, () => { ultimoToque = Date.now(); }, { passive: true, capture: true })
  );

  // arquivos desta página: o próprio HTML + scripts e estilos do site
  function arquivos() {
    const lista = [location.pathname];
    document.querySelectorAll("script[src], link[rel=stylesheet][href]").forEach(el => {
      const url = new URL(el.getAttribute("src") || el.getAttribute("href"), location.href);
      if (url.origin === location.origin) lista.push(url.pathname);
    });
    return [...new Set(lista)];
  }

  async function assinatura() {
    const partes = await Promise.all(arquivos().map(async caminho => {
      try {
        const r = await fetch(`${caminho}?v=${Date.now()}`, { method: "HEAD", cache: "no-store" });
        if (!r.ok) return `${caminho}:x`;
        return `${caminho}:${r.headers.get("etag") || r.headers.get("last-modified") || r.headers.get("content-length") || ""}`;
      } catch (e) {
        return null; // sem internet: não decide nada agora
      }
    }));
    if (partes.some(p => p === null)) return null;
    return partes.join("|");
  }

  function momentoSeguro(forcado) {
    // pedido da Administração ("Atualizar todas as telas agora") não espera os 30 s parado
    if (!forcado && document.visibilityState === "visible" && Date.now() - ultimoToque < PARADO_MS) return false;

    // alguém digitando?
    const ativo = document.activeElement;
    if (ativo && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName) && ativo.value) return false;
    const comTexto = [...document.querySelectorAll("input[type=text], input:not([type]), textarea")].some(i => i.value.trim());
    if (TELA === "totem" && comTexto) return false;   // motorista no meio do nome/placa

    try {
      if (TELA === "tv") {
        if (typeof anunciando !== "undefined" && anunciando) return false;
        if (typeof somLiberadoSozinho !== "undefined" && !somLiberadoSozinho) return false;
      }
      if (TELA === "admin" && typeof enviando !== "undefined" && Object.keys(enviando).length) return false;
    } catch (e) {}
    return true;
  }

  function recarregarQuandoPuder(forcado) {
    if (aguardandoMomento) return;
    aguardandoMomento = true;
    const tentar = () => {
      if (!momentoSeguro(forcado)) { setTimeout(tentar, (forcado ? 2 : 10) * 1000); return; }
      if (forcado) { location.reload(); return; }
      // trava contra recarregar em sequência
      try {
        const ultima = Number(sessionStorage.getItem("autoAtualizadoEm") || 0);
        if (Date.now() - ultima < 5 * 60 * 1000) { setTimeout(tentar, 60 * 1000); return; }
        sessionStorage.setItem("autoAtualizadoEm", String(Date.now()));
      } catch (e) {}
      location.reload();
    };
    tentar();
  }

  async function verificar() {
    if (aguardandoMomento) return;
    const atual = await assinatura();
    if (!atual) return;
    if (assinaturaInicial === null) { assinaturaInicial = atual; return; }
    if (atual === assinaturaInicial) { assinaturaNova = null; return; }
    if (atual === assinaturaNova) { recarregarQuandoPuder(); return; }
    assinaturaNova = atual; // confirma na próxima verificação
    setTimeout(verificar, 60 * 1000);
  }

  // botão "Atualizar todas as telas agora" da Administração
  if (window.db && window.UNIDADE && TELA && TELA !== "admin") {
    let pedidoVisto = null;
    window.db.ref(`unidades/${window.UNIDADE}/config/recarregar`).on("value", snap => {
      const pedido = snap.val() || 0;
      if (pedidoVisto === null) { pedidoVisto = pedido; return; } // ignora pedidos antigos ao abrir
      if (pedido === pedidoVisto) return;
      pedidoVisto = pedido;
      recarregarQuandoPuder(true);
    }, () => {});
  }

  setTimeout(verificar, 20 * 1000);
  setInterval(verificar, INTERVALO);
  window.__verificarAtualizacao = verificar; // usado nos testes
})();
