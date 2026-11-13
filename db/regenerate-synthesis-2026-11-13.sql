-- Audited, one-job regeneration of the FINAL SYNTHESIS ONLY for the unconfigured acceptance
-- investigation (Weber parcel 222320023). Applied after deploying whole-document reconciliation.
-- Scope: no source recrawl, OCR, document reinterpretation, budget change or inserted findings.
-- The worker's synthesisRegeneration path rebuilds inventories from durable shared readings
-- (research_readings by SHA), reconciles stale chunk gaps and regenerates only c.synthesis.
-- The prior explanation is retained verbatim in checkpoint.synthesisHistory.
update cornerpin_private.research_jobs
set checkpoint = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(checkpoint,
      '{synthesisHistory}', coalesce(checkpoint->'synthesisHistory','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'synthesis', checkpoint->'synthesis', 'retiredAt', now(),
        'reason', 'Human review: final synthesis called recovered Article 6 ACC provisions and the master Declaration Exhibit A missing, and led with a generic no-approval statement instead of the Board plan-approval gate.'))),
      '{synthesis}', 'null'::jsonb),
      '{synthesisAttempts}', '0'::jsonb),
      '{synthesisRegeneration}', jsonb_build_object('pending', true, 'requestedAt', now(),
        'scope', 'final synthesis only; no recrawl, OCR or reinterpretation',
        'reason', 'Deploy whole-document inventory reconciliation and semantic stale-gap checks')),
      '{migrations}', coalesce(checkpoint->'migrations','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'at', now(), 'action', 'synthesis_regeneration_requested',
        'note', 'Synthesis state only. Interpretations, documents, readings, search state and budget untouched.'))),
    status = 'queued', phase = 'synthesis_regeneration', available_at = now(),
    lease = null, lease_until = null, updated_at = now()
where id = 'ca12cf9a-c654-479a-a158-94be612b1523'
  and status = 'complete_with_gaps'
  and coalesce((checkpoint->'synthesisRegeneration'->>'pending')::boolean, false) = false
returning id, status, phase, jsonb_array_length(checkpoint->'synthesisHistory') as retained_prior_syntheses;
