// El rol ahora se elige en CADA login (no es fijo por cuenta), asi que el
// formulario de login/signup maneja explicitamente la sincronizacion de
// sesion durante un login activo. Mientras un login esta "en curso"
// (managedLogin=true), el listener automatico de AuthProvider
// (onIdTokenChanged) NO llama a /api/session por su cuenta: si lo hiciera,
// podria mandar un idToken viejo (cacheado antes del cambio de rol) que
// pise el rol recien elegido con el anterior por una carrera de red.
let managedLogin = false;

export function beginManagedLogin() {
  managedLogin = true;
}

export function endManagedLogin() {
  managedLogin = false;
}

export function isManagedLogin() {
  return managedLogin;
}
