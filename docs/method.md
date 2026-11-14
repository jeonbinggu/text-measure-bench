# 측정 방법

## 1. 무엇을 재는가

| 측정 | 질문 | 원본 | 실행 |
| --- | --- | --- | --- |
| 리사이즈 비용 | 박스 N개의 너비가 매 프레임 바뀔 때 높이를 다시 재는 데 얼마나 걸리나 | `results/resize-<방식>-<N>-<회차>.json` | `측정 시작` 버튼 / `npm run bench -- all` |
| 측정 오차 | DOM을 읽지 않고 잰 높이가 DOM과 얼마나 다른가 | `results/accuracy.json` | `정확도 측정` 버튼 / `npm run bench -- accuracy` |

표는 `npm run tables`(`scripts/make-tables.ts`)가 원본에서 만든다. 요약 규칙은 `src/bench/stats.ts` 한 곳에 있고, 화면의 표와 문서의 표가 같이 쓴다.

## 2. 측정 함수

세 함수 모두 `(text, font, maxWidth, lineHeight) → { height, lineCount, lines? }` (`src/measure/types.ts`).
폰트가 준비되기 전에 부르면 에러를 던진다. `src/measure/fonts.ts`의 `loadFonts()`를 먼저 기다려야 한다. `document.fonts.ready`만으로는 아직 쓰이지 않은 폰트를 기다려 주지 않아서, 그 앞에 `document.fonts.load()`를 부른다.

### DOM (기준값): `src/measure/dom.ts`

화면 밖(`left: -99999px`, `visibility: hidden`)에 `div`를 만들어 텍스트를 넣고 `getBoundingClientRect().height`를 읽는다. 줄 수는 `height / lineHeight`.

CSS: `white-space: normal; overflow-wrap: break-word; word-break: normal | keep-all`.

- `overflow-wrap: break-word`는 CSS 기본값이 아니다. 이 값이 없으면 공백 없는 긴 문자열(`long-url`)이 줄바꿈되지 않고 박스 밖으로 넘친다. pretext도 이 설정을 전제로 한다고 문서에 밝히고 있어, 기준값을 이 설정으로 쟀다. **기본값(`overflow-wrap: normal`)에서의 차이는 재지 않았다.**
- 줄별 텍스트는 그래핌마다 `Range.getClientRects()`의 위치를 읽어, top이 반 줄 이상 내려가면 새 줄로 본다.

### Canvas: `src/measure/canvas.ts`

`CanvasRenderingContext2D.measureText`로 폭을 재고 줄바꿈은 직접 구현했다. 브라우저 규칙을 흉내 내려 하지 않았다. 차이가 나는 것이 기록할 결과다.

줄바꿈 규칙:

1. 연속 공백·개행은 공백 하나로 접는다.
2. 공백에서 끊을 수 있다. 줄 끝 공백은 폭에 넣지 않는다.
3. 한글·한자·가나는 글자(그래핌)마다 앞뒤에서 끊을 수 있다.
4. 그 밖의 문자(영문, 숫자, 문장부호, 이모지)가 이어진 덩어리는 끊지 않는다.
5. 덩어리 하나가 `maxWidth`보다 넓으면 그래핌 단위로 강제로 끊는다.
6. 금칙 처리가 없다. 닫는 괄호나 마침표가 줄 맨 앞에, 여는 괄호가 줄 맨 끝에 올 수 있다.
7. keep-all이 없다.

폭은 끊을 수 있는 자리마다 **후보 줄 전체**를 `measureText`로 잰 값이다(커닝 포함). **폭 캐시를 두지 않는다.** 그래서 한글처럼 글자마다 끊을 수 있는 글은 글자 수만큼 `measureText`를 부른다. 리사이즈 비용 표의 `canvas` 수치는 이 구현의 비용이다.

### pretext: `src/measure/pretext.ts`

`@chenglou/pretext` 1.0. `prepareWithSegments()`는 같은 (텍스트, 폰트 문자열, keep-all 여부)에 대해 한 번만 부르고 `Map`에 둔다. 너비나 줄 높이가 바뀌면 `layout()` / `layoutWithLines()`만 다시 부른다. 폰트 문자열에 글자 크기가 들어 있으므로 글자 크기가 바뀌면 새로 prepare된다.

