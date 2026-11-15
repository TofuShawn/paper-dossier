#!/usr/bin/env node
/**
 * probe — run one of the measurement harnesses in `scripts/*.html`.
 *
 * Why this exists
 * ---------------
 * The probes are thirty-odd throwaway pages, each written to answer one
 * question about a skin: does the fold cut a glyph, does the fx button sit on
 * text, does the tag cloud still overflow. They are kept in the repository
 * because `SKINS.md` and `DESIGN.md` cite them as the evidence behind specific
 * conclusions, and because the next person changing a skin needs the same
 * measurement rather than a screenshot they have to squint at.
 *
 * What was missing was a way to run one. Every session so far did it by hand:
 * copy the file into `dist/`, start `serve.mjs`, guess at a Chrome flag, then
 * read `--dump-dom` output out of a wall of HTML. That knowledge lived in
 * nobody's head, which made the whole harness effectively undocumented.
 *
 * The probes are same-origin iframe harnesses — they load the built site into
 * an `<iframe>` and read `contentDocument` — so they have to be served from the
 * site root. That is the only non-obvious part, and it is what this handles.
 *
 *   node scripts/probe.mjs                 list every probe and what it needs
 *   node scripts/probe.mjs <name>          run it against the current build
 *   node scripts/probe.mjs <name> --page tags   pass a target page to a probe
 *                                              that reads one out of the URL hash
 *   node scripts/probe.mjs <name> --raw    print the whole DOM, not just output
 *
 * Output contract: a probe writes either `<pre id="out">` text or a
 * `RESULT:`-prefixed JSON blob. Both are printed; nothing is parsed, because
 * the point of these is to be read.
 *
 * On `--page` rather than `--hash /`
 * ---------------------------------
 * The probes take a path out of the URL hash, so `/` is the natural argument.
 * Git Bash (MSYS2) rewrites any argument that looks like a Unix path into a
 * Windows one before node ever sees it: `--hash /` arrives as
 * `--hash C:/Users/…/bash-win32-x64/`, the probe iframes that as a URL, and it
 * hangs on "pending" with no error anywhere. `MSYS_NO_PATHCONV=1` fixes it, but
 * nobody should have to know that, so `--page` takes a route *name* instead and
 * never puts a bare slash through a shell.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'scripts');
const DIST = join(ROOT, 'dist');
const SHIM = join(DIST, '_probe');

/**
 * Route names, so a target never has to be typed as a leading slash.
 *
 * `post` resolves against the built site rather than a hardcoded slug: the
 * sample posts are meant to be deleted, and a probe that names one would break
 * on the first fork.
 */
const PAGES = {
  home: '/',
  posts: '/posts/',
  tags: '/tags/',
  about: '/about/',
  notfound: '/404.html',
};

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : '',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/* ------------------------------------------------------------------- list -- */

async function list() {
  const files = (await readdir(SCRIPTS)).filter((f) => f.endsWith('.html')).sort();
  const rows = [];
  for (const f of files) {
    const src = await readFile(join(SCRIPTS, f), 'utf8');
    const title = (src.match(/<title>([^<]*)<\/title>/) || [, ''])[1].trim();
    rows.push({
      file: f,
      title,
      hash: src.includes('location.hash'),
      result: src.includes('RESULT:'),
    });
  }
  const w = Math.max(...rows.map((r) => r.file.length));
  console.log('Probe harnesses in scripts/. Each answers one question; none is a test.\n');
  for (const r of rows) {
    const needs = r.hash ? '  <target>' : '          ';
    console.log(`  ${r.file.padEnd(w)}  ${needs}  ${r.title}`);
  }
  console.log(
    `\n${rows.length} probes. ${rows.filter((r) => r.hash).length} take a page out of the URL hash.` +
      `\nProbes print either <pre id="out"> text or a RESULT: JSON blob — both are just printed.` +
      '\nRun one:  node scripts/probe.mjs <name>   (add --page <route> for a target)' +
      `\nRoutes:   ${Object.entries(PAGES).map(([k, v]) => `${k}=${v}`).join('  ')}` +
      '\nCatalogue: docs/PROBES.md',
  );
}

/* ----------------------------------------------------------------- server -- */

function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const clean = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);
      const rel = normalize(clean).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
      const base = join(dir, rel);
      let file = null;
      for (const candidate of [base, join(base, 'index.html'), `${base}.html`]) {
        if (!candidate.startsWith(dir)) continue;
        try {
          if ((await stat(candidate)).isFile()) {
            file = candidate;
            break;
          }
        } catch {
          /* next shape */
        }
      }
      if (!file) {
        res.writeHead(404, { 'content-type': MIME['.html'] });
        res.end('not found');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
        'content-length': body.length,
        'cache-control': 'no-store',
      });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* ------------------------------------------------------------------ chrome -- */

