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
- **No hardcodear secretos.** `GEMINI_API_KEY` y `TELEGRAM_BOT_TOKEN` van en Secret Manager y se referencian en `apphosting.yaml` — nunca en texto plano en el repo, aunque ahora sea privado. El alias de cobro (`NEXT_PUBLIC_FIAKTO_PAYMENT_ALIAS`) no es secreto (se muestra al cliente en pantalla), va como valor plano.
- **Patrón de bugs repetido en esta sesión:** varias veces la funcionalidad ya estaba bien implementada pero no había forma de *encontrarla* desde la navegación (no había link a `/login` desde la home, no había link a `/perfil` desde ningún lado, `/perfil` no tenía forma de volver atrás, el mapa era interactivo pero no lo decía en ningún lado). Antes de dar por buena una pantalla nueva: ¿hay cómo llegar? ¿hay cómo volver? ¿es obvio qué se puede clickear?
- **Verificá siempre que tu clon local coincida con `origin/main` antes de diagnosticar nada.** El 2026-08-10 una sesión completa (36 commits) se hizo por error sobre una carpeta local cuya historia de git había divergido de GitHub desde el 3 de agosto y nunca se pusheó — se "arreglaron" bugs sobre código que no era el que estaba desplegado. Antes de investigar cualquier bug: `git fetch && git log HEAD..origin/main` (y viceversa); si hay commits de un lado que el otro no tiene, `origin/main` es la fuente de verdad, no asumas que tu carpeta está al día solo porque no tenés cambios sin commitear.
- **Esa misma rama divergente (`backup/local-divergent-2026-08-10`, todavía en el repo local, nunca en GitHub) tenía trabajo real que se creía en producción y no lo estaba**: disputas/Telegram, panel admin y pago por transferencia con comisión, hechos el 2026-08-04/06, quedaron atrapados ahí y nunca llegaron a `main`. Se rescataron/reimplementaron el 2026-08-12 sobre el `main` actual (que para entonces ya tenía el flujo de presupuestos, distinto al de esa rama) — ver "Disputas y pagos" abajo. Antes de asumir que algo "ya está hecho" porque quedó anotado en una sesión anterior, confirmá que el código sigue en `main`, no solo que existe en algún lado del disco.

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
- [x] **SLA / Ventana de reparación**: estados `in_progress`/`completed`, `slaDeadline` según `riskLevel` del triage (emergencia 4h, urgente 24h, normal 72h), endpoints `POST /api/requests/[id]/start` y `/complete`.
- [x] **Flujo de presupuestos (2026-08-11)**: `QuoteSchema` y los estados `"quoted"`/`"accepted"` ya existían en el dominio pero nada los usaba — cualquier profesional que matcheaba oficio/cobertura podía iniciar el trabajo directamente. Ahora: el profesional envía un presupuesto privado (`POST /api/requests/[id]/quotes`, mano de obra + materiales + descripción + horas estimadas; bloqueado si ya envió uno para esa solicitud, o si el estado ya no acepta presupuestos), varios profesionales pueden competir por la misma solicitud (`listOpen()` incluye `"open"` y `"quoted"`), el cliente ve todos los presupuestos recibidos en la nueva página `/cliente/solicitudes/[id]` (no existía antes; el listado ahora linkea ahí) y acepta uno (`POST .../quotes/[quoteId]/accept`), lo que rechaza los demás pendientes y asigna la solicitud (`status: "accepted"`, `professionalId`). `POST /api/requests/[id]/start` ya no acepta a cualquier profesional matcheante: exige `status === "accepted" && professionalId === actor.id`. Probado de punta a punta en staging (publicar → 2 profesionales pueden ver la misma solicitud → presupuestar → aceptar → "Iniciar trabajo" solo para el ganador → "En reparación" con SLA).

