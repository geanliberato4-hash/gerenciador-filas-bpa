const chamadaBox = document.getElementById("chamada");
const cardEl = document.getElementById("card");
const nomeEl = document.getElementById("nome");
const placaEl = document.getElementById("placa");
const guicheEl = document.getElementById("guiche");
const ultimasEl = document.getElementById("ultimas");
const ativarSomEl = document.getElementById("ativarSom");
const relogioEl = document.getElementById("relogio");

let iniciado = false;
let timeoutOcultar = null;
let somAtivo = false;
let audioCtx = null;
const historicoTela = []; // últimas chamadas mostradas nesta TV

// ================= SOM (sempre ligado) =================
// Não existe opção de desligar o som nesta tela.
// O navegador só bloqueia o som se o computador não estiver configurado
// (ver abrir-tela-chamada.bat). Nesse caso aparece o aviso para liberar.

function liberarSom() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) { audioCtx = null; }

  // "desbloqueia" a voz do navegador com uma fala vazia
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch (e) {}

  verificarSom();
}

function verificarSom() {
  const liberado = !!audioCtx && audioCtx.state === "running";
  somAtivo = liberado;
  ativarSomEl.style.display = liberado ? "none" : "flex";
  return liberado;
}

// 1) tenta ligar sozinho ao abrir (funciona no Chrome configurado pelo atalho)
let houveToque = false;
let somLiberadoSozinho = false;
liberarSom();
setTimeout(() => {
  // som ligou sem ninguém tocar na tela = TV aberta pelo atalho
  if (verificarSom() && !houveToque) somLiberadoSozinho = true;
}, 800);
if (audioCtx) audioCtx.onstatechange = verificarSom;

// 2) se o navegador bloquear, qualquer toque, clique ou tecla libera
["click", "touchstart", "keydown"].forEach(ev =>
  document.addEventListener(ev, () => {
    houveToque = true;
    liberarSom();
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  })
);