function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => p && existsSync(p));
  if (!hit) {
    console.error(
      'No Chrome or Chromium found. Set one of the expected install paths, or run the\n' +
        "probe yourself: copy it into dist/, serve dist/, open the page, read <pre id=\"out\">.\n" +
        'The probes are iframe harnesses, so they must be served from the site root.',
    );
    process.exit(2);
  }
  return hit;
}

function dumpDom(chrome, url) {
  return new Promise((resolve) => {
    const proc = spawn(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      // Probes wait on iframe onload + a settle timer before writing their
      // output. Without a virtual-time budget, --dump-dom returns the
      // "loading…" placeholder and the measurement is silently lost.
      //
      // The budget is virtual, not wall clock: Chrome fast-forwards timers, so
      // 120s of probe timers finish in about a second of real time. `probe.html`
      // is the reason it is this large — it walks 4 pages x 2 widths at 3.2s
      // each, which is 25.6s of settle time before it writes anything.
      '--virtual-time-budget=120000',
      '--dump-dom',
      url,
    ]);
    let html = '';
    proc.stdout.on('data', (d) => (html += d));
    proc.stderr.on('data', () => {});
    proc.on('close', () => resolve(html));
  });
}

/**
 * The probe's answer: whatever it wrote into `<pre id="out">`.
 *
 * Both output shapes land there — plain lines, and the `RESULT:` JSON some
 * probes build. Reading it from anywhere else would match the *source* of the
 * probe (`…textContent = 'RESULT:'+out.join(...)`), which is how a probe that
 * never finished looks identical to one that answered.
 */
function extract(html) {
  const pre = html.match(/<pre id="out">([\s\S]*?)<\/pre>/);
  if (!pre) return null;
  const text = pre[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
  if (/^(loading|running|pending)…?$/.test(text)) {
    return `(probe never finished — still says "${text}")`;
  }
  return text || '(probe finished with empty output)';
}

/* -------------------------------------------------------------------- main -- */

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args[0] === '--list' || args[0] === 'list') return list();

  const name = args[0].replace(/\.html$/, '');
  const raw = args.includes('--raw');

  // `--page <route>` resolves a route name to a path. Accepting a literal path
  // too would be friendlier, but Git Bash mangles a bare `/` before node runs,
  // so the named form is the one that works first try on every platform.
  const pageIdx = args.indexOf('--page');
  let hash = '';
  if (pageIdx >= 0) {
    const want = args[pageIdx + 1] ?? 'home';
    hash = PAGES[want] ?? (want.startsWith('/') ? want : `/${want}/`);
  }

  // One probe is not shaped like the others. `probe.html` is the general
  // harness — overflow, contrast, tokens, canvas, reveals, across a *set* of
  // pages — so it parses its hash as a JSON array instead of a single path.
  // Passing it a bare route silently measures nothing and prints "running…".
  const wantsArray = existsSync(join(SCRIPTS, `${name}.html`))
    ? (await readFile(join(SCRIPTS, `${name}.html`), 'utf8')).includes(
        'JSON.parse(decodeURIComponent(location.hash',
      )
    : false;
  if (wantsArray) {
    const pages = pageIdx >= 0 ? [hash, '/posts/'] : ['/', '/posts/', '/tags/', '/about/'];
    hash = JSON.stringify(pages);
  }

  const file = join(SCRIPTS, `${name}.html`);
  if (!existsSync(file)) {
    console.error(`No such probe: ${name}\nRun \`node scripts/probe.mjs\` to list them.`);
    process.exit(2);
  }
  if (!existsSync(DIST)) {
    console.error('No dist/ — run `npm run build` first. The probes measure the built site.');
    process.exit(2);
  }

  // The probes are same-origin iframes: they must be served next to the site,
  // not from scripts/. Copy in, and remove afterwards so dist/ stays the build.
  await mkdir(SHIM, { recursive: true });
  await copyFile(file, join(SHIM, `${name}.html`));

  const server = await serve(DIST);
  const { port } = server.address();
  // `_probe/` sits at the site root, so the probe's own `iframe src="/"` resolves
  // to the built site. A subdirectory that changes the origin would not.
  const url = `http://127.0.0.1:${port}/_probe/${name}.html${hash ? `#${encodeURIComponent(hash)}` : ''}`;

  const html = await dumpDom(findChrome(), url);
  server.close();
  await rm(SHIM, { recursive: true, force: true });

  if (raw) {
    console.log(html);
    return;
  }
  const out = extract(html);
  if (out === null) {
    console.error(
      `Probe produced no output. It may need a target page:\n` +
        `  node scripts/probe.mjs ${name} --page home\n` +
        `Or it may have failed — add --raw to see the whole DOM.`,
    );
    process.exit(1);
  }
  console.log(out.trim());
}

await main();
