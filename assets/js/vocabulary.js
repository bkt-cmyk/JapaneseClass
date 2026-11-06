const defaultData = {
    "ชุดคำศัพท์พื้นฐาน": [
        { "char": "学校", "data1": "がっこう", "mean": "โรงเรียน" },
        { "char": "先生", "data1": "せんせい", "mean": "คุณครู" },
        { "char": "水", "data1": "みず", "mean": "น้ำ" },
        { "char": "食べる", "data1": "たべる", "mean": "กิน" }
    ]
};

const STORAGE_KEY = 'japaneseclass.vocabulary.v1';
const savedState = readSavedState();
let kanjiDataSets = {};
let currentSetName = '';
let currentWordIdx = 0;
let isCorrect = false;
let reviewMode = false;
let reviewIndices = [];
let reviewCompleted = new Set();
let completedBySet = new Map();
let wrongBySet = new Map();
let lastIndexBySet = {};

function readSavedState() {
    try {
        if (typeof localStorage === 'undefined') return {};
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return data && typeof data === 'object' ? data : {};
    } catch (_) { return {}; }
}

function saveProgress() {
    try {
        if (typeof localStorage === 'undefined') return;
        const correct = {}, wrong = {};
        for (const [name, indexes] of completedBySet) correct[name] = [...indexes];
        for (const [name, indexes] of wrongBySet) wrong[name] = [...indexes];
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            selectedSet: currentSetName, lastIndexBySet, correct, wrong
        }));
    } catch (_) { /* Local storage might be unavailable. */ }
}

function setAnswerStatus(message, state = 'neutral') {
    const element = document.getElementById('answer-status');
    element.innerText = message;
    element.className = 'status-chip state-' + state;
}

function setLoadMessage(message) {
    const element = document.getElementById('load-message');
    element.textContent = message;
    element.hidden = !message;
}

async function fetchKanjiData() {
    try {
        const response = await fetch('../data/vocabulary.json');
        if (!response.ok) throw new Error('Lesson file unavailable');
        kanjiDataSets = await response.json();
        setLoadMessage('');
    } catch (_) {
        kanjiDataSets = defaultData;
        setLoadMessage('โหลดบทเรียนเต็มไม่ได้ กำลังใช้ชุดตัวอย่าง โปรดตรวจอินเทอร์เน็ตแล้วรีเฟรชหน้าเว็บ');
    }
    initApp();
}

function restoreIndexSets(data, name, total) {
    const indexes = data && Array.isArray(data[name]) ? data[name] : [];
    return new Set(indexes.filter(i => Number.isInteger(i) && i >= 0 && i < total));
}

function initApp() {
    const setNames = Object.keys(kanjiDataSets);
    const setSelect = document.getElementById('setSelect');
    setSelect.innerHTML = setNames.map(name =>
        '<option value="' + name + '">' + name + '</option>'
    ).join('');
    const savedIndexes = savedState.lastIndexBySet;
    lastIndexBySet = savedIndexes && typeof savedIndexes === 'object' && !Array.isArray(savedIndexes)
        ? savedIndexes : {};
    for (const name of setNames) {
        completedBySet.set(name, restoreIndexSets(savedState.correct, name, kanjiDataSets[name].length));
        wrongBySet.set(name, restoreIndexSets(savedState.wrong, name, kanjiDataSets[name].length));
    }

    const input = document.getElementById('answer-input');
    let isComposing = false;
    input.addEventListener('compositionstart', () => { isComposing = true; });
    input.addEventListener('compositionend', () => { isComposing = false; });
    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing || isComposing || e.keyCode === 229) return;
        e.preventDefault();
        if (!document.getElementById('set-summary').hidden) return;
        handleMainAction();
    });
    if (setNames.length) {
        loadSet(setNames.includes(savedState.selectedSet) ? savedState.selectedSet : setNames[0]);
    }
}

function currentDeck() {
    if (reviewMode) return reviewIndices;
    return kanjiDataSets[currentSetName].map((_, index) => index);
}

