import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = (relative) => readFileSync(path.join(root, relative), 'utf8');
const load = (relative) => JSON.parse(file(relative));

test('navigation and local assets resolve', () => {
  for (const name of ['index.html', 'pages/kanji.html', 'pages/vocabulary.html']) {
    const html = file(name);
    const attrs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    for (const url of attrs) {
      if (/^(https?:|mailto:|data:|#)/.test(url)) continue;
      const target = path.resolve(root, path.dirname(name), url.split(/[?#]/)[0]);
      assert.ok(existsSync(target), name + ' references missing ' + url);
    }
  }
  assert.match(file('index.html'), /href="pages\/kanji.html"/);
  assert.match(file('index.html'), /href="pages\/vocabulary.html"/);
  assert.match(file('kanji_practice.html'), /url=pages\/kanji.html/);
  assert.match(file('vocabulary_practice.html'), /url=pages\/vocabulary.html/);
});

test('lesson data is present and well formed', () => {
  for (const relative of ['data/kanji.json', 'data/vocabulary.json']) {
    const groups = load(relative);
    assert.ok(Object.keys(groups).length > 0);
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

test('practice scripts have valid JavaScript syntax', () => {
  for (const name of ['assets/js/kanji.js', 'assets/js/vocabulary.js']) {
    assert.doesNotThrow(() => new vm.Script(file(name), { filename: name }));
  }
});

function mockDocument() {
  const fields = new Map();
  return {
    getElementById(id) {
      if (!fields.has(id)) fields.set(id, {
        value: '', innerHTML: '', innerText: '', className: '', disabled: false,
        style: {}, clientWidth: 320, focus() {}, addEventListener() {}
      });
      return fields.get(id);
    }
  };
}

test('kanji practice loads a lesson and starts the stroke quiz', async () => {
  const document = mockDocument();
  let lastChar = null;
  let quizStarted = false;
  const window = { addEventListener() {} };
  const sandbox = {
    document, window, console,
    fetch: async () => ({ ok: true, json: async () => load('data/kanji.json') }),
    HanziWriter: { create(_id, char) {
      lastChar = char;
      return { quiz() { quizStarted = true; }, cancelQuiz() {}, animateCharacter() {} };
    }},
    setTimeout() { return 1; }, clearTimeout() {}
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(file('assets/js/kanji.js'), context);
  await window.onload();
  assert.equal(lastChar, '一');
  assert.equal(quizStarted, true);
  assert.equal(document.getElementById('display-reading').innerText, 'いち');
});

test('vocabulary practice checks a correct answer', async () => {
  const document = mockDocument();
  const window = {};
  const sandbox = {
    document, window, console,
    fetch: async () => ({ ok: true, json: async () => load('data/vocabulary.json') }),
    setTimeout() { return 1; }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(file('assets/js/vocabulary.js'), context);
  await window.onload();
  assert.ok(document.getElementById('display-meaning').innerText.length > 0);
  document.getElementById('answer-input').value = 'みます';
  vm.runInContext('checkAnswer()', context);
  assert.equal(document.getElementById('answer-input').className, 'correct');
});
