# Fiakto

**Todo tiene solución.**

Fiakto es un marketplace argentino para contratar profesionales verificados. Los clientes publican un problema, Gemini ayuda a clasificarlo y los profesionales compatibles envían presupuestos privados.

## Para retomar en otra sesión/PC (leer esto primero)

- **Repo privado.** `PabloIan92/Fiakto` en GitHub, rama `main`. Cloná/pulleá normal, requiere acceso.
- **El rol se elige en cada login, no es fijo por cuenta.** Un mismo email/contraseña (o cuenta de Google) puede operar como "cliente" o como "profesional" — se elige explícitamente en el selector de `/login` cada vez que se inicia sesión, nunca se adivina ni se guarda como propiedad permanente de la cuenta. Ver detalle en "Arquitectura de roles" más abajo antes de tocar auth/perfil.
- **`npm run dev` local NO tiene credenciales de Firebase Admin configuradas en esta máquina.** Cualquier ruta que use `firebase-admin` (login, `/api/session`, `/api/profile`, `/api/requests`) devuelve 401 en local — no es un bug de código, falta `GOOGLE_APPLICATION_CREDENTIALS`/Application Default Credentials. **Para probar flujos de auth/datos hay que hacerlo contra staging**, no contra `npm run dev` (ver más abajo cómo deployar).
- **Staging:** `https://fiakto-staging--fiakto.us-central1.hosted.app/` — backend de Firebase App Hosting `fiakto-staging`, proyecto Firebase `fiakto`. **No está conectado a GitHub, no hay auto-deploy.** Después de cada cambio hay que correr manualmente:
  ```bash
  firebase deploy --only apphosting --project fiakto
  ```
  El Firebase CLI no está instalado global en esta máquina, está cacheado vía npx en `C:\Users\Lemmon\AppData\Local\npm-cache\_npx\ba4f1959e38407b5\node_modules\firebase-tools` — invocarlo con `node <esa-ruta>/lib/bin/firebase.js <comando>` (o `npx firebase-tools@latest <comando>` si esa ruta ya no existe).
- **No hardcodear secretos.** `GEMINI_API_KEY` y (a futuro) el alias/CBU de cobro van en Secret Manager y se referencian en `apphosting.yaml` — nunca en texto plano en el repo, aunque ahora sea privado.
- **Patrón de bugs repetido en esta sesión:** varias veces la funcionalidad ya estaba bien implementada pero no había forma de *encontrarla* desde la navegación (no había link a `/login` desde la home, no había link a `/perfil` desde ningún lado, `/perfil` no tenía forma de volver atrás, el mapa era interactivo pero no lo decía en ningún lado). Antes de dar por buena una pantalla nueva: ¿hay cómo llegar? ¿hay cómo volver? ¿es obvio qué se puede clickear?

## Arquitectura de roles (clave para no romper nada)

- El custom claim `role` de Firebase Auth (`customer` | `professional` | `admin`) representa el **rol activo de la sesión actual**, no un atributo fijo de la cuenta. Se asigna/cambia en cada login vía `POST /api/session` (`app/api/session/handler.ts`, dependencia `setActiveRole`).
- El perfil (`profiles` en Firestore) se guarda **por `(userId, role)`**, documento con ID `${userId}_${role}` (`src/server/repositories/firestore-profile-repository.ts`). Así el perfil de cliente y el de profesional de la misma cuenta no se pisan entre sí.
- `src/client/pending-role.ts` (`beginManagedLogin`/`endManagedLogin`/`isManagedLogin`): mientras un login está en curso, el listener automático de `AuthProvider` (`onIdTokenChanged`) no llama a `/api/session` por su cuenta, para que un idToken viejo no pise el rol recién elegido por una carrera de red. Si tocás el flujo de login, respetar este mecanismo o vas a reintroducir esa carrera.
- `useRoleGuard` (`app/providers/AuthProvider.tsx`) redirige si el rol activo no corresponde a la página (cliente no puede ver `/profesional/*`, profesional no puede ver `/cliente/*`).
- **No existe conversión "cliente → profesional"** (se eliminó `become-professional`). Para operar con el otro rol: cerrar sesión (botón en `/perfil` o en el header) y volver a entrar eligiéndolo.
- `/perfil` muestra domicilio+mapa solo en modo "customer"; foto de perfil obligatoria + oficios+cobertura solo en modo "professional".

## Estado del proyecto

El repositorio contiene una vertical funcional en desarrollo. La base técnica, los contratos de dominio, la persistencia, el triage, el alta de solicitudes, auth (email/password + Google) y la separación cliente/profesional están implementados y cubiertos por pruebas.

### ✅ Completado

**Core:**
- [x] Shell responsive con Next.js App Router y TypeScript.
- [x] Contratos Zod para solicitudes, triage, presupuestos y perfil.
- [x] Persistencia con Firebase Admin y reglas de Firestore cerradas por defecto.
- [x] Registro de auditoría append-only.
- [x] Proveedor Gemini con salida JSON validada y límites de seguridad.
- [x] Triage con medios firmados y bloqueo automático ante emergencias.
- [x] Formulario móvil accesible sin solicitar el domicilio exacto.

