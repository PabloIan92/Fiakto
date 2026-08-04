# Fiakto

**Todo tiene solución.**

Fiakto es un marketplace argentino para contratar profesionales verificados. Los clientes publican un problema, Gemini ayuda a clasificarlo y los profesionales compatibles envían presupuestos privados.

## Estado del proyecto

El repositorio contiene una vertical funcional en desarrollo. La base técnica, los contratos de dominio, la persistencia, el triage y el alta de solicitudes están implementados y cubiertos por pruebas.

### Completado

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

## Próximas tareas

### Prioridad alta — completar la vertical

- [ ] Subir fotos, videos y audios a Cloud Storage antes de crear la solicitud. La pantalla ya valida tipo, tamaño y cantidad, pero todavía envía `media: []`.
- [ ] Crear oportunidades filtradas por oficio, cobertura e identidad verificada.
- [ ] Implementar presupuestos privados con protección contra duplicados.
- [ ] Mostrar al cliente sus presupuestos sin filtrar datos de competidores.
- [ ] Agregar pruebas Playwright para el recorrido solicitud → triage → presupuesto.
- [ ] Configurar Firebase Emulator Suite para desarrollo local reproducible.

### Prioridad media — preparar staging

- [ ] Crear `.env.example` sin secretos reales.
- [ ] Añadir `apphosting.yaml` y configurar Firebase App Hosting.
- [ ] Guardar `GEMINI_API_KEY` en Secret Manager.
- [ ] Configurar Firebase Authentication, Firestore y Cloud Storage.
- [ ] Ejecutar `npm run build` y publicar una URL de staging.
- [ ] Verificar que los logs no incluyan tokens, documentos ni domicilios.

### Después del MVP

- [ ] Integrar verificación de identidad y controles contra abuso.
- [ ] Validar con Mercado Pago un flujo regulado de cobro, liberación y reembolso.
- [ ] Implementar aceptación del presupuesto, chat, evidencia y órdenes de cambio.
- [ ] Añadir doble confirmación de finalización y resolución administrativa de disputas.
- [ ] Incorporar calificaciones bilaterales, suscripción Premium y analítica.
- [ ] Evaluar una aplicación Android y Google Play Console después de validar la web responsive.

## Desarrollo local

Requisitos: Node.js 20 o posterior y npm.

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`. El formulario de cliente está en `/cliente/solicitudes/nueva`.

Para usar Firebase y Gemini en un entorno real se necesitan credenciales de servidor. Nunca uses el prefijo `NEXT_PUBLIC_` para `GEMINI_API_KEY` ni para credenciales administrativas.

## Verificación

```bash
npm run validate
npm run build
```

`npm run validate` ejecuta ESLint, el chequeo de TypeScript y todas las pruebas de Vitest.

## Arquitectura

```text
app/                 Rutas, páginas y endpoints de Next.js
src/domain/          Esquemas y reglas de negocio
src/server/          Firebase, autenticación, auditoría y Gemini
tests/               Pruebas unitarias, de rutas y de interfaz
demo/                Material reproducible para la demo
docs/                Diseño, planes y documentación operativa
```

Las direcciones exactas permanecen ocultas hasta la contratación. Los profesionales no ven precios de competidores. Gemini asiste y deja trazabilidad, pero no mueve dinero ni toma decisiones finales por las personas.
