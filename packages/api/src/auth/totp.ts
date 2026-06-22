/**
 * TOTP MFA helpers (Auth.js-compatible TOTP via otplib).
 *
 * Spec: MFA required at first login, no bypass. TOTP seeds live in Supabase Vault
 * in production. This module generates/verifies codes; the storage layer decides
 * where the seed is persisted. team_members.totp_secret holds a Vault key id in
 * prod, or the seed directly in dev (NODE_ENV !== production).
 */

import { authenticator } from "otplib";
import QRCode from "qrcode";
import { env } from "../lib/env.js";

authenticator.options = { window: 1 }; // allow +/-1 step for clock drift

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function verifyToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s+/g, ""), secret });
  } catch {
    return false;
  }
}

export function otpauthUrl(username: string, secret: string): string {
  return authenticator.keyuri(username, env.totpIssuer, secret);
}

/** Returns a data: URL PNG for the enrollment QR code. */
export async function enrollmentQrDataUrl(username: string, secret: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl(username, secret));
}