같은 폰트 이름이 가리키는 글꼴이 바뀌는 경우(웹폰트 로드 완료)에는 `invalidatePretext()`로 캐시를 비워야 한다. 비우지 않으면 폴백 폰트로 잰 폭이 남는다(`before-font` 케이스).

## 3. 리사이즈 시나리오: `src/bench/resize.ts`

- 박스 N개(10 / 60 / 200)를 `display: flex; flex-wrap: wrap` 컨테이너에 놓는다. 박스마다 문단이 다르다(문장 12개를 박스 번호에 따라 4~6개씩 조합). 같은 문단을 돌려 쓰면 pretext 캐시만 이득을 본다.
- 폰트 `500 16px Pretendard`, 줄 높이 24px.
- 모든 박스의 너비를 320 → 640px로 30프레임에 걸쳐 바꾼다. `requestAnimationFrame` 한 번에 한 단계, 너비는 정수 px로 반올림.
- 프레임마다 모든 박스의 높이를 재서 박스의 `height`에 반영한다.

| 방식 | 프레임 안에서 하는 일 |
| --- | --- |
| `dom-batched` | 모든 박스의 너비를 쓴다 → 모든 높이를 읽는다 → 모든 높이를 쓴다 |
| `dom-interleaved` | 박스마다 너비 쓰기 → 높이 읽기 → 높이 쓰기 |
| `canvas` | 박스마다 Canvas 측정 함수로 높이 계산 → 너비·높이 쓰기 (DOM은 읽지 않는다) |
| `pretext` | 박스마다 캐시된 prepare 결과에 `layout()` → 너비·높이 쓰기 (DOM은 읽지 않는다) |

기록:

- `frames`: 프레임마다 `performance.now()`로 잰 "측정 시작 ~ 높이 반영 완료"(ms).
- `rafDeltas`: 직전 `requestAnimationFrame`과의 간격(ms).
- `prepareMs`: `pretext`만. 회차마다 캐시를 비우고 박스 N개를 prepare하는 시간. 프레임 시간에는 들어가지 않는다.
- 환경 정보(`env`).

반복과 제외:

- 조합(방식 × N)마다 5회. 회차마다 측정 컨테이너를 새로 만들고 끝나면 지운다. 페이지는 새로 고치지 않는다.
- 실행 순서는 회차가 바깥 루프다(1회차의 12조합 → 2회차의 12조합 → …). 한 조합의 5회가 연달아 붙지 않는다.
- 표: 회차별 중앙값 5개 중, 그 다섯 값의 중앙값에서 가장 먼 1회를 뺀다. 남은 4회의 프레임 120개를 합쳐 중앙값과 p95(nearest-rank)를 낸다. 뺀 회차는 표 아래에 자동으로 적힌다.

## 4. 오차 측정: `src/bench/cases.ts`, `src/bench/accuracy.ts`

케이스(문자열은 모두 직접 썼다): `ko-long` `en-long` `mixed` `emoji` `long-url` `punct` `fallback`, 그리고 `before-font`.

- 앞의 7종: 너비 200 / 320 / 480px × `word-break` normal / keep-all. 폰트 `500 16px Pretendard`, 줄 높이 24px. DOM·Canvas·pretext의 높이, 줄 수, 줄별 텍스트를 기록하고, DOM과의 높이 차·줄 수 차·줄 내용이 처음 달라진 줄 번호를 계산한다. 줄 내용 비교는 공백을 정리(연속 공백은 하나로, 앞뒤 공백 제거)한 뒤에 한다.
- `before-font`: 새 family 이름으로 `FontFace`를 등록만 하고(아직 로드 전) 세 방식으로 잰 뒤, `load()`가 끝나면 그대로 다시 재고, pretext 캐시를 비운 뒤 또 잰다.
- `fallback` 케이스가 정말 폴백 폰트로 그려지는지: 그래핌마다 뒤에 붙인 generic family(serif / sans-serif / monospace)만 바꿔 그려서 픽셀이 달라지면 Pretendard에 없는 글리프로 본다. 세 generic 어디에도 없어 같은 시스템 폰트로 넘어가는 글리프(일부 기호, 이모지)는 이 방법으로 못 잡는다.
- 줄 내용이 달랐던 행은 `node scripts/capture.mjs`가 기록된 줄 배열을 그대로 그려 `docs/img/diff-*.png`로 저장한다.