// ================= RELÓGIO =================
function atualizarRelogio() {
  relogioEl.textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
atualizarRelogio();
setInterval(atualizarRelogio, 10000);

// ================= OUVIR SENHAS =================
// Cada chamada (ou rechamada) entra numa FILA DE ANÚNCIOS.
// A TV mostra e fala uma de cada vez, sem cortar a anterior,
// mesmo que dois guichês chamem ao mesmo tempo.
const anunciados = new Map(); // id -> chamadoEm já colocado na fila
const filaAnuncios = [];
let senhasAtuais = {};
let anunciando = false;

db.ref(`unidades/${UNIDADE}/senhas`)
  .on("value", snapshot => {
    senhasAtuais = {};
    const novas = [];

    snapshot.forEach(snap => {
      const s = snap.val();
      if (!s) return;
      senhasAtuais[snap.key] = s;
      if (s.status !== "chamando" || !s.chamadoEm) return;

      if (s.chamadoEm > (anunciados.get(snap.key) || 0)) {
        anunciados.set(snap.key, s.chamadoEm);
        // na primeira carga da página só registra (não anuncia chamadas antigas)
        if (iniciado) novas.push({ id: snap.key, chamadoEm: s.chamadoEm });
      }
    });

    iniciado = true;
    if (!novas.length) return;

    novas.sort((a, b) => a.chamadoEm - b.chamadoEm);
    novas.forEach(n => {
      // rechamada de quem já está esperando na fila de anúncios: não duplica
      if (!filaAnuncios.some(f => f.id === n.id)) filaAnuncios.push(n);
    });
    if (!anunciando) proximoAnuncio();
  });

function proximoAnuncio() {
  // pula senhas que foram encerradas/devolvidas antes da vez delas
  let item;
  while ((item = filaAnuncios.shift())) {
    if (item.teste) { item.dados = { teste: true, nome: "Teste", placa: "", guiche: "" }; break; }
    const s = senhasAtuais[item.id];
    if (s && s.status === "chamando") { item.dados = s; break; }
  }

  if (!item) {
    anunciando = false;
    return;
  }

  anunciando = true;
  const s = item.dados;
  const inicio = Date.now();

  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  mostrarChamada(s);
  tocarAviso();

  setTimeout(() => {
    falar(s, () => {
      if (s.teste) confirmarTeste();
      // cada chamada fica pelo menos 6 s na tela, com uma pausa antes da próxima
      const restante = Math.max(0, 6000 - (Date.now() - inicio));
      setTimeout(proximoAnuncio, restante + 1500);
    });
  }, 900);
}

// ================= TESTE DA TV (botão na Administração) =================
// O administrador pede um teste; a TV anuncia uma chamada de teste
// (sem motorista) e responde dizendo se o som está liberado.
let testeVisto = null;
db.ref(`unidades/${UNIDADE}/config/testeTv`).on("value", snap => {
  const pedido = snap.val();
  if (testeVisto === null) { testeVisto = pedido || 0; return; } // ignora pedidos antigos ao abrir
  if (!pedido || pedido === testeVisto) return;
  testeVisto = pedido;
  if (!filaAnuncios.some(f => f.teste)) filaAnuncios.push({ id: "__teste", teste: true });
  if (!anunciando) proximoAnuncio();
});

function confirmarTeste() {
  db.ref(`unidades/${UNIDADE}/config/testeTvOk`).set({
    em: firebase.database.ServerValue.TIMESTAMP,
    som: !!somAtivo
  }).catch(() => {});
}

// ================= UI =================
// Desenha a placa: Mercosul (faixa azul BRASIL) ou modelo antigo (cinza, ABC-1234)
function placaDesenhada(placa) {
  const p = String(placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const antiga = /^[A-Z]{3}[0-9]{4}$/.test(p);
  const el = document.createElement("span");
  el.className = "placa-br" + (antiga ? " antiga" : "");
  const faixa = document.createElement("span");
  faixa.className = "faixa";
  if (antiga) {
    faixa.textContent = "BRASIL";
  } else {
    const br = document.createElement("i");
    br.textContent = "BR";
    const pais = document.createElement("span");
    pais.textContent = "BRASIL";
    const bandeira = document.createElement("i");
    bandeira.textContent = "🇧🇷";
    faixa.append(br, pais, bandeira);
  }
  const letras = document.createElement("span");
  letras.className = "letras";
  letras.textContent = antiga ? `${p.slice(0, 3)}-${p.slice(3)}` : (p || String(placa || ""));
  el.append(faixa, letras);
  return el;
}

function mostrarChamada(s) {
  const tituloEl = document.getElementById("chamandoTitulo");
  if (s.teste) {
    if (tituloEl) tituloEl.textContent = "Teste";
    nomeEl.textContent = "🔊 Teste da TV";
    placaEl.textContent = "Se você está ouvindo, o som está funcionando";
    guicheEl.textContent = "Nenhum motorista foi chamado";
  } else {
    if (tituloEl) tituloEl.textContent = "Chamando";
    nomeEl.textContent = `Motorista ${s.nome}`;
    placaEl.replaceChildren(placaDesenhada(s.placa));
    guicheEl.textContent = `Dirigir-se ao ${s.guiche}`;
  }

  // reinicia a animação
  cardEl.style.animation = "none";
  void cardEl.offsetWidth;
  cardEl.style.animation = "";

  chamadaBox.style.display = "flex";
  document.body.classList.add("chamando");

  clearTimeout(timeoutOcultar);
  timeoutOcultar = setTimeout(() => {
    chamadaBox.style.display = "none";
    document.body.classList.remove("chamando");
  }, 30000);

  if (!s.teste) registrarUltima(s);
}

function registrarUltima(s) {
  // remove repetição (rechamada) e coloca no topo
  const i = historicoTela.findIndex(h => h.nome === s.nome && h.placa === s.placa);
  if (i >= 0) historicoTela.splice(i, 1);
  historicoTela.unshift({ nome: s.nome, placa: s.placa, guiche: s.guiche });
  historicoTela.length = Math.min(historicoTela.length, 4);

  ultimasEl.innerHTML = "";
  document.body.classList.toggle("tem-ultimas", historicoTela.length > 0);
  const titulo = document.createElement("h2");
  titulo.textContent = "Últimas chamadas";
  ultimasEl.appendChild(titulo);
  historicoTela.forEach(h => {
    const item = document.createElement("div");
    item.className = "item";
    item.appendChild(placaDesenhada(h.placa));
    item.appendChild(document.createTextNode(`${h.nome} • ${h.guiche}`));
    ultimasEl.appendChild(item);
  });
}

// ================= SOM DE AVISO =================
function tocarAviso() {
  if (!somAtivo || !audioCtx) return;
  try {
    const agora = audioCtx.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, agora + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.4, agora + i * 0.35 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, agora + i * 0.35 + 0.33);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(agora + i * 0.35);
      osc.stop(agora + i * 0.35 + 0.35);
    });
  } catch (e) {}
}

