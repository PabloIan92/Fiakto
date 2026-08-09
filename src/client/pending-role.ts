// El signup dispara dos llamadas a /api/session en paralelo: la explicita
// del formulario de login y la reactiva de AuthProvider (onIdTokenChanged).
// Cualquiera de las dos puede llegar primero al servidor, asi que ambas
// leen el rol elegido desde esta variable compartida en vez de que una
// dependa del timing de la otra.
let pendingSignupRole: "customer" | "professional" | undefined;

export function setPendingSignupRole(role: "customer" | "professional" | undefined) {
  pendingSignupRole = role;
}

export function peekPendingSignupRole() {
  return pendingSignupRole;
}

export function clearPendingSignupRole() {
  pendingSignupRole = undefined;
}
