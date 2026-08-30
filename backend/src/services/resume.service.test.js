import { activateResume, createApplication } from "./resume.service.js";

describe("resume ownership and activation", () => {
  it("rejects an application creation attempt that references another user's resume", async () => {
    const client = { query: async () => ({ rows: [] }) };

    await expect(
      createApplication({
        withTransaction: async (fn) => fn(client),
        userId: "user-a",
        jobId: "job-1",
        activeResumeId: "resume-owned-by-user-b",
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "That resume does not belong to your account" });
  });

  it("checks owned resume before inserting an application", async () => {
    const calls = [];
    const client = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return calls.length === 1 ? { rows: [{ id: "resume-1" }] } : { rows: [{ id: "application-1" }] };
      },
    };

    const result = await createApplication({
      withTransaction: async (fn) => fn(client),
      userId: "user-a",
      jobId: "job-1",
      activeResumeId: "resume-1",
    });

    expect(result.rows[0].id).toBe("application-1");
    expect(calls[0].sql).toContain("user_id=$2 FOR SHARE");
    expect(calls[1].sql).toContain("INSERT INTO applications");
  });

  it("does not deactivate any resume when the requested activation target is missing", async () => {
    const calls = [];
    const client = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return { rows: [] };
      },
    };

    await expect(
      activateResume({
        withTransaction: async (fn) => fn(client),
        userId: "user-a",
        resumeId: "missing-resume",
      })
    ).rejects.toMatchObject({ statusCode: 404, message: "Resume not found" });

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("FOR UPDATE");
  });

  it("deactivates other versions and activates the target in one transaction callback", async () => {
    const calls = [];
    const client = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (calls.length === 1) return { rows: [{ id: "resume-2" }] };
        if (calls.length === 3) return { rows: [{ id: "resume-2", is_active: true }] };
        return { rows: [] };
      },
    };
    let transactions = 0;

    const resume = await activateResume({
      withTransaction: async (fn) => {
        transactions += 1;
        return fn(client);
      },
      userId: "user-a",
      resumeId: "resume-2",
    });

    expect(transactions).toBe(1);
    expect(resume).toMatchObject({ id: "resume-2", is_active: true });
    expect(calls[1].sql).toContain("is_active=false");
    expect(calls[2].sql).toContain("is_active=true");
  });
});
