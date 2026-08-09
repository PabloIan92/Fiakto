# Fiakto

**Todo tiene solución.**

Fiakto es un marketplace argentino para contratar profesionales verificados. Los clientes publican un problema, Gemini ayuda a clasificarlo y los profesionales compatibles envían presupuestos privados.

## Estado del proyecto

El repositorio contiene una vertical funcional en desarrollo. La base técnica, los contratos de dominio, la persistencia, el triage y el alta de solicitudes están implementados y cubiertos por pruebas.

### ✅ Completado

**Core (antes):**
- [x] Shell responsive con Next.js App Router y TypeScript.
- [x] Contratos Zod para solicitudes, triage y presupuestos.
- [x] Persistencia con Firebase Admin y reglas de Firestore cerradas por defecto.
- [x] Registro de auditoría append-only.
- [x] Proveedor Gemini con salida JSON validada y límites de seguridad.
- [x] Autenticación mediante Firebase ID token o cookie `__session`.
- [x] API para crear solicitudes sin aceptar un `customerId` enviado por el cliente.
- [x] Triage con medios firmados y bloqueo automático ante emergencias.
- [x] Formulario móvil accesible sin solicitar el domicilio exacto.
- [x] Demo y evidencia para la presentación en Devpost.

**PWA + Mapa:**
- [x] **PWA instalable** (Android Chrome + iPhone Safari): `next-pwa` + Workbox, service worker con estrategias de cache, `manifest.webmanifest`, iconos 72→512px, meta tags iOS/Android. En iPhone la instalación es solo desde **Safari** (Compartir → Agregar a inicio) — Chrome/Firefox en iOS no exponen esa función, es restricción de Apple, no del código.
- [x] **Selector de ubicación en mapa (cliente)**: `MapPicker` con Leaflet + OpenStreetMap, marcador arrastrable, círculo de radio configurable (1–10 km), validación obligatoria antes de enviar.
- [x] **Vista aproximada (profesional)**: `ApproximateMap` solo lectura, zona borrosa (círculo punteado) sin revelar dirección exacta, ya conectada en `/profesional/oportunidades/[id]`.
- [x] **Dominio extendido**: `LocationSchema` con `lat`, `lng`, `displayRadiusKm`, `province`, `locality`, `exactAddress` (condicional, solo tras aceptación + pago).
- [x] **UI formulario**: selector de provincia, localidad, radio de visibilidad; integración con subida de medios existente y flujo de triage automático.

**Arreglos de esta vuelta (feedback de prueba con usuarios reales):**
- [x] `/perfil` ya no se cuelga en "Cargando perfil…" sin sesión: redirige a `/login`.
- [x] `/login` con el diseño brutalista del resto del sitio (`#181713`/`#dc4b2f`, bordes, sombra `8px_8px_0`).
- [x] `TRADES` (perfil) y `TriageResult.trade` (triage por IA) unificados en un solo vocabulario (`src/domain/profile.ts`), agregando `refrigeracion` y `otro` al triage y sacando la lista duplicada que tenía `triage.ts`.

**Perfiles, sesión y oportunidades (feedback de prueba con usuarios reales):**
- [x] **Vista de profesional** (`/profesional/oportunidades`, listado + detalle): filtra por oficio/cobertura vía `canProfessionalViewRequest`, siempre oculta `exactAddress`, muestra `ApproximateMap`.
- [x] **Perfil de cliente** (`/perfil`): domicilio con mapa exacto (marcador preciso, reusa `MapPicker`) y teléfono. Nuevo `UserProfileSchema` + `FirestoreProfileRepository`.
- [x] **Perfil de profesional con oficios editables**: plomería, electricidad, gasista, cerrajería, pintura, carpintería, jardinería, limpieza, albañilería, techista. Conversión cliente→profesional vía custom claims (`/api/profile/become-professional`).
- [x] **Login + sesión persistente**: `/login` (email/password), `AuthProvider` sincroniza el token de Firebase automáticamente a la cookie `__session` — ya no hace falta loguearse de nuevo en cada visita.
- [x] **Listado de pedidos hechos**: `/cliente/solicitudes` con badges de estado en español, `listByCustomer`/`listOpen` en `RequestRepository`.

## Próximas tareas

### Prioridad alta — rematar lo de esta vuelta

