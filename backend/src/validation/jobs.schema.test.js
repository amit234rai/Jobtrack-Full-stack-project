import { importJobsSchema, updateStatusSchema } from "./jobs.schema.js";

describe("job and pipeline validation", () => {
  it("accepts a limited valid import", () =>
    expect(
      importJobsSchema.safeParse({
        jobs: [{ title: "Backend Engineer", company_name: "Acme" }],
      }).success
    ).toBe(true));

  it("rejects an empty import", () =>
    expect(importJobsSchema.safeParse({ jobs: [] }).success).toBe(false));

  it("rejects statuses outside the pipeline", () =>
    expect(updateStatusSchema.safeParse({ status: "hired" }).success).toBe(false));
});
