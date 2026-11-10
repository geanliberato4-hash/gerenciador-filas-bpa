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
  estilo.textContent = `
    .midia-carregando .background, html.midia-carregando body { background-image: none !important; }
    .midia-frente {
      position: fixed; inset: 0; z-index: -2; pointer-events: none;
      background: center / contain no-repeat;
    }
    .midia-youtube {
      position: fixed; top: 50%; left: 50%; border: 0; pointer-events: none;
      width: max(100vw, 177.78vh); height: max(56.25vw, 100vh);
      transform: translate(-50%, -50%);
    }`;
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

  // A imagem personalizada aparece INTEIRA (sem cortar nem esticar), centralizada.
  // O espaço que sobra nas laterais é preenchido com a mesma imagem desfocada.
  function aplicarImagem(url) {
    const valor = url ? `url("${url}")` : "";
    const fundo = document.querySelector(".background");
    // no painel e na administração o fundo fica no <body> (o .background herda);
    // no totem fica direto no .background
    document.body.style.backgroundImage = (TELA === "painel" || TELA === "admin") ? valor : "";
    if (fundo) {
      fundo.style.backgroundImage = valor;
      fundo.style.backgroundSize = url ? "cover" : "";
      fundo.style.backgroundPosition = url ? "center" : "";
      fundo.style.filter = url ? "blur(18px)" : "";
      fundo.style.transform = url ? "scale(1.15)" : "";
    }
    let frente = document.querySelector(".midia-frente");
    if (url) {
      if (!frente) {
        frente = document.createElement("div");
        frente.className = "midia-frente";
        if (fundo) fundo.after(frente); else document.body.prepend(frente);
      }
      frente.style.backgroundImage = valor;
    } else if (frente) {
      frente.remove();
    }
    document.documentElement.classList.remove("midia-carregando");
  }

  // ---------- vídeo do YouTube na TV (repete, sem som) ----------
  function idYoutube(texto) {
    const m = String(texto || "").match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // O quadro do YouTube fica INVISÍVEL até o vídeo começar a tocar de verdade.
  // Assim, se o YouTube pedir login ("confirme que não é um robô"), bloquear
  // o vídeo ou der erro, isso nunca aparece na TV: ela continua no vídeo
  // normal e tenta o YouTube de novo mais tarde.
  let ytAtual = null, ytTimer = null, ytRetentar = null, ytOuvindo = null;

  function aplicarYoutube(id) {
    const video = document.querySelector("video");
    let quadro = document.querySelector(".midia-youtube");
    clearTimeout(ytTimer); clearTimeout(ytRetentar); clearInterval(ytOuvindo);
    ytAtual = id;
    if (!id) {
      if (quadro) quadro.remove();
      if (video) { video.style.display = ""; video.play().catch(() => {}); }
      return;
    }
    if (quadro) quadro.remove();
    if (video) { video.style.display = ""; video.play().catch(() => {}); }

    const origem = encodeURIComponent(location.origin);
    quadro = document.createElement("iframe");
    quadro.className = "midia-youtube";
    quadro.style.opacity = "0";
    quadro.setAttribute("allow", "autoplay; encrypted-media");
    quadro.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    quadro.setAttribute("tabindex", "-1");
    quadro.setAttribute("aria-hidden", "true");
    quadro.src = `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}` +
      "&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3" +
      `&enablejsapi=1&origin=${origem}`;
    if (video) video.before(quadro); else document.body.prepend(quadro);

    // pede ao player do YouTube para avisar quando começar a tocar
    const ouvir = () => {
      try { quadro.contentWindow.postMessage(JSON.stringify({ event: "listening", id: "tv", channel: "widget" }), "*"); } catch (e) {}
    };
    quadro.addEventListener("load", ouvir);
    ytOuvindo = setInterval(ouvir, 1000);

    // se em 2 min não estiver tocando (anúncio, login, bloqueio): desiste por enquanto e tenta de novo em 15 min
    ytTimer = setTimeout(() => {
      if (ytAtual !== id || quadro.style.opacity === "1") return;
      clearInterval(ytOuvindo);
      quadro.remove();
      ytRetentar = setTimeout(() => { if (ytAtual === id) aplicarYoutube(id); }, 15 * 60 * 1000);
    }, 120 * 1000);
  }

  window.addEventListener("message", e => {
    if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
    let dados;
    try { dados = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (err) { return; }
    const estado = dados && dados.info && dados.info.playerState;
    const quadro = document.querySelector(".midia-youtube");
    if (!quadro || e.source !== quadro.contentWindow) return;
    if (dados.event === "onError") {
      clearTimeout(ytTimer); clearInterval(ytOuvindo);
      quadro.remove();
      const id = ytAtual;
      ytRetentar = setTimeout(() => { if (ytAtual === id) aplicarYoutube(id); }, 15 * 60 * 1000);
      return;
    }
    if (estado === 1 && quadro.style.opacity !== "1") {   // 1 = tocando
      clearTimeout(ytTimer); clearInterval(ytOuvindo);
      quadro.style.opacity = "1";
      const video = document.querySelector("video");
      if (video) { video.pause(); video.style.display = "none"; }
    }
  });

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
    if (TELA === "tv") { aplicarYoutube(null); aplicarVideo(url); }
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

    // link do YouTube (só na TV): não baixa nada, o vídeo vem direto do YouTube
    if (meta.tipo === "video/youtube") {
      const id = idYoutube(meta.nome);
      if (TELA !== "tv" || !id) return;
      versaoAplicada = meta.versao;
      lembrar(null);
      gravarCache(null);
      trocarUrl(null);
      aplicarVideo(null);
      aplicarYoutube(id);
      return;
    }

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
