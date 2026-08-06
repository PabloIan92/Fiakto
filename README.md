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

**Nuevo en esta versión (PWA + Mapa):**
- [x] **PWA instalable** (Android Chrome + iPhone Safari): `next-pwa` + Workbox, service worker con estrategias de cache, `manifest.webmanifest`, iconos 72→512px, meta tags iOS/Android.
- [x] **Selector de ubicación en mapa (cliente)**: `MapPicker` con Leaflet + OpenStreetMap, marcador arrastrable, círculo de radio configurable (1–10 km), validación obligatoria antes de enviar.
- [x] **Vista aproximada (profesional)**: `ApproximateMap` solo lectura, zona borrosa (círculo punteado) sin revelar dirección exacta.
- [x] **Dominio extendido**: `LocationSchema` con `lat`, `lng`, `displayRadiusKm`, `province`, `locality`, `exactAddress` (condicional, solo tras aceptación + pago).
- [x] **UI formulario**: selector de provincia, localidad, radio de visibilidad; integración con subida de medios existente y flujo de triage automático.

## Próximas tareas

### Prioridad alta — completar la vertical

- [ ] Subir fotos, videos y audios a Cloud Storage antes de crear la solicitud. La pantalla ya valida tipo, tamaño y cantidad, pero todavía envía `media: []` (parcial: infraestructura de URLs firmadas existe en `/api/requests/media`).
- [ ] **Revelación condicional de dirección exacta**: endpoint/API que devuelve `exactAddress` solo si `status === "accepted" && paymentConfirmed`.
- [ ] **Filtrado por proximidad**: query Firestore geo (geohash / `geofirestore`) para oportunidades cercanas al profesional.
- [ ] Crear oportunidades filtradas por oficio, cobertura e identidad verificada.
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
- [ ] Ejecutar `npm run build` (con `--webpack` flag por compatibilidad next-pwa) y publicar URL de staging.
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
  api/               Endpoints (requests, triage, media)
  cliente/           Páginas cliente (nueva solicitud, mis solicitudes)
  components/        MapPicker, ApproximateMap
  (public)/          Páginas públicas
src/
  domain/            Esquemas Zod (requests, triage, quotes, location)
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