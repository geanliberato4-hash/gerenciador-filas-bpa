/* =========================================================
   IMAGEM / VÍDEO DE FUNDO PERSONALIZADO
   Uso: <script src="js/midia.js" data-tela="totem"></script>
   Telas: totem, painel, admin (imagem) e tv (vídeo).

   O administrador envia o arquivo pela Administração. Ele fica
   no Firebase em pedaços (midiaDados) e cada aparelho baixa
   UMA vez e guarda no próprio navegador (IndexedDB). Nas
   próximas aberturas só confere a "versão" (poucos bytes).
   Sem arquivo personalizado = imagem/vídeo original do site.
   ========================================================= */
(function () {
  const script = document.currentScript;
  const TELA = script && script.dataset.tela;
  if (!TELA || !window.db) return;

  const BASE = `unidades/${window.UNIDADE}`;

  // enquanto carrega a imagem personalizada, esconde a original (não pisca)
  const estilo = document.createElement("style");
  estilo.textContent = ".midia-carregando .background, html.midia-carregando body { background-image: none !important; }";
  document.head.appendChild(estilo);
  const CHAVE_LOCAL = `midia_${TELA}`;
  let urlAtual = null;

  /* ---------- guarda no navegador (IndexedDB) ---------- */
  function abrirBanco() {
    return new Promise((ok, erro) => {
      try {
        const req = indexedDB.open("filas-midia", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("arquivos");
        req.onsuccess = () => ok(req.result);
        req.onerror = () => erro(req.error);
      } catch (e) { erro(e); }
    });
  }
  async function lerCache() {
    try {
      const banco = await abrirBanco();
      return await new Promise(ok => {
        const r = banco.transaction("arquivos").objectStore("arquivos").get(TELA);
        r.onsuccess = () => ok(r.result || null);
        r.onerror = () => ok(null);
      });
    } catch (e) { return null; }
  }
  async function gravarCache(valor) {
    try {
      const banco = await abrirBanco();
      const tx = banco.transaction("arquivos", "readwrite");
      if (valor) tx.objectStore("arquivos").put(valor, TELA);
      else tx.objectStore("arquivos").delete(TELA);
    } catch (e) {}
  }
  function lembrar(versao) {
    try { versao ? localStorage.setItem(CHAVE_LOCAL, versao) : localStorage.removeItem(CHAVE_LOCAL); } catch (e) {}
  }

  /* ---------- aplica na tela ---------- */
  function trocarUrl(blob) {
    const nova = blob ? URL.createObjectURL(blob) : null;
    if (urlAtual) setTimeout(u => URL.revokeObjectURL(u), 5000, urlAtual);
    urlAtual = nova;
    return nova;
  }

  function aplicarImagem(url) {
    const valor = url ? `url("${url}")` : "";
    const fundo = document.querySelector(".background");
    // no painel e na administração o fundo fica no <body> (o .background herda);
    // no totem fica direto no .background
    document.body.style.backgroundImage = (TELA === "painel" || TELA === "admin") ? valor : "";
    if (fundo) fundo.style.backgroundImage = valor;
    document.documentElement.classList.remove("midia-carregando");
  }

  function aplicarVideo(url) {
    const video = document.querySelector("video");
    if (!video) return;
    if (!url && !video.getAttribute("src")) return; // já está no vídeo original
    const src = url || "video/fundo.mp4";
    if (video.getAttribute("src") === src) return;
    video.querySelectorAll("source").forEach(s => s.remove());
    video.setAttribute("src", src);
    video.muted = true;
    video.load();
    video.play().catch(() => {});
  }

  function aplicar(blob) {
    const url = trocarUrl(blob);
    if (TELA === "tv") aplicarVideo(url);
    else aplicarImagem(url);
  }

  /* ---------- baixa do Firebase ---------- */
  async function baixar(meta) {
    const snap = await window.db.ref(`${BASE}/midiaDados/${TELA}`).once("value");
    const d = snap.val();
    if (!d || d.versao !== meta.versao || !d.partes) return null;
    const partes = Object.keys(d.partes).sort((a, b) => a - b).map(k => d.partes[k]);
    if (partes.length !== d.total) return null;
    const bytes = partes.map(b64 => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    });
    return new Blob(bytes, { type: meta.tipo || "" });
  }

  // 1) abre rápido com o que já está guardado (evita piscar a imagem antiga)
  let versaoAplicada = null;
  let lembrada = null;
  try { lembrada = localStorage.getItem(CHAVE_LOCAL); } catch (e) {}
  if (lembrada) {
    if (TELA !== "tv") document.documentElement.classList.add("midia-carregando");
    lerCache().then(c => {
      if (c && c.versao === lembrada && versaoAplicada === null) {
        versaoAplicada = c.versao;
        aplicar(c.blob);
      }
    });
    // garantia: se nada carregar em 4 s, mostra a imagem original
    setTimeout(() => document.documentElement.classList.remove("midia-carregando"), 4000);
  }

  // 2) confere com o Firebase e acompanha mudanças em tempo real
  window.db.ref(`${BASE}/midia/${TELA}`).on("value", async snap => {
    const meta = snap.val();
    if (!meta || !meta.versao) {
      if (versaoAplicada !== "") { versaoAplicada = ""; aplicar(null); }
      lembrar(null);
      gravarCache(null);
      return;
    }
    if (meta.versao === versaoAplicada) return;

    let cache = await lerCache();
    if (!cache || cache.versao !== meta.versao) {
      try {
        const blob = await baixar(meta);
        if (!blob) return;
        cache = { versao: meta.versao, blob };
        gravarCache(cache);
      } catch (e) {
        console.error("midia:", e);
        document.documentElement.classList.remove("midia-carregando");
        return;
      }
    }
    versaoAplicada = meta.versao;
    lembrar(meta.versao);
    aplicar(cache.blob);
  }, () => document.documentElement.classList.remove("midia-carregando"));
})();
