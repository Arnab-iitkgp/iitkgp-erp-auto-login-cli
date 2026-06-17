import { z } from "zod";

export const AppConfigSchema = z.object({
  erpRoll: z.string(),
  erpUrl: z.string().url(),
  gmailEmail: z.string().email(),
  securityQuestions: z.record(
    z.string(),  // key
    z.string()   // value
  ),
  savedSlots: z.array(z.string()).optional(),
  slotNames: z.record(z.string(), z.string()).optional(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;