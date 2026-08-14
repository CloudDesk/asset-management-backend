CREATE TABLE IF NOT EXISTS "return_status_timeline" (
  "id" SERIAL PRIMARY KEY,
  "return_request_id" INTEGER NOT NULL,
  "previous_status" VARCHAR(100),
  "status" VARCHAR(100) NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "actor_type" VARCHAR(50),
  "actor_id" INTEGER,
  "message" TEXT,
  "metadata" JSONB,
  "createddate" BIGINT,
  CONSTRAINT "return_status_timeline_return_request_id_fkey"
    FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_return_status_timeline_request"
  ON "return_status_timeline"("return_request_id");

CREATE INDEX IF NOT EXISTS "idx_return_status_timeline_status"
  ON "return_status_timeline"("status");

CREATE INDEX IF NOT EXISTS "idx_return_status_timeline_event_type"
  ON "return_status_timeline"("event_type");

INSERT INTO "return_status_timeline" (
  "return_request_id",
  "previous_status",
  "status",
  "event_type",
  "actor_type",
  "actor_id",
  "message",
  "metadata",
  "createddate"
)
SELECT
  request."id",
  NULL,
  request."status",
  'current_status_backfill',
  'system',
  NULL,
  'Current status backfilled for timeline',
  jsonb_build_object('backfilled', true, 'requestNumber', request."requestnumber"),
  COALESCE(request."modifieddate", request."createddate")
FROM "return_requests" AS request
WHERE NOT EXISTS (
  SELECT 1
  FROM "return_status_timeline" AS timeline
  WHERE timeline."return_request_id" = request."id"
);
