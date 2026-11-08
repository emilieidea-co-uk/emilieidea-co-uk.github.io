const secret = /^(cookies?|password|authorization|accessToken|token)$/i;
export function redactDiagnostics(value) {
  if (Array.isArray(value)) return value.map(redactDiagnostics);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !secret.test(key)).map(([key, item]) => [key, redactDiagnostics(item)]));
  if (typeof value === 'string') return value.replace(/https?:\/\/[^\s<>"']+/g, address => {
    try { const url = new URL(address); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.href; } catch { return '[URL omitted]'; }
  });
  return value;
}
export function importLog(operation, data, level = 'info') {
  const report = redactDiagnostics(data);
  console[level]('[EmilieIdea Import]', operation, report);
  if (report?.candidates?.length) console.table?.(report.candidates);
  return report;
}
