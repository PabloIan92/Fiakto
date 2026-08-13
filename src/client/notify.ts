// Alertas dentro de la app (sonido + notificación del navegador) mientras
// la pestaña está abierta. No usa Service Worker a propósito: next-pwa ya
// se deshabilitó una vez por romper el build (ver README, nota PWA), así
// que esto no depende de tener uno registrado ni funciona con la app
// cerrada — es una mejora liviana, no push notifications reales.

const NOTIFICATION_ICON = "/icons/icon-192x192.png";

export function playAlertSound() {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Web Audio puede fallar (ej. autoplay bloqueado antes de una
    // interacción del usuario) — la alerta visual en pantalla no depende
    // de esto.
  }
}

export function requestNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

export function showAppAlert(title: string, body: string) {
  playAlertSound();
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: NOTIFICATION_ICON });
    } catch {
      // best-effort, nunca bloquea el flujo
    }
  }
}