## 5. 렌더러: `src/render/`

입력은 pretext `layoutWithLines()`의 줄 배열 하나다.

- **HTML** `lines`: 줄마다 `div`(`white-space: pre`, 높이 = 줄 높이). `native`: 원문 전체를 넣고 브라우저가 줄바꿈.
- **SVG**: 줄마다 `<text>`. `y = 줄 번호 × lineHeight + 베이스라인 보정`.
- **Canvas**: `fillText`. 비트맵 크기에 `devicePixelRatio`를 곱하고 `scale`한다.

베이스라인 보정(`baselineOffset`): CSS는 `line-height − (ascent + descent)`를 위아래로 반씩 나눠 붙인다. 같은 계산을 Canvas `measureText`의 `fontBoundingBoxAscent` / `fontBoundingBoxDescent`로 해서 `(lineHeight − (asc + desc)) / 2 + asc`를 SVG와 Canvas에 똑같이 쓴다.
`dominant-baseline`을 쓰지 않은 이유는, 그 속성은 어느 기준선에 맞출지만 고르고 줄 상자 안에서의 세로 위치(half-leading)는 맞춰 주지 않기 때문이다. 이 값은 Pretendard의 메트릭으로 계산하므로, 폴백 폰트로 그려지는 글리프에는 맞지 않을 수 있다(findings 4-5).

## 6. 환경

코드가 기록하는 값(각 JSON의 `env`): userAgent, 브라우저 브랜드·버전, OS, `devicePixelRatio`, 논리 코어 수, 화면 크기, `crossOriginIsolated`, 폰트 파일 이름, 시각.

레포에 들어 있는 `results/`를 잰 환경:

| 항목 | 값 |
| --- | --- |
| 기기 | 노트북, Intel Core i7-1165G7, 내장 그래픽(Iris Xe) |
| OS | Windows 11 Home |
| 브라우저 | Playwright가 내려받은 Chromium 159, 창을 띄운 상태(headed), 뷰포트 1500 × 900 |
| 화면 | 주사율 59Hz, `devicePixelRatio` 1 |
| 폰트 | `public/fonts/PretendardVariable.woff2` (로컬) |
| 시계 해상도 | dev 서버가 COOP / COEP 헤더를 보내 cross-origin isolated 상태 → `performance.now()` 5µs |
| 전원 | **배터리 구동** (측정 전 확인 시 방전 중, 60%) |
| 다른 프로그램 | **Android Studio와 그 Java 프로세스가 떠 있었다** (여유 메모리 약 2.2GB) |
| 확장 프로그램 | Playwright Chromium의 새 프로필이라 없음 |

전원과 다른 프로그램은 통제하지 못했다. findings 4-2의 회차 간 변동과 관련이 있을 수 있다.

## 7. 알려진 한계

- 프레임 시간은 스크립트 구간만 잰다. 그 뒤 브라우저가 하는 스타일 계산·레이아웃·페인트는 들어 있지 않다. `canvas`와 `pretext`는 DOM을 읽지 않으므로 레이아웃이 이 구간 밖에서 일어난다. `dom-batched`의 마지막 높이 쓰기 뒤의 레이아웃도 구간 밖이다. `rafDeltas`가 전체 프레임 길이를 보여 주지만 주사율(약 16.7ms)보다 짧아질 수 없다.
- 회차 간 변동이 크다(findings 4-2). 전원 연결, 다른 프로그램 종료 상태에서 다시 재야 한다.
- `canvas`는 폭 캐시가 없는 구현 하나의 수치다. Canvas 측정 일반의 성능이 아니다.
- 브라우저 하나(Chromium), OS 하나(Windows), 폰트 하나, 글자 크기 하나(16px)에서만 쟀다.
- 기준값 DOM을 `overflow-wrap: break-word`로 쟀다(2절).
- 회차 사이에 페이지를 새로 고치지 않는다. 컨테이너만 새로 만든다.
- 회귀 테스트의 스냅샷(`tests/__snapshots__`)은 이 환경의 폴백 폰트·이모지 폰트에서의 값이다. 다른 OS에서는 Canvas의 "알려진 차이"가 달라질 수 있다.
- 자동 실행은 Playwright의 Chromium을 쓴다. 평소 쓰는 Chrome과 버전·설정이 다를 수 있다(`--channel=chrome`으로 바꿀 수 있다).
