// Prints Mykhailo's CV text file to a PDF through a plain HTML layout.
//
//   npm run cv:pdf                       -> public/mykhailo-maliavin-cv.pdf
//   npm run cv:pdf -- --out <file.pdf>   -> somewhere else (e.g. a review copy)
//   npm run cv:pdf -- --with-phone       -> keep the phone number (off by default)
//   npm run cv:pdf -- --src <file.txt>   -> another copy of the CV text (or set CV_TXT)
//
// The text file stays in iCloud and is never copied into the repo: it holds the phone number.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const DEFAULT_SRC = join(
  homedir(),
  'Library/Mobile Documents/com~apple~CloudDocs/CV/cv-maliavin-2026-europe.txt',
);
// International format, as in the CV; year ranges like "1998 - 2004" must not match.
const PHONE = /\+\d[\d ()-]{7,}\d/g;
const FIELD = /^(Job Title|Company|Location|Dates|Note): (.*)$/;

const { values: args } = parseArgs({
  options: {
    src: { type: 'string', default: process.env.CV_TXT ?? DEFAULT_SRC },
    out: { type: 'string', default: 'public/mykhailo-maliavin-cv.pdf' },
    'with-phone': { type: 'boolean', default: false },
  },
});

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Blank-line separated blocks, each a list of lines with trailing spaces removed. */
const blocks = (lines) =>
  lines
    .join('\n')
    .split(/\n\s*\n/)
    .map((b) =>
      b
        .split('\n')
        .map((l) => l.trimEnd())
        .filter(Boolean),
    )
    .filter((b) => b.some((l) => l.trim()));

const join1 = (lines) => lines.map((l) => l.trim()).join(' ');

/** A block of "- " bullets with two-space continuation lines, optionally under a lead line. */
function bulletBlock(lines) {
  const lead = [];
  const items = [];
  for (const l of lines) {
    if (l.startsWith('- ')) items.push([l.slice(2)]);
    else if (items.length) items[items.length - 1].push(l);
    else lead.push(l);
  }
  const list = items.length
    ? `<ul>${items.map((i) => `<li>${esc(join1(i))}</li>`).join('')}</ul>`
    : '';
  if (!lead.length) return list;
  return items.length ? `<h4>${esc(join1(lead))}</h4>${list}` : `<p>${esc(join1(lead))}</p>`;
}

function jobHeader(lines) {
  const f = Object.fromEntries(lines.map((l) => l.match(FIELD).slice(1)));
  return `<div class="job">
    <h3>${esc(f['Job Title'])}</h3>
    <div class="job__line"><span><span class="job__company">${esc(f.Company)}</span><span class="sep"> - </span>${esc(f.Location)}</span><span class="job__dates">${esc(f.Dates)}</span></div>
    ${f.Note ? `<p class="job__note">${esc(f.Note)}</p>` : ''}
  </div>`;
}

