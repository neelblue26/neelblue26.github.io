// Run `node tools/update-bank.cjs` to preview additions; add --apply to import them.
// Existing questions and UUIDs stay intact so saved progress remains valid.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const run = promisify(execFile);
const root = path.resolve(__dirname, '..');
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const api = 'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-question';
function readJS(file, key) {
  const context = {window: {}};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
  return context.window[key];
}
async function jsonRequest(url, body) {
  const args = ['-f', '-sS', '-L', '--ssl-no-revoke', '--max-time', '45', url];
  if (body) args.push('-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(body));
  const {stdout} = await run('curl.exe', args, {maxBuffer: 20 * 1024 * 1024});
  return JSON.parse(stdout);
}
function validate(q, id) {
  if (!q || !['mcq', 'spr'].includes(q.type) || typeof q.stem !== 'string' || !q.stem.trim()
      || typeof q.rationale !== 'string' || !q.rationale.trim()) throw Error('Missing content for ' + id);
  const answers = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
  if (!answers.length || answers.some(a => a == null || !String(a).trim())) throw Error('Missing answer for ' + id);
  if (q.type === 'mcq' && (!Array.isArray(q.answerOptions) || q.answerOptions.length !== 4
      || q.answerOptions.some(o => typeof o.content !== 'string' || !o.content.trim())
      || answers.length !== 1 || !/^[A-D]$/.test(answers[0]))) throw Error('Invalid choices for ' + id);
  return {st: q.stimulus || '', q: q.stem, o: (q.answerOptions || []).map(o => o.content),
    a: answers.join('|'), r: q.rationale, tp: q.type};
}
async function main() {
  const indexFile = path.join(root, 'apdata/index.js');
  const existing = readJS(indexFile, 'QIDX');
  const known = new Set(existing.map(q => q.id));
  const skillKey = (section, domain, skill) => [section, domain, skill.trim().toLowerCase()].join('|');
  const skills = new Map(existing.map(q => [skillKey(q.t, q.d, q.k), q.k]));
  if (known.size !== existing.length) throw Error('Duplicate existing UUIDs');
  const additions = new Map();
  for (const [section, domains] of [['Math', 'H,P,Q,S'], ['Reading and Writing', 'INI,CAS,EOI,SEC']]) {
    const response = await jsonRequest('https://practicesat.vercel.app/api/get-questions?domains=' + domains);
    if (!response.success || !Array.isArray(response.data) || !response.data.length) throw Error('Invalid metadata for ' + section);
    let legacy = 0;
    for (const row of response.data) {
      if (!row.external_id) { legacy++; continue; }
      if (!uuid.test(row.external_id) || row.program !== 'SAT') throw Error('Unexpected metadata');
      if (known.has(row.external_id) || additions.has(row.external_id)) continue;
      const difficulty = {E: 'Easy', M: 'Medium', H: 'Hard'}[row.difficulty];
      if (!difficulty || !row.skill_desc || !row.primary_class_cd_desc || !row.questionId) throw Error('Incomplete metadata');
      additions.set(row.external_id, {id: row.external_id, t: section, d: row.primary_class_cd_desc,
        k: skills.get(skillKey(section, row.primary_class_cd_desc, row.skill_desc)) || row.skill_desc.trim(),
        df: difficulty, qid: row.questionId});
    }
    console.log(section + ': ' + [...additions.values()].filter(q => q.t === section).length + ' new; ' + legacy + ' legacy entries without UUIDs');
  }
  console.log(existing.length + ' existing + ' + additions.size + ' new = ' + (existing.length + additions.size));
  if (!process.argv.includes('--apply') || !additions.size) return;
  const cache = path.join(root, 'api-build/cache');
  fs.mkdirSync(cache, {recursive: true});
  const pending = [...additions.values()];
  const batch = new Date().toISOString();
  for (const meta of pending) meta.addedBatch = batch;
  let next = 0, finished = 0;
  const results = new Map();
  async function worker() {
    while (next < pending.length) {
      const meta = pending[next++];
      const file = path.join(cache, meta.id + '.json');
      let raw, content;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          raw = attempt === 0 && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : await jsonRequest(api, {external_id: meta.id});
          content = validate(raw, meta.id);
          break;
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
      fs.writeFileSync(file, JSON.stringify(raw));
      results.set(meta.id, content);
      if (++finished % 25 === 0 || finished === pending.length) console.log('Validated ' + finished + '/' + pending.length);
    }
  }
  // Wait for every download to settle before deciding whether publication is safe.
  const workers = await Promise.allSettled(Array.from({length: 6}, worker));
  const failed = workers.filter(w => w.status === 'rejected');
  if (failed.length) throw Error(failed.map(w => w.reason.message).join('\n') + '\nNo published bank files changed.');
  const shards = new Map();
  for (const meta of pending) {
    const prefix = meta.id.slice(0, 2);
    if (!shards.has(prefix)) {
      const file = path.join(root, 'apdata/q', prefix + '.js');
      shards.set(prefix, fs.existsSync(file) ? readJS(file, '__Q') : {});
    }
    const content = results.get(meta.id);
    shards.get(prefix)[meta.id] = content;
    meta.tp = content.tp;
  }
  // All new content has been validated before writing any browser assets.
  for (const [prefix, content] of shards) {
    fs.writeFileSync(path.join(root, 'apdata/q', prefix + '.js'),
      'window.__Q=window.__Q||{};Object.assign(window.__Q,' + JSON.stringify(content) + ');\n');
  }
  fs.writeFileSync(indexFile, 'window.QBANK_VERSION=' + Date.now() + ';\nwindow.QIDX=[\n' + [...existing, ...pending].map(q => JSON.stringify(q) + ',').join('\n') + '\n];\n');
  for (const name of ['bank.html', 'index.html']) {
    const file = path.join(root, name);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/apdata\/index\.js\?v=(\d+)/,
      (_, version) => 'apdata/index.js?v=' + (Number(version) + 1)));
  }
  console.log('Imported ' + pending.length + ' questions. Review changes and push to publish.');
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