function renderWordSelect() {
    const words = kanjiDataSets[currentSetName];
    document.getElementById('kanjiSelect').innerHTML = currentDeck().map(i => {
        const word = words[i];
        const label = String(word.char + ' - ' + word.mean)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        return '<option value="' + i + '">' + label + '</option>';
    }).join('');
}

function loadSet(setName) {
    if (!Object.prototype.hasOwnProperty.call(kanjiDataSets, setName)) return;
    currentSetName = setName;
    reviewMode = false;
    reviewIndices = [];
    reviewCompleted = new Set();
    document.getElementById('setSelect').value = setName;
    renderWordSelect();
    const index = Number(lastIndexBySet[setName]);
    const start = Number.isInteger(index) && index >= 0 &&
        index < kanjiDataSets[setName].length ? index : 0;
    loadWord(start, false);
}

function loadWord(index, focusInput = true) {
    const idx = Number(index);
    const deck = currentDeck();
    if (!Number.isInteger(idx) || !deck.includes(idx)) return;
    currentWordIdx = idx;
    isCorrect = false;
    if (!reviewMode) lastIndexBySet[currentSetName] = idx;
    const word = kanjiDataSets[currentSetName][idx];
    document.getElementById('display-meaning').innerText = word.mean;
    document.getElementById('kanjiSelect').value = String(idx);
    const input = document.getElementById('answer-input');
    input.value = '';
    input.className = '';
    input.disabled = false;
    input.readOnly = false;
    if (focusInput) input.focus();
    document.getElementById('revealed-hint').style.display = 'none';
    document.getElementById('check-btn').innerText = 'ตรวจสอบคำตอบ (Enter)';
    document.getElementById('check-btn').disabled = false;
    document.getElementById('next-btn').disabled = false;
    document.getElementById('set-summary').hidden = true;
    setAnswerStatus('พร้อมแล้วหรือยัง?', 'neutral');
    updateProgress();
    updateReviewButton();
    saveProgress();
}

function updateProgress() {
    const deck = currentDeck();
    const total = deck.length;
    const correct = reviewMode
        ? reviewCompleted.size
        : (completedBySet.get(currentSetName)?.size || 0);
    const position = deck.indexOf(currentWordIdx) + 1;
    document.getElementById('progress-label').innerText = reviewMode
        ? 'ทบทวนถูก (รอบนี้)' : 'ตอบถูก (บันทึกในเครื่อง)';
    document.getElementById('progress-count').innerText = correct + '/' + total;
    document.getElementById('word-position').innerText =
        (reviewMode ? 'ทบทวนข้อ ' : 'ข้อ ') + position + '/' + total;
    document.getElementById('progress-fill').style.width =
        (total ? correct / total * 100 : 0) + '%';
    const track = document.getElementById('progress-track');
    track.setAttribute('aria-valuemax', String(total));
    track.setAttribute('aria-valuenow', String(correct));
}

function updateReviewButton() {
    const count = wrongBySet.get(currentSetName)?.size || 0;
    const button = document.getElementById('review-btn');
    button.innerText = reviewMode
        ? 'กลับไปฝึกชุดปกติ'
        : 'ทบทวนคำที่เคยผิด (' + count + ')';
    button.disabled = !reviewMode && count === 0;
}

function normalizeReading(value) {
    return String(value || '').replace(/[～〜]/g, '~')
        .normalize('NFKC').trim().replace(/\s+/g, '');
}

function acceptedReadings(word) {
    const expected = normalizeReading(word.data1);
    const readings = new Set([expected]);
    // ～ marks a prefix/suffix placeholder, not a phonetic character.
    if (expected.startsWith('~')) readings.add(expected.slice(1));
    if (Array.isArray(word.acceptedReadings)) {
        for (const variant of word.acceptedReadings) readings.add(normalizeReading(variant));
    }
    return readings;
}

function handleMainAction() {
    if (isCorrect) nextInSet();
    else checkAnswer();
}

function markWrong() {
    wrongBySet.get(currentSetName)?.add(currentWordIdx);
    updateReviewButton();
    saveProgress();
}

