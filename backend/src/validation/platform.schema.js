import { z } from "zod";

export const resumeSchema = z.object({
  label: z.string().trim().min(1, "Give this version a label").max(255),
  file_url: z.string().trim().url("Enter a valid link to the file").max(1000),
});

export const noteSchema = z.object({
  content: z.string().trim().min(1, "Note cannot be empty").max(5000),
});

export const interviewSchema = z.object({
  round_name: z.string().trim().min(1, "Round name is required").max(255),
  scheduled_at: z.string().datetime({ message: "Pick a valid date and time" }),
  location: z.string().trim().max(255).optional(),
});

export const applicationUpdateSchema = z.object({
  active_resume_id: z.string().uuid().nullable().optional(),
});
