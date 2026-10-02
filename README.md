# 오퀴즈 — 5문제 챌린지

분야와 난이도를 선택해 영어 객관식 문제 5개를 풀고, 점수와 오답을 확인하는 웹앱입니다. 화면 안내는 한국어이며 문제와 선택지는 영어 원문입니다.

**[웹앱 실행](https://kimhrin.github.io/oquiz/)** · **[HTML 열기](https://kimhrin.github.io/oquiz/oquiz.html)** · **[HTML ZIP 다운로드](https://kimhrin.github.io/oquiz/oquiz-html.zip)**

웹앱 하단의 **HTML 다운로드** 버튼이나 ZIP 링크로 `oquiz.html`을 저장한 뒤 Chrome 또는 Edge에서 열 수 있습니다. 별도 설치·로그인·API 키 입력 없이 사용하며, 실제 문제를 받으려면 인터넷 연결이 필요합니다.

## 주요 기능

- 전체·일반상식·컴퓨터·영화·게임·스포츠, 쉬움·보통·어려움 선택
- 문제 5개, 보기 무작위 배치, 즉시 채점, 100점 만점 결과
- 문제별 정답 비교와 API 재호출 없는 오답 복습
- 브라우저에 최근 5회 기록 저장, 최고·평균 점수, 삭제 확인
- 모바일 화면, 키보드 조작, 요청 실패·호출 제한 안내

공개 화면은 Dify를 사용하는 Proxy 방식으로 시작합니다. 모드 선택 패널과 번역 버튼은 없습니다. Mock·Direct·Proxy 세 가지 데이터 어댑터는 학습용 소스와 테스트에 보존되어 있습니다. API 실패를 Mock 문제로 바꾸지 않습니다.

## 구성과 데이터 흐름

| 방식 | 흐름 | 현재 용도 |
|---|---|---|
| Mock | 코드에 포함된 샘플 문제 | 어댑터 테스트·학습 |
| Direct | 브라우저 → Open Trivia DB GET | 어댑터 테스트·학습 |
| Proxy | 브라우저 → 공개 게이트웨이 → Dify Workflow → Open Trivia DB | 공개 웹앱 기본 동작 |

GitHub Pages는 화면과 다운로드 파일을 제공합니다. `/api/quiz` 처리는 별도로 운영 중인 온라인 게이트웨이가 담당합니다. Dify 앱 키는 서버 런타임에만 저장하며 이 저장소와 배포 HTML에는 포함하지 않습니다.

## 개발 환경에서 실행

Node.js 22 이상이 필요합니다. 기본 실행·빌드·단위 테스트에는 외부 패키지 설치가 필요하지 않습니다.

```sh
git clone https://github.com/kimhrin/oquiz.git
cd oquiz
npm start
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다. Windows에서는 `start.cmd`도 사용할 수 있습니다. 로컬 서버의 Proxy 기능을 사용하려면 `.env.example`을 `.env`로 복사한 뒤 **자신의** Dify 앱 키를 설정하고 서버를 다시 실행합니다. Windows의 `configure-dify.cmd`는 키를 화면에 표시하지 않고 입력받습니다.

`.env`는 Git에서 제외됩니다. 키를 HTML·커밋·이슈에 넣지 마세요. 배포된 웹앱과 다운로드 HTML은 이미 운영 중인 게이트웨이를 이용하므로 사용자의 키 설정이 필요하지 않습니다.

## 빌드와 테스트

```sh
npm run build
npm test
```

npm 없이 Node 실행 파일만 있는 환경에서는 `node scripts/build.mjs`와 `node --test tests/core.test.mjs tests/gateway.test.mjs tests/worker.test.mjs`를 순서대로 실행할 수 있습니다. 로컬 서버는 `node scripts/serve.mjs`로 시작합니다.

| 명령 | 결과 |
|---|---|
| `npm run build` | Pages 화면·단일 HTML·ZIP·백엔드 Worker 생성 |
| `npm run build:pages` | 루트 `index.html`, `oquiz.html`, `oquiz-html.zip` 생성 |
| `npm run build:worker` | `dist/server/index.js` 생성; 별도 서버 배포용 |
| `npm test` | Worker 빌드 후 채점·어댑터·게이트웨이·CORS 테스트 14개 |
| `npm run check:dify` | 로컬 `.env`로 실제 Workflow 1회 호출 |

브라우저 테스트에는 Playwright와 Chromium/Chrome이 추가로 필요합니다. Playwright를 설치한 환경에서 로컬 서버를 켜고 `node tests/browser-check.cjs`, `node tests/modes-browser.cjs`를 실행합니다. 설치 위치가 다르면 `PLAYWRIGHT_MODULE`과 `CHROME_PATH`로 지정합니다. `BASE_URL`로 서버 주소를 바꿀 수 있습니다. 실제 외부 호출은 `LIVE_API=1`일 때만 추가 실행하며, 기본 UI 테스트는 고정 응답으로 실행됩니다.

## 파일 안내

| 경로 | 내용 |
|---|---|
| `dist/` | 수정할 프런트엔드 HTML·CSS·JavaScript 원본 |
| `index.html` | GitHub Pages용 생성 파일; HTML 다운로드 버튼 포함 |
| `oquiz.html`, `oquiz-html.zip` | 공유·제출용 생성 파일 |
| `scripts/` | 로컬 서버, Dify 게이트웨이, 빌드·설정 도구 |
| `dify/oquiz-workflow.yml` | Dify에 가져올 Workflow DSL |
| `tests/` | 단위 테스트와 브라우저 시나리오 |
| `docs/wireframe.html` | 시작·문제·결과 화면 와이어프레임 |
| `docs/DESIGN.md` | 요구사항·화면 흐름·데이터 설계 |
| `docs/DIFY.md` | Dify Import·Test Run·Publish·API 연결 방법 |
| `docs/HOSTING.md` | 배포 구조와 Git 변경·업로드 절차 |
| `docs/VALIDATION.md` | 검증 결과와 한계 |

화면을 수정할 때는 `dist/`를 편집한 뒤 빌드하여 생성 파일도 함께 커밋합니다. `dist/server/`는 재생성 가능한 서버 결과물이며 Git에 포함하지 않습니다.

## 사용 범위와 출처

기록은 각 브라우저에 저장되며 다른 PC와 동기화되지 않습니다. 저장이 차단된 환경에서는 현재 창에서만 기록을 유지합니다. 로그인·전역 랭킹·자동 번역·서버 DB는 제공하지 않습니다. 공개 API와 게이트웨이의 가용성 및 호출 제한에 따라 문제 조회가 지연되거나 실패할 수 있습니다.

문제 데이터: [Open Trivia DB](https://opentdb.com/), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). 문제를 디코딩하고 보기 순서를 바꾸어 표시합니다. Mock은 직접 작성한 샘플입니다. Google Fonts의 Noto Sans KR·DM Sans·Manrope를 사용하며, 폰트 요청 실패 시 시스템 폰트로 표시합니다.
