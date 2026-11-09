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
      // cada chamada fica pelo menos 6 s na tela, com uma pausa antes da próxima
      const restante = Math.max(0, 6000 - (Date.now() - inicio));
      setTimeout(proximoAnuncio, restante + 1500);
    });
  }, 900);
}

// ================= UI =================
function mostrarChamada(s) {
  nomeEl.textContent = `Motorista ${s.nome}`;
  placaEl.textContent = `Placa ${s.placa}`;
  guicheEl.textContent = `Dirigir-se ao ${s.guiche}`;

  // reinicia a animação
  cardEl.style.animation = "none";
  void cardEl.offsetWidth;
  cardEl.style.animation = "";

  chamadaBox.style.display = "flex";

  clearTimeout(timeoutOcultar);
  timeoutOcultar = setTimeout(() => {
    chamadaBox.style.display = "none";
  }, 30000);

  registrarUltima(s);
}

function registrarUltima(s) {
  // remove repetição (rechamada) e coloca no topo
  const i = historicoTela.findIndex(h => h.nome === s.nome && h.placa === s.placa);
  if (i >= 0) historicoTela.splice(i, 1);
  historicoTela.unshift({ nome: s.nome, placa: s.placa, guiche: s.guiche });
  historicoTela.length = Math.min(historicoTela.length, 4);

  ultimasEl.innerHTML = "";
  historicoTela.forEach(h => {
    const item = document.createElement("div");
    item.className = "item";
    const b = document.createElement("b");
    b.textContent = h.placa;
    item.appendChild(b);
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
function falar(s, aoTerminar) {
  let terminou = false;
  const fim = () => {
    if (terminou) return;
    terminou = true;
    if (aoTerminar) aoTerminar();
  };

  // soletra a placa para ficar mais claro (ex.: "A B C 1 D 2 3")
  const placaFalada = String(s.placa || "").split("").join(" ");
  const texto = `Motorista ${s.nome}, placa ${placaFalada}, dirigir-se ao ${s.guiche}`;

  // garantia: se o navegador não avisar que terminou, segue mesmo assim
  setTimeout(fim, Math.min(20000, 3000 + texto.length * 110));

  if (!somAtivo || !("speechSynthesis" in window)) { setTimeout(fim, 4000); return; }

  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = 0.9;
  fala.pitch = 1;
  fala.onend = fim;
  fala.onerror = fim;

  const vozBR = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("pt-br"));
  if (vozBR) fala.voice = vozBR;

  speechSynthesis.cancel();
  speechSynthesis.speak(fala);
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