**Disputas y pagos (rescatado/reimplementado 2026-08-12 — ver nota de la rama divergente arriba):**
- [x] **Comisión Fiakto del 8%** (`SERVICE_FEE_RATE`/`computeQuoteBreakdown`, `src/domain/quotes.ts`): al aceptar un presupuesto, el cliente ahora elige método de pago ("Aceptar y pagar en efectivo" / "Aceptar y transferir a Fiakto") en `/cliente/solicitudes/[id]`; `POST .../quotes/[quoteId]/accept` exige `paymentMethod` en el body, calcula subtotal+comisión+total y lo guarda (`recordPayment` en `RequestRepository`). "Efectivo" nunca toca una cuenta de Fiakto; "transfer" deja `payoutStatus: "pending"`.
- [x] **Pago por transferencia**: el cliente ve el alias (`NEXT_PUBLIC_FIAKTO_PAYMENT_ALIAS`) y sube un comprobante (`POST /api/requests/[id]/payment-receipt`, mismo patrón base64 que la foto de perfil). Un admin ve el comprobante y marca "Ya le pagué al profesional" en `/admin/pagos` (`GET /api/admin/payments`, `POST /api/admin/payments/[id]/settle`) — ahí es donde Fiakto efectivamente retiene la comisión con un registro real, no solo una captura externa de Mercado Pago/Ualá.
- [x] **Revelación condicional de dirección exacta**: `isPaymentConfirmed` (`src/domain/requests.ts`) — el profesional asignado ve `exactAddress` solo si el pago está confirmado (efectivo: inmediato al aceptar, ya que necesita la dirección para ir a trabajar; transferencia: recién con comprobante subido, **no** espera a que el admin liquide — liquidar es contabilidad interna de Fiakto, no una condición para que el profesional pueda ir). Antes de esto la dirección exacta nunca se revelaba a nadie más que al cliente.
- [x] **Sistema de disputas**: cliente o profesional asignado pueden reportar un problema (`POST /api/requests/[id]/report`, botón "¿Algo salió mal?" en `/cliente/solicitudes/[id]` y `/profesional/oportunidades/[id]`) una vez que hay un compromiso aceptado. Se guarda en Firestore (`reports`), dispara una alerta best-effort a Telegram (`src/server/telegram.ts`, nunca bloquea el flujo si falla) y un admin lo resuelve con una nota en `/admin/reportes` (`GET /api/admin/reports`, `POST /api/admin/reports/[id]/resolve`).
- [x] **Rol admin**: no se elige en el selector de `/login` (no hay botón para eso) — se otorga por fuera de la app con `node scripts/grant-admin.mjs <email>` (requiere credenciales que esta máquina no tiene configuradas, ver más abajo). `POST /api/session` nunca degrada un claim `admin` existente aunque el idToken todavía diga `customer`/`professional` de una sesión vieja.
- [ ] **Pendiente para que las alertas de Telegram funcionen**: crear/confirmar el secreto `TELEGRAM_BOT_TOKEN` en Secret Manager del proyecto `fiakto` y completar `TELEGRAM_CHAT_ID` en `apphosting.yaml` (hoy vacío) con el chat real de `@fiakto_alertas_bot`. Sin esto, `sendTelegramAlert` no hace nada (best-effort) pero el reporte se guarda igual y aparece en `/admin/reportes`.
- [ ] **Pendiente para poder entrar a `/admin/*`**: correr `gcloud auth application-default login` + `node scripts/grant-admin.mjs pabloianlaurino@gmail.com` (o el email que corresponda) desde una máquina con esas credenciales — no se pudo ejecutar en esta sesión.
- [x] Listas blindadas contra solicitudes viejas sin `location` (datos de antes de que el campo fuera obligatorio) — muestran "Ubicación no disponible" en vez de crashear.
- [x] **Fix (2026-08-10) — solicitudes quedaban en "Borrador" para siempre**: `app/cliente/solicitudes/nueva/page.tsx` creaba la solicitud (`POST /api/requests`) pero nunca llamaba al endpoint de triage (`POST /api/requests/[id]/triage`) — el documento nacía en `status: "draft"` y nada volvía a tocarlo. Se agregó la llamada al triage justo después de crear, más un botón "Reintentar análisis" en `/cliente/solicitudes` para las que ya habían quedado colgadas. De paso se encontró que `gemini-triage-provider.ts` usaba el modelo `gemini-2.5-flash`, deprecado para esta API key (404 `"no longer available to new users"`) — se cambió a `gemini-flash-latest` (verificado en logs de producción tras el fix).
- [x] **Fix (2026-08-10) — no redirigía tras crear la solicitud**: ahora `router.push("/cliente/solicitudes")` después de un submit exitoso, en vez de dejar al cliente en la misma pantalla.
- [x] **Fix (2026-08-10) — "Mis solicitudes"/"Oportunidades" colgadas en "Cargando…"**: en una navegación dura (URL directa o F5), `onIdTokenChanged` del SDK de Firebase Auth a veces nunca dispara ni una sola vez (restauración de persistencia en IndexedDB colgada) y `loading` se quedaba en `true` para siempre, sin ningún pedido de red. Se agregó un timeout de 6s en `AuthProvider` que fuerza `loading=false` si el listener real no resolvió a tiempo.
- [x] **Precarga de domicilio (2026-08-10)**: si el cliente ya guardó su domicilio en `/perfil`, `/cliente/solicitudes/nueva` precarga el mapa, la localidad y la provincia con eso en vez de pedírselo de nuevo en cada solicitud.
- [x] **Fix (2026-08-11) — el profesional no veía oportunidades de su propia zona**: `canProfessionalViewRequest` (`src/domain/quotes.ts`) comparaba la localidad de la solicitud contra la cobertura del profesional con igualdad de string exacta. Como el campo "Zonas de cobertura" es texto libre sin ningún selector (a diferencia del domicilio del cliente, que sí tiene mapa), cualquier diferencia de mayúsculas/tildes/espacios hacía que la solicitud nunca apareciera, sin ningún error visible. Se normaliza (minúsculas, sin tildes, sin espacios extra) antes de comparar. Reportado por Pablo probando con dos cuentas de Gmail reales (cliente `pabloianlaurino`, profesional `ianvilona`).
- [x] **Fix (2026-08-11) — `GET /api/requests` crasheaba con 500 para cualquier profesional**: si había al menos una solicitud "open" vieja sin `location` (datos previos a que el campo fuera obligatorio), el filtro de matching leía `item.location.province` sin guard y tiraba `TypeError`, tumbando el listado completo — todos los profesionales veían "no hay solicitudes", sin importar su cobertura. Mismo problema sin guard en el detalle (`[id]/handler.ts`) y en `start/handler.ts`. Se agregó `item.location &&` antes de cada acceso; una solicitud sin location nunca pudo haber matcheado igual, así que ahora se excluye/deniega en vez de crashear.
- [x] **Fix (2026-08-11) — 4 páginas con sesión quedaban estáticas y cacheadas por el CDN durante un año**: `/cliente/solicitudes`, `/cliente/solicitudes/nueva`, `/perfil` y `/profesional/oportunidades` son componentes 100% cliente sin ninguna dependencia de datos que Next detecte en build time, así que el build las marcaba `○ Static` y las prerenderizaba una vez sin ningún usuario real — con el `<p>Cargando...</p>` ya "horneado" adentro del HTML. Firebase App Hosting cacheaba esa respuesta (`cache-control: s-maxage=31536000`, `Vary` sin la cookie de sesión) y la servía a cualquiera que entrara por navegación directa/F5. `export const dynamic = "force-dynamic"` **solo lo respeta Next.js en archivos de Server Component**, no en archivos `"use client"` (confirmado con una ruta de prueba descartable antes de aplicar el fix real) — por eso cada una de las 4 páginas se partió en un `page.tsx` servidor delgado (con el export) + un `client.tsx` con la lógica real.
- [x] **Fix (2026-08-11) — 3 páginas podían quedar colgadas en "Cargando..." para siempre, independientemente del cacheo**: en `oportunidades/client.tsx`, `cliente/solicitudes/client.tsx` y `oportunidades/[id]/page.tsx`, el `useEffect` que dispara el fetch de datos dependía de `[user]` (o `[user, params.id, reloadIndex]`) sin incluir `ready`. Si el usuario de Firebase Auth resolvía antes que el rol (`ready` todavía `false`), el efecto corría una vez, salía por el guard temprano, y **nunca se volvía a ejecutar** cuando `ready` pasaba a `true` — sin ningún pedido de red ni error, indistinguible de un cuelgue de infraestructura. Se agregó `ready` a cada array de dependencias. De paso se habilitó `eslint-plugin-react-hooks` (ya estaba instalado, nunca wireado en `eslint.config.mjs`) para que `exhaustive-deps` atrape esta clase de bug sola — encontró los 3 casos, incluido uno en un archivo no tocado en esta sesión.

