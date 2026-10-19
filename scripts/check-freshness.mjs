// Stale-data alert: exits 1 (and prints why) when /freshness.json says stale.
// Run by hand or from a schedule (APPROVALS W25). node scripts/check-freshness.mjs [url]
const url = process.argv[2] || 'https://trydropapp.com/freshness.json';
const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
const report = await response.json().catch(() => ({ status: 'stale', problems: ['unreadable response ' + response.status] }));
console.log(`${report.status.toUpperCase()} ${url}` + (report.problems?.length ? '\n- ' + report.problems.join('\n- ') : `: ${report.showsNext7Days} shows next 7 days, newest added ${report.hoursSinceNewestShow} h ago`));
process.exit(report.status === 'ok' ? 0 : 1);