// ================= VOZ =================
// Ajustes escolhidos na Administração: voz, velocidade e repetir a chamada
let vozConfig = { nome: "", velocidade: 0.9, repetir: false };
db.ref(`unidades/${UNIDADE}/config/voz`).on("value", snap => {
  const v = snap.val() || {};
  vozConfig = {
    nome: String(v.nome || ""),
    velocidade: Math.min(1.4, Math.max(0.6, Number(v.velocidade) || 0.9)),
    repetir: !!v.repetir
  };
});

function escolherVoz() {
  const vozes = speechSynthesis.getVoices();
  return (vozConfig.nome && vozes.find(v => v.name === vozConfig.nome)) ||
    vozes.find(v => v.lang && v.lang.toLowerCase().startsWith("pt-br")) ||
    vozes.find(v => v.lang && v.lang.toLowerCase().startsWith("pt")) || null;
}

// a TV informa quais vozes em português ela tem (aparecem na Administração)
let vozesInformadas = "";
function informarVozes() {
  try {
    const lista = speechSynthesis.getVoices()
      .filter(v => v.lang && v.lang.toLowerCase().startsWith("pt"))
      .map(v => String(v.name).slice(0, 100))
      .slice(0, 30);
    const chave = JSON.stringify(lista);
    if (!lista.length || chave === vozesInformadas) return;
    vozesInformadas = chave;
    db.ref(`unidades/${UNIDADE}/config/vozesTv`).set({ lista, em: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
  } catch (e) {}
}
if ("speechSynthesis" in window) {
  speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", informarVozes);
  setTimeout(informarVozes, 2000);
  setInterval(informarVozes, 10 * 60 * 1000);
}

// Soletra a placa um caractere por vez, com pausa entre eles.
// Cada letra vai escrita como se fala ("bê", "cê", "agá"...) e cada número
// por extenso, senão a voz junta tudo ("ABC" vira palavra, "23" vira "vinte e três").
const NOMES_LETRAS = {
  A: "á", B: "bê", C: "cê", D: "dê", E: "é", F: "éfe", G: "gê", H: "agá", I: "í",
  J: "jota", K: "cá", L: "éle", M: "ême", N: "êne", O: "ó", P: "pê", Q: "quê",
  R: "érre", S: "ésse", T: "tê", U: "u", V: "vê", W: "dáblio", X: "xis",
  Y: "ípsilon", Z: "zê"
};
const NOMES_NUMEROS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];

function soletrarPlaca(placa) {
  return String(placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "").split("")
    .map(c => /[0-9]/.test(c) ? NOMES_NUMEROS[Number(c)] : (NOMES_LETRAS[c] || c))
    .join(", ");
}

function falar(s, aoTerminar) {
  let terminou = false;
  const fim = () => {
    if (terminou) return;
    terminou = true;
    if (aoTerminar) aoTerminar();
  };

  const placaFalada = soletrarPlaca(s.placa);
  const texto = s.teste
    ? "Teste de som da tela de chamada. Se você está ouvindo esta mensagem, está tudo funcionando."
    : `Motorista ${s.nome}. Placa: ${placaFalada}. Dirigir-se ao ${s.guiche}.`;
  const vezes = vozConfig.repetir ? 2 : 1;

  // garantia: se o navegador não avisar que terminou, segue mesmo assim
  const estimado = (3000 + texto.length * 110) / vozConfig.velocidade;
  setTimeout(fim, Math.min(45000, estimado * vezes + (vezes - 1) * 1200));

  if (!somAtivo || !("speechSynthesis" in window)) { setTimeout(fim, 4000); return; }

  const voz = escolherVoz();
  const dizer = restantes => {
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = (voz && voz.lang) || "pt-BR";
    fala.rate = vozConfig.velocidade;
    fala.pitch = 1;
    if (voz) fala.voice = voz;
    fala.onend = () => (restantes > 1 ? setTimeout(() => dizer(restantes - 1), 1200) : fim());
    fala.onerror = fim;
    speechSynthesis.speak(fala);
  };

  speechSynthesis.cancel();
  dizer(vezes);
}


// ================= ATUALIZAÇÃO DE MADRUGADA =================
// A TV recarrega sozinha uma vez por dia, às 3h, para pegar as
// atualizações do sistema. Só faz isso se o som liga sem toque
// (TV aberta pelo atalho); senão ficaria muda até alguém tocar.
setInterval(() => {
  const agora = new Date();
  if (agora.getHours() !== 3 || anunciando || !somLiberadoSozinho) return;
  const hoje = agora.toDateString();
  let ultima = null;
  try { ultima = sessionStorage.getItem("tvRecarregadaEm"); } catch (e) {}
  if (ultima === hoje) return;
  try { sessionStorage.setItem("tvRecarregadaEm", hoje); } catch (e) {}
  location.reload();
}, 60 * 1000);
