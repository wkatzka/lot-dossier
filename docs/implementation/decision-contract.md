# Evidence-to-decision contract

Site question identity is project/property key plus URI-encoded section/item. Presentation wording is not identity. Renaming a section/item creates a new question; an old decision is retained, never silently transferred. Report refresh preserves the ledger and its history.

Each decision retains disposition, reviewer, time, parcel/work applicability, conclusion, reasoning, missing evidence, competing-source reasoning and citations. Document citations bind document ID, content hash and page/section; URLs retain their exact original locator but do not pretend to detect remote content changes. Reviewers must renew URL-only reviews when their source changes. Uploaded snapshots provide content binding.

Legacy checklist choices have ambiguous provenance because uploading used to close items. Migration preserves those choices and attachment metadata as unverified history. Attachment bytes are copied into the existing project document store, with content-hash deduplication; capacity failures remain visible. Repeating unchanged migration creates no new revision.

A decision closes a question only when resolved/not applicable, explicitly confirmed, supported by a citation and applicability reasoning, and still bound to the current finding/work scope/document version. Contradicting references require an explanation. Excluded records cannot alone support closure. Newer documents reopen review rather than automatically acquiring legal precedence.

The site ledger records reviewed screening questions. It does not confer authority approval. Rules & Approvals retains rule identity, controlling-instrument citations and stage-specific approval evidence in its existing ledger. Application answers require separate value/source confirmation; site closure never automatically confirms an answer or satisfies an approval. Unsubmitted package reviews are invalidated by decision changes; issued/history records remain historical.

Integration status: site counts, overview, rendered report/export, document review and project serialization use site decisions. Application answer review, dependency propagation into readiness, simulated cross-device restore and requirement migration are implemented and tested. Production release a4d45c8 completed; real project observations are recorded in the correctness checklist. This implementation does not establish unresolved governing authority or prove public-search exhaustion.
