# JobTrack current audit

Updated: 30 August 2026. This report describes the checked source, not an aspirational feature list.

## Corrected in this review

- The board no longer requests an invalid `limit=500`; it uses the API maximum of 100 and exposes page navigation.
- A refresh error no longer clears already-rendered applications. The UI displays the error instead.
- Saving a note inserts the confirmed note into the open drawer immediately, then refreshes detail data.
- Status changes now cast the reused status parameter consistently, preventing PostgreSQL's `text`/`varchar` inference error.
- Add a role uses `POST /applications/with-job`, which creates company, job, and application in one database transaction.
- Supertest can import Express without opening port 4000. Redis connects only when a cache command is used. Integration tests clean up their pool and Redis client.

## Remaining product and operational gaps

1. Jobs remain globally visible and have no creator field. Confirm that shared job postings are intentional.
2. Access tokens cannot be revoked after password reset; an issued token can remain valid until expiry.
3. Resume handling stores URLs only and has no frontend management screen.
4. SQL files mounted into Postgres init run only for a new data volume. Existing databases need a deliberate migration procedure before schema changes are deployed.
5. `/health` verifies PostgreSQL only; it does not prove Redis or SMTP is ready.
6. Browser-level tests are absent. The Jest integration tests are skipped unless their process is configured with a reachable disposable database.

## Verification performed

- `npm test` in `backend`: 5 suites, 27 passing tests. Database-backed cases were skipped in the local Jest environment because it has no database connection.
- `npm run build` in `frontend`: production build passed.
- Live API check on `http://localhost:4000`: health returned `ok`; signup plus `POST /applications/with-job` returned a saved application, and its detail endpoint returned the same application.