**Infra / deploy:**
- [x] `npm run build` de producción funciona (proyecto movido fuera de `system32` — un lockfile ajeno ahí rompía el tracing de módulos de Next — y Next bajado de 16 a 15.5.23).
- [x] `next-pwa` deshabilitado por defecto (ver nota PWA más abajo) + limpieza automática de service workers viejos de antes de ese cambio (`app/components/ServiceWorkerCleanup.tsx`) — sin esto, usuarios que visitaron el sitio antes del fix se quedaban con un SW roto cacheando chunks inexistentes y la app crasheaba.
- [x] `firebase.json`/`apphosting.yaml` configurados, backend `fiakto-staging` deployado (ver arriba, sin auto-deploy desde GitHub).
- [x] `GEMINI_API_KEY` en Secret Manager, referenciado en `apphosting.yaml` y con acceso otorgado al backend.
- [x] Bug de Storage corregido: `getStorage().bucket()` sin nombre resolvía al bucket legacy `<project>.appspot.com` (no existe en este proyecto) — se fuerza `fiakto.firebasestorage.app`.

**Verificación de edad (2026-08-10):**
- [x] `UserProfileSchema` tiene `birthDate` (YYYY-MM-DD, opcional a nivel de schema para no romper perfiles viejos guardados antes de este campo). `PUT /api/profile` exige que esté presente y rechaza el guardado (403, `minorBlocked: true`) si la persona tiene menos de 18 años (`isAdult`/`calculateAge` en `src/domain/profile.ts`) — aplica a cliente y profesional.
- [x] `/perfil` pide la fecha de nacimiento como campo obligatorio y muestra el error del servidor si el guardado se rechaza (antes `handleSubmit` no chequeaba `response.ok` para nada — cualquier error, no solo este, se mostraba como "Perfil guardado").
- [x] `/cliente/solicitudes/nueva` y `/profesional/oportunidades` bloquean su uso (mensaje explícito, sin formulario/listado) si el perfil ya guardado indica que la persona es menor — cubre a alguien que guardó su perfil antes de que este chequeo existiera.
- [x] **Fix (2026-08-11)**: el form siempre manda `birthDate` como string (nunca `undefined`), así que dejar la fecha vacía mandaba `""`, que la regex de formato rechazaba como "Invalid profile" en vez del mensaje claro de "falta la fecha". Se normaliza `""` → `undefined` antes de validar.
- [ ] **No implementado todavía**: verificación real de identidad/edad (hoy es autodeclarada, no hay validación contra DNI ni nada similar).

