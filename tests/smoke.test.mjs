import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = (relative) => readFileSync(path.join(root, relative), 'utf8');
const load = (relative) => JSON.parse(file(relative));

test('all local navigation and assets resolve', () => {
  for (const name of ['index.html', 'pages/kanji.html', 'pages/vocabulary.html']) {
    for (const [, url] of file(name).matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|data:|#)/.test(url)) continue;
      const target = path.resolve(root, path.dirname(name), url.split(/[?#]/)[0]);
      assert.ok(existsSync(target), name + ' references missing ' + url);
    }
  }
  const home = file('index.html');
  assert.match(home, /href="pages\/kanji.html"/);
  assert.match(home, /href="pages\/vocabulary.html"/);
  for (const name of ['pages/kanji.html', 'pages/vocabulary.html']) {
    const html = file(name);
    assert.match(html, /href="\.\.\/index.html"/);
    assert.doesNotMatch(html, /user-scalable=no/);
    assert.match(html, /id="load-message"/);
  }
  assert.equal(existsSync(path.join(root, 'kanji_practice.html')), false);
  assert.equal(existsSync(path.join(root, 'vocabulary_practice.html')), false);
});


test('SEO metadata, crawlable pages, sitemap and social image are consistent', () => {
  const base = 'https://japaneseclass.vercel.app';
  const canonicalPages = [
    ['index.html', base + '/'],
    ['pages/kanji.html', base + '/pages/kanji.html'],
    ['pages/vocabulary.html', base + '/pages/vocabulary.html']
  ];
  const titles = new Set();
  const descriptions = new Set();
  for (const [name, canonical] of canonicalPages) {
    const html = file(name);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(title && description, name + ' must have a title and meta description');
    assert.ok(!titles.has(title), 'Duplicate SEO title in ' + name);
    assert.ok(!descriptions.has(description), 'Duplicate SEO description in ' + name);
    titles.add(title);
    descriptions.add(description);
    assert.ok(html.includes('<link rel="canonical" href="' + canonical + '">'));
    assert.ok(html.includes('<meta property="og:url" content="' + canonical + '">'));
    assert.ok(html.includes('<meta property="og:image" content="' + base + '/assets/og-cover.png">'));
    assert.match(html, /<h1\b/);
  }
  const sitemap = file('sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(urls, canonicalPages.map(([, url]) => url));
  const robots = file('robots.txt');
  assert.ok(robots.includes('Sitemap: ' + base + '/sitemap.xml'));
  assert.ok(!/Disallow:\s*\//.test(robots));
  const favicon = readFileSync(path.join(root, 'assets/favicon.png'));
  const cover = readFileSync(path.join(root, 'assets/og-cover.png'));
  const signature = '89504e470d0a1a0a';
  assert.equal(favicon.subarray(0, 8).toString('hex'), signature);
  assert.equal(cover.subarray(0, 8).toString('hex'), signature);
  assert.ok(cover.readUInt32BE(16) >= 600 && cover.readUInt32BE(20) >= 315);
  const command = load('vercel.json').ignoreCommand;
  for (const name of ['index.html', 'pages/', 'assets/', 'data/', 'vercel.json', 'sitemap.xml', 'robots.txt']) {
    assert.ok(command.includes(name), 'Deploy ignore command misses ' + name);
  }
});


test('home page clearly introduces practice modes and how to begin', () => {
  const home = file('index.html');
  const css = file('assets/css/home.css');
  assert.ok(home.includes('<h1 id="page-title">ฝึกคันจิและคำศัพท์ภาษาญี่ปุ่นออนไลน์</h1>'));
  assert.ok(home.includes('JLPT N5–N4'));
  assert.ok(home.includes('คำศัพท์บทที่ 26–28'));
  assert.ok(home.includes('เริ่มฝึกเขียนคันจิ →'));
  assert.ok(home.includes('เริ่มฝึกคำศัพท์ →'));
  assert.ok(home.includes('เริ่มฝึกได้ใน 3 ขั้นตอน'));
  assert.equal((home.match(/<li>/g) || []).length, 3);
  assert.equal((home.match(/class="mode-level"/g) || []).length, 2);
  assert.ok(css.includes('.home-howto'));
  assert.ok(css.includes('.howto-list'));
});

test('lesson data is valid and unchanged', () => {
  const kanji = load('data/kanji.json');
  const vocabulary = load('data/vocabulary.json');
  assert.equal(Object.keys(kanji).length, 73);
  assert.equal(Object.values(kanji).flat().length, 365);
  assert.equal(Object.values(vocabulary).flat().length, 144);
  for (const groups of [kanji, vocabulary]) {
    for (const [name, words] of Object.entries(groups)) {
      assert.ok(Array.isArray(words) && words.length > 0, name);
      for (const word of words) {
        for (const field of ['char', 'data1', 'mean']) {
          assert.ok(typeof word[field] === 'string' && word[field].length > 0, field);
        }
      }
    }
  }
});

test('all pages use the kanji-based shared theme', () => {
  const theme = file('assets/css/theme.css');
  for (const token of ['--bg: #fff6e4', '--brand: #17a398', '--pop: #ff6b4a', '.site-header', '.brand-row', '.card', '.meaning-badge', '.actions button']) {
    assert.ok(theme.includes(token), 'Shared theme lacks ' + token);
  }
  for (const page of ['index.html', 'pages/kanji.html', 'pages/vocabulary.html']) {
    assert.match(file(page), /assets\/css\/theme\.css\?v=/);
    assert.match(file(page), /class="site-header/);
    assert.match(file(page), /class="site-main/);
  }
  for (const css of ['assets/css/home.css', 'assets/css/kanji.css', 'assets/css/vocabulary.css']) {
    assert.doesNotMatch(file(css), /:root\s*\{/);
  }
  assert.match(file('pages/vocabulary.html'), /id="answer-status"/);
});

test('desktop layout rules and cache-versioned assets are present', () => {
  for (const name of ['assets/css/home.css', 'assets/css/kanji.css', 'assets/css/vocabulary.css']) {
    assert.match(file(name), /@media \(min-width: 900px\)/);
  }
  assert.match(file('assets/css/kanji.css'), /grid-template-areas:/);
  assert.match(file('assets/css/theme.css'), /@media \(min-width: 900px\)/);
  assert.match(file('index.html'), /assets\/css\/home\.css\?v=/);
  assert.match(file('pages/kanji.html'), /assets\/js\/kanji\.js\?v=/);
  assert.match(file('pages/vocabulary.html'), /assets\/js\/vocabulary\.js\?v=/);
});

test('practice scripts have valid JavaScript syntax', () => {
  for (const name of ['assets/js/kanji.js', 'assets/js/vocabulary.js']) {
    assert.doesNotThrow(() => new vm.Script(file(name), { filename: name }));
  }
});

function mockDocument() {
  const fields = new Map();
  return {
    getElementById(id) {
      if (!fields.has(id)) {
        const attrs = new Map();
        const handlers = new Map();
        fields.set(id, {
          value: '', innerHTML: '', innerText: '', textContent: '', className: '',
          disabled: false, readOnly: false, hidden: true, style: {}, clientWidth: 320, offsetWidth: 320,
          classList: { add() {}, remove() {} },
          setAttribute(name, value) { attrs.set(name, String(value)); },
          getAttribute(name) { return attrs.get(name); },
          focus() {},
          addEventListener(type, handler) { handlers.set(type, handler); },
          dispatch(type, event = {}) { handlers.get(type)?.(event); }
        });
      }
      return fields.get(id);
    }
  };
}

function createKanjiApp({ failData = false, missingWriter = false, storage } = {}) {
  const document = mockDocument();
  let lastChar = null;
  let quizCallbacks = null;
  let quizStarts = 0;
  const windowHandlers = new Map();
  const window = { addEventListener(type, cb) { windowHandlers.set(type, cb); } };
  const sandbox = {
    document, window, console, localStorage: storage,
    fetch: async () => {
      if (failData) throw new Error('offline');
      return { ok: true, json: async () => load('data/kanji.json') };
    },
    setTimeout() { return 1; }, clearTimeout() {}
  };
  if (!missingWriter) sandbox.HanziWriter = {
    create(_id, char) {
      lastChar = char;
      return {
        quiz(callbacks) { quizCallbacks = callbacks; quizStarts++; },
        cancelQuiz() {}, animateCharacter() {}, showCharacter() {}, updateColor() {}
      };
    }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(file('assets/js/kanji.js'), context);
  return {
    document, window, context, lastChar: () => lastChar,
    quiz: () => quizCallbacks, quizStarts: () => quizStarts,
    emitResize: () => windowHandlers.get('resize')?.()
  };
}

test('kanji drawing starts, and only completed words count as progress', async () => {
  const app = createKanjiApp();
  await app.window.onload();
  const get = (id) => app.document.getElementById(id);
  assert.equal(app.lastChar(), '一');
  assert.ok(app.quiz());
  assert.equal(get('display-reading').innerText, 'いち');
  assert.equal(get('progress-count').innerText, '0/5');
  vm.runInContext('nextInSet()', app.context);
  assert.equal(get('progress-count').innerText, '0/5', 'skipping must not count');
  vm.runInContext('prevInSet()', app.context);
  app.quiz().onComplete();
  assert.equal(get('progress-count').innerText, '1/5');
  assert.equal(get('progress-track').getAttribute('aria-valuenow'), '1');
  assert.equal(get('progress-fill').style.width, '20%');
  app.quiz().onComplete();
  assert.equal(get('progress-count').innerText, '1/5', 'repeated completion is not double counted');
  vm.runInContext('loadSet("N5 L2")', app.context);
  assert.equal(get('progress-count').innerText, '0/5');
  vm.runInContext('loadSet("N5 L1")', app.context);
  assert.equal(get('progress-count').innerText, '1/5', 'switching sets retains session progress');
});


test('kanji defaults to manual advance, finishes without looping, and restores saved progress', async () => {
  const memory = new Map();
  const storage = {
    getItem(key) { return memory.get(key) || null; },
    setItem(key, value) { memory.set(key, value); }
  };
  const app = createKanjiApp({ storage });
  await app.window.onload();
  assert.equal(app.document.getElementById('auto-next').checked, false);
  app.quiz().onComplete();
  assert.equal(app.document.getElementById('progress-count').innerText, '1/5');
  const restored = createKanjiApp({ storage });
  await restored.window.onload();
  assert.equal(restored.document.getElementById('progress-count').innerText, '1/5');
  vm.runInContext('loadWord(4)', restored.context);
  vm.runInContext('nextInSet()', restored.context);
  assert.equal(restored.document.getElementById('set-summary').hidden, false);
  assert.equal(restored.document.getElementById('next-btn').disabled, true);
  vm.runInContext('restartSet()', restored.context);
  assert.equal(restored.document.getElementById('progress-count').innerText, '0/5');
  vm.runInContext('toggleAutoNext(true)', restored.context);
  assert.equal(JSON.parse(memory.get('japaneseclass.kanji.v1')).autoNext, true);
});

test('desktop resize with unchanged canvas size does not restart the quiz', async () => {
  const app = createKanjiApp();
  await app.window.onload();
  assert.equal(app.quizStarts(), 1);
  // This mock executes the debounce callback immediately for the event.
  const resize = vm.runInContext(
    `(() => { clearTimeout(resizeTimer); if (writer && !isWordComplete) {
      const size = Math.min(document.getElementById('writer-container').clientWidth - 10, 320);
      if (size > 32 && Math.abs(size - lastWriterSize) >= 8) setupWriterForChar();
    } })`, app.context
  );
  resize();
  assert.equal(app.quizStarts(), 1);
});

test('kanji warns instead of crashing when external writer is unavailable', async () => {
  const app = createKanjiApp({ missingWriter: true });
  await app.window.onload();
  assert.match(app.document.getElementById('status-msg').innerText, /โหลดระบบเขียนไม่สำเร็จ/);
});

test('kanji reports fallback when its lesson file cannot load', async () => {
  const app = createKanjiApp({ failData: true });
  await app.window.onload();
  assert.equal(app.document.getElementById('load-message').hidden, false);
  assert.match(app.document.getElementById('load-message').textContent, /ชุดตัวอย่าง/);
});

function createVocabularyApp({ failData = false, storage } = {}) {
  const document = mockDocument();
  const window = {};
  const sandbox = {
    document, window, console, localStorage: storage,
    fetch: async () => {
      if (failData) throw new Error('offline');
      return { ok: true, json: async () => load('data/vocabulary.json') };
    },
    setTimeout() { return 1; }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(file('assets/js/vocabulary.js'), context);
  return { document, window, context };
}

test('vocabulary checks readings and permits retrying a wrong answer', async () => {
  const app = createVocabularyApp();
  await app.window.onload();
  const get = (id) => app.document.getElementById(id);
  assert.equal(get('display-meaning').innerText, 'ดู, มอง, ตรวจ');
  get('answer-input').value = 'ちがう';
  vm.runInContext('checkAnswer()', app.context);
  assert.equal(get('answer-input').className, 'wrong');
  assert.match(get('answer-status').innerText, /ลองใหม่/);
  get('answer-input').value = 'みます';
  vm.runInContext('checkAnswer()', app.context);
  assert.equal(get('answer-input').className, 'correct');
  assert.equal(get('answer-input').readOnly, true);
  assert.match(get('answer-status').innerText, /ถูกต้อง/);
  assert.equal(get('answer-input').disabled, false);
});


test('vocabulary shows saved progress, supports wrong-answer review, and ends without looping', async () => {
  const memory = new Map();
  const storage = {
    getItem(key) { return memory.get(key) || null; },
    setItem(key, value) { memory.set(key, value); }
  };
  const app = createVocabularyApp({ storage });
  await app.window.onload();
  const get = id => app.document.getElementById(id);
  assert.equal(get('progress-count').innerText, '0/46');
  assert.equal(get('word-position').innerText, 'ข้อ 1/46');
  get('answer-input').value = 'ちがう';
  vm.runInContext('checkAnswer()', app.context);
  assert.equal(get('review-btn').disabled, false);
  vm.runInContext('toggleReview()', app.context);
  assert.equal(get('word-position').innerText, 'ทบทวนข้อ 1/1');
  get('answer-input').value = 'みます';
  vm.runInContext('checkAnswer()', app.context);
  assert.equal(get('progress-count').innerText, '1/1');
  assert.equal(get('answer-input').className, 'correct');
  vm.runInContext('nextInSet()', app.context);
  assert.equal(get('set-summary').hidden, false);
  vm.runInContext('toggleReview()', app.context);
  vm.runInContext('loadWord(45)', app.context);
  vm.runInContext('nextInSet()', app.context);
  assert.equal(get('set-summary').hidden, false);
  assert.equal(get('check-btn').disabled, true);
  const restored = createVocabularyApp({ storage });
  await restored.window.onload();
  assert.equal(restored.document.getElementById('progress-count').innerText, '1/46');
  assert.equal(JSON.parse(memory.get('japaneseclass.vocabulary.v1')).wrong['คำศัพท์บทที่ 26'].length, 0);
});

test('vocabulary accepts normalized placeholder readings without changing Japanese sounds', async () => {
  const app = createVocabularyApp();
  await app.window.onload();
  const examples = load('data/vocabulary.json')['คำศัพท์บทที่ 28'];
  const index = examples.findIndex(word => word.data1 === '～か');
  assert.ok(index >= 0);
  vm.runInContext('loadSet("คำศัพท์บทที่ 28")', app.context);
  vm.runInContext('loadWord(' + index + ')', app.context);
  const input = app.document.getElementById('answer-input');
  input.value = ' か ';
  vm.runInContext('checkAnswer()', app.context);
  assert.equal(input.className, 'correct');
  vm.runInContext('loadWord(' + index + ')', app.context);
  input.value = 'き';
  vm.runInContext('checkAnswer()', app.context);
  assert.equal(input.className, 'wrong');
});

test('practice pages expose progress, summaries, and mobile-friendly help', () => {
  const kanji = file('pages/kanji.html');
  const vocabulary = file('pages/vocabulary.html');
  for (const html of [kanji, vocabulary]) {
    assert.match(html, /id="set-summary"/);
    assert.match(html, /id="progress-count"/);
    assert.match(html, /id="progress-track"/);
    assert.match(html, /rel="canonical"/);
  }
  assert.match(kanji, /id="auto-next"/);
  assert.match(kanji, /ชุดคันจิ/);
  assert.match(vocabulary, /id="review-btn"/);
  assert.match(vocabulary, /class="keyboard-help"/);
  assert.doesNotMatch(vocabulary, /autofocus/);
  assert.match(file('assets/css/theme.css'), /position: static/);
});

test('vocabulary fallback is clearly disclosed', async () => {
  const app = createVocabularyApp({ failData: true });
  await app.window.onload();
  assert.equal(app.document.getElementById('load-message').hidden, false);
  assert.match(app.document.getElementById('load-message').textContent, /ชุดตัวอย่าง/);
});

test('Japanese IME Enter is ignored while composing and advances after a correct answer', async () => {
  const app = createVocabularyApp();
  await app.window.onload();
  const input = app.document.getElementById('answer-input');
  const meaning = app.document.getElementById('display-meaning');
  input.value = 'みます';
  input.dispatch('compositionstart');
  input.dispatch('keydown', { key: 'Enter', isComposing: true, keyCode: 229, preventDefault() {} });
  assert.equal(input.className, '', 'IME composition should not check the answer');
  input.dispatch('compositionend');
  input.dispatch('keydown', { key: 'Enter', isComposing: false, keyCode: 13, preventDefault() {} });
  assert.equal(input.className, 'correct');
  assert.equal(input.readOnly, true);
  input.dispatch('keydown', { key: 'Enter', isComposing: false, keyCode: 13, preventDefault() {} });
  assert.equal(meaning.innerText, 'มองหา, ค้นหา');
  assert.equal(input.readOnly, false);
});