function checkAnswer() {
    if (isCorrect) return;
    const input = document.getElementById('answer-input');
    const answer = normalizeReading(input.value);
    if (!answer) {
        setAnswerStatus('กรุณาพิมพ์คำอ่านก่อนตรวจคำตอบ', 'info');
        return;
    }
    const word = kanjiDataSets[currentSetName][currentWordIdx];
    if (acceptedReadings(word).has(answer)) {
        isCorrect = true;
        completedBySet.get(currentSetName)?.add(currentWordIdx);
        if (reviewMode) {
            reviewCompleted.add(currentWordIdx);
            wrongBySet.get(currentSetName)?.delete(currentWordIdx);
        }
        input.className = 'correct';
        input.readOnly = true;
        document.getElementById('check-btn').innerText = 'คำถัดไป (Enter)';
        setAnswerStatus('ถูกต้อง! ไปคำถัดไปได้เลย', 'success');
        updateProgress();
        updateReviewButton();
        saveProgress();
    } else {
        input.className = 'wrong';
        markWrong();
        setAnswerStatus('ยังไม่ถูก ลองใหม่อีกครั้ง', 'error');
        const index = currentWordIdx;
        setTimeout(() => {
            if (currentWordIdx === index && !isCorrect) input.className = '';
        }, 400);
    }
}

function showHint() {
    const word = kanjiDataSets[currentSetName][currentWordIdx];
    const hint = document.getElementById('revealed-hint');
    hint.innerText = 'เฉลย: ' + word.data1;
    hint.style.display = 'block';
    if (!isCorrect) {
        markWrong();
        setAnswerStatus('ดูเฉลยแล้ว ลองพิมพ์คำตอบได้เลย', 'info');
    }
}

function nextInSet() {
    const deck = currentDeck();
    const pos = deck.indexOf(currentWordIdx);
    if (pos >= deck.length - 1) finishSet();
    else loadWord(deck[pos + 1]);
}

function finishSet() {
    const correct = reviewMode
        ? reviewCompleted.size
        : (completedBySet.get(currentSetName)?.size || 0);
    const total = currentDeck().length;
    document.getElementById('summary-text').innerText = reviewMode
        ? 'ทบทวนถูก ' + correct + '/' + total + ' คำ · ยังมีคำที่ต้องทบทวน ' +
          (wrongBySet.get(currentSetName)?.size || 0) + ' คำ'
        : 'ตอบถูก ' + correct + '/' + total + ' คำ · บันทึกความก้าวหน้าในเครื่องนี้แล้ว';
    document.getElementById('set-summary').hidden = false;
    document.getElementById('check-btn').disabled = true;
    document.getElementById('next-btn').disabled = true;
    document.getElementById('answer-input').readOnly = true;
    setAnswerStatus('ถึงท้ายชุดแล้ว ✓', 'info');
    saveProgress();
}

function restartSet() {
    if (reviewMode) {
        reviewMode = false;
        reviewIndices = [];
        reviewCompleted = new Set();
    }
    completedBySet.set(currentSetName, new Set());
    lastIndexBySet[currentSetName] = 0;
    renderWordSelect();
    loadWord(0, false);
}

function chooseSet() { document.getElementById('setSelect').focus(); }

function toggleReview() {
    if (reviewMode) {
        reviewMode = false;
        reviewIndices = [];
        reviewCompleted = new Set();
        renderWordSelect();
        const index = Number(lastIndexBySet[currentSetName]);
        loadWord(Number.isInteger(index) && index >= 0 &&
            index < kanjiDataSets[currentSetName].length ? index : 0, false);
        return;
    }
    const wrong = wrongBySet.get(currentSetName) || new Set();
    reviewIndices = [...wrong].sort((a, b) => a - b);
    if (!reviewIndices.length) {
        setAnswerStatus('ยังไม่มีคำผิดในชุดนี้', 'info');
        return;
    }
    reviewMode = true;
    reviewCompleted = new Set();
    renderWordSelect();
    loadWord(reviewIndices[0], false);
}

window.onload = fetchKanjiData;
