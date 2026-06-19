-- Draft (INACTIVE) roster-terms clickwrap for the agency roster feature.
-- Mechanism is ready; legal reviews the wording and flips is_active=true to
-- start the 14-day grace clock + portal gate. Applied to prod via MCP 2026-06-19.
insert into public.nda_templates (version_label, jurisdiction, title, body_html, agreement_type, is_active, notes)
select
  'v1.0-draft', 'global',
  'Agency Roster & Subcontractor Compliance Terms',
  '<h2>Agency Roster &amp; Subcontractor Compliance Terms</h2>
   <p>These terms govern your use of the Cethos vendor portal''s Linguist Roster, by which you (the "Agency") assign individual linguists ("Roster Linguists") to Cethos projects.</p>
   <ol>
     <li><strong>Competence.</strong> You represent and warrant that each Roster Linguist you make eligible and assign to a Cethos project meets the professional competence requirements of ISO 17100 §6.1 (and, where applicable, the relevant requirements for the role performed).</li>
     <li><strong>Evidence held.</strong> You confirm that you hold documentary evidence supporting each Roster Linguist''s competence — including, as applicable, qualifications/degrees, professional certifications, and/or documented translation or domain experience — and that the information you record in the roster is accurate.</li>
     <li><strong>Production on demand.</strong> You agree to produce that evidence to Cethos promptly upon request (including where Cethos''s client or an auditor requires it), by releasing the relevant documents through the vendor portal''s evidence-release facility.</li>
     <li><strong>Attribution.</strong> For each delivery, you will identify the Roster Linguist who actually performed the work. This attribution is recorded for ISO 17100 traceability and is locked once the step is approved.</li>
     <li><strong>Confidentiality.</strong> These terms supplement, and do not replace, your existing confidentiality and service agreements with Cethos.</li>
   </ol>
   <p><em>Draft for internal review — not yet active.</em></p>',
  'roster_terms', false,
  'Draft seeded 2026-06-19 with the agency roster Phase 1 build. Review wording with legal before activating.'
where not exists (
  select 1 from public.nda_templates where agreement_type = 'roster_terms'
);
