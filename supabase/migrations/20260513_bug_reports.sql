-- ============================================================================
-- bug_reports — vendor-submitted bug reports from inside the portal
--
-- Vendors hit "Report a bug" from the sidebar. Captures: short title,
-- free-text description, the URL they were on, viewport, recent
-- console output (auto-collected ring buffer), and optionally a PNG
-- screenshot stored in the private bug-report-screenshots bucket.
--
-- Sent to staff via Brevo when inserted; visible to admin via SQL
-- until a dedicated admin UI ships.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id               uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  reporter_email          text,
  title                   text NOT NULL,
  description             text NOT NULL,
  url                     text,
  user_agent              text,
  viewport                jsonb,   -- { width, height, dpr }
  console_logs            jsonb,   -- [{ level, ts, message }, ...]
  screenshot_storage_path text,    -- bug-report-screenshots/{vendor_id}/{id}.png
  metadata                jsonb,
  status                  text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','in_progress','resolved','closed','duplicate')),
  staff_notes             text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_vendor ON public.bug_reports (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON public.bug_reports (status, created_at DESC);

COMMENT ON TABLE public.bug_reports IS
  'Vendor-submitted bug reports. Sent via Brevo to staff support email on insert. Screenshots in private bug-report-screenshots bucket.';

DROP TRIGGER IF EXISTS trg_bug_reports_updated_at ON public.bug_reports;
CREATE TRIGGER trg_bug_reports_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Private bucket for screenshot uploads. Service-role-only access; the
-- edge function mints short-lived signed URLs when staff needs to view.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bug-report-screenshots', 'bug-report-screenshots', false, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;
