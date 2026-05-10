import { z } from "zod";

export const AppConfigSchema = z.object({
  erpRoll: z.string(),
  erpUrl: z.string().url(),

  securityQuestions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
    })
  ),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;