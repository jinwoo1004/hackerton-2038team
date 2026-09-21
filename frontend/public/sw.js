// 홈 화면 추가 조건만 맞추고 캐시는 하지 않는다
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
