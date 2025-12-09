/**
 * OAuth 2.0 PKCE (Proof Key for Code Exchange) client
 * Supports any OAuth2 provider configured via environment variables
 */
export class OAuth2Client {
  constructor() {
    // Load OAuth config from environment
    this.clientId = import.meta.env.VITE_OAUTH_CLIENT_ID;
    this.authorizationEndpoint = import.meta.env.VITE_OAUTH_AUTH_URL;
    this.tokenEndpoint = import.meta.env.VITE_OAUTH_TOKEN_URL;
    this.redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI || `${window.location.origin}/callback`;
    this.scope = import.meta.env.VITE_OAUTH_SCOPE || 'user:email';

    // Storage keys
    this.TOKEN_KEY = 'oauth_access_token';
    this.USERNAME_KEY = 'oauth_username';
    this.CODE_VERIFIER_KEY = 'pkce_code_verifier';
  }

  /**
   * Generate a random code verifier for PKCE
   */
  generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Generate code challenge from verifier
   */
  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64URLEncode(new Uint8Array(hash));
  }

  /**
   * Base64 URL encode (without padding)
   */
  base64URLEncode(buffer) {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Start OAuth flow - redirect to authorization endpoint
   */
  async startOAuthFlow() {
    if (!this.clientId || !this.authorizationEndpoint) {
      throw new Error('OAuth not configured. Set VITE_OAUTH_CLIENT_ID and VITE_OAUTH_AUTH_URL in .env');
    }

    // Generate and store PKCE verifier
    const codeVerifier = this.generateCodeVerifier();
    sessionStorage.setItem(this.CODE_VERIFIER_KEY, codeVerifier);

    // Generate challenge
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${this.authorizationEndpoint}?${params.toString()}`;

    // Redirect to OAuth provider
    window.location.href = authUrl;
  }

  /**
   * Handle OAuth callback - exchange code for token
   */
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Get stored code verifier
    const codeVerifier = sessionStorage.getItem(this.CODE_VERIFIER_KEY);
    if (!codeVerifier) {
      throw new Error('Code verifier not found. Please restart the OAuth flow.');
    }

    // Exchange code for token
    const tokenParams = new URLSearchParams({
      client_id: this.clientId,
      code: code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorData}`);
    }

    const data = await response.json();

    // Store access token
    localStorage.setItem(this.TOKEN_KEY, data.access_token);

    // Extract and store username from JWT token
    try {
      const username = this.extractUsernameFromToken(data.access_token);
      this.setUsername(username);
    } catch (error) {
      console.warn('Could not extract username from token:', error);
    }

    // Clean up
    sessionStorage.removeItem(this.CODE_VERIFIER_KEY);

    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);

    return data.access_token;
  }

  /**
   * Extract username from JWT token
   */
  extractUsernameFromToken(token) {
    try {
      // JWT tokens have 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1]));

      // Try different username claims in order of preference
      return payload.preferred_username
        || payload.email
        || payload.sub
        || 'oauth-user';
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      return 'oauth-user';
    }
  }

  /**
   * Get stored access token
   */
  getAccessToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Get stored username
   */
  getUsername() {
    return localStorage.getItem(this.USERNAME_KEY);
  }

  /**
   * Store username
   */
  setUsername(username) {
    localStorage.setItem(this.USERNAME_KEY, username);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getAccessToken();
  }

  /**
   * Check if stored token is expired
   */
  isTokenExpired() {
    const token = this.getAccessToken();
    if (!token) {
      return true;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true; // Invalid JWT format
      }

      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) {
        return false; // No expiration claim, assume valid
      }

      // exp is in seconds, Date.now() is in milliseconds
      // Add 30 second buffer to avoid edge cases
      const expirationTime = payload.exp * 1000;
      const now = Date.now();
      const bufferMs = 30 * 1000;

      return now >= (expirationTime - bufferMs);
    } catch {
      // If we can't decode, treat as expired to be safe
      return true;
    }
  }

  /**
   * Logout - clear stored tokens
   */
  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USERNAME_KEY);
    sessionStorage.removeItem(this.CODE_VERIFIER_KEY);
  }

  /**
   * Check if current URL is OAuth callback
   */
  isCallback() {
    const params = new URLSearchParams(window.location.search);
    return params.has('code') || params.has('error');
  }
}
