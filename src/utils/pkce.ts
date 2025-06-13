
// PKCE (Proof Key for Code Exchange) utilities for OAuth2 flows
// Implements RFC 7636 standards

/**
 * Generates a cryptographically secure random string for code_verifier
 * According to RFC 7636, it should be 43-128 characters long
 */
export const generateCodeVerifier = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
};

/**
 * Creates a code_challenge from the code_verifier using SHA256
 * @param codeVerifier The code verifier string
 * @returns Promise<string> The base64url-encoded SHA256 hash
 */
export const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
};

/**
 * Base64url encoding (without padding)
 * @param buffer The buffer to encode
 * @returns The base64url-encoded string
 */
const base64UrlEncode = (buffer: Uint8Array): string => {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Stores PKCE parameters for later use in the callback
 * @param codeVerifier The code verifier to store
 * @param state The OAuth state parameter
 */
export const storePKCEParams = (codeVerifier: string, state: string): void => {
  localStorage.setItem('onedrive_code_verifier', codeVerifier);
  localStorage.setItem('onedrive_auth_state', state);
};

/**
 * Retrieves and clears PKCE parameters from storage
 * @param state The state to verify
 * @returns The code verifier if state matches, null otherwise
 */
export const retrieveAndClearPKCEParams = (state: string): string | null => {
  const storedState = localStorage.getItem('onedrive_auth_state');
  const codeVerifier = localStorage.getItem('onedrive_code_verifier');
  
  if (!storedState || !codeVerifier || storedState !== state) {
    // Clean up any stored values if verification fails
    localStorage.removeItem('onedrive_code_verifier');
    localStorage.removeItem('onedrive_auth_state');
    return null;
  }
  
  // Clean up after successful retrieval
  localStorage.removeItem('onedrive_code_verifier');
  localStorage.removeItem('onedrive_auth_state');
  
  return codeVerifier;
};
