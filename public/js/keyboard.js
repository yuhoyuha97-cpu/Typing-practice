// 화면 키보드 모듈 — 키 피드백 + 다음 키 안내
const KeyboardDisplay = (() => {

    // ── 키보드 레이아웃 정의 ──────────────────────────────

    // 영문 QWERTY (표시문자, 실제 key값)
    const EN_ROWS = [
        ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
        ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
        ['Caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'Enter'],
        ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Shift↑'],
        ['Space']
    ];

    // 한글 두벌식 배열 (각 키의 한글 문자)
    // 실제 key 이벤트에서 영문 키코드를 한글 문자로 매핑
    const KO_MAP = {
        'q': 'ㅂ', 'w': 'ㅈ', 'e': 'ㄷ', 'r': 'ㄱ', 't': 'ㅅ',
        'y': 'ㅛ', 'u': 'ㅕ', 'i': 'ㅑ', 'o': 'ㅐ', 'p': 'ㅔ',
        'a': 'ㅁ', 's': 'ㄴ', 'd': 'ㅇ', 'f': 'ㄹ', 'g': 'ㅎ',
        'h': 'ㅗ', 'j': 'ㅓ', 'k': 'ㅏ', 'l': 'ㅣ',
        'z': 'ㅋ', 'x': 'ㅌ', 'c': 'ㅊ', 'v': 'ㅍ', 'b': 'ㅠ', 'n': 'ㅜ', 'm': 'ㅡ',
        // Shift (쌍자음/이중모음)
        'Q': 'ㅃ', 'W': 'ㅉ', 'E': 'ㄸ', 'R': 'ㄲ', 'T': 'ㅆ',
        'O': 'ㅒ', 'P': 'ㅖ',
    };

    const KO_ROWS = [
        ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
        ['Tab', 'ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ', '[', ']', '\\'],
        ['Caps', 'ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ', ';', "'", 'Enter'],
        ['Shift', 'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', ',', '.', '/', 'Shift↑'],
        ['Space']
    ];

    // 키 너비 클래스 매핑
    const WIDE_KEYS = {
        'Backspace': 'key-wide', 'Tab': 'key-wide', 'Caps': 'key-wide',
        'Enter': 'key-wide', 'Shift': 'key-wider', 'Shift↑': 'key-wider', 'Space': 'key-space'
    };

    // 실물 key → 화면 키 ID 매핑
    const KEY_ID_MAP = {
        'Backspace': 'Backspace', 'Tab': 'Tab', 'CapsLock': 'Caps',
        'Enter': 'Enter', 'ShiftLeft': 'Shift', 'ShiftRight': 'Shift↑',
        ' ': 'Space',
    };
    // 영문 소문자 → 키 ID
    'qwertyuiopasdfghjklzxcvbnm'.split('').forEach(c => KEY_ID_MAP[c] = c);
    '`1234567890-=[]\\\';,./'.split('').forEach(c => KEY_ID_MAP[c] = c);

    // 손가락 매핑 (키 -> 손가락 ID)
    const FINGER_MAP = {
        // Left Hand
        '`': 'f-lp', '1': 'f-lp', 'q': 'f-lp', 'a': 'f-lp', 'z': 'f-lp', 'Tab': 'f-lp', 'Caps': 'f-lp', 'Shift': 'f-lp',
        'ㅂ': 'f-lp', 'ㅃ': 'f-lp', 'ㅁ': 'f-lp', 'ㅋ': 'f-lp',
        '2': 'f-lr', 'w': 'f-lr', 's': 'f-lr', 'x': 'f-lr',
        'ㅈ': 'f-lr', 'ㅉ': 'f-lr', 'ㄴ': 'f-lr', 'ㅌ': 'f-lr',
        '3': 'f-lm', 'e': 'f-lm', 'd': 'f-lm', 'c': 'f-lm',
        'ㄷ': 'f-lm', 'ㄸ': 'f-lm', 'ㅇ': 'f-lm', 'ㅊ': 'f-lm',
        '4': 'f-li', '5': 'f-li', 'r': 'f-li', 't': 'f-li', 'f': 'f-li', 'g': 'f-li', 'v': 'f-li', 'b': 'f-li',
        'ㄱ': 'f-li', 'ㄲ': 'f-li', 'ㅅ': 'f-li', 'ㅆ': 'f-li', 'ㄹ': 'f-li', 'ㅎ': 'f-li', 'ㅍ': 'f-li', 'ㅠ': 'f-li',
        // Right Hand
        '6': 'f-ri', '7': 'f-ri', 'y': 'f-ri', 'u': 'f-ri', 'h': 'f-ri', 'j': 'f-ri', 'n': 'f-ri', 'm': 'f-ri',
        'ㅛ': 'f-ri', 'ㅕ': 'f-ri', 'ㅗ': 'f-ri', 'ㅓ': 'f-ri', 'ㅜ': 'f-ri', 'ㅡ': 'f-ri',
        '8': 'f-rm', 'i': 'f-rm', 'k': 'f-rm', ',': 'f-rm',
        'ㅑ': 'f-rm', 'ㅏ': 'f-rm',
        '9': 'f-rr', 'o': 'f-rr', 'l': 'f-rr', '.': 'f-rr',
        'ㅐ': 'f-rr', 'ㅒ': 'f-rr', 'ㅣ': 'f-rr',
        '0': 'f-rp', '-': 'f-rp', '=': 'f-rp', 'p': 'f-rp', '[': 'f-rp', ']': 'f-rp', '\\': 'f-rp', ';': 'f-rp', '\'': 'f-rp', '/': 'f-rp', 'Enter': 'f-rp', 'Shift↑': 'f-rp', 'Backspace': 'f-rp',
        'ㅔ': 'f-rp', 'ㅖ': 'f-rp',
        // Thumbs
        'Space': 'f-rt'
    };

    let container = null;
    let currentLang = 'en';
    let activeTimeout = null;

    // ── 렌더링 ────────────────────────────────────────────

    // ── 렌더링 ────────────────────────────────────────────
    /**
     * @param {HTMLElement} el - 컨테이너
     * @param {string} lang - 언어 ('ko' 또는 'en')
     * @param {Object} options - { customPositions: { fingerId: {x,y} } }
     */
    function render(el, lang = 'en', options = {}) {
        container = el;
        currentLang = lang;
        const rows = lang === 'ko' ? KO_ROWS : EN_ROWS;

        el.innerHTML = '';
        el.className = 'keyboard-wrap';
        el.style.position = 'relative';

        rows.forEach((row, ri) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'kb-row';
            row.forEach(key => {
                const btn = document.createElement('div');
                btn.className = 'kb-key ' + (WIDE_KEYS[key] || '');
                btn.dataset.key = key;
                btn.textContent = key === 'Space' ? '' : key;
                rowEl.appendChild(btn);
            });
            el.appendChild(rowEl);
        });

        // 손가락 오버레이 영역 추가 (keyboard.css의 구조와 일치시킴)
        const hands = document.createElement('div');
        hands.className = 'hand-overlay';
        if (options.opacity !== undefined) {
            hands.style.opacity = options.opacity;
        }

        hands.innerHTML = `
            <div class="hand left-hand">
                <div class="palm" id="p-l"></div>
                <div class="fingers">
                    <div class="finger f-lp" id="f-lp"></div>
                    <div class="finger f-lr" id="f-lr"></div>
                    <div class="finger f-lm" id="f-lm"></div>
                    <div class="finger f-li" id="f-li"></div>
                    <div class="finger f-lt" id="f-lt"></div>
                </div>
            </div>
            <div class="hand right-hand">
                <div class="palm" id="p-r"></div>
                <div class="fingers">
                    <div class="finger f-rt" id="f-rt"></div>
                    <div class="finger f-ri" id="f-ri"></div>
                    <div class="finger f-rm" id="f-rm"></div>
                    <div class="finger f-rr" id="f-rr"></div>
                    <div class="finger f-rp" id="f-rp"></div>
                </div>
            </div>
        `;
        el.appendChild(hands);

        // 커스텀 위치 적용 (상대적 오프셋 모드)
        if (options.customPositions) {
            const parts = el.querySelectorAll('.finger, .palm');
            parts.forEach(p => {
                const pos = options.customPositions[p.id];
                if (pos && (pos.x !== 0 || pos.y !== 0)) {
                    // 자연스러운 flex 위치에서 translate로 이동
                    let transform = `translate(${pos.x}px, ${pos.y}px)`;
                    if (p.id === 'f-lt') transform += ' rotate(70deg)';
                    if (p.id === 'f-rt') transform += ' rotate(-70deg)';
                    p.style.transform = transform;
                }
            });
        }
    }

    // ── 키 피드백 ─────────────────────────────────────────

    // 누른 키 하이라이트 (녹색 = 정타, 빨강 = 오타)
    function pressKey(keyId, correct = true) {
        if (!container) return;
        // code → 화면 key 문자 변환
        let displayKey = KEY_ID_MAP[keyId] || keyId;

        // 한글 모드일 때 영문 keyId를 한글 문자로 변환
        if (currentLang === 'ko' && KO_MAP[displayKey]) {
            displayKey = KO_MAP[displayKey];
        } else if (currentLang === 'ko' && KO_MAP[displayKey.toLowerCase()]) { // 'A' (Shift+A) -> 'ㅁ' 등으로 떨어질 경우의 대비 (하지만 KO_MAP 대문자는 쌍자음 지원)
            displayKey = KO_MAP[displayKey];
        }

        // 따옴표나 백슬래시 등의 특수문자 대응
        let escapedKey = displayKey;
        if (displayKey === '\\') escapedKey = '\\\\';
        if (displayKey === "'") escapedKey = "\\'";
        if (displayKey === '"') escapedKey = '\\"';

        try {
            const el = container.querySelector(`[data-key="${escapedKey}"]`);
            if (!el) return;

            el.classList.remove('key-correct', 'key-error');
            // reflow를 강제로 발생시켜 짧은 시간에 연속으로 같은 키를 누를 때 애니메이션 초기화
            void el.offsetWidth;
            el.classList.add(correct ? 'key-correct' : 'key-error');

            if (el.dataset.activeTimeout) {
                clearTimeout(parseInt(el.dataset.activeTimeout));
            }
            const timeoutId = setTimeout(() => {
                el.classList.remove('key-correct', 'key-error');
                delete el.dataset.activeTimeout;
            }, 180);
            el.dataset.activeTimeout = timeoutId;

            // 손가락 오버레이 애니메이션 적용
            const fingerId = FINGER_MAP[displayKey];
            if (fingerId) {
                const fel = container.querySelector('#' + fingerId);
                if (fel) {
                    fel.classList.remove('active', 'error');
                    void fel.offsetWidth;
                    fel.classList.add(correct ? 'active' : 'error');

                    if (fel.dataset.activeTimeout) clearTimeout(parseInt(fel.dataset.activeTimeout));
                    fel.dataset.activeTimeout = setTimeout(() => {
                        fel.classList.remove('active', 'error');
                    }, 180);
                }
            }

        } catch (e) {
            console.error('Invalid selector for key feedback:', displayKey, e);
        }
    }

    // 다음에 눌러야 할 키 안내 (파란 테두리 + 손가락 힌트)
    function highlightNext(char) {
        if (!container) return;
        // 기존 힌트 제거
        container.querySelectorAll('.key-hint').forEach(e => e.classList.remove('key-hint'));
        container.querySelectorAll('.finger.hint').forEach(e => e.classList.remove('hint'));

        if (!char) return;

        const markHint = (key) => {
            let escapedKey = key;
            if (key === '\\') escapedKey = '\\\\';
            if (key === "'") escapedKey = "\\'";
            if (key === '"') escapedKey = '\\"';

            try {
                const el = container.querySelector(`[data-key="${escapedKey}"]`);
                if (el) {
                    el.classList.add('key-hint');
                    const fingerId = FINGER_MAP[key];
                    if (fingerId) {
                        const fel = container.querySelector('#' + fingerId);
                        if (fel) fel.classList.add('hint');
                    }
                }
            } catch (e) { }
        };

        if (char === 'Enter') { markHint('Enter'); return; }

        if (currentLang === 'ko') {
            const match = Object.entries(KO_MAP).find(([k, v]) => v === char);
            if (match) {
                const engKey = match[0];
                const baseHangul = KO_MAP[engKey.toLowerCase()];
                markHint(baseHangul);
                // 쉬프트 조합 (ㅃㅉㄸㄲㅆㅒㅖ)
                if (engKey >= 'A' && engKey <= 'Z') {
                    const fid = FINGER_MAP[baseHangul];
                    if (fid && fid.startsWith('f-l')) markHint('Shift↑'); // 왼손 타자는 우측 쉬프트
                    else markHint('Shift');
                }
            } else {
                if (char === ' ') markHint('Space');
                else markHint(char);
            }
        } else {
            if (char === ' ') markHint('Space');
            else if (char >= 'A' && char <= 'Z') {
                markHint(char.toLowerCase());
                const fid = FINGER_MAP[char.toLowerCase()];
                if (fid && fid.startsWith('f-l')) markHint('Shift↑');
                else markHint('Shift');
            } else {
                // 특수문자 쉬프트 처리
                const specialShiftMap = {
                    '~': '`', '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', '+': '=',
                    '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/'
                };
                if (specialShiftMap[char]) {
                    const baseSpecial = specialShiftMap[char];
                    markHint(baseSpecial);
                    const fid = FINGER_MAP[baseSpecial];
                    if (fid && fid.startsWith('f-l')) markHint('Shift↑');
                    else markHint('Shift');
                } else {
                    markHint(char.toLowerCase());
                }
            }
        }
    }

    // 언어 전환 시 키보드 재렌더
    function setLang(lang) {
        if (container) render(container, lang);
    }

    // 전체 키 초기화
    function reset() {
        if (!container) return;
        container.querySelectorAll('.kb-key').forEach(el => {
            el.classList.remove('key-correct', 'key-error', 'key-hint');
        });
        container.querySelectorAll('.finger').forEach(el => {
            el.classList.remove('active', 'error', 'hint');
        });
    }

    return { render, pressKey, highlightNext, setLang, reset };
})();
