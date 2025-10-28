// service-worker.js

const CACHE_NAME = 'vademecum-cache-v2'; // v2 para forçar a atualização por causa da mudança de nome do arquivo
// Lista de arquivos para pre-cache (agora com a pasta 'data/' e 'index.html')
const preCacheFiles = [
    './', // Página principal (index.html)
    './index.html', // Alias para a página principal
    './data/DEL2848compilado.html', // Caminho atualizado
    './data/codigo-civil.html'      // Caminho atualizado
    // Adicione aqui outros arquivos da pasta 'data/' que queira no cache inicial
];

// Evento de Instalação (Install)
self.addEventListener('install', event => {
    console.log('[ServiceWorker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[ServiceWorker] Fazendo pré-cache dos arquivos da app');
            // Opcional: Adiciona arquivos de CDN ao cache
            // Note que isso pode falhar se o CORS não for permitido (modo 'no-cors')
            const cdnUrls = [
                'https://cdn.tailwindcss.com',
                'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
                'https://cdnjs.cloudflare.com/ajax/libs/mark.js/8.11.1/mark.min.js'
            ];
            
            // Adiciona os arquivos locais
            cache.addAll(preCacheFiles);

            // Tenta adicionar os arquivos de CDN (modo 'no-cors' não armazena o conteúdo, apenas a requisição/resposta opaca)
            cdnUrls.forEach(url => {
                cache.add(new Request(url, { mode: 'no-cors' }))
                    .catch(err => console.warn(`[ServiceWorker] Falha ao fazer cache de ${url}: `, err));
            });
        }).then(() => self.skipWaiting()) // Ativa o Service Worker imediatamente
    );
});

// Evento de Ativação (Activate)
self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Ativando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Apaga caches antigos se o nome mudou
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Torna-se o controlador da página imediatamente
    );
});

// Evento de Busca (Fetch) - Estratégia: Cache falling back to Network
self.addEventListener('fetch', event => {
    // Não interfere com requisições que não são GET (como POST)
    if (event.request.method !== 'GET') {
        return;
    }

    // Não interfere com requisições do Google (para os botões de IA) ou Planalto (brasão)
    if (event.request.url.includes('google.com') || event.request.url.includes('planalto.gov.br')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(response => {
                // 1. Encontrado no Cache
                if (response) {
                    // console.log(`[ServiceWorker] Servindo do cache: ${event.request.url}`);
                    return response;
                }

                // 2. Não encontrado no Cache (busca na rede)
                // console.log(`[ServiceWorker] Buscando na rede: ${event.request.url}`);
                return fetch(event.request).then(networkResponse => {
                    // Clona a resposta. Uma vai para o cache, a outra para o navegador.
                    const responseToCache = networkResponse.clone();
                    
                    // Adiciona a nova resposta ao cache
                    cache.put(event.request, responseToCache);
                    
                    // Retorna a resposta da rede
                    return networkResponse;
                }).catch(error => {
                    // Erro ao buscar da rede (ex: offline)
                    console.error('[ServiceWorker] Falha ao buscar da rede:', error);
                    // (Opcional) Retornar uma página de fallback offline aqui
                });
            });
        })
    );
});
