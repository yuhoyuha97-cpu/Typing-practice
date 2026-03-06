// ── Word Bubble Shooter 게임 엔진 ──────────────────────────────
'use strict';

const BubbleGame = (() => {

    // ── 상수 ──────────────────────────────────────────────────
    const COLS = 8;
    const BUBBLE_R = 28;               // 버블 반지름(px)
    const CANVAS_W = 480;
    const CANVAS_H = 560;
    const DANGER_Y = CANVAS_H - 72;   // 위험선 Y
    const PROJ_SPEED = 14;              // 발사체 속도
    const FILL_PROB = 0.78;            // 버블 채움 확률
    const INIT_ROWS = 4;               // 초기 행 수
    const DROP_START = 11000;           // 초기 내려오기 주기(ms)
    const DROP_MIN = 3500;            // 최소 주기
    const DROP_STEP = 600;             // 레벨당 주기 감소
    let specialProb = 0.07;            // 스페셜 버블 생성 확률 (설정 가능)

    const COLORS = [
        '#FF4455', // 빨강
        '#FF9900', // 주황
        '#FFD700', // 노랑
        '#33CC66', // 초록
        '#3399FF', // 파랑
        '#AA44FF', // 보라
    ];

    // ── 내부 상태 ─────────────────────────────────────────────
    let canvas, ctx;
    let bubbles = [];   // BubbleCell[]
    let proj = null; // 날아가는 발사체
    let wordPool = [];   // 단어 풀 (shuffle 후 pop)
    let allWords = [];   // 원본 단어 목록
    let score = 0;
    let combo = 0;
    let level = 1;
    let popped = 0;    // 이번 레벨 처치 수
    let TARGET_PER_LEVEL = 8;
    let dropInterval = DROP_START;
    let dropTimer = null;
    let animFrame = null;
    let gameRunning = false;
    let cb = {};               // 콜백 모음
    let fallingBubbles = [];   // 천장에서 분리되어 떨어지는 버블 배열
    let aimTarget = null;      // 현재 조준 중인 타겟 버블
    let aimPath = null;       // 조준 경로 { vx, vy, bouncePoint }
    let totalDrops = 0;        // 전체 내려온 횟수 (하단 행 추가 홀짝 보정용)
    let renderScale = 1;       // CSS scale 대신 ctx.scale로 해상도 유지

    // ── 오디오 ────────────────────────────────────────────────
    let _audioCtx = null;
    function getAudioCtx() {
        if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
        return _audioCtx;
    }

    // 버블 팝 사운드 (combo에 따라 음높이 상승)
    function playPopSound(count = 1) {
        try {
            const ctx = getAudioCtx();
            const now = ctx.currentTime;

            // 짧은 노이즈 burst (공기 빠지는 느낌)
            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.18, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            noiseSource.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noiseSource.start(now); noiseSource.stop(now + 0.06);

            // 하강하는 사인파 (버블 팝 피치)
            const baseFreq = 480 + (count - 1) * 60;
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.35, now + 0.1);
            gainNode.gain.setValueAtTime(0.22, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.12);
        } catch (e) { /* 오디오 미지원 시 무시 */ }
    }

    // 스페셜 버블 터짐 효과음 (3연속 상승음)
    function playSpecialSound() {
        try {
            const ctx2 = getAudioCtx();
            const now = ctx2.currentTime;
            [0, 0.07, 0.14].forEach((delay, i) => {
                const o = ctx2.createOscillator();
                const g = ctx2.createGain();
                o.type = 'sine';
                o.frequency.setValueAtTime(700 + i * 200, now + delay);
                o.frequency.exponentialRampToValueAtTime(1400 + i * 200, now + delay + 0.15);
                g.gain.setValueAtTime(0.25, now + delay);
                g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
                o.connect(g); g.connect(ctx2.destination);
                o.start(now + delay); o.stop(now + delay + 0.15);
            });
        } catch (e) { }
    }

    // ── 스페셜: 랜덤 방향 라인 버블 선택 ────────────────────────
    // dir: 0=가로(행), 1=좌대각선, 2=우대각선
    function getLineBubbles(target, dir) {
        return bubbles.filter(b => {
            if (!b.alive) return false;
            const rowDiff = b.row - target.row;
            if (dir === 0) {
                return b.row === target.row;
            } else if (dir === 1) {
                const expectedX = target.x - rowDiff * BUBBLE_R;
                return Math.abs(b.x - expectedX) < BUBBLE_R * 1.3;
            } else {
                const expectedX = target.x + rowDiff * BUBBLE_R;
                return Math.abs(b.x - expectedX) < BUBBLE_R * 1.3;
            }
        });
    }

    // ── 육각형 격자 좌표 ──────────────────────────────────────
    const hexX = (col, row) =>
        BUBBLE_R + col * BUBBLE_R * 2 + (row % 2 === 1 ? BUBBLE_R : 0);
    const hexY = (row) => BUBBLE_R + row * BUBBLE_R * 1.72;

    // ── 공개 API ──────────────────────────────────────────────
    function init(canvasEl, words, callbacks = {}) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        cb = callbacks;

        allWords = [...words];
        refillPool();

        bubbles = [];
        fallingBubbles = [];
        proj = null;
        score = 0; combo = 0; level = 1; popped = 0;
        dropInterval = DROP_START;
        totalDrops = 0;
        gameRunning = true;
        // 상세 통계 초기화
        startTime = 0; totalCharsTyped = 0; lastWordTime = 0; lastWordWpm = 0; maxWpm = 0;
        totalShots = 0; totalHits = 0;

        // 위에서 추가된 "연결성 검증 방지(럭키샷 방지)" 코드는 
        // 아랫줄(row + 1)을 기준으로 윗줄을 붙이도록 설계되어 있음.
        // 처음 4줄(INIT_ROWS)을 한꺼번에 찍어낼 때는
        // 반드시 '아랫줄'을 먼저 만들고 '윗줄'을 만들어야 함 (바텀업 스폰).
        for (let r = INIT_ROWS - 1; r >= 0; r--) {
            spawnRow(r);
        }

        // 초기화 시에 천장(row=0)에서 끊어진 거품 정리 (혹시 모를 예외 방지)
        dropDetachedBubbles();

        startDrop();
        loop();
    }

    // 타수(WPM) 추적용 상태
    let startTime = 0;
    let totalCharsTyped = 0;
    let lastWordTime = 0;
    let lastWordWpm = 0;
    let maxWpm = 0;
    let totalShots = 0;   // 전체 발사 횟수
    let totalHits = 0;    // 성공 타격 횟수

    // ── 타겟 선택 헬퍼 (스마트 조준) ─────────────────────────
    function findBestTarget(word, prefixMatch = false) {
        const sx = CANVAS_W / 2, sy = CANVAS_H - 28;
        // 1. 조건에 맞는 모든 버블 찾기
        const candidates = bubbles.filter(b => b.alive && (prefixMatch ? b.word.startsWith(word) : b.word === word));
        if (candidates.length === 0) return null;

        // 2. 경로가 뚫려있는(맞출 수 있는) 거품 필터링
        const reachable = candidates.filter(b => findShotPath(sx, sy, b) !== null);
        let bestList = reachable.length > 0 ? reachable : candidates;

        // 3. 여러 개라면 가장 아래에 있는 버블(y값이 큰 것) 우선
        bestList.sort((a, b) => b.y - a.y);
        return bestList[0];
    }

    // 발사 (단어 입력 완료 시 호출)
    function shoot(word) {
        if (!gameRunning || proj) return false;

        const now = Date.now();
        if (startTime === 0) startTime = now;

        const target = findBestTarget(word, false);
        if (!target) {
            combo = 0;
            notifyUpdate();
            return false;
        }

        // 성공 타이핑 시 통계 계산
        const wordLen = word.length;
        totalCharsTyped += wordLen;
        totalShots++;  // 발사 횟수 비용 (성공 타이핑 기준 계산의 효율성 없어 해당 시 1 증가)

        if (lastWordTime === 0) lastWordTime = startTime;
        const timeDiffSec = (now - lastWordTime) / 1000;

        // 현재 단어 WPM (한글 1글자 = 2.5타격 가정, 분당 타수)
        if (timeDiffSec > 0) {
            const strokes = (typeof gameLang !== 'undefined' && gameLang === 'en') ? wordLen : wordLen * 2.5;
            lastWordWpm = Math.round((strokes / timeDiffSec) * 60);
            if (lastWordWpm > maxWpm) maxWpm = lastWordWpm;
        }
        lastWordTime = now;

        const sx = CANVAS_W / 2, sy = CANVAS_H - 28;
        const path = findShotPath(sx, sy, target);

        let vx, vy;
        if (path) {
            // 열린 경로 (직선 또는 반사)
            vx = path.vx; vy = path.vy;
        } else {
            // 모든 경로 차단 → 직선으로 강제 발사 (중간 버블에 막혀 소멸됨)
            const d = Math.hypot(target.x - sx, target.y - sy);
            vx = (target.x - sx) / d * PROJ_SPEED;
            vy = (target.y - sy) / d * PROJ_SPEED;
        }

        proj = { x: sx, y: sy, vx, vy, color: target.color, word };
        return true;
    }

    // 조준 (입력 중 실시간 호출)
    function aim(word) {
        if (!gameRunning) { aimTarget = null; aimPath = null; return; }

        let target = findBestTarget(word, false);
        if (!target && word.length > 0) {
            target = findBestTarget(word, true);
        }

        aimTarget = target;
        const sx = CANVAS_W / 2, sy = CANVAS_H - 28;
        aimPath = aimTarget ? findShotPath(sx, sy, aimTarget) : null;
    }

    function pause() { gameRunning = false; clearInterval(dropTimer); cancelAnimationFrame(animFrame); }
    function resume() { if (!gameRunning) { gameRunning = true; startDrop(); loop(); } }
    function stop() { pause(); bubbles = []; proj = null; }

    // 현재 화면의 살아있는 단어 목록 (입력 힌트용)
    function getLiveWords() {
        return [...new Set(bubbles.filter(b => b.alive).map(b => b.word))];
    }

    // ── 단어 풀 관리 ──────────────────────────────────────────
    function refillPool() {
        wordPool = shuffle([...allWords]);
    }

    function nextWord() {
        // 화면에 이미 있는 단어는 중복 방지
        const live = new Set(bubbles.filter(b => b.alive).map(b => b.word));
        for (let tries = 0; tries < wordPool.length; tries++) {
            const w = wordPool.pop();
            if (wordPool.length === 0) refillPool();
            if (!live.has(w)) return w;
        }
        return wordPool.pop() || allWords[0]; // fallback
    }

    // ── 행 스폰 ───────────────────────────────────────────────
    function spawnRow(atRow) {
        // totalDrops를 반영해 실제 화면 홀짝 패리티 결정
        const visualParity = (atRow + totalDrops) % 2;
        const cols = COLS - (visualParity === 1 ? 1 : 0);

        // 새로 생성할 버블의 열(col) 인덱스들
        const newCols = [];
        for (let c = 0; c < cols; c++) {
            if (Math.random() <= FILL_PROB) {
                newCols.push(c);
            }
        }

        // 새 행이 기존 거품들과 연결되지 않아 통째로 떨어지는 현상 방지:
        // 만약 기존에 살아있는 행(atRow + 1)이 있다면, 적어도 하나는 맞닿아야 함
        const childRow = atRow + 1;
        const children = bubbles.filter(b => b.alive && b.row === childRow);

        if (children.length > 0) {
            let hasConnection = false;
            for (const c of newCols) {
                const x = BUBBLE_R + c * BUBBLE_R * 2 + (visualParity === 1 ? BUBBLE_R : 0);
                const y = hexY(atRow);
                // 연결 확인
                for (const child of children) {
                    if (Math.hypot(child.x - x, child.y - y) < BUBBLE_R * 2.2) {
                        hasConnection = true;
                        break;
                    }
                }
                if (hasConnection) break;
            }

            // 연결된 게 하나도 없다면 강제로 하나 연결되도록 추가
            if (!hasConnection) {
                const randomChild = children[Math.floor(Math.random() * children.length)];
                // 부모 행에서의 유효한 col 값 중 하나를 선택 (가장 가까운 X 좌표)
                let bestCol = 0;
                let minDist = Infinity;
                for (let c = 0; c < cols; c++) {
                    const x = BUBBLE_R + c * BUBBLE_R * 2 + (visualParity === 1 ? BUBBLE_R : 0);
                    const y = hexY(atRow);
                    const dist = Math.hypot(randomChild.x - x, randomChild.y - y);
                    if (dist < minDist) {
                        minDist = dist;
                        bestCol = c;
                    }
                }
                if (!newCols.includes(bestCol)) {
                    newCols.push(bestCol);
                }
            }
        }

        // 확정된 newCols를 기반으로 실제 버블 스폰
        for (const c of newCols) {
            const isSpecial = Math.random() < specialProb;
            const color = isSpecial ? '#FFFFFF' : COLORS[Math.floor(Math.random() * COLORS.length)];
            const word = nextWord();
            // X는 스폰 시 고정 — 이후 row가 바뀌어도 재계산하지 않음
            const x = BUBBLE_R + c * BUBBLE_R * 2 + (visualParity === 1 ? BUBBLE_R : 0);
            bubbles.push({
                row: atRow, col: c,
                color, word,
                x,
                y: hexY(atRow),
                alive: true,
                isSpecial,
            });
        }
    }

    // ── 내려오기 타이머 ───────────────────────────────────────
    function startDrop() {
        clearInterval(dropTimer);
        dropTimer = setInterval(() => {
            if (!gameRunning) return;
            // 기존 버블: Y만 내림 (X는 절대 건들지 않음)
            bubbles.forEach(b => { b.row++; b.y = hexY(b.row); });
            // 새 행 추가 전에 totalDrops 증가 (패리티 보정)
            totalDrops++;
            spawnRow(0);
            // 새 row=0 스폰 후, 연결 끊긴 고립 버블 즉시 낙하 처리
            dropDetachedBubbles();
            checkDanger();
        }, dropInterval);
    }

    // ── 위험 체크 ─────────────────────────────────────────────
    function checkDanger() {
        if (bubbles.some(b => b.alive && b.y + BUBBLE_R >= DANGER_Y)) {
            endGame(false);
        }
    }

    // ── 충돌 가능 경로 탐색 ────────────────────────────────────
    // 선분 (sx,sy)→(tx,ty)가 excluding 제외한 버블과 충돌하는지 체크하고,
    // 가장 가까운 장애물과의 '여유 간격(여유도)'을 반환합니다.
    // -1: 충돌 (절대 통과 불가)
    // 그 외 양수: 가장 가까운 장애물 중심과의 거리 (클수록 안전함)
    function getSegmentClearance(sx, sy, tx, ty, excluding) {
        let minClearance = Infinity;
        const dx = tx - sx, dy = ty - sy;
        const len = Math.hypot(dx, dy);
        if (len === 0) return Infinity; // 길이가 0이면 통과
        const ux = dx / len, uy = dy / len;

        for (const b of bubbles) {
            if (!b.alive || excluding.has(b)) continue;
            const bx = b.x - sx, by = b.y - sy;
            // 선분에 투영된 길이를 구하고, 선분 밖이면 양끝점 거리 사용
            const t = Math.max(0, Math.min(len, bx * ux + by * uy));
            const cx = sx + t * ux, cy = sy + t * uy;
            const dist = Math.hypot(b.x - cx, b.y - cy);

            // 물리적인 절대 충돌 반경(BUBBLE_R * 2 - 4 = 약 52).
            // 이것보다 작으면 무조건 물리 엔진에서 충돌함. 
            // 시각적 오차 및 육각 그리드의 빡빡함을 고려하여 1.6 정도를 최소 컷오프로 남겨둠
            if (dist < BUBBLE_R * 1.6) return -1;

            if (dist < minClearance) minClearance = dist;
        }
        return minClearance;
    }

    // 직선 또는 벽 반사 경로 탐색 (안전 점수 기반으로 최적 경로 도출)
    // 반환: { vx, vy, bouncePoint } 또는 null (모든 경로 불가)
    function findShotPath(sx, sy, target) {
        const excl = new Set([target]);

        let bestPath = null;
        let maxClearance = -1;

        // 가능한 경로 객체와 안전 점수를 받아서 최고 점수 갱신
        function considerPath(pathObj, clearance) {
            if (clearance > maxClearance) {
                maxClearance = clearance;
                bestPath = pathObj;
            }
        }

        // 1. 직선 경로 탐색 (오프셋 스윕)
        const steps = 15;
        const spread = BUBBLE_R * 1.2;
        const offsets = [];
        for (let i = 0; i <= steps; i++) {
            const t = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) / Math.ceil(steps / 2);
            offsets.push(t * spread);
        }

        for (const offX of offsets) {
            const fakeTx = target.x + offX;
            const fakeTy = target.y;

            const clearance = getSegmentClearance(sx, sy, fakeTx, fakeTy, excl);
            if (clearance > 0) {
                const d = Math.hypot(fakeTx - sx, fakeTy - sy);
                // 중앙을 쏠 수 있으면 중앙 우대 (오프셋에 페널티 부과)
                const effectiveClearance = clearance - Math.abs(offX) * 0.1;
                considerPath({
                    vx: (fakeTx - sx) / d * PROJ_SPEED,
                    vy: (fakeTy - sy) / d * PROJ_SPEED, bouncePoint: null
                }, effectiveClearance);
            }
        }

        // 2. 바운드 경로 탐색 헬퍼 (벽 튕김 처리)
        function evaluateWallBounce(wallX, offX) {
            const fakeTx = target.x + offX;
            const rtx = 2 * wallX - fakeTx;
            const d = Math.hypot(rtx - sx, target.y - sy);
            if (d === 0) return;
            const bpY = sy + (wallX - sx) / (rtx - sx) * (target.y - sy);
            if (bpY <= -BUBBLE_R || bpY >= sy) return;

            // 1구간(대포->벽)과 2구간(벽->목표) 중 더 좁은 곳이 해당 경로의 최종 여유도
            const cl1 = getSegmentClearance(sx, sy, wallX, bpY, excl);
            if (cl1 < 0) return;
            const cl2 = getSegmentClearance(wallX, bpY, fakeTx, target.y, excl);
            if (cl2 < 0) return;

            const minCl = Math.min(cl1, cl2);
            // 바운드 샷은 기본적으로 직사보다 시각적으로 복잡하므로 약간 페널티(5px) 부과
            // 하지만 막힌 곳을 우회할 만큼 충분히 널널하다면 직사를 이길 수 있음!
            const effectiveClearance = minCl - 5 - Math.abs(offX) * 0.1;

            considerPath({
                vx: (rtx - sx) / d * PROJ_SPEED,
                vy: (target.y - sy) / d * PROJ_SPEED,
                bouncePoint: { x: wallX, y: bpY }
            }, effectiveClearance);
        }

        const wallL = BUBBLE_R;
        const wallR = CANVAS_W - BUBBLE_R;

        // 3. 바운드 오프셋 스윕
        const bounceSteps = 25;
        const bounceSpread = BUBBLE_R * 1.8;
        const bounceOffsets = [];
        for (let i = 0; i <= bounceSteps; i++) {
            const t = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) / Math.ceil(bounceSteps / 2);
            bounceOffsets.push(t * bounceSpread);
        }

        for (const offX of bounceOffsets) {
            evaluateWallBounce(wallL, offX);
            evaluateWallBounce(wallR, offX);
        }

        // 경로가 1개라도 있으면 가장 안전한 경로 반환, 다 막혔으면 null 반환
        return bestPath;
    }

    // ── 충돌 판정 ─────────────────────────────────────────────
    function checkCollision() {
        if (!proj) return;

        // 모든 살아있는 버블과 충돌 체크 (가장 가까운 것 우선)
        let closestDist = Infinity;
        let closestBubble = null;
        for (const b of bubbles) {
            if (!b.alive) continue;
            const dist = Math.hypot(b.x - proj.x, b.y - proj.y);
            if (dist < BUBBLE_R * 2 - 4 && dist < closestDist) {
                closestDist = dist;
                closestBubble = b;
            }
        }

        if (closestBubble) {
            if (closestBubble.word === proj.word) {
                // ✅ 타겟 버블: 격파
                popBubbles(closestBubble);
            } else {
                // ❌ 중간 버블에 막힘: 현재 위치에 부착
                attachBubble();
                combo = 0;
                notifyUpdate();
            }
            proj = null;
            return;
        }

        // 화면 이탈 시 발사체 소멸
        if (proj.x < -BUBBLE_R || proj.x > CANVAS_W + BUBBLE_R ||
            proj.y < -BUBBLE_R || proj.y > CANVAS_H + BUBBLE_R) {
            proj = null;
            combo = 0;
            notifyUpdate();
        }
    }

    // ── 발사체 부착 (빗나갔을 때 클러스터에 붙음) ────────────────
    function attachBubble() {
        const ax = proj.x, ay = proj.y;
        if (ay >= DANGER_Y) { checkDanger(); return; }
        if (ay < 0) return;

        // 기존 버블과 너무 가까우면 붙이지 않음
        const tooClose = bubbles.some(b => b.alive && Math.hypot(b.x - ax, b.y - ay) < BUBBLE_R * 1.5);
        if (!tooClose) {
            const approxRow = Math.max(0, Math.round((ay - BUBBLE_R) / (BUBBLE_R * 1.72)));
            bubbles.push({
                row: approxRow, col: 0,
                color: proj.color, word: proj.word,
                x: ax, y: ay,
                alive: true,
            });
            dropDetachedBubbles();
        }
        checkDanger();
    }

    // ── BFS 연쇄 제거 ─────────────────────────────────────────
    function popBubbles(target) {
        const color = target.color;
        const visited = new Set();
        const queue = [target];
        visited.add(target);

        // 스페셜 버블: 랜덤 방향 한 줄 전제
        if (target.isSpecial) {
            const dir = Math.floor(Math.random() * 3);
            getLineBubbles(target, dir).forEach(b => visited.add(b));
            playSpecialSound();
        }

        // 1단계: 같은 색 연결 BFS
        while (queue.length) {
            const cur = queue.shift();
            for (const nb of bubbles) {
                if (visited.has(nb) || !nb.alive || nb.color !== color) continue;
                if (Math.hypot(nb.x - cur.x, nb.y - cur.y) < BUBBLE_R * 2.2) {
                    visited.add(nb);
                    queue.push(nb);
                }
            }
        }

        const count = visited.size;
        visited.forEach(b => { b.alive = false; });

        // 팔 사운드 (combo 수치로 음높이 조절)
        playPopSound(Math.min(combo + 1, 6));

        // 2단계: 천장 연결 체크 → 분리된 버블 낙하
        dropDetachedBubbles();

        // 점수: 단독=10, 연쇄 보너스
        combo++;
        totalHits++;  // 성공 타요 증가
        const pts = count === 1 ? 10 * combo : count * 15 * combo;
        score += pts;
        popped++;

        // 레벨 업
        if (popped >= TARGET_PER_LEVEL * level) {
            level++;
            dropInterval = Math.max(DROP_MIN, dropInterval - DROP_STEP);
            startDrop();
        }

        notifyUpdate({ pts, count });
    }

    // ── 천장 연결 BFS → 분리 버블 낙하 ──────────────────────────
    function dropDetachedBubbles() {
        // 천장(row === 0)의 살아있는 버블에서 BFS로 연결된 버블 전부 마킹
        const connected = new Set();
        const queue = bubbles.filter(b => b.alive && b.row === 0);
        queue.forEach(b => connected.add(b));

        let i = 0;
        while (i < queue.length) {
            const cur = queue[i++];
            for (const nb of bubbles) {
                if (connected.has(nb) || !nb.alive) continue;
                if (Math.hypot(nb.x - cur.x, nb.y - cur.y) < BUBBLE_R * 2.2) {
                    connected.add(nb);
                    queue.push(nb);
                }
            }
        }

        // 연결 안 된 살아있는 버블 → 낙하 애니메이션으로 전환
        const toFall = bubbles.filter(b => b.alive && !connected.has(b));
        toFall.forEach(b => {
            b.alive = false;
            fallingBubbles.push({
                x: b.x, y: b.y,
                vx: (Math.random() - 0.5) * 2,  // 살짝 좌우 흔들림
                vy: -1 + Math.random() * 2,      // 초기 속도 (약간 위로 튀었다가 떨어짐)
                color: b.color, word: b.word,
                alpha: 1.0,
            });
        });

        // 낙하 버블로 얻는 보너스 점수
        if (toFall.length > 0) {
            score += toFall.length * 5 * combo;
            notifyUpdate({});
        }
    }

    function notifyUpdate(extra = {}) {
        let avgWpm = 0;
        if (startTime > 0) {
            const totalElapsedSec = (Date.now() - startTime) / 1000;
            const totalStrokes = (typeof gameLang !== 'undefined' && gameLang === 'en') ? totalCharsTyped : totalCharsTyped * 2.5;
            if (totalElapsedSec > 0) avgWpm = Math.round((totalStrokes / totalElapsedSec) * 60);
        }
        if (cb.onUpdate) cb.onUpdate({ score, level, combo, wpm: { current: lastWordWpm, avg: avgWpm, max: maxWpm }, ...extra });
    }

    // ── 게임 종료 ─────────────────────────────────────────────
    function endGame(win) {
        gameRunning = false;
        clearInterval(dropTimer);
        cancelAnimationFrame(animFrame);

        const endTime = Date.now();
        const durationSec = startTime > 0 ? Math.round((endTime - startTime) / 1000) : 0;
        const totalStrokes = (typeof gameLang !== 'undefined' && gameLang === 'en')
            ? totalCharsTyped : totalCharsTyped * 2.5;
        const avgWpmFinal = (durationSec > 0) ? Math.round((totalStrokes / durationSec) * 60) : 0;
        const accuracy = totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : 100;

        if (cb.onGameOver) cb.onGameOver({
            score, level, win,
            wpm: { avg: avgWpmFinal, max: maxWpm },
            accuracy,
            duration: durationSec,
            totalShots,
            totalHits,
        });
    }

    // ── 메인 루프 ─────────────────────────────────────────────
    function loop() {
        if (!gameRunning) return;
        update();
        render();
        animFrame = requestAnimationFrame(loop);
    }

    function update() {
        // 발사체 이동
        if (proj) {
            proj.x += proj.vx;
            proj.y += proj.vy;
            if (proj.x - BUBBLE_R < 0 || proj.x + BUBBLE_R > CANVAS_W) proj.vx *= -1;
            checkCollision();
        }

        // 낙하 버블 물리 업데이트
        const GRAVITY = 0.55;
        fallingBubbles = fallingBubbles.filter(f => {
            f.vy += GRAVITY;
            f.y += f.vy;
            f.x += f.vx;
            f.alpha -= 0.022;         // 서서히 투명해짐
            return f.alpha > 0 && f.y < CANVAS_H + BUBBLE_R * 2;
        });
    }

    // ── 렌더링 ────────────────────────────────────────────────
    // 별 배경 (고정)
    const STARS = Array.from({ length: 70 }, () => ({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H * 0.9,
        r: Math.random() * 1.4 + 0.4,
        a: Math.random() * 0.5 + 0.2,
    }));

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(renderScale, renderScale);

        // 배경
        const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        bg.addColorStop(0, '#07071a');
        bg.addColorStop(1, '#0e1c2f');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // 별
        STARS.forEach(s => {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${s.a})`;
            ctx.fill();
        });

        // 위험선
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = 'rgba(255,68,68,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, DANGER_Y);
        ctx.lineTo(CANVAS_W, DANGER_Y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 버블 렌더 (살아있는 것)
        bubbles.forEach(b => {
            if (!b.alive) return;
            drawBubble(b.x, b.y, b.color, b.word, 1.0, b.isSpecial);
        });

        // 낙하 중인 버블
        fallingBubbles.forEach(f => {
            drawBubble(f.x, f.y, f.color, f.word, f.alpha, f.isSpecial);
        });

        // 발사체
        if (proj) drawProjectile(proj.x, proj.y, proj.color);

        // 대포
        drawCannon();

        ctx.restore();
    }

    function drawBubble(x, y, color, word, alpha = 1.0, isSpecial = false) {
        ctx.save();
        ctx.globalAlpha = alpha;

        // 스페셜: 무지개는 글로우+테두리에만, 본체는 항상 은백색으로 고정
        const rainbowColor = `hsl(${(Date.now() / 8) % 360}, 100%, 65%)`;

        // 글로우
        ctx.shadowColor = isSpecial ? rainbowColor : color;
        ctx.shadowBlur = isSpecial ? (18 + Math.sin(Date.now() / 200) * 8) : 16;

        // 본체 (스페셜 = 은백색 그라데이션, 일반 = 해당 컴러)
        ctx.beginPath();
        ctx.arc(x, y, BUBBLE_R - 1, 0, Math.PI * 2);
        if (isSpecial) {
            const bodyGrad = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, BUBBLE_R);
            bodyGrad.addColorStop(0, '#ffffff');
            bodyGrad.addColorStop(0.5, '#d8eeff');
            bodyGrad.addColorStop(1, '#a8c8ff');
            ctx.fillStyle = bodyGrad;
        } else {
            ctx.fillStyle = color;
        }
        ctx.globalAlpha = 0.92 * alpha;
        ctx.fill();

        // 하이라이트
        const shine = ctx.createRadialGradient(x - 9, y - 9, 2, x, y, BUBBLE_R);
        shine.addColorStop(0, 'rgba(255,255,255,0.85)');
        shine.addColorStop(0.4, 'rgba(255,255,255,0.15)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 0.6 * alpha;
        ctx.fillStyle = shine;
        ctx.beginPath();
        ctx.arc(x, y, BUBBLE_R - 1, 0, Math.PI * 2);
        ctx.fill();

        // 테두리
        ctx.globalAlpha = isSpecial ? 0.95 * alpha : 0.4 * alpha;
        ctx.strokeStyle = isSpecial ? rainbowColor : 'rgba(255,255,255,0.5)';
        ctx.lineWidth = isSpecial ? 3 : 1;
        ctx.beginPath();
        ctx.arc(x, y, BUBBLE_R - 1, 0, Math.PI * 2);
        ctx.stroke();

        // 스페셜: 회전하는 외부 후광 효과
        if (isSpecial) {
            ctx.globalAlpha = 0.65 * alpha;
            ctx.strokeStyle = `hsl(${((Date.now() / 8) + 180) % 360}, 100%, 80%)`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.lineDashOffset = -(Date.now() / 25) % 9;
            ctx.beginPath();
            ctx.arc(x, y, BUBBLE_R + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();

        // 단어 텍스트
        ctx.save();
        ctx.globalAlpha = alpha;

        // 별 모양 추가 시 글자 잘림 현상 방지를 위해 전체 단어 유지
        const displayWord = isSpecial ? '★' + word : word;

        // 글자 수에 따라 폰트 크기를 유동적으로 조절
        let fs = 13;
        if (displayWord.length > 7) fs = 8.5;
        else if (displayWord.length > 5) fs = 10;
        else if (displayWord.length > 3) fs = 11.5;

        ctx.font = `bold ${fs}px 'Pretendard', 'Apple SD Gothic Neo', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isSpecial ? '#fff' : '#ffffff';
        ctx.shadowColor = isSpecial ? rainbowColor : 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = isSpecial ? 8 : 5;

        // 텍스트 전체 출력 (말줄임표 제거)
        ctx.fillText(displayWord, x, y);
        ctx.restore();
    }

    function drawProjectile(x, y, color) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 28;

        // 꼬리
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x - proj.vx * 2.5, y - proj.vy * 2.5, BUBBLE_R - 8, 0, Math.PI * 2);
        ctx.fill();

        // 본체
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.arc(x, y, BUBBLE_R - 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // 하이라이트
        const shine = ctx.createRadialGradient(x - 7, y - 7, 1, x, y, BUBBLE_R - 3);
        shine.addColorStop(0, 'rgba(255,255,255,0.9)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = shine;
        ctx.beginPath();
        ctx.arc(x, y, BUBBLE_R - 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ── 대포 렌더링 (회전 + 색상 + 반사 조준선) ────────────────
    function drawCannon() {
        const cx = CANVAS_W / 2, cy = CANVAS_H - 28;
        const barrelColor = aimTarget ? aimTarget.color : '#00d4ff';

        // 실제 발사 방향 각도 (aimPath가 있으면 반사 방향, 없으면 타겟 직선)
        let angle = -Math.PI / 2;
        if (aimPath) {
            angle = Math.atan2(aimPath.vy, aimPath.vx);
        } else if (aimTarget) {
            angle = Math.atan2(aimTarget.y - cy, aimTarget.x - cx);
        }

        // 조준선 렌더링
        if (aimTarget) {
            ctx.save();
            ctx.setLineDash([6, 8]);
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 8;

            if (aimPath && aimPath.bouncePoint) {
                // 반사 경로: 2단계 점선 (색상 구분)
                const bp = aimPath.bouncePoint;
                // 1구간: 포신 → 반사점 (밝은 색)
                ctx.strokeStyle = barrelColor;
                ctx.shadowColor = barrelColor;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(bp.x, bp.y);
                ctx.stroke();
                // 2구간: 반사점 → 타겟 (약간 어둡게)
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.moveTo(bp.x, bp.y);
                ctx.lineTo(aimTarget.x, aimTarget.y);
                ctx.stroke();
                // 반사점 표시 (원)
                ctx.globalAlpha = 0.7;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.arc(bp.x, bp.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = barrelColor;
                ctx.fill();
            } else if (aimPath) {
                // 직선 경로
                ctx.strokeStyle = barrelColor;
                ctx.shadowColor = barrelColor;
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(aimTarget.x, aimTarget.y);
                ctx.stroke();
            } else {
                // 경로 차단됨: 빨간 점선
                ctx.strokeStyle = '#FF4455';
                ctx.shadowColor = '#FF4455';
                ctx.globalAlpha = 0.45;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(aimTarget.x, aimTarget.y);
                ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.restore();
        }

        // 포신 (회전)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2);
        ctx.shadowColor = barrelColor;
        ctx.shadowBlur = 22;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = barrelColor;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-6, -34, 12, 26, 4);
        else ctx.rect(-6, -34, 12, 26);
        ctx.fill();
        ctx.restore();

        // 받침대
        ctx.save();
        ctx.shadowColor = barrelColor;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#1a2a3a';
        ctx.globalAlpha = 0.95;
        ctx.fill();
        ctx.strokeStyle = barrelColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    // ── 유틸 ──────────────────────────────────────────────────
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ── 렌더스케일 설정 (외부에서 호출) ──────────────────────────
    function setRenderScale(s) {
        renderScale = s;
        if (canvas) {
            canvas.width = Math.round(CANVAS_W * s);
            canvas.height = Math.round(CANVAS_H * s);
        }
    }

    function setSpecialProb(prob) {
        specialProb = prob;
    }

    return { init, shoot, aim, pause, resume, stop, getLiveWords, setRenderScale, setSpecialProb };
})();
