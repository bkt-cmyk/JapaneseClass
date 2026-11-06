# JapaneseClass

**English** · [ภาษาไทย](README.th.md)

A small, browser-based Japanese practice site with Thai translations. It has two exercises: writing kanji in stroke order and typing vocabulary readings.

**Site:** https://bkt-cmyk.github.io/JapaneseClass/

## Practice modes

- **Kanji:** Draw characters in the correct stroke order. See the reading, Thai meaning, stroke animation, and progress within a lesson.
- **Vocabulary:** Given a Thai meaning, type the matching Japanese reading. Check your answer, reveal it, or skip ahead.

The kanji dataset contains 365 entries across 73 N5/N4 lesson sets. The vocabulary dataset currently covers lessons 26–28 (144 words).

## Run locally

Serve the repository over HTTP from its root directory:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening the HTML files with `file://` may prevent the browser from loading the JSON datasets.

## Project layout

```text
index.html                     Home page (GitHub Pages entry point)
pages/                         Kanji and vocabulary exercises
assets/css/                    Page styles
assets/js/                     Exercise logic
data/                          Lesson datasets (JSON)
tests/                         Smoke tests
archive/                       Previous kanji page version
kanji_practice.html            Redirect for the old URL
vocabulary_practice.html       Redirect for the old URL
README.th.md                   Thai documentation
```

The site uses plain HTML, CSS, and JavaScript. Kanji stroke data and the Hanzi Writer library are loaded from jsDelivr, so writing practice requires an internet connection.

## Check the project

```sh
node --test tests/smoke.test.mjs
```

The tests check internal file links, lesson data, script syntax, and basic practice-page behavior. They are not a substitute for testing in a real browser.
