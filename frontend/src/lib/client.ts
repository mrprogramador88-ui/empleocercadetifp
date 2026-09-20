// Identificador anónimo por navegador (sin login): viaja como parámetro y
// mantiene el perfil separado por navegador en el backend.
const KEY = "ecdt_client_id";

export function getClientId(): string {
  let value = localStorage.getItem(KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(KEY, value);
  }
  return value;
}
