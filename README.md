# JapaneseClass

**English** · [ภาษาไทย](README.th.md)

A small, browser-based Japanese practice site with Thai translations. It has two exercises: writing kanji in stroke order and typing vocabulary readings.

**Site:** https://japaneseclass.vercel.app/

## Practice modes

- **Kanji:** Draw characters in stroke order, with Thai meanings, readings, and stroke animations. Completed words and your current lesson position are saved in this browser. Moving to the next word is manual by default; automatic advance is an optional toggle.
- **Vocabulary:** Type Japanese readings from Thai meanings, check answers, reveal hints, and review words you got wrong. The page displays your current position, correct-answer progress, and an end-of-set summary. Common full-width typing variants are normalized, and placeholder readings such as `～か` also accept `か`.

The kanji dataset contains 365 entries across 73 N5/N4 lesson sets. The vocabulary dataset currently covers lessons 26–28 (144 words).

## Practice progress and privacy

Practice progress, the last selected lesson, and vocabulary mistakes are saved in your browser using `localStorage`. No account or server-side tracking is required. Progress is not synced across devices and may be cleared if you delete site data. At the end of a set, **Start over** clears the correct-answer progress for that lesson. Vocabulary mistake history stays available for review until you answer those words correctly in review mode.

## Run locally

Serve the repository over HTTP from its root directory:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening the HTML files with `file://` may prevent the browser from loading the JSON datasets.

## Project layout

```text
index.html                     Home page (Vercel static-site entry point)
pages/                         Kanji and vocabulary exercises
assets/css/                    Shared theme and page styles
assets/js/                     Exercise logic
data/                          Lesson datasets (JSON)
tests/                         Smoke tests
archive/                       Previous kanji page version
README.th.md                   Thai documentation
```

All three pages share the same kanji-inspired design system in `assets/css/theme.css` (cream background, teal accents, coral buttons, cards and typography). The layout adapts to mobile and desktop screens. Japanese IME composition is ignored until the reading has been committed. The site uses plain HTML, CSS, and JavaScript. Kanji stroke data and the Hanzi Writer library are loaded from jsDelivr, so writing practice requires an internet connection.

## Check the project

```sh
node --test tests/smoke.test.mjs
```

The tests check internal file links, lesson data, script syntax, progress persistence, answer normalization, wrong-answer review, end-of-set behavior, offline fallback, and basic practice-page behavior. They are not a substitute for testing in a real browser.
