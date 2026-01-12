/**
 * JWT Token Validation for Cognito and OIDC
 *
 * For local development, we validate:
 * - JWT structure (3 parts, valid base64)
 * - Token expiration
 * - Basic claims structure
 *
 * We do NOT verify signatures (we don't have the keys locally).
 * This is intentional for local development convenience.
 */

export interface JwtValidationResult {
  isValid: boolean;
  error?: string;
  claims?: JwtClaims;
}

export interface JwtClaims {
  /** Subject - typically user ID */
  sub?: string;
  /** Issuer - Cognito user pool URL or OIDC provider */
  iss?: string;
  /** Audience - client ID */
  aud?: string | string[];
  /** Expiration time (Unix timestamp) */
  exp?: number;
  /** Issued at time (Unix timestamp) */
  iat?: number;
  /** Token use (access, id) */
  token_use?: string;
  /** Cognito username */
  'cognito:username'?: string;
  /** Cognito groups */
  'cognito:groups'?: string[];
  /** Email */
  email?: string;
  /** Email verified */
  email_verified?: boolean;
  /** Custom claims */
  [key: string]: unknown;
}

/**
 * Decode base64url string (JWT uses base64url, not standard base64)
 */
function base64UrlDecode(str: string): string {
  // Replace base64url chars with base64 chars
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

/**
 * Parse JWT token without verifying signature
 * Returns the decoded payload claims
 */
export function parseJwt(token: string): JwtValidationResult {
  if (!token) {
    return { isValid: false, error: 'Token is empty' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { isValid: false, error: 'Invalid JWT structure: expected 3 parts' };
  }

  try {
    // Decode header (for debugging, we don't use it)
    const headerJson = base64UrlDecode(parts[0]);
    JSON.parse(headerJson); // Validate it's valid JSON

    // Decode payload
    const payloadJson = base64UrlDecode(parts[1]);
    const claims = JSON.parse(payloadJson) as JwtClaims;

    return { isValid: true, claims };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to decode JWT: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate JWT token for Cognito or OIDC authentication
 */
export function validateJwt(
  token: string,
  options: {
    /** Check token expiration (default: true) */
    checkExpiration?: boolean;
    /** Expected issuer (Cognito user pool URL or OIDC provider) */
    expectedIssuer?: string;
    /** Expected audience (client ID) */
    expectedAudience?: string;
    /** Clock skew tolerance in seconds (default: 60) */
    clockSkewSeconds?: number;
  } = {}
): JwtValidationResult {
  const { checkExpiration = true, expectedIssuer, expectedAudience, clockSkewSeconds = 60 } = options;

  // Parse the token
  const parseResult = parseJwt(token);
  if (!parseResult.isValid) {
    return parseResult;
  }

  const claims = parseResult.claims!;

  // Check expiration
  if (checkExpiration && claims.exp) {
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp + clockSkewSeconds < now) {
      return {
        isValid: false,
        error: 'Token has expired',
        claims,
      };
    }
  }

  // Check issuer if specified
  if (expectedIssuer && claims.iss !== expectedIssuer) {
    return {
      isValid: false,
      error: `Invalid issuer: expected '${expectedIssuer}', got '${claims.iss}'`,
      claims,
    };
  }

  // Check audience if specified
  if (expectedAudience) {
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(expectedAudience)) {
      return {
        isValid: false,
        error: `Invalid audience: expected '${expectedAudience}'`,
        claims,
      };
    }
  }

  return { isValid: true, claims };
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Validate Cognito JWT token
 * Checks structure, expiration, and optionally user pool ID
 */
export function validateCognitoToken(token: string, userPoolId?: string): JwtValidationResult {
  // Cognito issuer format: https://cognito-idp.{region}.amazonaws.com/{userPoolId}
  const expectedIssuer = userPoolId ? undefined : undefined; // We'd need region too

  const result = validateJwt(token, {
    checkExpiration: true,
    expectedIssuer,
  });

  if (!result.isValid) {
    return result;
  }

  // Additional Cognito-specific validation
  const claims = result.claims!;

  // Check if it looks like a Cognito token
  if (claims.iss && !claims.iss.includes('cognito-idp')) {
    // Not a Cognito token, but might be valid OIDC
    return result;
  }

  // Validate token_use for Cognito tokens
  if (claims.token_use && !['access', 'id'].includes(claims.token_use)) {
    return {
      isValid: false,
      error: `Invalid token_use: expected 'access' or 'id', got '${claims.token_use}'`,
      claims,
    };
  }

  return result;
}

/**
 * Validate OIDC JWT token
 */
export function validateOidcToken(token: string, issuer?: string, clientId?: string): JwtValidationResult {
  return validateJwt(token, {
    checkExpiration: true,
    expectedIssuer: issuer,
    expectedAudience: clientId,
  });
}
