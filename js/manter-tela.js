/* =========================================================
   MANTER A TELA LIGADA
   Impede que o tablet do totem (e a TV) apague a tela
   sozinho enquanto o site estiver aberto.
   1) Usa o "Wake Lock" do navegador (Chrome/Edge/Android,
      Safari a partir do iOS 16.4).
   2) Em navegadores antigos, toca um vídeo preto, mudo e
      minúsculo em loop, o que também impede a tela de apagar.
   ========================================================= */
(function () {
  // vídeo preto de 2 s (16x16, mudo) embutido, para não depender de outro arquivo
  const VIDEO_PRETO = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMvbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAB9AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAll0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAfQAAAAAAABAAAAAAHRbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAgABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABfG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAATxzdGJsAAAAvHN0c2QAAAAAAAAAAQAAAKxhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAMmF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAAg8SJZYAQAEaO+Py/34+AAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAALSAAAC0gAAAAYc3R0cwAAAAAAAAABAAAAAgAAQAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAgAAAAEAAAAcc3RzegAAAAAAAAAAAAAAAgAAAsYAAAAMAAAAFHN0Y28AAAAAAAAAAQAAA18AAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjE2LjEwMAAAAAhmcmVlAAAC2m1kYXQAAAKsBgX//6jcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MSBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT0yIHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTAgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0wIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PTAgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0xIGtleWludD0yNTAga2V5aW50X21pbj0xIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9MTAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAEmWIhAAW/+x/wlV/0QKRHm1/8QAAAAhBmiEYgr/+8A==";

  let bloqueio = null;
  let videoReserva = null;

  function usarVideoReserva() {
    if (videoReserva) { videoReserva.play().catch(() => {}); return; }
    videoReserva = document.createElement("video");
    videoReserva.src = VIDEO_PRETO;
    videoReserva.muted = true;
    videoReserva.loop = true;
    videoReserva.playsInline = true;
    videoReserva.setAttribute("playsinline", "");
    videoReserva.setAttribute("aria-hidden", "true");
    videoReserva.style.cssText = "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;bottom:0;left:0;";
    document.body.appendChild(videoReserva);
    videoReserva.play().catch(() => {});
  }

  async function manterLigada() {
    if (document.visibilityState !== "visible") return;
    if ("wakeLock" in navigator) {
      if (bloqueio && !bloqueio.released) return;
      try {
        bloqueio = await navigator.wakeLock.request("screen");
        bloqueio.addEventListener("release", () => { bloqueio = null; });
        return;
      } catch (e) {
        // recusado (ex.: modo economia de bateria): tenta o vídeo
      }
    }
    usarVideoReserva();
  }

  // ao abrir, ao voltar para a tela, a cada toque e a cada minuto
  manterLigada();
  document.addEventListener("visibilitychange", manterLigada);
  ["click", "touchstart", "keydown"].forEach(ev =>
    document.addEventListener(ev, manterLigada, { passive: true })
  );
  setInterval(manterLigada, 60 * 1000);

  window.__telaLigada = () => !!(bloqueio && !bloqueio.released) || !!(videoReserva && !videoReserva.paused);
})();
