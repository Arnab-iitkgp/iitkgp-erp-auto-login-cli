import { z } from "zod";

export const AppConfigSchema = z.object({
  erpRoll: z.string(),
  erpUrl: z.string().url(),
  gmailEmail: z.string().email(),
  securityQuestions: z.record(
    z.string(),  // key
    z.string()   // value
  ),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;