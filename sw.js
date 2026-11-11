/* =========================================================
   SERVICE WORKER DO TOTEM
   Só existe para o tablet poder instalar o totem como app
   (tela cheia, sem barra de endereço). Não guarda nada em
   cache: tudo vem sempre do site, então as atualizações
   continuam chegando normalmente.
   ========================================================= */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request));
});