**Legal / compliance (borradores, no listos para producción):**
- [x] Documentos en `docs/legal/`: términos de servicio, política de privacidad, aviso resumido, cláusula de arbitraje, política DMCA. Declaran uso de IA/Gemini, jurisdicción Argentina, DMCA con notice-and-takedown.
- [ ] **Faltan datos reales**: todavía no hay entidad legal constituida (sin razón social/CUIT/domicilio), y quedan a propósito sin completar: institución/ciudad de arbitraje, monto de responsabilidad, plazos de negociación, jurisdicción de tribunales. Revisión legal humana recomendada antes de publicar a usuarios reales.

## Próximas tareas

### Prioridad alta

- [x] ~~Flujo de presupuestos (`quotes`)~~ — implementado 2026-08-11.
- [x] ~~Comisión Fiakto, pago por transferencia, revelación condicional de dirección, disputas~~ — rescatado/reimplementado 2026-08-12, ver "Disputas y pagos" arriba.
- [x] ~~`npx tsc --noEmit` con errores preexistentes en mocks de `ProfileRepository`~~ — arreglado 2026-08-12.
- [x] ~~Race condition: `GET /api/requests` podía devolver 401 justo después del signup~~ — arreglado 2026-08-12 (era más serio de lo que parecía: la cookie de sesión podía no llegar a fijarse nunca, no solo tardar; ver `syncSessionUntilReady` en `src/client/session-sync.ts`).
- [x] ~~Subir fotos/videos/audios de la solicitud a Cloud Storage~~ — implementado 2026-08-13: el cliente pide signed URLs de escritura (`POST /api/requests/media`) y sube cada archivo directo a Storage antes de crear la solicitud (no embebido en el body, pueden pesar hasta 20MB), reemplazando el `media: []` que se mandaba siempre.
- [x] ~~Enforcement real de "foto obligatoria" para profesional~~ — implementado 2026-08-13: `canProfessionalViewRequest` (`src/domain/quotes.ts`) ahora exige `hasPhoto`, no solo oficio/cobertura/verificado. Antes la UI la pedía pero nada bloqueaba aparecer en oportunidades ni mandar presupuestos sin ella; ahora un profesional sin foto queda afuera de `GET /api/requests`, `GET /api/requests/[id]` y `POST /api/requests/[id]/quotes` igual que si no matcheara oficio/cobertura.
- [ ] **Filtrado por proximidad real** (geohash/`geofirestore`) — hoy solo filtra por oficio/cobertura declarada (texto libre), no distancia. **No encarado el 2026-08-13**: el profesional hoy no tiene ninguna coordenada guardada, solo una lista de localidades en texto libre (`coverage: string[]`) — para calcular distancia real primero hay que decidir cómo declara su zona (¿un punto+radio en el mapa, como el domicilio del cliente? ¿un polígono?) y migrar los perfiles existentes. Es un cambio de modelo de datos, no solo de query.
- [ ] Identidad verificada del profesional (no se chequea al filtrar oportunidades).
- [ ] Configurar Firebase Emulator Suite, o generar credenciales de Application Default Credentials, para poder probar `npm run dev` local sin depender de staging.
- [ ] Pruebas Playwright end-to-end (hoy la cobertura es unitaria/Vitest).

