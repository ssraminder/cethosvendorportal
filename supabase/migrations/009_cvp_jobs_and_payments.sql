-- Migration 009: CVP Jobs and Payments tables
-- Created: March 24, 2026

-- CVP Jobs table — one row per vendor job assignment
CREATE TABLE IF NOT EXISTS cvp_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  job_reference VARCHAR(50),
  source_language_id UUID REFERENCES languages(id),
  target_language_id UUID REFERENCES languages(id),
  domain VARCHAR(50),
  service_type VARCHAR(30),
  word_count INTEGER,
  deadline TIMESTAMPTZ,
  instructions TEXT,
  source_file_paths JSONB DEFAULT '[]',
  rate DECIMAL(10,2),
  rate_unit VARCHAR(20),
  currency VARCHAR(3) DEFAULT 'CAD',
  estimated_total DECIMAL(10,2),
  status VARCHAR(30) DEFAULT 'offered' CHECK (status IN ('offered','accepted','in_progress','delivered','under_review','approved','revision_requested','completed','declined','cancelled')),
  offered_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  delivered_at TIMESTAMPTZ,
  delivery_file_paths JSONB DEFAULT '[]',
  delivery_notes TEXT,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  quality_score INTEGER CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvp_jobs_vendor ON cvp_jobs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cvp_jobs_status ON cvp_jobs(status);
CREATE INDEX IF NOT EXISTS idx_cvp_jobs_deadline ON cvp_jobs(deadline);

-- CVP Payments table — invoices and payment tracking
CREATE TABLE IF NOT EXISTS cvp_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  job_id UUID REFERENCES cvp_jobs(id),
  invoice_number VARCHAR(30) UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CAD',
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','submitted','approved','paid','cancelled')),
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  payment_method VARCHAR(30),
  payment_reference VARCHAR(100),
  invoice_pdf_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvp_payments_vendor ON cvp_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cvp_payments_status ON cvp_payments(status);
CREATE INDEX IF NOT EXISTS idx_cvp_payments_job ON cvp_payments(job_id);

-- Storage buckets for vendor file uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-deliveries', 'vendor-deliveries', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-certifications', 'vendor-certifications', false) ON CONFLICT (id) DO NOTHING;

-- RLS policies
ALTER TABLE cvp_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on cvp_jobs" ON cvp_jobs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE cvp_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on cvp_payments" ON cvp_payments FOR ALL USING (true) WITH CHECK (true);
