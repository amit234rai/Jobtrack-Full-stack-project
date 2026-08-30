import { z } from "zod";

export const VALID_STATUSES = ["saved", "applied", "oa", "interview", "offer", "rejected"];
export const FUNNEL_STAGES = ["applied", "oa", "interview", "offer"];

const optionalUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .max(1000)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createJobSchema = z
  .object({
    title: z.string().trim().min(1, "Job title is required").max(255),
    description: z.string().trim().max(20_000).optional(),
    location: z.string().trim().max(255).optional(),
    source_url: optionalUrl,
    salary_min: z.coerce.number().int().nonnegative().optional(),
    salary_max: z.coerce.number().int().nonnegative().optional(),
    company_name: z.string().trim().min(1).max(255).optional(),
  })
  .refine(
    (job) => job.salary_min === undefined || job.salary_max === undefined || job.salary_min <= job.salary_max,
    { message: "Minimum salary cannot exceed maximum salary", path: ["salary_min"] }
  );

export const importJobsSchema = z.object({
  jobs: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Job title is required").max(255),
        company_name: z.string().trim().min(1).max(255).optional(),
        location: z.string().trim().max(255).optional(),
        source_url: optionalUrl,
        description: z.string().trim().max(20_000).optional(),
      })
    )
    .min(1, "Add at least one row to import")
    .max(100, "Import is limited to 100 rows at a time"),
});

export const createApplicationSchema = z.object({
  job_id: z.string().uuid("A valid job id is required"),
  active_resume_id: z.string().uuid().optional(),
});

export const createApplicationWithJobSchema = z.object({
  title: z.string().trim().min(1, "Job title is required").max(255),
  company_name: z.string().trim().min(1, "Company is required").max(255),
  active_resume_id: z.string().uuid().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(VALID_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${VALID_STATUSES.join(", ")}` }),
  }),
});

export const listApplicationsQuerySchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  search: z.string().trim().max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().uuid("Invalid id") });