### Feature pedida por Pablo, todavía sin encarar: validación de comprobante de transferencia con Gemini

Cuando el cliente sube el comprobante de transferencia (ver "Disputas y pagos" arriba — la subida y el panel admin de liquidación ya existen), Gemini tiene que verificar: (1) que sea realmente un comprobante y no otra cosa, (2) que la transferencia sea al alias/CBU correcto, (3) que la fecha sea del mismo día, (4) que el importe coincida con lo pedido, y confirmar automáticamente en vez de depender de que un admin lo mire a mano. **Ya no está bloqueada** (el flujo de presupuestos, el importe esperado y el alias ya existen) — quedó sin encarar en la sesión del 2026-08-12 por decisión explícita de priorizar el resto del backlog técnico primero. El alias real de Pablo (`fiakto`) ya está en `NEXT_PUBLIC_FIAKTO_PAYMENT_ALIAS` (no es secreto, se muestra en pantalla); si en el futuro se agrega un CBU, ese sí va a Secret Manager.

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
    requests/                Alta y listado de solicitudes, [id]/start, [id]/complete, [id]/triage,
                             [id]/quotes (+ [quoteId]/accept), [id]/report, [id]/payment-receipt
    admin/                   reports/ (+ [id]/resolve), payments/ (+ [id]/settle) — gateado por role==="admin"
    session/                 POST setActiveRole + cookie __session, DELETE logout
  cliente/                  Mis solicitudes, nueva solicitud, [id] (detalle + presupuestos + pago + reportar)
  profesional/              Oportunidades (listado + detalle + reportar)
  admin/                    reportes/ (disputas), pagos/ (liquidar transferencias) — solo role==="admin"
  perfil/                   Perfil de cliente o profesional segun rol activo
  login/                    Login + alta, email/password y Google, selector de rol
  providers/                AuthProvider (useAuth, useRoleGuard)
  components/               MapPicker, ApproximateMap, AppHeader, ServiceWorkerCleanup
  (public)/                 Home publica (con link a /login)
src/
  client/                   Firebase client SDK, session-sync (syncSessionUntilReady), pending-role
  domain/                   Esquemas Zod (requests, triage, quotes, location, profile, reports)
  server/                   Firebase admin, auth, auditoria, Gemini, repositorios, media, telegram
scripts/                    grant-admin.mjs (otorgar role="admin" a una cuenta, requiere ADC)
tests/                      Pruebas unitarias, de rutas y de interfaz (Vitest)
docs/legal/                 Terminos, privacidad, arbitraje, DMCA (borradores)
firebase.json, apphosting.yaml   Config de Firebase App Hosting (backend fiakto-staging)
```

Las direcciones exactas permanecen ocultas hasta la contratación. Los profesionales no ven precios de competidores. Gemini asiste y deja trazabilidad, pero no mueve dinero ni toma decisiones finales por las personas.
