import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { pool } from "./db/pool.js";
import { withTransaction } from "./db/transaction.js";
import { redis } from "./db/redis.js";
import { env } from "./config/env.js";
import { sendInterviewReminder } from "./utils/mail.js";
import { dispatchOutbox as dispatch, processInterviewReminder } from "./services/outbox.service.js";

const queue = new Queue("notifications", { connection: redis });
const leadMinutes = env.REMINDER_LEAD_MINUTES;

async function dispatchOutbox() {
  return dispatch({ query: pool.query.bind(pool), queue, leadMinutes });
}

setInterval(() => dispatchOutbox().catch(console.error), 5000);
dispatchOutbox().catch(console.error);

new Worker(
  "notifications",
  async (job) =>
    processInterviewReminder({
      withTransaction,
      sendReminder: sendInterviewReminder,
      interviewId: job.data.interview_id,
    }),
  { connection: redis }
);

console.log("Worker started: processing interview reminders");
