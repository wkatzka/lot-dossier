/* Shared public-source index. Recording identity is not parcel applicability. */
const catalogue = require('../data/title/public-record-sources.json');
const ROUTES = ['recorder_index', 'parcel_and_parent_records', 'planning_case_files',
 'adopted_agreements_and_exhibits', 'public_notice_attachments', 'association_libraries',
 'developer_libraries', 'released_records_archive', 'public_mirrors_and_archives'];
function find(county, entry) {
 return catalogue.documents.find(d => d.county === county && d.entry === String(entry)) || null;
}
function allowed(url) { return catalogue.documents.some(d => d.url === url); }
function assessment(attempts = []) {
 const routes = ROUTES.map(route => {
  const a = attempts.filter(x => x.route === route).at(-1);
  // An empty result, error, redirect or unexamined search is not proof of a locked source.
  const documented = !!(a?.url && a?.checkedAt && a?.basis);
  return { route, status: documented ? a.status : 'not_checked',
   closed: documented && ['searched_no_match', 'access_restricted', 'not_applicable'].includes(a.status) && a.coverageComplete === true,
   barrier: documented && a.status === 'access_restricted', evidence: documented ? a : null };
 });
 const knownRoutesChecked = routes.every(r => r.closed);
 const instrumentId = attempts[0]?.instrumentId;
 const instrumentScoped = !!instrumentId && routes.every(r => r.evidence?.instrumentId === instrumentId);
 const accessDependencyEstablished = instrumentScoped && routes.some(r => r.barrier && r.evidence.holdingsEvidence?.instrumentId === instrumentId && /^https:\/\//.test(r.evidence.holdingsEvidence.url || '') && r.evidence.holdingsEvidence.locator);
 return {routes, knownRoutesChecked, accessDependencyEstablished: !!accessDependencyEstablished, contactFallbackEligible: knownRoutesChecked && !!accessDependencyEstablished,
  status: knownRoutesChecked ? 'known_routes_checked' : 'public_research_incomplete',
  limitation: 'Coverage applies only to the named routes and recorded checks. New leads reopen discovery; no claim of exhaustive internet coverage.'};
}
module.exports = {find, allowed, assessment, ROUTES};