- [ ] `npm run build` de producción sigue roto por un bug abierto de Next.js 16.x (`InvariantError` al prerenderizar `/_global-error`, confirmado independiente de next-pwa/webpack/turbopack: [vercel/next.js#87719](https://github.com/vercel/next.js/issues/87719)). `npm run dev` funciona normal; bloquea publicar staging/producción hasta que Next.js lo arregle o se baje a Next 15.
- [ ] Cargar Firebase real (ver `.env.example` pendiente más abajo) para poder probar el flujo de login/perfil end-to-end — hoy sin credenciales la app funciona pero como "visitante no logueado" en todas partes.

### Prioridad alta — completar la vertical

- [ ] Subir fotos, videos y audios a Cloud Storage antes de crear la solicitud. La pantalla ya valida tipo, tamaño y cantidad, pero todavía envía `media: []` (parcial: infraestructura de URLs firmadas existe en `/api/requests/media`).
- [ ] **Revelación condicional de dirección exacta**: endpoint/API que devuelve `exactAddress` solo si `status === "accepted" && paymentConfirmed`.
- [ ] **Filtrado por proximidad**: query Firestore geo (geohash / `geofirestore`) para oportunidades cercanas al profesional (hoy filtra por oficio/cobertura, no por distancia real).
- [ ] Identidad verificada del profesional (el filtro de oportunidades hoy no la chequea).
- [ ] Implementar presupuestos privados con protección contra duplicados.
- [ ] Mostrar al cliente sus presupuestos sin filtrar datos de competidores.
- [ ] **SLA / Ventana de reparación**: estados `in_progress` / `completed`, `slaDeadline`, alertas de vencimiento, tracking `workStartedAt` / `workCompletedAt`.
- [ ] Agregar pruebas Playwright para el recorrido solicitud → triage → presupuesto.
- [ ] Configurar Firebase Emulator Suite para desarrollo local reproducible.

### Prioridad media — preparar staging

- [ ] Crear `.env.example` sin secretos reales.
- [ ] Añadir `apphosting.yaml` y configurar Firebase App Hosting.
- [ ] Guardar `GEMINI_API_KEY` en Secret Manager.
- [ ] Configurar Firebase Authentication, Firestore y Cloud Storage.
- [ ] Ejecutar `npm run build` (con `--webpack` flag por compatibilidad next-pwa) y publicar URL de staging — bloqueado por el bug de Next.js de arriba.
- [ ] Verificar que los logs no incluyan tokens, documentos ni domicilios.

### Después del MVP

- [ ] Integrar verificación de identidad y controles contra abuso.
- [ ] Validar con Mercado Pago un flujo regulado de cobro, liberación y reembolso.
- [ ] Implementar aceptación del presupuesto, chat, evidencia y órdenes de cambio.
- [ ] Añadir doble confirmación de finalización y resolución administrativa de disputas.
- [ ] Incorporar calificaciones bilaterales, suscripción Premium y analítica.
- [ ] Evaluar aplicación nativa Android/iOS después de validar la web responsive (PWA cubre instalación y offline básico).

## Desarrollo local

Requisitos: Node.js 20 o posterior y npm.

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`. El formulario de cliente está en `/cliente/solicitudes/nueva`.

Para usar Firebase y Gemini en un entorno real se necesitan credenciales de servidor. Nunca uses el prefijo `NEXT_PUBLIC_` para `GEMINI_API_KEY` ni para credenciales administrativas.

**Build producción:**
```bash
npm run build        # usa --webpack flag internamente (next.config.ts)
```

## Verificación

```bash
npm run validate
npm run build
```

`npm run validate` ejecuta ESLint, el chequeo de TypeScript y todas las pruebas de Vitest.

## Arquitectura

```text
app/                 Rutas, páginas y endpoints de Next.js
  api/               Endpoints (requests, triage, media, profile, session)
  cliente/           Páginas cliente (nueva solicitud, mis solicitudes)
  profesional/       Oportunidades del profesional (listado + detalle con ApproximateMap)
  perfil/            Perfil de cliente/profesional (domicilio, teléfono, oficios)
  login/             Login + alta con Firebase Auth
  providers/         AuthProvider (sesión persistente vía cookie __session)
  components/        MapPicker, ApproximateMap
  (public)/          Páginas públicas
src/
  client/            Firebase client SDK, sincronización de sesión
  domain/            Esquemas Zod (requests, triage, quotes, location, profile)
  server/            Firebase, auth, auditoría, Gemini, repositorios, media, triage-service
tests/               Pruebas unitarias, de rutas y de interfaz
demo/                Material reproducible para la demo
docs/                Diseño, planes y documentación operativa
public/
  icons/             Iconos PWA 72→512px (generados desde SVG)
  manifest.webmanifest
  sw.js              Service worker Workbox (precache + runtime caching)
scripts/             gen-icons.mjs (genera iconos desde SVG)
types/               Declaraciones TypeScript (next-pwa, minimatch)
```

Las direcciones exactas permanecen ocultas hasta la contratación. Los profesionales no ven precios de competidores. Gemini asiste y deja trazabilidad, pero no mueve dinero ni toma decisiones finales por las personas.