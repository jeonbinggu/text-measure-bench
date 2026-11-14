# text-measure-bench

텍스트 측정(DOM / Canvas / pretext)과 렌더링(HTML / SVG / Canvas)을 같은 조건에서 반복 측정하는 실험 레포.
Vite + TypeScript, UI 프레임워크 없음(프레임워크의 렌더 비용이 측정에 섞이지 않게).

## 공통 규칙

1. **숫자를 만들어 내지 않는다.** 표의 모든 수치는 실제 실행 결과다. 못 잰 칸은 `미측정`. 예상값·추정값을 결과처럼 쓰지 않는다.
2. **결과를 좋게 보이게 하려고 코드를 조작하지 않는다.** 비교 대상을 일부러 느리게 짜거나 유리한 케이스만 고르지 않는다.
3. **원본을 남긴다.** 측정은 `results/*.json`에 프레임별 값으로 저장하고, 표는 `npm run tables`로만 만든다. 표를 손으로 고치지 않는다.
4. **한 번에 하나만 바꾼다.** 성능에 영향을 주는 변경은 하나마다 같은 조건으로 다시 측정하고 전후를 기록한다.
5. **모르는 것은 멈추고 묻는다.** 결과가 예상과 크게 다르거나 원인을 확신할 수 없으면 추측으로 고치지 말고 관찰을 보고한다.
6. **작업 기록.** `docs/log.md`에 작업 단위마다 한 줄: `날짜 | 한 일 | 결과 | 사람이 확인해야 할 것`.
7. **외부 수치와 비교하지 않는다.** 다른 환경의 벤치마크 수치를 문서에 인용하지 않는다.

## 디렉터리 규칙

| 위치 | 넣는 것 |
| --- | --- |
| `src/measure/` | 측정 함수. 전부 `types.ts`의 `Measurer` 인터페이스를 따른다. 폰트 준비 전 호출은 던진다(`fonts.ts`) |
| `src/render/` | pretext 줄 배열을 그리는 렌더러 (HTML, SVG, Canvas) |
| `src/bench/` | 리사이즈 시나리오(`resize.ts`), 오차 케이스(`cases.ts`)와 실행기(`accuracy.ts`), 환경 정보·저장(`env.ts`) |
| `src/ui/` | 선택 박스와 리사이즈 핸들 |
| `results/` | 측정 원본 JSON. 사람이 고치지 않는다 |
| `scripts/` | `make-tables.ts`(results → 표), `run-bench.mjs`(브라우저 자동 실행), `capture.mjs`(화면 캡처) |
| `tests/` | 브라우저에서 도는 회귀 테스트 (Vitest browser mode) |
| `docs/` | `log.md`, `method.md`, `findings.md`(초안, 결론은 사람이 확정), `img/` |

## 그 밖에

- 의존성은 `@chenglou/pretext`, 개발 의존성은 `vitest` `@vitest/browser-playwright` `playwright`. 그 밖의 패키지는 추가 전에 이유를 적고 확인받는다.
- 웹폰트는 `public/fonts/PretendardVariable.woff2` 한 종으로 고정. 모든 측정은 `loadFonts()` 뒤에 시작한다.
- 줄바꿈 규칙을 바꾸면 `docs/method.md`와 코드 주석을 함께 고친다.
- 어긋남이 보이면 고쳐서 숨기지 않는다. `docs/findings.md`에 관찰로 적는다.
