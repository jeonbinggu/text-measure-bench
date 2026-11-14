# text-measure-bench

여러 줄 텍스트의 높이를 재는 세 가지 방법(DOM, Canvas `measureText`, [pretext](https://github.com/chenglou/pretext))을 같은 조건에서 반복 측정해 비용과 오차를 비교한다.
pretext가 정한 줄 배열 하나를 HTML · SVG · Canvas 세 렌더러에 그려 서로 얼마나 어긋나는지도 본다.
모든 수치는 `results/`의 원본 JSON에서 스크립트로 만들며, 같은 명령으로 다시 재현할 수 있다.

데모: (배포 후 링크를 넣을 자리)

## 실행

```sh
npm install
npx playwright install chromium   # 테스트·자동 측정용 (처음 한 번)

npm run dev      # 비교 화면 + 측정 버튼
npm test         # 브라우저(Chromium)에서 도는 회귀 테스트
npm run tables   # results/*.json → 아래 표와 docs/findings.md의 표를 다시 생성
npm run build    # dist/ 에 정적 배포용 결과물
```

Node 22 이상이 필요하다 (`npm run tables`가 `--experimental-strip-types`를 쓴다).

## 측정하는 법

**화면에서:** `npm run dev`로 띄운 페이지의 "측정" 영역에서

- `이 조합만 측정` — 고른 방식 × N 조합을 5회 실행
- `측정 시작`(머리 오른쪽) — 4방식 × N 3가지 × 5회 = 60회
- `정확도 측정` — 오차 케이스 8종

dev 서버에서는 결과가 `results/`에 바로 저장되고, 정적 배포본에서는 JSON 파일로 내려받아진다(내려받은 파일을 `results/`에 넣으면 된다).

**자동으로:**

```sh
npm run bench               # 정확도 + 전체 실행. Chromium 창이 뜨고 끝나면 닫힌다
npm run bench -- accuracy   # 정확도만
npm run bench -- all        # 리사이즈 전체만
npm run bench -- --channel=chrome   # 설치된 Chrome으로
node scripts/capture.mjs    # docs/img/ 화면 캡처
```

측정 중에는 창을 가리거나 최소화하지 않는다. 기존 `results/` 파일은 덮어쓴다.

## 측정 방법 요약

- **리사이즈 비용:** 텍스트 박스 N개(10 / 60 / 200)의 너비를 320 → 640px로 30프레임에 걸쳐 바꾸면서, 프레임마다 모든 박스의 높이를 다시 재서 반영한다. 프레임마다 "측정 시작 ~ 높이 반영 완료" 구간을 `performance.now()`로 잰다.
  - `dom-batched`: 너비를 모두 쓴 뒤 높이를 모두 읽는다
  - `dom-interleaved`: 박스마다 쓰기 → 읽기를 반복한다
  - `canvas`: `measureText` + 직접 구현한 줄바꿈
  - `pretext`: 미리 `prepare`해 둔 결과에 `layout()`만 호출
- **오차:** 문자열 케이스 8종을 너비 200 / 320 / 480px에서 재고, DOM 값을 기준으로 높이·줄 수·처음 달라진 줄을 기록한다.
- 조합마다 5회 실행하고, 회차 중앙값이 가장 튀는 1회를 뺀 뒤 중앙값과 p95를 낸다.

자세한 내용과 한계는 [docs/method.md](docs/method.md), 결과 해석 초안은 [docs/findings.md](docs/findings.md), 작업 기록은 [docs/log.md](docs/log.md).

## 결과

아래 표는 이 레포에 들어 있는 `results/`로 만든 것이다. 측정 조건(특히 전원)에 대한 주의는 [docs/method.md](docs/method.md)의 "환경"을 볼 것.

<!-- tables:start -->
<!-- npm run tables가 만든 내용이다. 손으로 고치지 말 것 -->

### 리사이즈 비용

프레임 하나에서 "측정 시작 ~ 높이 반영 완료"까지 걸린 시간(ms). 박스 N개, 너비 320 → 640px, 30프레임.

| 방식 | N | 중앙값 (ms) | p95 (ms) | rAF 간격 중앙값 (ms) | prepare 1회 (ms) | 프레임 수 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `dom-batched` | 10 | 0.695 | 1.160 | 16.665 | — | 120 |
| `dom-interleaved` | 10 | 1.587 | 2.520 | 16.665 | — | 120 |
| `canvas` | 10 | 7.223 | 10.650 | 16.668 | — | 120 |
| `pretext` | 10 | 0.063 | 0.120 | 16.668 | 2.693 | 120 |
| `dom-batched` | 60 | 1.928 | 3.635 | 16.672 | — | 120 |
| `dom-interleaved` | 60 | 13.015 | 23.400 | 16.697 | — | 120 |
| `canvas` | 60 | 65.600 | 119.425 | 83.245 | — | 120 |
| `pretext` | 60 | 0.160 | 0.330 | 16.665 | 5.065 | 120 |
| `dom-batched` | 200 | 5.477 | 17.165 | 16.685 | — | 120 |
| `dom-interleaved` | 200 | 71.758 | 128.610 | 83.350 | — | 120 |
| `canvas` | 200 | 155.390 | 245.385 | 183.335 | — | 120 |
| `pretext` | 200 | 0.455 | 0.750 | 16.670 | 13.605 | 120 |

조합마다 5회 중 회차 중앙값이 가장 튀는 1회를 뺐다. 뺀 회차: `dom-batched` N=10: 4회차(중앙값 0.585ms), `dom-interleaved` N=10: 4회차(중앙값 1.075ms), `canvas` N=10: 1회차(중앙값 11.153ms), `pretext` N=10: 3회차(중앙값 0.080ms), `dom-batched` N=60: 2회차(중앙값 2.875ms), `dom-interleaved` N=60: 3회차(중앙값 5.862ms), `canvas` N=60: 3회차(중앙값 21.918ms), `pretext` N=60: 2회차(중앙값 0.325ms), `dom-batched` N=200: 2회차(중앙값 11.348ms), `dom-interleaved` N=200: 2회차(중앙값 121.473ms), `canvas` N=200: 2회차(중앙값 238.608ms), `pretext` N=200: 2회차(중앙값 0.665ms).

- 중앙값·p95는 남은 4회의 프레임을 모두 합쳐(120프레임) 계산했다.
- 이 시간에는 스크립트가 끝난 뒤 브라우저가 하는 레이아웃·페인트가 들어 있지 않다. rAF 간격은 그것까지 포함하지만 화면 주사율보다 짧아질 수 없으므로 참고용이다.
- prepare 1회는 `pretext`가 박스 N개를 처음 준비하는 시간으로, 프레임 시간과 별도다(4회의 중앙값).

### 측정 오차

기준값은 DOM(`getBoundingClientRect`)이다. 폰트 `500 16px Pretendard`, 줄 높이 24px.
각 칸은 `높이 차 / 줄 수 차 / 줄 내용이 처음 달라진 줄 번호`.

| 케이스 | 너비 | word-break | DOM (기준) | Canvas − DOM | pretext − DOM |
| --- | ---: | --- | --- | --- | --- |
| `ko-long` | 200 | normal | 216px / 9줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `ko-long` | 200 | keep-all | 240px / 10줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `ko-long` | 320 | normal | 144px / 6줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `ko-long` | 320 | keep-all | 144px / 6줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `ko-long` | 480 | normal | 96px / 4줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `ko-long` | 480 | keep-all | 144px / 6줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `en-long` | 200 | normal | 288px / 12줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `en-long` | 200 | keep-all | 288px / 12줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `en-long` | 320 | normal | 192px / 8줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `en-long` | 320 | keep-all | 192px / 8줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `en-long` | 480 | normal | 120px / 5줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `en-long` | 480 | keep-all | 120px / 5줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `mixed` | 200 | normal | 144px / 6줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `mixed` | 200 | keep-all | 144px / 6줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `mixed` | 320 | normal | 96px / 4줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `mixed` | 320 | keep-all | 96px / 4줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `mixed` | 480 | normal | 72px / 3줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `mixed` | 480 | keep-all | 72px / 3줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `emoji` | 200 | normal | 144px / 6줄 | +24px / +1줄 / 4 | 0px / 0줄 / 같음 |
| `emoji` | 200 | keep-all | 144px / 6줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `emoji` | 320 | normal | 96px / 4줄 | 0px / 0줄 / 2 | 0px / 0줄 / 같음 |
| `emoji` | 320 | keep-all | 96px / 4줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `emoji` | 480 | normal | 72px / 3줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `emoji` | 480 | keep-all | 72px / 3줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `long-url` | 200 | normal | 192px / 8줄 | 0px / 0줄 / 2 | 0px / 0줄 / 같음 |
| `long-url` | 200 | keep-all | 192px / 8줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `long-url` | 320 | normal | 144px / 6줄 | -24px / -1줄 / 1 | 0px / 0줄 / 같음 |
| `long-url` | 320 | keep-all | 144px / 6줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `long-url` | 480 | normal | 96px / 4줄 | -24px / -1줄 / 1 | 0px / 0줄 / 같음 |
| `long-url` | 480 | keep-all | 96px / 4줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `punct` | 200 | normal | 168px / 7줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `punct` | 200 | keep-all | 168px / 7줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `punct` | 320 | normal | 96px / 4줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `punct` | 320 | keep-all | 96px / 4줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `punct` | 480 | normal | 72px / 3줄 | 0px / 0줄 / 1 | 0px / 0줄 / 같음 |
| `punct` | 480 | keep-all | 72px / 3줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `fallback` | 200 | normal | 120px / 5줄 | 0px / 0줄 / 4 | 0px / 0줄 / 같음 |
| `fallback` | 200 | keep-all | 120px / 5줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `fallback` | 320 | normal | 72px / 3줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `fallback` | 320 | keep-all | 72px / 3줄 | 해당 없음 | 0px / 0줄 / 같음 |
| `fallback` | 480 | normal | 48px / 2줄 | 0px / 0줄 / 같음 | 0px / 0줄 / 같음 |
| `fallback` | 480 | keep-all | 48px / 2줄 | 해당 없음 | 0px / 0줄 / 같음 |

- 줄 수가 DOM과 다른 행: Canvas 3 / 21, pretext 0 / 42.
- 줄 내용이 한 줄이라도 다른 행: Canvas 7 / 21, pretext 0 / 42.
- Canvas 구현에는 keep-all이 없어 keep-all 행은 `해당 없음`이다.
- 폴백 폰트로 그려진 것이 확인된 글리프 — `fallback`: 漢 字 文 章 特 殊 ∮ ℵ ☃ 測 定 確 認. (판별 방법의 한계로 못 잡은 글리프가 있을 수 있다.)

### 폰트 로드 전후 (`before-font`)

아직 로드되지 않은 폰트 이름으로 먼저 재고, 로드가 끝난 뒤 다시 쟀다. "로드 후(그대로)"는 캐시를 건드리지 않고 다시 잰 값, "로드 후(캐시 비움)"은 pretext 캐시를 비우고 다시 잰 값이다.

| 너비 | 방식 | 로드 전 | 로드 후 (그대로) | 로드 후 (캐시 비움) |
| ---: | --- | --- | --- | --- |
| 200 | dom | 144px / 6줄 | 144px / 6줄 | 144px / 6줄 |
| 200 | canvas | 144px / 6줄 | 144px / 6줄 | 144px / 6줄 |
| 200 | pretext | 144px / 6줄 | 144px / 6줄 | 144px / 6줄 |
| 320 | dom | 96px / 4줄 | 72px / 3줄 | 72px / 3줄 |
| 320 | canvas | 96px / 4줄 | 72px / 3줄 | 72px / 3줄 |
| 320 | pretext | 96px / 4줄 | 96px / 4줄 | 72px / 3줄 |
| 480 | dom | 72px / 3줄 | 72px / 3줄 | 72px / 3줄 |
| 480 | canvas | 72px / 3줄 | 72px / 3줄 | 72px / 3줄 |
| 480 | pretext | 72px / 3줄 | 72px / 3줄 | 72px / 3줄 |

### 측정 환경 (JSON에 기록된 값)

- Chromium 159, Not/A)Brand 8 · Windows · DPR 1 · PretendardVariable.woff2 · performance.now() 해상도 5µs

<!-- tables:end -->

## 구조

```
src/measure/   측정 함수 (dom, canvas, pretext) — 같은 Measurer 인터페이스
src/render/    렌더러 (html, svg, canvas) — 입력은 pretext 줄 배열
src/bench/     리사이즈 시나리오, 오차 케이스, 환경 정보
src/ui/        선택 박스와 리사이즈 핸들
scripts/       make-tables.ts, run-bench.mjs, capture.mjs, inspect-fonts.mjs
results/       측정 원본 JSON
tests/         회귀 테스트
```

## 라이선스

폰트 Pretendard는 SIL Open Font License 1.1 (`public/fonts/LICENSE-Pretendard.txt`).
