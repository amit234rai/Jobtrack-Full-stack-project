export const CLAIM_OUTBOX_EVENTS_SQL = `WITH claimable AS (
  SELECT id
  FROM outbox_events
  WHERE processed = false
    AND (processing_at IS NULL OR processing_at < now() - interval '5 minutes')
  ORDER BY created_at
  LIMIT 100
  FOR UPDATE SKIP LOCKED
)
UPDATE outbox_events AS event
SET processing_at = now(),
    dispatch_attempts = event.dispatch_attempts + 1
FROM claimable
WHERE event.id = claimable.id
RETURNING event.*`;

export async function dispatchOutbox({ query, queue, leadMinutes, now = Date.now }) {
  const events = await query(CLAIM_OUTBOX_EVENTS_SQL);

  for (const event of events.rows) {
    try {
      const delay = Math.max(
        0,
        new Date(event.payload.scheduled_at).getTime() - now() - leadMinutes * 60000
      );

      await queue.add("interview-reminder", event.payload, {
        jobId: event.id,
        delay,
        removeOnComplete: { age: 86_400 },
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });

      await query("UPDATE outbox_events SET processed=true, processing_at=NULL WHERE id=$1", [event.id]);
    } catch (error) {
      await query("UPDATE outbox_events SET processing_at=NULL WHERE id=$1", [event.id]);
      throw error;
    }
  }
}

export async function processInterviewReminder({ withTransaction, sendReminder, interviewId }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT u.email, u.full_name, i.round_name, i.scheduled_at, i.location,
              i.reminder_sent, j.title, c.name AS company
       FROM interviews i
       JOIN applications a ON a.id=i.application_id
       JOIN users u ON u.id=a.user_id
       JOIN jobs j ON j.id=a.job_id
       LEFT JOIN companies c ON c.id=j.company_id
       WHERE i.id=$1
       FOR UPDATE OF i`,
      [interviewId]
    );

    const interview = result.rows[0];
    if (!interview || interview.reminder_sent) return false;

    await sendReminder({
      to: interview.email,
      name: interview.full_name,
      role: interview.title,
      company: interview.company || "the company",
      round: interview.round_name,
      scheduledAt: interview.scheduled_at,
      location: interview.location,
    });

    await client.query("UPDATE interviews SET reminder_sent=true WHERE id=$1", [interviewId]);
    return true;
  });
}
