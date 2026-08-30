import { badRequest, notFoundError } from "../utils/api-error.js";

export async function activateResume({ withTransaction, userId, resumeId }) {
  return withTransaction(async (client) => {
    const target = await client.query(
      "SELECT id FROM resume_versions WHERE id=$1 AND user_id=$2 FOR UPDATE",
      [resumeId, userId]
    );

    if (!target.rows[0]) throw notFoundError("Resume not found");

    await client.query(
      "UPDATE resume_versions SET is_active=false WHERE user_id=$1 AND id<>$2",
      [userId, resumeId]
    );

    const result = await client.query(
      "UPDATE resume_versions SET is_active=true WHERE id=$1 AND user_id=$2 RETURNING *",
      [resumeId, userId]
    );

    return result.rows[0];
  });
}

export async function createApplication({ withTransaction, userId, jobId, activeResumeId }) {
  return withTransaction(async (client) => {
    if (activeResumeId) {
      const resume = await client.query(
        "SELECT id FROM resume_versions WHERE id=$1 AND user_id=$2 FOR SHARE",
        [activeResumeId, userId]
      );

      if (!resume.rows[0]) throw badRequest("That resume does not belong to your account");
    }

    return client.query(
      `INSERT INTO applications (user_id, job_id, active_resume_id, status)
       VALUES ($1, $2, $3, 'saved')
       RETURNING *`,
      [userId, jobId, activeResumeId ?? null]
    );
  });
}

export async function createApplicationWithJob({ withTransaction, userId, title, companyName, activeResumeId }) {
  return withTransaction(async (client) => {
    if (activeResumeId) {
      const resume = await client.query(
        "SELECT id FROM resume_versions WHERE id=$1 AND user_id=$2 FOR SHARE",
        [activeResumeId, userId]
      );
      if (!resume.rows[0]) throw badRequest("That resume does not belong to your account");
    }

    const company = await client.query(
      `INSERT INTO companies (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [companyName]
    );
    const job = await client.query(
      "INSERT INTO jobs (company_id, title) VALUES ($1, $2) RETURNING *",
      [company.rows[0].id, title]
    );
    const application = await client.query(
      `INSERT INTO applications (user_id, job_id, active_resume_id, status)
       VALUES ($1, $2, $3, 'saved') RETURNING *`,
      [userId, job.rows[0].id, activeResumeId ?? null]
    );

    return { job: { ...job.rows[0], company_name: company.rows[0].name }, application: application.rows[0] };
  });
}
