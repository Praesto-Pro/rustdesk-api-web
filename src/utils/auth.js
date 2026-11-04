const TokenKey = 'access_token'
const OidcCode = 'oidc_code'
const OidcCodeExpiry = 'oidc_code_expiry';

export function getToken () {
  return localStorage.getItem(TokenKey)
}

export function setToken (token) {
  localStorage.setItem(`wc-option:local:access_token`, token)
  return localStorage.setItem(TokenKey, token)
}

export function removeToken () {
  localStorage.removeItem('wc-option:local:access_token')
  localStorage.removeItem('user_info')
  return localStorage.removeItem(TokenKey)
}

// Store the code with its expiry timestamp in milliseconds
export function setCode(code) {
  const now = Date.now(); // Current timestamp in milliseconds
  const expiry = now + 60 * 1000; // Expire after 60 seconds

  localStorage.setItem(OidcCode, code); // Store the code
  localStorage.setItem(OidcCodeExpiry, expiry); // Store the expiry timestamp
}

// Get the code; remove it and return null if expired
export function getCode() {
  const expiry = localStorage.getItem(OidcCodeExpiry); // Get the expiry timestamp
  const now = Date.now(); // Current timestamp

  const timestamp = Number(expiry)
  if (!expiry || !Number.isSafeInteger(timestamp) || timestamp <= now || timestamp > now + 60_000) {
    // Remove the code and expiry timestamp if expired
    removeCode();
    return null;
  }
  return localStorage.getItem(OidcCode); // Return the code if it has not expired
}

// Remove the code and expiry timestamp
export function removeCode() {
  localStorage.removeItem(OidcCode);
  localStorage.removeItem(OidcCodeExpiry);
}
