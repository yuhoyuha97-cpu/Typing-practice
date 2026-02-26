// 연습 콘텐츠 관리 모듈
const Content = (() => {

    // Firestore에서 콘텐츠 불러오기
    async function load(docId) {
        const snap = await db.collection('content').doc(docId).get();
        if (!snap.exists) return [];
        return snap.data().items || [];
    }

    // 콘텐츠 저장 (관리자 전용)
    async function save(docId, items) {
        await db.collection('content').doc(docId).set({
            items,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // 랜덤 항목 n개 반환
    function getRandom(items, n = 1) {
        const shuffled = [...items].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
    }

    // 기본 콘텐츠 초기화 (최초 배포 시 Firestore에 없으면 사용)
    const defaults = {
        words_ko: {
            items: [
                // 동물
                '사과', '바나나', '딸기', '포도', '수박', '복숭아', '오렌지', '레몬', '망고', '키위',
                '토마토', '감자', '고구마', '양파', '마늘', '당근', '오이', '호박', '배추', '시금치',
                '강아지', '고양이', '토끼', '사자', '호랑이', '코끼리', '기린', '원숭이', '펭귄', '독수리',
                '곰', '늑대', '여우', '사슴', '말', '소', '돼지', '닭', '오리', '거위',
                '고래', '상어', '돌고래', '문어', '오징어', '게', '새우', '조개', '물고기', '개구리',
                '나비', '잠자리', '벌', '개미', '거미', '달팽이', '지렁이', '무당벌레', '메뚜기', '매미',
                // 음식
                '밥', '국', '김치', '불고기', '비빔밥', '냉면', '삼겹살', '된장찌개', '갈비', '순두부',
                '라면', '떡볶이', '순대', '튀김', '김밥', '부침개', '잡채', '제육볶음', '삼계탕', '설렁탕',
                '빵', '케이크', '과자', '아이스크림', '초콜릿', '사탕', '젤리', '도넛', '크래커', '쿠키',
                '커피', '녹차', '홍차', '우유', '주스', '콜라', '사이다', '맥주', '물', '식혜',
                // 학교
                '학교', '교실', '선생님', '학생', '공부', '숙제', '시험', '점수', '성적', '졸업',
                '교과서', '공책', '연필', '지우개', '자', '가위', '풀', '테이프', '칠판', '분필',
                '도서관', '수업', '방과후', '급식', '체육', '음악', '미술', '과학', '수학', '국어',
                '영어', '사회', '역사', '지리', '도덕', '기술', '가정', '보건', '진로', '동아리',
                // 컴퓨터/IT
                '컴퓨터', '키보드', '마우스', '모니터', '프린터', '스캐너', '노트북', '스마트폰', '태블릿', '인터넷',
                '소프트웨어', '하드웨어', '프로그램', '데이터', '파일', '폴더', '바탕화면', '저장', '복사', '붙여넣기',
                '삭제', '실행', '검색', '다운로드', '업로드', '메일', '채팅', '영상통화', '게임', '앱',
                '유튜브', '블로그', '카카오', '네이버', '구글', '인스타', '틱톡', '페이스북', '트위터', '줌',
                // 자연/날씨
                '봄', '여름', '가을', '겨울', '눈', '비', '바람', '구름', '하늘', '태양',
                '달', '별', '무지개', '번개', '천둥', '태풍', '안개', '서리', '이슬', '빙하',
                '산', '강', '바다', '호수', '숲', '들판', '사막', '섬', '동굴', '폭포',
                '나무', '꽃', '풀', '잎', '씨앗', '뿌리', '가지', '열매', '솔방울', '대나무',
                // 교통
                '기차', '버스', '택시', '비행기', '자동차', '자전거', '오토바이', '배', '지하철', '트럭',
                '헬리콥터', '로켓', '우주선', '전철', '고속버스', '케이블카', '기선', '요트', '잠수함', '킥보드',
                // 집/생활
                '거실', '침실', '부엌', '화장실', '욕실', '현관', '베란다', '창문', '문', '계단',
                '냉장고', '세탁기', '청소기', '에어컨', '선풍기', '텔레비전', '전자레인지', '오븐', '밥솥', '정수기',
                '소파', '침대', '책상', '의자', '옷장', '서랍', '선반', '거울', '시계', '램프',
                '가족', '아버지', '어머니', '형', '누나', '오빠', '언니', '동생', '할머니', '할아버지',
                // 신체/건강
                '머리', '얼굴', '눈', '코', '귀', '입', '이', '혀', '목', '어깨',
                '팔', '손', '손가락', '배', '허리', '다리', '발', '발가락', '가슴', '등',
                '병원', '의사', '간호사', '약', '주사', '혈액', '심장', '폐', '위', '간',
                // 스포츠/취미
                '축구', '야구', '농구', '배구', '수영', '달리기', '등산', '낚시', '태권도', '유도',
                '피아노', '기타', '바이올린', '드럼', '플루트', '노래', '춤', '그림', '독서', '영화',
                '게임', '보드게임', '퍼즐', '레고', '캠핑', '요리', '사진', '여행', '쇼핑', '산책',
                // 직업
                '의사', '간호사', '교사', '경찰', '소방관', '군인', '요리사', '미용사', '운전사', '농부',
                '과학자', '예술가', '음악가', '배우', '운동선수', '기자', '변호사', '판사', '건축가', '프로그래머',
                // 감정/형용사적 명사
                '행복', '슬픔', '기쁨', '화남', '두려움', '놀람', '사랑', '우정', '친절', '용기',
                '자유', '평화', '희망', '꿈', '목표', '노력', '성공', '실패', '도전', '성장',
                // 장소
                '도서관', '병원', '은행', '마트', '백화점', '공원', '놀이터', '영화관', '식당', '카페',
                '박물관', '미술관', '수족관', '동물원', '놀이공원', '체육관', '수영장', '경기장', '공항', '항구'
            ]
        },
        sentences_ko: {
            items: [
                '가는 말이 고와야 오는 말이 곱다.',
                '세 살 버릇 여든까지 간다.',
                '티끌 모아 태산이다.',
                '하늘이 무너져도 솟아날 구멍이 있다.',
                '백지장도 맞들면 낫다.',
                '원숭이도 나무에서 떨어진다.',
                '시작이 반이다.',
                '발 없는 말이 천 리 간다.',
                '콩 심은 데 콩 나고 팥 심은 데 팥 난다.',
                '낮말은 새가 듣고 밤말은 쥐가 듣는다.',
                '고생 끝에 낙이 온다.',
                '빛 좋은 개살구.',
                '호랑이도 제 말 하면 온다.',
                '우물 안 개구리.',
                '돌다리도 두드려 보고 건너라.',
                '금강산도 식후경이다.',
                '가랑비에 옷 젖는 줄 모른다.',
                '아는 것이 힘이다.',
                '연습이 완벽을 만든다.',
                '매일 조금씩 꾸준히 하면 반드시 실력이 늘게 됩니다.'
            ]
        },
        paragraphs_ko: {
            items: [
                '컴퓨터는 현대 사회에서 없어서는 안 될 중요한 도구입니다. 우리는 컴퓨터를 통해 정보를 검색하고, 문서를 작성하며, 다양한 작업을 효율적으로 처리할 수 있습니다. 특히 키보드 입력 속도가 빠를수록 업무 효율이 높아지기 때문에, 타자 연습은 매우 중요한 기초 능력입니다.',
                '봄이 되면 나무에 꽃이 피고 새들이 노래를 합니다. 따뜻한 햇살 아래 공원을 걷다 보면 마음이 상쾌해집니다. 겨울 동안 움츠렸던 몸과 마음을 활짝 펼칠 수 있는 계절, 바로 봄입니다. 이런 봄날에 열심히 공부하는 여러분들이 자랑스럽습니다.',
                '독서는 지식을 쌓는 가장 좋은 방법 중 하나입니다. 책을 통해 우리는 다양한 세계를 경험하고, 새로운 생각을 배울 수 있습니다. 하루에 단 30분이라도 책을 읽는 습관을 기른다면, 시간이 지날수록 그 효과는 놀랍도록 커질 것입니다.',
                '운동은 몸과 마음을 건강하게 유지하는 데 도움이 됩니다. 매일 규칙적으로 운동을 하면 체력이 향상되고 스트레스도 해소됩니다. 걷기, 달리기, 수영 등 자신에게 맞는 운동을 찾아 꾸준히 실천해 보세요. 건강한 몸에 건강한 정신이 깃든다는 말처럼, 운동은 우리 삶을 더욱 풍요롭게 만들어 줍니다.',
                '우리나라는 사계절이 뚜렷한 나라입니다. 봄에는 꽃이 피고, 여름에는 푸른 나무가 무성하며, 가을에는 단풍이 아름답게 물들고, 겨울에는 하얀 눈이 내립니다. 이러한 계절의 변화는 우리에게 다양한 자연의 모습을 보여주고 풍부한 감성을 키워줍니다.'
            ]
        },
        words_en: {
            items: [
                // Animals
                'dog', 'cat', 'rabbit', 'lion', 'tiger', 'elephant', 'giraffe', 'monkey', 'penguin', 'eagle',
                'bear', 'wolf', 'fox', 'deer', 'horse', 'cow', 'pig', 'chicken', 'duck', 'goose',
                'whale', 'shark', 'dolphin', 'octopus', 'squid', 'crab', 'shrimp', 'clam', 'fish', 'frog',
                'butterfly', 'dragonfly', 'bee', 'ant', 'spider', 'snail', 'worm', 'ladybug', 'grasshopper', 'cicada',
                'parrot', 'owl', 'flamingo', 'peacock', 'crow', 'sparrow', 'pigeon', 'hawk', 'swan', 'heron',
                // Food
                'apple', 'banana', 'strawberry', 'grape', 'watermelon', 'peach', 'orange', 'lemon', 'mango', 'kiwi',
                'tomato', 'potato', 'onion', 'garlic', 'carrot', 'cucumber', 'pumpkin', 'cabbage', 'spinach', 'broccoli',
                'rice', 'bread', 'pizza', 'burger', 'noodle', 'salad', 'steak', 'sushi', 'taco', 'pasta',
                'cake', 'cookie', 'donut', 'candy', 'chocolate', 'ice cream', 'pudding', 'waffle', 'pancake', 'muffin',
                'coffee', 'tea', 'milk', 'juice', 'cola', 'water', 'soup', 'sandwich', 'omelet', 'bacon',
                // School
                'school', 'classroom', 'teacher', 'student', 'study', 'homework', 'exam', 'score', 'library', 'desk',
                'pencil', 'eraser', 'ruler', 'scissors', 'glue', 'notebook', 'textbook', 'board', 'chalk', 'marker',
                'math', 'science', 'history', 'english', 'music', 'art', 'sports', 'biology', 'chemistry', 'physics',
                'grade', 'lesson', 'project', 'report', 'quiz', 'test', 'answer', 'question', 'lecture', 'club',
                // Technology
                'computer', 'keyboard', 'mouse', 'monitor', 'printer', 'scanner', 'laptop', 'smartphone', 'tablet', 'internet',
                'software', 'hardware', 'program', 'data', 'file', 'folder', 'desktop', 'save', 'copy', 'paste',
                'delete', 'search', 'download', 'upload', 'email', 'chat', 'video', 'game', 'app', 'website',
                'robot', 'drone', 'satellite', 'server', 'network', 'password', 'username', 'browser', 'database', 'code',
                // Nature
                'spring', 'summer', 'autumn', 'winter', 'snow', 'rain', 'wind', 'cloud', 'sky', 'sun',
                'moon', 'star', 'rainbow', 'thunder', 'storm', 'fog', 'river', 'ocean', 'mountain', 'forest',
                'lake', 'desert', 'island', 'cave', 'waterfall', 'volcano', 'glacier', 'valley', 'cliff', 'meadow',
                'tree', 'flower', 'grass', 'leaf', 'seed', 'root', 'branch', 'fruit', 'vine', 'bamboo',
                // Transport
                'train', 'bus', 'taxi', 'airplane', 'car', 'bicycle', 'motorcycle', 'ship', 'subway', 'truck',
                'helicopter', 'rocket', 'spaceship', 'boat', 'ferry', 'ambulance', 'scooter', 'van', 'tram', 'cable car',
                // Sports & Hobbies
                'soccer', 'baseball', 'basketball', 'volleyball', 'swimming', 'running', 'hiking', 'fishing', 'tennis', 'golf',
                'piano', 'guitar', 'violin', 'drum', 'singing', 'dancing', 'painting', 'reading', 'cooking', 'travel',
                // Jobs
                'doctor', 'nurse', 'teacher', 'police', 'firefighter', 'soldier', 'chef', 'farmer', 'pilot', 'engineer',
                'scientist', 'artist', 'musician', 'actor', 'athlete', 'lawyer', 'judge', 'architect', 'programmer', 'designer',
                // Emotions & Values
                'happy', 'sad', 'angry', 'scared', 'surprised', 'love', 'friendship', 'kindness', 'courage', 'freedom',
                'hope', 'dream', 'goal', 'effort', 'success', 'failure', 'challenge', 'growth', 'peace', 'trust'
            ]
        },
        sentences_en: {
            items: [
                'Practice makes perfect.',
                'The early bird catches the worm.',
                'Actions speak louder than words.',
                'Every cloud has a silver lining.',
                'Where there is a will, there is a way.',
                'Knowledge is power.',
                'Time is money.',
                'Look before you leap.',
                'Better late than never.',
                'Two heads are better than one.',
                'A journey of a thousand miles begins with a single step.',
                'Don\'t judge a book by its cover.',
                'Slow and steady wins the race.',
                'Honesty is the best policy.',
                'The pen is mightier than the sword.',
                'All that glitters is not gold.',
                'You reap what you sow.',
                'Rome was not built in a day.',
                'No pain, no gain.',
                'Keep up the great work and you will surely improve.'
            ]
        },
        paragraphs_en: {
            items: [
                'Computers have become an essential part of our daily lives. We use them to search for information, write documents, and complete various tasks efficiently. The ability to type quickly and accurately is a fundamental skill in the digital age. Regular typing practice can significantly improve your speed and accuracy over time.',
                'Reading is one of the best ways to expand your knowledge and vocabulary. Through books, we can explore different worlds and learn new ideas. Even spending just thirty minutes a day reading can have a remarkable impact on your intellectual growth. Start with topics you enjoy and gradually challenge yourself with more complex material.',
                'Exercise is crucial for maintaining both physical and mental health. Regular physical activity improves your fitness level and helps reduce stress. Whether it is walking, running, swimming, or playing sports, find an activity that you enjoy and stick with it. A healthy body leads to a healthy mind, making your life more fulfilling.',
                'Nature offers us a beautiful display of changing seasons. In spring, flowers bloom and birds sing. Summer brings warm sunshine and green trees. Autumn paints the leaves in brilliant shades of red and gold. Winter covers the world in a blanket of white snow. Each season has its own unique beauty and teaches us to appreciate the cycle of life.',
                'Technology is advancing at an incredible pace. New inventions and discoveries are changing the way we live, work, and communicate. It is important to stay curious and keep learning in this rapidly changing world. Embrace new technologies while also remembering the timeless values of creativity, collaboration, and critical thinking.'
            ]
        },

        // ── 자리연습: 한글 5단계 커리큘럼 ──
        keyboard_ko: {
            items: [
                // ── 1단계: 기본 자리 (가운데 줄 ㅁㄴㅇㄹ / ㅓㅏㅣ) ──
                '나라', '머리', '마나', '아라', '느리', '어머니', '아니', '나머지', '미나리', '이리',
                '나라니', '너머', '미리', '마디', '어라', '아리랑', '나들이', '마무리', '어마니', '이나라',
                '다리', '너나', '아마', '이미', '라라', '나나', '너니', '모니', '마리',

                // ── 2단계: 윗줄 확장 (ㅂㅈㄷㄱㅅ / ㅕㅑㅐㅔ) ──
                '고기', '사과', '바지', '대체', '세계', '여자', '기차', '제사', '가게', '시대',
                '어깨', '시계', '지도', '거기', '자기', '가지', '비누', '도로', '도시', '가수',
                '아기', '사자', '구두', '배구', '야구', '기수', '거미', '제비', '부자', '버섯',
                '가위', '수저', '과자', '개미', '베개', '지갑', '도시락', '계란', '그네', '기러기',

                // ── 3단계: 아랫줄 확장 (ㅋㅌㅊㅍㅎ / ㅠㅜㅡ) ──
                '포도', '하루', '우유', '퓨마', '크림', '치마', '투표', '하마', '커피',
                '호수', '쿠키', '파도', '토마토', '푸름', '트럭', '코트', '휴지', '호두',
                '튜브', '하늘', '카드', '타자기', '후추', '포크', '파리', '피아노', '화가', '호랑이',
                '크레파스', '태풍', '치즈', '코드', '카레', '파티', '초코', '토스트', '푸딩',

                // ── 4단계: Shift 키 조합 (쌍자음 ㅃㅉㄸㄲㅆ / 복모음 ㅒㅖ) ──
                '꼬리', '아빠', '토끼', '쓰레기', '얘기', '짜장', '떡볶이', '싸움', '까치',
                '뿌리', '따님', '씨앗', '꼬마', '오빠', '찌개', '아저씨', '코끼리', '까마귀', '쌍둥이',
                '빨대', '똬리', '쓰기', '빼기', '따오기', '뻐꾸기', '씩씩', '깨알', '삐삐', '때때로',
                '얘들아', '계약', '폐허', '혜성', '계곡', '폐기', '예절', '사례', '시계추', '실례',

                // ── 5단계: 실전 받침 단어 종합 (모든 자모음 + 받침) ──
                '대한민국', '컴퓨터', '인터넷', '키보드', '마우스', '프로그램', '데이터', '네트워크', '알고리즘', '인공지능',
                '함수', '변수', '객체', '클래스', '메소드', '상속', '인스턴스', '라이브러리', '프레임워크', '서버',
                '클라이언트', '데이터베이스', '쿼리', '배열', '리스트', '스택', '그래프', '트리', '정렬',
                '검색', '컴파일', '빌드', '배포', '디버깅', '오류', '예외처리', '성능', '최적화', '사용자',
                '환경설정', '동기화', '비동기', '업데이트', '패치', '인터페이스', '추상화', '캡슐화', '다형성', '문서화'
            ]
        },

        // ── 자리연습: 영문 키보드 위치 드릴 ──
        keyboard_en: {
            items: [
                // 홈 행 (asdf hjkl)
                'aaa sss ddd fff ggg hhh jjj kkk lll',
                'asdf jkl; asdf jkl; asdf jkl; asdf jkl;',
                'fjfj dkdk slsl a;a; fjdk sla; fjdksla;',
                'add all fall glad hall hall lads flag sad',
                // 윗 행 (qwer uiop)
                'qqq www eee rrr ttt yyy uuu iii ooo ppp',
                'qwer tyui op qwer tyui op qwer tyuiop',
                'quit with your power tower quiet write true',
                'type rope wire poor trip rope quit peer tier',
                // 아랫 행 (zxcv bnm)
                'zzz xxx ccc vvv bbb nnn mmm',
                'zxcv bnm zxcv bnm zxcv bnm zxcv bnm',
                'zinc exam cave bank name move zinc exam cave',
                // 전체 알파벳 드릴
                'the quick brown fox jumps over the lazy dog',
                'pack my box with five dozen liquor jugs',
                // 숫자 행
                '1111 2222 3333 4444 5555 6666 7777 8888 9999 0000',
                '12 34 56 78 90 123 456 789 1234 5678 9012',
                // 대소문자 혼합
                'Hello World Java Script Python React Node SQL',
            ]
        }
    };

    // Firestore에 없으면 기본값 반환
    async function getContent(type) {
        try {
            const items = await load(type);
            if (items.length > 0) return items;
            return defaults[type]?.items || [];
        } catch {
            return defaults[type]?.items || [];
        }
    }

    // ── Datamuse API로 영어 단어 수집 및 Firestore 저장 ──────────────
    // 관리자 전용. 주제별로 단어를 가져와 기존 목록에 합산.
    const DATAMUSE_TOPICS = [
        'animals', 'food', 'school', 'sports', 'technology',
        'nature', 'music', 'travel', 'health', 'science'
    ];

    async function fetchAndSaveEnglishWords() {
        const wordSet = new Set(defaults.words_en.items); // 기본 단어 포함
        const MAX_PER_TOPIC = 80;

        for (const topic of DATAMUSE_TOPICS) {
            try {
                const res = await fetch(
                    `https://api.datamuse.com/words?topics=${topic}&max=${MAX_PER_TOPIC}&md=f`
                );
                const data = await res.json();
                data.forEach(({ word, tags }) => {
                    // 명사/형용사/단일 단어만 포함, 공백 없는 단어, 3글자 이상
                    const isNoun = !tags || tags.includes('n') || tags.includes('adj');
                    if (isNoun && !word.includes(' ') && word.length >= 3 && word.length <= 12) {
                        wordSet.add(word);
                    }
                });
            } catch (e) {
                console.warn(`Datamuse fetch failed for topic: ${topic}`, e);
            }
        }

        const wordList = [...wordSet].sort();
        await save('words_en', wordList);
        return wordList.length;
    }

    // 초기 콘텐츠 Firestore에 업로드
    // keyboard_ko / keyboard_en / words_ko / words_en 은 항상 최신으로 덮어씀
    const FORCE_OVERWRITE_KEYS = ['keyboard_ko', 'keyboard_en', 'words_ko', 'words_en'];

    async function initializeDefaults() {
        for (const [key, val] of Object.entries(defaults)) {
            try {
                if (FORCE_OVERWRITE_KEYS.includes(key)) {
                    await save(key, val.items);
                } else {
                    const snap = await db.collection('content').doc(key).get();
                    if (!snap.exists) {
                        await save(key, val.items);
                    }
                }
            } catch (e) {
                // 권한 부족 등 에러 무시 (일반 유저)
            }
        }
    }

    return { load, save, getRandom, getContent, initializeDefaults, defaults, fetchAndSaveEnglishWords };
})();
