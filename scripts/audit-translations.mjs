import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const sourceFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(target);
  }
}

walk(root);

const i18nSource = fs.readFileSync(path.join(root, 'lib/i18n.ts'), 'utf8');
const dictionaryKeyMatches = [...i18nSource.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*\{/gm)];
const dictionaryKeys = new Set(dictionaryKeyMatches.map((match) => match[1]));
const issues = [];
let fallbackCount = 0;
let keyCount = 0;

const duplicateKeys = dictionaryKeyMatches
  .map((match) => match[1])
  .filter((key, index, keys) => keys.indexOf(key) !== index);
for (const key of new Set(duplicateKeys)) {
  issues.push(`src/lib/i18n.ts: duplicate translation key "${key}"`);
}

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(process.cwd(), file);

  if (/(?:\u00e1\u20ac|\u00c3|\u00f0\u0178|\u00e2\u00ef\ufe0f)/u.test(source)) {
    issues.push(`${relative}: contains possible mojibake/encoding corruption`);
  }

  const suspiciousMyanmar = /(?:မှာယ်ရည်|မှာယ်|စသည်း|သပ်မှတ်|အမှိုင်မုဒ်|ဖုန်(?!း))/u.exec(source);
  if (suspiciousMyanmar) {
    issues.push(`${relative}: contains a known low-quality Myanmar translation fragment "${suspiciousMyanmar[0]}"`);
  }

  const calls = /\bt\(\s*(['"])(.*?)\1\s*(?:,\s*(['"])(.*?)\3\s*)?\)/gs;
  for (const match of source.matchAll(calls)) {
    const keyOrEnglish = match[2];
    const fallbackMm = match[4];

    if (fallbackMm !== undefined) {
      fallbackCount += 1;
      if (!fallbackMm.trim()) issues.push(`${relative}: empty Myanmar fallback for "${keyOrEnglish}"`);
      if (fallbackMm === keyOrEnglish && !/^[A-Z0-9 .#:+/&()…-]+$/.test(fallbackMm)) {
        issues.push(`${relative}: English and Myanmar text are identical for "${keyOrEnglish}"`);
      }
    } else if (dictionaryKeys.has(keyOrEnglish)) {
      keyCount += 1;
    } else if (/^[a-z][A-Za-z0-9_]*$/.test(keyOrEnglish)) {
      issues.push(`${relative}: missing translation key "${keyOrEnglish}"`);
    }
  }
}

console.log(`Translation audit: ${sourceFiles.length} source files, ${keyCount} dictionary-key calls, ${fallbackCount} legacy fallback calls.`);

if (issues.length > 0) {
  console.error(`Found ${issues.length} translation issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Translation audit passed: no empty fallbacks, missing keys, or encoding corruption detected.');
}
