const defaultData = {
        "ชุดคำศัพท์พื้นฐาน": [
            { "char": "学校", "data1": "がっこう", "mean": "โรงเรียน" },
            { "char": "先生", "data1": "せんせい", "mean": "คุณครู" },
            { "char": "水", "data1": "みず", "mean": "น้ำ" },
            { "char": "食べる", "data1": "たべる", "mean": "กิน" },
        ]
    };

    let kanjiDataSets = {};
    let currentSetName = "";
    let currentWordIdx = 0;
    let isCorrect = false;

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
            initApp();
        } catch (e) {
            kanjiDataSets = defaultData;
            setLoadMessage('โหลดบทเรียนเต็มไม่ได้ กำลังใช้ชุดตัวอย่าง โปรดตรวจอินเทอร์เน็ตแล้วรีเฟรชหน้าเว็บ');
            initApp();
        }
    }

    function initApp() {
        const setSelect = document.getElementById('setSelect');
        const setNames = Object.keys(kanjiDataSets);
        setSelect.innerHTML = setNames.map(name => `<option value="${name}">${name}</option>`).join('');
        if (setNames.length > 0) loadSet(setNames[0]);

        document.getElementById('answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleMainAction();
            }
        });
    }

    function loadSet(setName) {
        currentSetName = setName;
        const kanjiSelect = document.getElementById('kanjiSelect');
        kanjiSelect.innerHTML = kanjiDataSets[setName].map((item, i) => 
            `<option value="${i}">${item.char} - ${item.mean}</option>`
        ).join('');
        loadWord(0);
    }

    function loadWord(index) {
        currentWordIdx = parseInt(index);
        isCorrect = false;
        const data = kanjiDataSets[currentSetName][currentWordIdx];
        
        document.getElementById('display-meaning').innerText = data.mean;
        document.getElementById('kanjiSelect').value = index;
        
        const input = document.getElementById('answer-input');
        input.value = '';
        input.className = '';
        input.disabled = false;
        input.focus();
        
        document.getElementById('revealed-hint').style.display = "none";
        document.getElementById('check-btn').innerText = "ตรวจสอบคำตอบ (Enter)";
    }

    function handleMainAction() {
        if (isCorrect) {
            nextInSet();
        } else {
            checkAnswer();
        }
    }

    function checkAnswer() {
        const input = document.getElementById('answer-input');
        const userAnswer = input.value.trim();
        const correctAnswer = kanjiDataSets[currentSetName][currentWordIdx].data1;

        if (!userAnswer) return;

        if (userAnswer === correctAnswer) {
            isCorrect = true;
            input.className = 'correct';
            input.disabled = true;
            document.getElementById('check-btn').innerText = "คำถัดไป (Enter)";
        } else {
            input.className = 'wrong';
            setTimeout(() => {
                if (!isCorrect) input.className = '';
            }, 400);
        }
    }

    function showHint() {
        const hintDiv = document.getElementById('revealed-hint');
        const correctAnswer = kanjiDataSets[currentSetName][currentWordIdx].data1;
        hintDiv.innerText = `เฉลย: ${correctAnswer}`;
        hintDiv.style.display = "block";
    }

    function nextInSet() {
        const set = kanjiDataSets[currentSetName];
        currentWordIdx = (currentWordIdx + 1) % set.length;
        loadWord(currentWordIdx);
    }

    window.onload = fetchKanjiData;