**Mapa:**
- [x] `MapPicker` (Leaflet + OpenStreetMap): marcador arrastrable, click para marcar, círculo de radio configurable — con texto visible en pantalla indicando que es interactivo (antes solo tenía un `aria-label`, parecía decorativo).
- [x] `ApproximateMap` (solo lectura, para el profesional): zona borrosa sin revelar dirección exacta.

**Auth y roles (rediseñado el 2026-08-09, ver "Arquitectura de roles" arriba):**
- [x] Email/password y **Google** (`signInWithPopup` + `GoogleAuthProvider`, ya habilitado en el proyecto de Firebase, no requirió tocar la consola).
- [x] Selector "Soy cliente"/"Soy profesional" en login **y** en signup — el rol se elige en cada inicio de sesión.
- [x] Sesión persistente vía cookie `__session`, sincronizada por `AuthProvider`.
- [x] Perfil separado por rol (domicilio+teléfono para cliente; foto de perfil obligatoria+teléfono+oficios para profesional). Subida de foto a Cloud Storage (`POST /api/profile/photo`), servida vía URL firmada.
- [x] Guardas de ruta (`useRoleGuard`) en las 4 páginas de cliente/profesional.
- [x] Navegación: header con "Mi perfil"/"Cerrar sesión" en las páginas autenticadas, link "Volver a [sección]" en `/perfil`, link a `/login` desde la home pública.

**Solicitudes y oportunidades:**
- [x] `/cliente/solicitudes` (listado) y `/cliente/solicitudes/nueva` (alta con mapa).
- [x] `/profesional/oportunidades` (listado filtrado por oficio/cobertura vía `canProfessionalViewRequest`) + detalle, siempre oculta `exactAddress`.
- [x] **SLA / Ventana de reparación**: estados `in_progress`/`completed`, `slaDeadline` según `riskLevel` del triage (emergencia 4h, urgente 24h, normal 72h), endpoints `POST /api/requests/[id]/start` y `/complete`. **Simplificación conocida**: sin flujo de presupuestos/aceptación todavía, cualquier profesional que matchea oficio/cobertura puede iniciar un pedido "open" directamente.
- [x] Listas blindadas contra solicitudes viejas sin `location` (datos de antes de que el campo fuera obligatorio) — muestran "Ubicación no disponible" en vez de crashear.

**Infra / deploy:**
- [x] `npm run build` de producción funciona (proyecto movido fuera de `system32` — un lockfile ajeno ahí rompía el tracing de módulos de Next — y Next bajado de 16 a 15.5.23).
- [x] `next-pwa` deshabilitado por defecto (ver nota PWA más abajo) + limpieza automática de service workers viejos de antes de ese cambio (`app/components/ServiceWorkerCleanup.tsx`) — sin esto, usuarios que visitaron el sitio antes del fix se quedaban con un SW roto cacheando chunks inexistentes y la app crasheaba.
- [x] `firebase.json`/`apphosting.yaml` configurados, backend `fiakto-staging` deployado (ver arriba, sin auto-deploy desde GitHub).
- [x] `GEMINI_API_KEY` en Secret Manager, referenciado en `apphosting.yaml` y con acceso otorgado al backend.
- [x] Bug de Storage corregido: `getStorage().bucket()` sin nombre resolvía al bucket legacy `<project>.appspot.com` (no existe en este proyecto) — se fuerza `fiakto.firebasestorage.app`.

**Legal / compliance (borradores, no listos para producción):**
- [x] Documentos en `docs/legal/`: términos de servicio, política de privacidad, aviso resumido, cláusula de arbitraje, política DMCA. Declaran uso de IA/Gemini, jurisdicción Argentina, DMCA con notice-and-takedown.
- [ ] **Faltan datos reales**: todavía no hay entidad legal constituida (sin razón social/CUIT/domicilio), y quedan a propósito sin completar: institución/ciudad de arbitraje, monto de responsabilidad, plazos de negociación, jurisdicción de tribunales. Revisión legal humana recomendada antes de publicar a usuarios reales.

## Próximas tareas

### Prioridad alta

