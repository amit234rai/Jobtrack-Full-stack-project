import { dispatchOutbox, processInterviewReminder } from "./outbox.service.js";

describe("outbox dispatch", () => {
  it("claims an event, uses its idempotency key, and marks it processed", async () => {
    const calls = [];
    const query = async (sql, params) => {
      calls.push({ sql, params });
      if (calls.length === 1) {
        return {
          rows: [
            {
              id: "event-1",
              payload: { scheduled_at: "2026-08-28T10:30:00.000Z", interview_id: "interview-1" },
            },
          ],
        };
      }
      return { rows: [] };
    };
    const added = [];
    const queue = { add: async (...args) => added.push(args) };

    await dispatchOutbox({
      query,
      queue,
      leadMinutes: 30,
      now: () => Date.parse("2026-08-28T10:00:00.000Z"),
    });

    expect(added).toHaveLength(1);
    expect(added[0][2]).toMatchObject({ jobId: "event-1", delay: 0, attempts: 3 });
    expect(calls[0].sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(calls[1]).toEqual({
      sql: "UPDATE outbox_events SET processed=true, processing_at=NULL WHERE id=$1",
      params: ["event-1"],
    });
  });

  it("releases a claim when queueing fails so a later poll can retry", async () => {
    const calls = [];
    const query = async (sql, params) => {
      calls.push({ sql, params });
      return calls.length === 1
        ? { rows: [{ id: "event-1", payload: { scheduled_at: "2026-08-28T10:30:00.000Z" } }] }
        : { rows: [] };
    };
    const queue = { add: async () => { throw new Error("Redis unavailable"); } };

    await expect(dispatchOutbox({ query, queue, leadMinutes: 30 })).rejects.toThrow("Redis unavailable");
    expect(calls[1]).toEqual({
      sql: "UPDATE outbox_events SET processing_at=NULL WHERE id=$1",
      params: ["event-1"],
    });
  });
});

describe("interview reminder processing", () => {
  it("sends to the interview email and records a successful send", async () => {
    const queries = [];
    const client = {
      query: async (sql, params) => {
        queries.push({ sql, params });
        if (queries.length === 1) {
          return {
            rows: [
              {
                email: "candidate@example.com",
                full_name: "Candidate",
                round_name: "Technical",
                scheduled_at: "2026-08-28T10:30:00.000Z",
                location: "https://meet.example.com",
                reminder_sent: false,
                title: "Backend Engineer",
                company: "Acme",
              },
            ],
          };
        }
        return { rows: [] };
      },
    };
    const sent = [];

    const didSend = await processInterviewReminder({
      withTransaction: async (fn) => fn(client),
      sendReminder: async (payload) => sent.push(payload),
      interviewId: "interview-1",
    });

    expect(didSend).toBe(true);
    expect(sent[0]).toMatchObject({ to: "candidate@example.com", role: "Backend Engineer" });
    expect(queries[1]).toEqual({
      sql: "UPDATE interviews SET reminder_sent=true WHERE id=$1",
      params: ["interview-1"],
    });
  });

  it("does not send a second reminder when the interview is already marked sent", async () => {
    const client = {
      query: async () => ({ rows: [{ reminder_sent: true }] }),
    };
    const sendReminder = async () => { throw new Error("should not send"); };

    await expect(
      processInterviewReminder({
        withTransaction: async (fn) => fn(client),
        sendReminder,
        interviewId: "interview-1",
      })
    ).resolves.toBe(false);
  });
});
