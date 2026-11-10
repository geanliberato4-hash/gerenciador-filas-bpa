/* =========================================================
   RECADO NAS TELAS
   Faixa amarela com o aviso escrito pelo administrador
   (ex.: "Balança em manutenção até 14h"). Aparece no totem e
   na TV enquanto estiver ligado na Administração.
   Uso: <script src="js/recado.js" data-tela="totem|tv"></script>
   ========================================================= */
(function () {
  const script = document.currentScript;
  const TELA = (script && script.dataset.tela) || "totem";
  if (!window.db) return;

  const estilo = document.createElement("style");
  estilo.textContent = `
    .recado-faixa {
      position: fixed; left: 0; right: 0; top: 0; z-index: 50;
      display: none; align-items: center; justify-content: center; gap: 12px;
      padding: 12px 18px;
      background: #ffd400; color: #1a1a1a;
      font-family: 'Poppins', Arial, sans-serif; font-weight: 700;
      font-size: 18px; line-height: 1.3; text-align: center;
      box-shadow: 0 6px 24px rgba(0,0,0,.45);
      word-break: break-word;
    }
    .recado-faixa.ativa { display: flex; }
    .recado-faixa .icone { font-size: 1.2em; }
    .recado-tv.recado-faixa {
      right: 14vw; border-bottom-right-radius: 18px;
      padding: 1.8vh 3vw; font-size: 3.4vh;
    }
    body.com-recado-totem .container { padding-top: 90px; }
  `;
  document.head.appendChild(estilo);

  const faixa = document.createElement("div");
  faixa.className = "recado-faixa" + (TELA === "tv" ? " recado-tv" : "");
  faixa.setAttribute("role", "status");
  faixa.innerHTML = `<span class="icone">⚠️</span><span class="texto"></span>`;
  document.body.appendChild(faixa);

  window.db.ref(`unidades/${window.UNIDADE}/config/recado`).on("value", snap => {
    const r = snap.val() || {};
    const texto = String(r.texto || "").trim();
    const ativo = !!r.ativo && !!texto;
    faixa.querySelector(".texto").textContent = texto;
    faixa.classList.toggle("ativa", ativo);
    if (TELA !== "tv") document.body.classList.toggle("com-recado-totem", ativo);
  });
})();
