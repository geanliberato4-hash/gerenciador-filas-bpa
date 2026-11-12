/* =========================================================
   ÍCONE E COR DE CADA FILA
   Escolhidos pelo nome da fila (sem precisar configurar nada).
   Usado no totem (botões) e no painel do atendente (colunas),
   para a mesma fila ter a mesma cara nas duas telas.
   ========================================================= */
(function () {
  const REGRAS = [
    { busca: /descarg/,              icone: "🚛", cor: "#f08c00" },
    { busca: /carreg/,               icone: "⛽", cor: "#0c8599" },
    { busca: /check|vistori|inspe/,  icone: "📋", cor: "#1c7ed6" },
    { busca: /balan|pesag/,          icone: "⚖️", cor: "#7048e8" },
    { busca: /pend|problem|ocorr/,   icone: "⚠️", cor: "#e03131" },
    { busca: /document|nota|fiscal/, icone: "📄", cor: "#5c7cfa" },
    { busca: /atend/,                icone: "💬", cor: "#2f9e44" }
  ];
  const RESERVA = ["#2f9e44", "#1c7ed6", "#f08c00", "#7048e8", "#0c8599", "#d6336c"];

  function semAcento(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  window.visualFila = function (nome, indice) {
    const n = semAcento(nome);
    const regra = REGRAS.find(r => r.busca.test(n));
    if (regra) return { icone: regra.icone, cor: regra.cor };
    return { icone: "🎫", cor: RESERVA[(indice || 0) % RESERVA.length] };
  };
})();