- [ ] Flujo de presupuestos (`quotes`): privados, protección contra duplicados, aceptación por el cliente. Bloquea varias cosas: la revelación condicional de dirección exacta, el cobro/pago, y la feature de validación de comprobantes pedida por Pablo (ver abajo).
- [ ] Subir fotos/videos/audios de la solicitud a Cloud Storage antes de crear la solicitud (hoy el form valida pero envía `media: []`).
- [ ] **Revelación condicional de dirección exacta**: solo si `status === "accepted" && paymentConfirmed`.
- [ ] **Filtrado por proximidad real** (geohash/`geofirestore`) — hoy solo filtra por oficio/cobertura declarada, no distancia.
- [ ] Identidad verificada del profesional (no se chequea al filtrar oportunidades).
- [ ] Enforcement real de "foto obligatoria" para profesional (hoy es obligatoria en la UI pero nada bloquea aparecer en oportunidades sin ella).
- [ ] Race condition menor: `GET /api/requests` puede devolver 401 una vez justo después del signup (la cookie de sesión tarda un instante en sincronizarse) — no rompe nada visible pero es un error real en consola.
- [ ] Configurar Firebase Emulator Suite, o generar credenciales de Application Default Credentials, para poder probar `npm run dev` local sin depender de staging.
- [ ] Pruebas Playwright end-to-end (hoy la cobertura es unitaria/Vitest).

### Feature pedida por Pablo, todavía sin encarar: validación de comprobante de transferencia con Gemini

Cuando el cliente paga por transferencia, debe subir el comprobante y Gemini tiene que verificar: (1) que sea realmente un comprobante y no otra cosa, (2) que la transferencia sea al alias/CBU correcto, (3) que la fecha sea del mismo día, (4) que el importe coincida con lo pedido. **Bloqueada** hasta que exista el flujo de presupuestos (para saber el importe esperado) y una decisión de dónde vive el alias esperado por profesional/plataforma. El alias/CBU real de Pablo fue compartido en el chat de una sesión anterior — **va a Secret Manager cuando se implemente, nunca hardcodeado**.

### Después del MVP

- [ ] Integrar verificación de identidad y controles contra abuso.
- [ ] Mercado Pago: cobro, liberación y reembolso regulados.
- [ ] Aceptación de presupuesto, chat, evidencia, órdenes de cambio.
- [ ] Doble confirmación de finalización y resolución administrativa de disputas.
- [ ] Calificaciones bilaterales, suscripción Premium, analítica.
- [ ] Evaluar app nativa Android/iOS (hoy PWA está deshabilitado, ver nota abajo).

## Desarrollo local

Requisitos: Node.js 20 o posterior y npm.

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000` (o el puerto que indique la consola si el 3000 está ocupado). El formulario de cliente está en `/cliente/solicitudes/nueva`.

**Importante:** sin Application Default Credentials configuradas, todo lo que dependa de `firebase-admin` (login, perfil, requests) devuelve 401 en local. Para probar esos flujos, deployar a staging (ver arriba) y probar ahí.

**Build producción:**
```bash
npm run build
```

**Nota PWA:** `next-pwa` está deshabilitado por defecto (incluso en producción) porque su integración con Next 15 App Router rompía el prerender (`TypeError: Cannot read properties of undefined (reading 'call')` en `webpack-runtime.js`). Se puede reactivar con `NEXT_PUBLIC_ENABLE_PWA=true`, pero eso vuelve a romper `npm run build` — pendiente encontrar una alternativa compatible con Next 15/App Router antes de reactivarlo. Si se reactiva alguna vez, revisar también `app/components/ServiceWorkerCleanup.tsx` (hoy desregistra cualquier SW existente mientras el flag esté apagado).

## Verificación

```bash
npm run validate
npm run build
```

`npm run validate` ejecuta ESLint, el chequeo de TypeScript y todas las pruebas de Vitest. Antes de dar por terminado un cambio: lint + build + test, los tres en verde, y si el cambio toca auth/datos, probarlo también contra staging con el skill `chrome-devtools` (Puppeteer) — no alcanza con local.

## Arquitectura

```text
app/                        Rutas, páginas y endpoints de Next.js
  api/
    profile/                GET/PUT perfil (por rol activo), photo/ (subida de foto)
    requests/                Alta y listado de solicitudes, [id]/start, [id]/complete, [id]/triage
    session/                 POST setActiveRole + cookie __session, DELETE logout
  cliente/                  Mis solicitudes, nueva solicitud
  profesional/              Oportunidades (listado + detalle)
  perfil/                   Perfil de cliente o profesional segun rol activo
  login/                    Login + alta, email/password y Google, selector de rol
  providers/                AuthProvider (useAuth, useRoleGuard)
  components/               MapPicker, ApproximateMap, AppHeader, ServiceWorkerCleanup
  (public)/                 Home publica (con link a /login)
src/
  client/                   Firebase client SDK, session-sync, pending-role (managed login)
  domain/                   Esquemas Zod (requests, triage, quotes, location, profile)
  server/                   Firebase admin, auth, auditoria, Gemini, repositorios, media
tests/                      Pruebas unitarias, de rutas y de interfaz (Vitest)
docs/legal/                 Terminos, privacidad, arbitraje, DMCA (borradores)
firebase.json, apphosting.yaml   Config de Firebase App Hosting (backend fiakto-staging)
```

Las direcciones exactas permanecen ocultas hasta la contratación. Los profesionales no ven precios de competidores. Gemini asiste y deja trazabilidad, pero no mueve dinero ni toma decisiones finales por las personas.
