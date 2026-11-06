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
                            if (onErr) onErr(err);
                        });
                });
        };

        async function fetchKanjiData() {
            try {
                const response = await fetch('../data/kanji.json').catch(() => null);
                kanjiDataSets = (response && response.ok) ? await response.json() : defaultData;
                initApp();
            } catch (e) {
                kanjiDataSets = defaultData;
                initApp();
            }
        }

        function initApp() {
            const setSelect = document.getElementById('setSelect');
            const setNames = Object.keys(kanjiDataSets);
            setSelect.innerHTML = setNames.map(name => {
                const currentSet = kanjiDataSets[name];
                const charList = currentSet.map(item => item.char);
                const charString = charList.join(' ');
                return `<option value="${name}">${name}: ${charString}</option>`;
            }).join('');
            if (setNames.length > 0) loadSet(setNames[0]);
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
            clearTimeout(autoAdvanceTimer);
            currentWordIdx = parseInt(index);
            currentCharInWordIdx = 0;
            isWordComplete = false;
            const data = kanjiDataSets[currentSetName][currentWordIdx];

            document.getElementById('display-meaning').innerText = data.mean;
            document.getElementById('display-reading').innerText = data.data1;
            document.getElementById('kanjiSelect').value = index;
            document.getElementById('next-btn').innerHTML = 'ข้ามคำนี้ <span>→</span>';

            updateProgress();
            setupWriterForChar();
        }

        function updateProgress() {
            const set = kanjiDataSets[currentSetName];
            const total = set.length;
            const pct = total > 0 ? ((currentWordIdx + 1) / total) * 100 : 0;
            document.getElementById('progress-fill').style.width = pct + '%';
            document.getElementById('progress-count').innerText = `${currentWordIdx + 1}/${total}`;
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
        }

        function startQuiz() {
            if (!writer) return;
            const data = kanjiDataSets[currentSetName][currentWordIdx];
            const totalChars = data.char.length;

            setStatus(
                totalChars > 1 ? `เขียนตัวที่ ${currentCharInWordIdx + 1} / ${totalChars}` : "ลากเส้นตามลำดับขีด",
                'neutral'
            );

            writer.quiz({
                onMistake: () => {
                    setStatus("ผิด! ลองใหม่อีกครั้ง", 'error');
                },
                onCorrectStroke: () => {
                    setStatus("ถูกต้อง! ต่อไป...", 'success');
                },
                onComplete: () => {
                    let nextIdx = currentCharInWordIdx + 1;
                    while (nextIdx < data.char.length && !/[\u4e00-\u9faf]/.test(data.char[nextIdx])) {
                        nextIdx++;
                    }

                    if (nextIdx < data.char.length) {
                        setStatus("ยอดเยี่ยม! ไปตัวถัดไป...", 'info');
                        setTimeout(() => {
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
            isWordComplete = true;
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

            const set = kanjiDataSets[currentSetName];
            if (set.length > 1) {
                autoAdvanceTimer = setTimeout(nextInSet, 1000);
            }
        }

        function prevInSet() {
            const set = kanjiDataSets[currentSetName];
            currentWordIdx = (currentWordIdx - 1 + set.length) % set.length;
            loadWord(currentWordIdx);
        }

        function nextInSet() {
            const set = kanjiDataSets[currentSetName];
            currentWordIdx = (currentWordIdx + 1) % set.length;
            loadWord(currentWordIdx);
        }

        window.onload = fetchKanjiData;
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (writer) setupWriterForChar();
            }, 300);
        });
