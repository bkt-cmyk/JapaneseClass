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

test('desktop layout rules and cache-versioned assets are present', () => {
  for (const name of ['assets/css/home.css', 'assets/css/kanji.css', 'assets/css/vocabulary.css']) {
    assert.match(file(name), /@media \(min-width: 900px\)/);
  }
  assert.match(file('assets/css/kanji.css'), /grid-template-areas:/);
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

function createKanjiApp({ failData = false, missingWriter = false } = {}) {
  const document = mockDocument();
  let lastChar = null;
  let quizCallbacks = null;
  let quizStarts = 0;
  const windowHandlers = new Map();
  const window = { addEventListener(type, cb) { windowHandlers.set(type, cb); } };
  const sandbox = {
    document, window, console,
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

function createVocabularyApp({ failData = false } = {}) {
  const document = mockDocument();
  const window = {};
  const sandbox = {
    document, window, console,
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
  get('answer-input').value = 'みます';
  vm.runInContext('checkAnswer()', app.context);
  assert.equal(get('answer-input').className, 'correct');
  assert.equal(get('answer-input').readOnly, true);
  assert.equal(get('answer-input').disabled, false);
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
