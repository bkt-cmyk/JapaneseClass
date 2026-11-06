const defaultData = {
            "ชุดคำศัพท์พื้นฐาน": [
                { "char": "学校", "data1": "がっこう", "mean": "โรงเรียน" },
                { "char": "先生", "data1": "せんせい", "mean": "คุณครู" },
                { "char": "水", "data1": "みず", "mean": "น้ำ" },
                { "char": "食べる", "data1": "たべる", "mean": "กิน" },
                { "char": "歩く", "data1": "あるく", "mean": "เดิน" },
                { "char": "悪い", "data1": "わるい", "mean": "เลว/แย่" }
            ],
            "ตัวเลข": [
                { "char": "一", "data1": "いち", "mean": "หนึ่ง" },
                { "char": "二", "data1": "に", "mean": "สอง" },
                { "char": "三", "data1": "さん", "mean": "สาม" },
                { "char": "四", "data1": "よん", "mean": "สี่" },
                { "char": "五", "data1": "ご", "mean": "ห้า" }
            ]
        };

        let kanjiDataSets = {};
        let writer;
        let currentSetName = "";
        let currentWordIdx = 0;
        let currentCharInWordIdx = 0;
        let isWordComplete = false;
        let autoAdvanceTimer;
        let lastWriterSize = 0;
        const completedBySet = new Map();
        const STORAGE_KEY = 'japaneseclass.kanji.v1';
        const savedState = readProgress();
        let lastIndexBySet = {};
        let autoNextEnabled = false;
        let quizGeneration = 0;
        function readProgress() {
            try {
                if (typeof localStorage === 'undefined') return {};
                const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
                return data && typeof data === 'object' ? data : {};
            } catch (_) { return {}; }
        }
        function saveProgress() {
            try {
                if (typeof localStorage === 'undefined') return;
                const completed = {};
                for (const [name, indexes] of completedBySet) completed[name] = [...indexes];
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    selectedSet: currentSetName, lastIndexBySet, completed, autoNext: autoNextEnabled
                }));
            } catch (_) { /* Local storage may be disabled. */ }
        }

        function setLoadMessage(message) {
            const element = document.getElementById('load-message');
            element.textContent = message;
            element.hidden = !message;
        }

        /**
         * ตัวโหลดข้อมูลตัวอักษรที่ได้รับการปรับปรุง:
         * 1. ลองโหลดจากฐานข้อมูลคันจิญี่ปุ่น (jp) ก่อน
         * 2. หากไม่พบ (404) จะลองโหลดจากฐานข้อมูลหลัก (cn/default)
         * 3. หากไม่พบอีก จะแจ้ง Error ผ่าน Console เพื่อไม่ให้แอปค้าง
         */
        const charDataLoader = (char, onComplete, onErr) => {
            fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@latest/${char}.json`)
                .then(res => {
                    if (!res.ok) throw new Error('Not found in JP db');
                    return res.json();
                })
                .then(onComplete)
                .catch(() => {
                    fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${char}.json`)
                        .then(res => {
                            if (!res.ok) throw new Error('Not found in any db');
                            return res.json();
                        })
                        .then(onComplete)
                        .catch(err => {
                            console.error('ไม่พบข้อมูลสำหรับตัวอักษร:', char);
                            if (currentSetName && kanjiDataSets[currentSetName]?.[currentWordIdx]?.char.includes(char)) {
                                setStatus('โหลดข้อมูลลำดับขีดไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตและรีเฟรชหน้าเว็บ', 'error');
                            }
                            if (onErr) onErr(err);
                        });
                });
        };

        async function fetchKanjiData() {
            try {
                const response = await fetch('../data/kanji.json').catch(() => null);
                if (!response || !response.ok) throw new Error('Lesson file unavailable');
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
            const savedIndexes = savedState.lastIndexBySet;
            lastIndexBySet = savedIndexes && typeof savedIndexes === 'object' && !Array.isArray(savedIndexes)
                ? savedIndexes : {};
            const savedCompleted = savedState.completed && typeof savedState.completed === 'object'
                ? savedState.completed : {};
            for (const name of setNames) {
                const indexes = Array.isArray(savedCompleted[name]) ? savedCompleted[name] : [];
                completedBySet.set(name, new Set(indexes.filter(i =>
                    Number.isInteger(i) && i >= 0 && i < kanjiDataSets[name].length
                )));
            }
            autoNextEnabled = savedState.autoNext === true;
            document.getElementById('auto-next').checked = autoNextEnabled;
            setSelect.innerHTML = setNames.map(name => {
                const charString = kanjiDataSets[name].map(item => item.char).join(' ');
                return '<option value="' + name + '">' + name + ': ' + charString + '</option>';
            }).join('');
            if (setNames.length > 0) {
                loadSet(setNames.includes(savedState.selectedSet) ? savedState.selectedSet : setNames[0]);
            }
        }

        function loadSet(setName) {
            if (!Object.prototype.hasOwnProperty.call(kanjiDataSets, setName)) return;
            currentSetName = setName;
            if (!completedBySet.has(setName)) completedBySet.set(setName, new Set());
            document.getElementById('setSelect').value = setName;
            const kanjiSelect = document.getElementById('kanjiSelect');
            kanjiSelect.innerHTML = kanjiDataSets[setName].map((item, i) =>
                '<option value="' + i + '">' + item.char + ' - ' + item.mean + '</option>'
            ).join('');
            const index = Number(lastIndexBySet[setName]);
            loadWord(Number.isInteger(index) && index >= 0 &&
                index < kanjiDataSets[setName].length ? index : 0);
        }

        function loadWord(index) {
            clearTimeout(autoAdvanceTimer);
            const idx = Number(index);
            const set = kanjiDataSets[currentSetName];
            currentWordIdx = Number.isInteger(idx) && idx >= 0 && idx < set.length ? idx : 0;
            currentCharInWordIdx = 0;
            quizGeneration++;
            isWordComplete = false;
            const data = set[currentWordIdx];
            document.getElementById('display-meaning').innerText = data.mean;
            document.getElementById('display-reading').innerText = data.data1;
            document.getElementById('kanjiSelect').value = String(currentWordIdx);
            const next = document.getElementById('next-btn');
            next.innerHTML = 'ข้ามคำนี้ <span>→</span>';
            next.disabled = false;
            document.getElementById('prev-btn').disabled = currentWordIdx === 0;
            document.getElementById('set-summary').hidden = true;
            lastIndexBySet[currentSetName] = currentWordIdx;
            saveProgress();
            updateProgress();
            setupWriterForChar();
        }

        function updateProgress() {
            const set = kanjiDataSets[currentSetName];
            const total = set.length;
            const completed = completedBySet.get(currentSetName)?.size ?? 0;
            const pct = total > 0 ? (completed / total) * 100 : 0;
            document.getElementById('progress-fill').style.width = pct + '%';
            document.getElementById('progress-count').innerText = `${completed}/${total}`;
            const track = document.getElementById('progress-track');
            track.setAttribute('aria-valuemax', String(total));
            track.setAttribute('aria-valuenow', String(completed));
        }

        function setStatus(text, state) {
            const msg = document.getElementById('status-msg');
            msg.innerText = text;
            msg.className = 'status-chip state-' + state;
            void msg.offsetWidth;
            msg.classList.add('pop');
        }

        function setupWriterForChar() {
            const data = kanjiDataSets[currentSetName][currentWordIdx];
            const charToDraw = data.char[currentCharInWordIdx];
            const container = document.getElementById('writer-container');

            if (writer && typeof writer.cancelQuiz === 'function') {
                try { writer.cancelQuiz(); } catch (e) { /* no active quiz to cancel */ }
            }
            container.innerHTML = '';
            writer = null;

            if (typeof HanziWriter === 'undefined') {
                setStatus('โหลดระบบเขียนไม่สำเร็จ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วรีเฟรชหน้าเว็บ', 'error');
                return;
            }

            const isKanji = /[\u4e00-\u9faf]/.test(charToDraw);
            if (!isKanji) {
                if (currentCharInWordIdx < data.char.length - 1) {
                    currentCharInWordIdx++;
                    setupWriterForChar();
                } else {
                    handleWordComplete();
                }
                return;
            }

            const size = Math.min(container.clientWidth - 10, 320);
            lastWriterSize = size;

            try {
                writer = HanziWriter.create('writer-container', charToDraw, {
                width: size,
                height: size,
                showCharacter: false,
                showOutline: true,
                drawingColor: '#2b2140',
                outlineColor: 'rgba(43, 33, 64, 0)',
                drawingWidth: 18,
                padding: 22,
                strokeAnimationSpeed: 1,
                delayBetweenStrokes: 100,
                charDataLoader: charDataLoader
                });
                startQuiz();
            } catch (err) {
                writer = null;
                console.error('Kanji writer could not start:', err);
                setStatus('เปิดแบบฝึกเขียนไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ', 'error');
            }
        }

        function startQuiz() {
            if (!writer) return;
            const generation = quizGeneration;
            const data = kanjiDataSets[currentSetName][currentWordIdx];
            const totalChars = data.char.length;

            setStatus(
                totalChars > 1 ? `เขียนตัวที่ ${currentCharInWordIdx + 1} / ${totalChars}` : "ลากเส้นตามลำดับขีด",
                'neutral'
            );

            writer.quiz({
                onMistake: () => {
                    if (generation === quizGeneration) setStatus("ผิด! ลองใหม่อีกครั้ง", 'error');
                },
                onCorrectStroke: () => {
                    if (generation === quizGeneration) setStatus("ถูกต้อง! ต่อไป...", 'success');
                },
                onComplete: () => {
                    if (generation !== quizGeneration) return;
                    let nextIdx = currentCharInWordIdx + 1;
                    while (nextIdx < data.char.length && !/[\u4e00-\u9faf]/.test(data.char[nextIdx])) {
                        nextIdx++;
                    }

                    if (nextIdx < data.char.length) {
                        setStatus("ยอดเยี่ยม! ไปตัวถัดไป...", 'info');
                        setTimeout(() => {
                            if (generation !== quizGeneration) return;
                            currentCharInWordIdx = nextIdx;
                            setupWriterForChar();
                        }, 800);
                    } else {
                        handleWordComplete();
                    }
                }
            });
        }

        function handleWordComplete() {
            if (isWordComplete) return;
            isWordComplete = true;
            completedBySet.get(currentSetName)?.add(currentWordIdx);
            updateProgress();
            saveProgress();
            setStatus("เขียนครบทั้งคำแล้ว ✓", 'success');
            document.getElementById('next-btn').innerHTML = 'คำถัดไป <span>→</span>';

            // deferred to the next tick so the mouseup/touchend that just completed
            // the last stroke finishes processing before we mutate the writer's DOM
            const completedWriter = writer;
            setTimeout(() => {
                if (completedWriter) {
                    completedWriter.showCharacter();
                    completedWriter.updateColor('drawingColor', { color: '#3eaa5c', duration: 300 });
                }
            }, 0);

            if (autoNextEnabled) autoAdvanceTimer = setTimeout(nextInSet, 1300);
        }

        function prevInSet() {
            if (currentWordIdx > 0) loadWord(currentWordIdx - 1);
        }
        function nextInSet() {
            const set = kanjiDataSets[currentSetName];
            if (currentWordIdx >= set.length - 1) finishSet();
            else loadWord(currentWordIdx + 1);
        }
        function finishSet() {
            clearTimeout(autoAdvanceTimer);
            const completed = completedBySet.get(currentSetName)?.size || 0;
            const total = kanjiDataSets[currentSetName].length;
            document.getElementById('summary-text').textContent =
                'เขียนสำเร็จ ' + completed + '/' + total + ' คำ (บันทึกในเครื่องนี้)';
            document.getElementById('set-summary').hidden = false;
            document.getElementById('next-btn').disabled = true;
            setStatus('ถึงท้ายชุดแล้ว ✓', 'info');
            saveProgress();
        }
        function restartSet() {
            completedBySet.set(currentSetName, new Set());
            lastIndexBySet[currentSetName] = 0;
            loadWord(0);
        }
        function chooseSet() { document.getElementById('setSelect').focus(); }
        function toggleAutoNext(checked) {
            autoNextEnabled = checked === true;
            clearTimeout(autoAdvanceTimer);
            if (autoNextEnabled && isWordComplete && document.getElementById('set-summary').hidden) {
                autoAdvanceTimer = setTimeout(nextInSet, 1300);
            }
            saveProgress();
        }

        window.onload = fetchKanjiData;
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (!writer || isWordComplete) return;
                const container = document.getElementById('writer-container');
                const size = Math.min(container.clientWidth - 10, 320);
                if (size > 32 && Math.abs(size - lastWriterSize) >= 8) {
                    setupWriterForChar();
                }
            }, 300);
        });
