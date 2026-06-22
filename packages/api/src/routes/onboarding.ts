/**
 * Brain Injection (Tier 3) onboarding.
 *
 * Public, no-login form served at /onboarding/:token. Five questions. On submit,
 * answers save to lls_brain_injection_responses and a thank-you screen shows (no
 * redirect). The team reviews answers inside the client workspace before queuing
 * content jobs.
 */

import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, clients, llsBrainInjectionResponses, llsIrisMemory } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { publicFormLimiter } from "../middleware/rateLimit.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { writeAudit } from "../lib/audit.js";
import { env } from "../lib/env.js";

/** Public router — mounted at /onboarding (no auth). */
export const onboardingPublicRouter = Router();

/** The five Brain Injection questions, surfaced to the public form. */
export const BRAIN_INJECTION_QUESTIONS = [
  { key: "bestCustomerDescription", label: "What do your best customers say about you? (What words do they use?)" },
  { key: "proudOf", label: "What are you most proud of that customers never see? (Behind-the-scenes excellence)" },
  { key: "bestCustomerStory", label: "Tell me your best customer story. (The job or client you still talk about)" },
  { key: "differentiator", label: "What makes you genuinely different from your top competitor?" },
  { key: "wishCustomersKnew", label: "What do you wish customers knew before they called you?" },
] as const;

onboardingPublicRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const [resp] = await db
      .select()
      .from(llsBrainInjectionResponses)
      .where(eq(llsBrainInjectionResponses.responseToken, req.params.token))
      .limit(1);
    if (!resp) throw new HttpError(404, "This onboarding link is not valid");

    const [client] = await db.select().from(clients).where(eq(clients.id, resp.clientId)).limit(1);
    res.json({
      businessName: client?.businessName ?? "your business",
      status: resp.status,
      alreadySubmitted: resp.status !== "pending",
      questions: BRAIN_INJECTION_QUESTIONS,
    });
  })
);

const submitSchema = z.object({
  bestCustomerDescription: z.string().max(5000).optional(),
  proudOf: z.string().max(5000).optional(),
  bestCustomerStory: z.string().max(5000).optional(),
  differentiator: z.string().max(5000).optional(),
  wishCustomersKnew: z.string().max(5000).optional(),
  additionalNotes: z.string().max(5000).optional(),
});

onboardingPublicRouter.post(
  "/:token",
  publicFormLimiter,
  asyncHandler(async (req, res) => {
    const body = submitSchema.parse(req.body);
    const [resp] = await db
      .select()
      .from(llsBrainInjectionResponses)
      .where(eq(llsBrainInjectionResponses.responseToken, req.params.token))
      .limit(1);
    if (!resp) throw new HttpError(404, "This onboarding link is not valid");
    if (resp.status !== "pending") throw new HttpError(409, "This form has already been submitted");

    await db
      .update(llsBrainInjectionResponses)
      .set({ ...body, status: "submitted", submittedAt: new Date() })
      .where(eq(llsBrainInjectionResponses.id, resp.id));

    res.json({ ok: true, message: "Thank you. Your answers have been received." });
  })
);

/** Workspace router — mounted at /api/clients (auth required). */
export const onboardingWorkspaceRouter = Router();

onboardingWorkspaceRouter.get(
  "/:slug/brain-injection",
  requireAuth,
  requirePermission("view_all_clients"),
  asyncHandler(async (req, res) => {
    const [client] = await db.select().from(clients).where(eq(clients.slug, req.params.slug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");
    const [resp] = await db
      .select()
      .from(llsBrainInjectionResponses)
      .where(eq(llsBrainInjectionResponses.clientId, client.id))
      .limit(1);
    if (!resp) throw new HttpError(404, "No Brain Injection record for this client");

    res.json({
      status: resp.status,
      onboardingUrl: `${env.onboardingBaseUrl}/onboarding/${resp.responseToken}`,
      submittedAt: resp.submittedAt,
      answers:
        resp.status === "pending"
          ? null
          : {
              bestCustomerDescription: resp.bestCustomerDescription,
              proudOf: resp.proudOf,
              bestCustomerStory: resp.bestCustomerStory,
              differentiator: resp.differentiator,
              wishCustomersKnew: resp.wishCustomersKnew,
              additionalNotes: resp.additionalNotes,
            },
    });
  })
);

onboardingWorkspaceRouter.post(
  "/:slug/brain-injection/review",
  requireAuth,
  requirePermission("approve_content"),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const [client] = await db.select().from(clients).where(eq(clients.slug, req.params.slug)).limit(1);
    if (!client) throw new HttpError(404, "Client not found");
    const [resp] = await db
      .select()
      .from(llsBrainInjectionResponses)
      .where(eq(llsBrainInjectionResponses.clientId, client.id))
      .limit(1);
    if (!resp) throw new HttpError(404, "No Brain Injection record for this client");
    if (resp.status !== "submitted") throw new HttpError(409, "Nothing to review yet");

    await db
      .update(llsBrainInjectionResponses)
      .set({ status: "reviewed", reviewedBy: auth.sub, reviewedAt: new Date() })
      .where(eq(llsBrainInjectionResponses.id, resp.id));

    // Feed Iris memory at confidence 1.0 (stored as 100). Schema-only consumer for now.
    const memories: Array<[string, string | null]> = [
      ["best_customer_description", resp.bestCustomerDescription],
      ["proud_of", resp.proudOf],
      ["best_customer_story", resp.bestCustomerStory],
      ["differentiator", resp.differentiator],
      ["wish_customers_knew", resp.wishCustomersKnew],
    ];
    const rows = memories
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => ({ clientId: client.id, memoryKey: k, memoryValue: v as string, source: "brain_injection", confidence: 100 }));
    if (rows.length) await db.insert(llsIrisMemory).values(rows);

    await writeAudit({
      actorId: auth.sub,
      actorRole: auth.role,
      action: "review_brain_injection",
      entityType: "brain_injection",
      entityId: resp.id,
      ipAddress: req.ip ?? null,
    });
    res.json({ ok: true });
  })
);
