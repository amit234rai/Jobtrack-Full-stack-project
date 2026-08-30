import request from "supertest";
import app from "./server.js";
import { pool } from "./db/pool.js";
import { redis } from "./db/redis.js";

const TEST_EMAIL = `test_${Date.now()}@example.com`;
const TEST_PASSWORD = "testpass123";
const TEST_NAME = "Test User";

let authToken;
let testUserId;
let testJobId;
let testAppId;
let dbAvailable = false;

const hasDb = async () => {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
};

describe("Integration Tests", () => {
  beforeAll(async () => {
    dbAvailable = await hasDb();
    if (!dbAvailable) {
      console.log("Skipping integration tests: database not available");
      return;
    }
    await pool.query("DELETE FROM applications WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [TEST_EMAIL]);
    await pool.query("DELETE FROM users WHERE email = $1", [TEST_EMAIL]);
  });

  afterAll(async () => {
    if (dbAvailable) {
      await pool.query("DELETE FROM applications WHERE user_id = $1", [testUserId]);
      await pool.query("DELETE FROM users WHERE id = $1", [testUserId]);
    }
    redis.disconnect();
    await pool.end();
  });

  const skipIfNoDb = () => !dbAvailable;

  test("POST /auth/signup - creates account and returns token", async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .post("/auth/signup")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, full_name: TEST_NAME })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.user.full_name).toBe(TEST_NAME);

    authToken = res.body.data.token;
    testUserId = res.body.data.user.id;
  });

  test("POST /auth/login - logs in and returns token", async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    authToken = res.body.data.token;
  });

  test("GET /auth/me - returns current user with valid token", async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
  });

  test("POST /jobs - creates a job", async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Test Engineer", company_name: "Test Corp" })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.job).toBeDefined();
    expect(res.body.data.job.title).toBe("Test Engineer");
    testJobId = res.body.data.job.id;
  });

  test("POST /applications - saves job to board", async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .post("/applications")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ job_id: testJobId })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.application).toBeDefined();
    expect(res.body.data.application.status).toBe("saved");
    testAppId = res.body.data.application.id;
  });

  test("POST /applications/with-job creates the job and board card atomically", async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .post("/applications/with-job")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Atomic test role", company_name: "Atomic Test Company" })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.job.title).toBe("Atomic test role");
    expect(res.body.data.application.job_id).toBe(res.body.data.job.id);
  });

  test("GET /applications - lists user applications", async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .get("/applications")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.applications)).toBe(true);
    expect(res.body.data.applications.length).toBeGreaterThan(0);
    const app = res.body.data.applications.find(a => a.id === testAppId);
    expect(app).toBeDefined();
  });

  test("PATCH /applications/:id/status - updates application status", async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .patch(`/applications/${testAppId}/status`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "applied" })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.application.status).toBe("applied");
    expect(res.body.data.application.applied_at).toBeDefined();
  });

  test("PATCH /applications/:id/status - moves through pipeline", async () => {
    if (skipIfNoDb()) return;
    const statuses = ["interview", "offer"];
    for (const status of statuses) {
      const res = await request(app)
        .patch(`/applications/${testAppId}/status`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ status })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.application.status).toBe(status);
    }
  });

  test("POST /applications/:id/notes saves a note that detail returns", async () => {
    if (skipIfNoDb()) return;
    const content = "Follow up with the recruiter on Tuesday";
    const createResponse = await request(app)
      .post(`/applications/${testAppId}/notes`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ content })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.note.content).toBe(content);

    const detailResponse = await request(app)
      .get(`/applications/${testAppId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(detailResponse.body.data.notes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createResponse.body.data.note.id, content })])
    );
  });

  test("GET /dashboard - returns dashboard metrics", async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .get("/dashboard")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.dashboard).toBeDefined();
    expect(res.body.data.dashboard.counts).toBeDefined();
    expect(typeof res.body.data.dashboard.counts.offer).toBe("number");
  });

  test("GET /health - returns health status", async () => {
    if (skipIfNoDb()) return;
    const res = await request(app)
      .get("/health")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.db_time).toBeDefined();
  });
});