function contactLine(text) {
  return text
    .split(' - ')
    .filter((part) => args['with-phone'] || !part.match(PHONE))
    .map((part) => {
      if (/^\S+@\S+$/.test(part)) return `<a href="mailto:${esc(part)}">${esc(part)}</a>`;
      if (/^linkedin\.com\//.test(part))
        return `<a href="https://www.${esc(part)}">${esc(part)}</a>`;
      return esc(part);
    })
    .join('<span class="sep"> - </span>');
}

function toHtml(txt) {
  const lines = txt.replace(/\r\n/g, '\n').split('\n');
  // Sections are a title line underlined with dashes; the head is everything before the first one.
  const starts = lines.flatMap((l, i) => (/^-{3,}$/.test(l) ? [i - 1] : []));
  const [nameBlock, headline, contact, ...facts] = blocks(lines.slice(0, starts[0]));
  const name = nameBlock[0];

  const sections = starts.map((start, n) => {
    const body = blocks(lines.slice(start + 2, starts[n + 1] ?? lines.length));
    const html = body
      .map((b) => {
        if (b.every((l) => FIELD.test(l))) return jobHeader(b);
        if (b.some((l) => l.startsWith('- '))) return bulletBlock(b);
        const kv = lines[start] === 'SKILLS' && join1(b).match(/^([^:]+): (.*)$/);
        if (kv) return `<p><strong>${esc(kv[1])}:</strong> ${esc(kv[2])}</p>`;
        return `<p>${esc(join1(b))}</p>`;
      })
      .join('\n');
    return `<section><h2>${esc(lines[start])}</h2>${html}</section>`;
  });

  const factLines = facts
    .flat()
    .map((l) => l.match(/^([^:]+): (.*)$/))
    .map((m) => `<p><strong>${esc(m[1])}:</strong> ${esc(m[2])}</p>`);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(name)} - CV</title><style>${CSS}</style></head>
<body>
  <header>
    <h1>${esc(name)}</h1>
    <p class="headline">${esc(join1(headline))}</p>
    <p class="contact">${contactLine(join1(contact))}</p>
    ${factLines.join('\n')}
  </header>
  ${sections.join('\n')}
</body></html>`;
}

const CSS = `
  @page { size: A4; margin: 16mm 16mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 9.5pt/1.42 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1a1c22; }
  a { color: inherit; text-decoration: none; }
  h1 { margin: 0; font-size: 22pt; letter-spacing: 0.06em; text-transform: uppercase; }
  .headline { margin: 2pt 0 6pt; font-size: 11.5pt; color: #8a3b12; }
  header p { margin: 1pt 0; }
  .contact { margin-bottom: 4pt !important; }
  .sep { color: #999; }
  section { margin-top: 12pt; }
  h2 { margin: 0 0 6pt; padding-bottom: 2pt; border-bottom: 1px solid #c9c2b6; font-size: 10.5pt;
       letter-spacing: 0.08em; text-transform: uppercase; color: #8a3b12; break-after: avoid; }
  h3 { margin: 0; font-size: 10.5pt; }
  h4 { margin: 6pt 0 2pt; font-size: 9.5pt; break-after: avoid; }
  p { margin: 0 0 5pt; }
  ul { margin: 0 0 6pt; padding-left: 13pt; }
  li { margin-bottom: 2pt; }
  .job { margin-top: 10pt; break-inside: avoid; break-after: avoid; }
  .job__line { display: flex; justify-content: space-between; gap: 12pt; }
  .job__company { font-weight: 600; }
  .job__dates { white-space: nowrap; font-weight: 600; }
  .job__note { margin: 1pt 0 0; font-style: italic; color: #555; }
  .job + p, .job + ul, .job + h4 { margin-top: 4pt; }
`;

/** Word tokens a reader sees, lower-cased (the layout upper-cases headings). */
const words = (s) => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');

const txt = await readFile(args.src, 'utf8').catch((e) => {
  throw new Error(`Cannot read the CV text at ${args.src} (${e.code}). Pass --src or set CV_TXT.`);
});
const html = toHtml(txt);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });

  // Same words, same order as the text file: nothing added, nothing dropped. Field labels
  // ("Job Title:", ...) are layout, and the phone is dropped unless --with-phone.
  const expected = words(
    txt
      .split('\n')
      .filter((l) => !/^[=-]{3,}$/.test(l))
      .map((l) => l.replace(FIELD, '$2'))
      .join('\n')
      .replace(PHONE, (m) => (args['with-phone'] ? m : '')),
  );
  const actual = words(await page.locator('body').innerText());
  if (actual !== expected) {
    const a = actual.split(' ');
    const e = expected.split(' ');
    const i = a.findIndex((w, n) => w !== e[n]);
    throw new Error(
      `PDF text differs from the CV text at word ${i}:\n  pdf: ${a.slice(i, i + 12).join(' ')}\n  txt: ${e.slice(i, i + 12).join(' ')}`,
    );
  }
  if (!args['with-phone'] && (await page.locator('body').innerText()).match(PHONE)) {
    throw new Error('A phone number is still in the PDF.');
  }

  const out = resolve(args.out);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(
    out,
    await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }),
  );
  console.log(`CV PDF written to ${out} (phone ${args['with-phone'] ? 'included' : 'left out'})`);
} finally {
  await browser.close();
}
