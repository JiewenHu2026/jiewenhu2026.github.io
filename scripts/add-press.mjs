import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Pipe an array of verified public records into this script:
// Get-Content -Raw verified-press.json | node scripts/add-press.mjs
// Verification of identity, credit, relevance and syndication happens before input.
const destination = fileURLToPath(new URL('../content/press.json', import.meta.url));
const fields = new Set(['title', 'publisher', 'date', 'endDate', 'dateNote', 'year', 'kind', 'description', 'url']);
const trackingParameters = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'yclid', '_ga', '_gl',
]);

function httpsUrl(value, label) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || /[\u0000-\u0020\u007f]/.test(value)) {
    throw new Error(label + ' must be an absolute HTTPS URL.');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(label + ' must be an absolute HTTPS URL.');
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error(label + ' must be an absolute HTTPS URL without credentials.');
  }
  return url;
}

function canonicalUrl(value) {
  const url = httpsUrl(value, 'Source URL');
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || trackingParameters.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  // Fragment identifiers can identify a publication, person or PDF page.
  return url.href;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (month === undefined) return true;
  if (month < 1 || month > 12) return false;
  if (day === undefined) return true;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

function validateEntry(entry, index) {
  const label = 'Entry ' + (index + 1);
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(label + ' must be an object.');
  }
  const unknownFields = Object.keys(entry).filter((field) => !fields.has(field));
  if (unknownFields.length) {
    throw new Error(label + ' has unsupported fields: ' + unknownFields.join(', ') + '.');
  }
  for (const field of ['title', 'publisher', 'description']) {
    if (typeof entry[field] !== 'string' || !entry[field].trim()) {
      throw new Error(label + ' requires a nonempty ' + field + '.');
    }
  }
  if (!['Press', 'Award / exhibition'].includes(entry.kind)) {
    throw new Error(label + ' kind must be "Press" or "Award / exhibition".');
  }
  if (entry.date !== undefined && !validDate(entry.date)) {
    throw new Error(label + ' date must be a valid YYYY, YYYY-MM or YYYY-MM-DD value.');
  }
  if (entry.endDate !== undefined &&
    (entry.date?.length !== 10 || !validDate(entry.endDate) || entry.endDate.length !== 10 || entry.endDate <= entry.date)) {
    throw new Error(label + ' endDate requires a full date after the start date.');
  }
  if (entry.dateNote !== undefined && (typeof entry.dateNote !== 'string' || !entry.dateNote.trim())) {
    throw new Error(label + ' dateNote must be nonempty text.');
  }
  if (entry.year !== undefined &&
    (!['number', 'string'].includes(typeof entry.year) || !/^[1-9]\d{3}$/.test(String(entry.year)))) {
    throw new Error(label + ' year must have four digits.');
  }
  if (entry.date === undefined && entry.year === undefined) {
    throw new Error(label + ' requires a publication date or year.');
  }
  if (entry.date && entry.year !== undefined && entry.date.slice(0, 4) !== String(entry.year)) {
    throw new Error(label + ' date and year disagree.');
  }
  httpsUrl(entry.url, label + ' URL');
  return entry;
}

function dateKey(entry) {
  const value = String(entry.date || entry.year || '');
  const [year = '', month = '00', day = '00'] = value.split('-');
  return [year, month, day].join('-');
}

function parseArray(text, label) {
  let value;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(label + ' must contain valid JSON.');
  }
  if (!Array.isArray(value)) throw new Error(label + ' must be a JSON array.');
  return value;
}

async function main() {
  if (process.argv.length > 2 || process.stdin.isTTY) {
    throw new Error('Pipe an array of verified entries to node scripts/add-press.mjs.');
  }
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  const candidates = parseArray(input, 'Standard input').map(validateEntry);
  const originalText = await readFile(destination, 'utf8');
  const existing = parseArray(originalText, 'content/press.json');
  const seen = new Set(existing.map((entry) => canonicalUrl(entry.url)));
  const additions = [];
  for (const entry of candidates) {
    const key = canonicalUrl(entry.url);
    if (seen.has(key)) continue;
    additions.push(entry);
    seen.add(key);
  }
  if (!additions.length) {
    console.log(JSON.stringify({ added: 0, skipped: candidates.length, total: existing.length }));
    return;
  }
  const merged = [...existing, ...additions].sort((a, b) => dateKey(b).localeCompare(dateKey(a)));
  const nextText = JSON.stringify(merged, null, 2) + '\n';
  const temporary = join(dirname(destination), '.press-' + randomUUID() + '.tmp');
  try {
    await writeFile(temporary, nextText, { encoding: 'utf8', flag: 'wx' });
    if (await readFile(destination, 'utf8') !== originalText) {
      throw new Error('content/press.json changed during this run. Retry with the latest file.');
    }
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  console.log(JSON.stringify({
    added: additions.length,
    skipped: candidates.length - additions.length,
    total: merged.length,
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
