# 작업 기록

형식: `날짜 | 한 일 | 결과 | 사람이 확인해야 할 것`

| 날짜 | 한 일 | 결과 | 사람이 확인해야 할 것 |
| --- | --- | --- | --- |
| 2026-11-14 | 프로젝트 세팅: Vite vanilla-ts, `@chenglou/pretext` 1.0, `vitest`, Pretendard Variable woff2 + OFL 라이선스 | `npm run build` 통과 | 폰트 파일 출처(orioncactus/pretendard main)와 라이선스 동봉이 과제 요건에 맞는지 |
| 2026-11-14 | 개발 의존성 `@vitest/browser-playwright`, `playwright` 추가 (브라우저에서 테스트·측정 자동 실행용, 계획 승인 때 확인받음) | 설치됨, Chromium 내려받음 | 없음 |
| 2026-11-14 | 측정 함수 3종 (`src/measure/`): DOM 기준값, Canvas(직접 구현한 줄바꿈), pretext(prepare 캐시). 폰트 준비 전 호출은 에러 | 세 함수가 같은 인터페이스로 동작 | DOM 기준값을 `overflow-wrap: break-word`로 잰 것이 과제 의도에 맞는지 (없으면 긴 URL이 줄바꿈되지 않음) |
| 2026-11-14 | 리사이즈 벤치(`src/bench/resize.ts`), 자동 실행(`scripts/run-bench.mjs`), 표 생성(`scripts/make-tables.ts`). 4방식 × 3N × 5회 실행 | `results/resize-*.json` 60개 | **전원: 배터리 구동이었다(60%, 방전 중). Android Studio가 떠 있었다.** 확장 프로그램은 Playwright Chromium 새 프로필이라 없음. 전원 연결 + 다른 프로그램 종료 상태에서 `npm run bench` 재실행 필요 |
| 2026-11-14 | 정확도 케이스 8종(`src/bench/cases.ts`, `accuracy.ts`) 실행 | `results/accuracy.json` 42행 + before-font 9행. pretext는 42행 모두 DOM과 같음. Canvas는 21행 중 줄 수 3행, 줄 내용 7행이 다름 | 케이스 문자열이 확인하려던 상황을 잘 담고 있는지. 폴백 글리프 판별이 못 잡는 글리프(이모지, 일부 기호)가 있음 |
| 2026-11-14 | 회귀 테스트: **Vitest browser mode(Playwright Chromium)를 택했다.** 설치·설정에 문제가 없어 스냅샷 비교 스크립트로 대체하지 않음 | `npm test` 10개 통과 | 스냅샷은 Windows의 폴백·이모지 폰트 기준. 다른 OS에서 돌리면 Canvas "알려진 차이" 스냅샷이 달라질 수 있음 |
| 2026-11-14 | 렌더러 3종(`src/render/`)과 비교 화면(나란히, 겹쳐 보기, 케이스 선택), 화면 캡처(`scripts/capture.mjs`), 폴백 글꼴 조사(`scripts/inspect-fonts.mjs`) | 동작 확인. 폴백 글리프(한자, 일부 기호)가 렌더러 사이에서 세로로 어긋나 보임. 폭과 HTML·SVG의 글꼴은 같음. 원인 미확정 | 겹쳐 보기에서 어긋남을 눈으로 확인 (`docs/img/view-overlay-fallback.png`). 고치지 않았음 |
| 2026-11-14 | 선택 박스와 핸들 8개(`src/ui/selection.ts`): pointer capture, `touch-action: none`, 화살표 키 8px | 끌기·키보드 동작을 자동화로 확인: 좌우는 prepare 횟수 그대로, 모서리는 늘어남 | 터치 기기에서의 조작은 확인하지 못함. 위아래 핸들에 "줄 높이 조절"을 넣은 것은 지시서에 없는 결정 |
| 2026-11-14 | 사용자가 준 디자인 시안(Design 캔버스 "text-measure-bench 화면 디자인")대로 화면 재구성: 머리, 옆 조건 패널, 눈금자·줄 번호, 결과 표 카드 | 빌드·테스트 통과. 화면의 결과 표는 `results/` 원본에서 `src/bench/stats.ts`로 계산 | 시안과 다르게 둔 것: 글꼴은 Google Fonts 대신 로컬 Pretendard 한 종(측정 조건 고정), 케이스는 시안의 5개가 아니라 실제 7개와 실제 문자열 |
| 2026-11-14 | 화면이 바뀌어 전체 측정을 다시 실행 (정확도 + 리사이즈 60회). 이전 원본은 커밋 `cf4093f`에 있음 | 표 갱신. **회차 간 변동이 2~4배로 큼. 첫 측정과 빠른 회차가 다름** | **절대값·배율은 아직 쓰지 말 것.** 통제된 조건에서 재측정 후 `docs/findings.md` 4-2를 다시 판단 |
| 2026-11-14 | 문서: `README.md`, `docs/method.md`, `docs/findings.md`(초안) | `npm run tables`로 표 삽입 | `findings.md`의 결론 문장 확정. Canvas에 폭 캐시를 넣은 방식을 추가로 잴지 결정 |
