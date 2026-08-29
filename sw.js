/* Service worker do Guia Stardew Valley.

   O guia é um arquivo só, então guardar tudo é barato: o index.html, o
   manifesto e os ícones. Depois da primeira visita ele abre sem rede.

   A estratégia é servir do cache e buscar a atualização em segundo plano.
   Assim o guia abre na hora, mesmo com sinal ruim no meio da partida, e a
   versão nova entra na próxima vez que você abrir. O contrário — esperar a
   rede a cada abertura — significaria baixar 737 KB antes de ver o dia de
   hoje, que é justamente o que este guia existe para evitar. */

const CACHE = 'guia-stardew-v1';
const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png',
  './icones/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ESSENCIAIS) })
      .then(function () { return self.skipWaiting() })
  );
});

/* joga fora cache de versão anterior, senão o aparelho acumula cópias velhas */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (chaves) {
        return Promise.all(chaves.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim() })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  /* navegar para qualquer endereço do guia devolve o index.html: é uma página só */
  const chave = e.request.mode === 'navigate' ? './index.html' : e.request;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(chave).then(function (guardada) {
        const daRede = fetch(e.request).then(function (resp) {
          if (resp && resp.ok && resp.type === 'basic') cache.put(chave, resp.clone());
          return resp;
        }).catch(function () { return null });

        /* tem no cache: entrega na hora e deixa a atualização correr atrás */
        if (guardada) return guardada;
        return daRede.then(function (r) {
          return r || new Response('Sem conexão e o guia ainda não foi guardado.',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        });
      });
    })
  );
});
