/**
 * Permission middleware. Enforces the role matrix on every protected route.
 * Use after requireAuth: router.post("/", requireAuth, requirePermission("add_edit_client"), handler)
 */

import type { Request, Response, NextFunction } from "express";
import { can, type Permission } from "../lib/permissions.js";

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.auth?.role;
    if (!role) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!can(role, permission)) {
      res.status(403).json({ error: `Forbidden: '${permission}' not permitted for role '${role}'` });
      return;
    }
    next();
  };
}
