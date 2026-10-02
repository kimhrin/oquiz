# 검증 결과

검증일: 2026-10-02. Windows / Chrome / Playwright / Node.

## 다음 문제 전환 시 스크롤 유지

- `다음 문제`를 누르면 전환 직전의 스크롤 좌표를 유지합니다. 짧은 다음 문항으로 인해 페이지 높이가 줄어들어도 기존 위치에 머물 수 있도록 퀴즈 중 최소 높이를 유지합니다.
- 문제 제목에 스크롤 이동 없이 키보드 초점을 옮깁니다. 결과 화면으로 이동하면 최소 높이를 해제하고 기존처럼 상단부터 보여줍니다.
- `tests/scroll-browser.cjs`: 1440px 데스크톱·390px 모바일에서 마우스/Enter 전환, 긴 문항→짧은 문항, 답 선택·제출 후 위치, 오답 복습, 결과 화면 초기화, Tab 접근을 확인했습니다. 전환 전후 Y 차이는 1px 이내이며 브라우저 오류는 없었습니다.

## GitHub 전체 소스 업로드 검증

2026-10-02 기준 공개 웹앱은 https://kimhrin.github.io/oquiz/ 이며, 아래의 기존 사이트 주소와 모드 선택 UI 관련 기록은 이전 단계의 검증 이력입니다. 현재 홈은 Proxy로 바로 시작하며 번역 기능과 모드 선택 패널은 없습니다.

- Node 단위 테스트 14개 통과: core 4개, gateway 8개, worker 2개.
- 브라우저 고정 응답 시나리오 14개 통과: 채점·중복 제출·복습·기록·오류·390px 모바일 화면·미처리 예외 검사.
- `node scripts/build.mjs`로 Pages HTML·단일 HTML·ZIP·Worker 생성 확인. 현재 작업 환경에 npm 실행 파일이 없어 빌드와 테스트의 Node 명령을 직접 실행했습니다.
- ZIP 무결성 검사 통과. 내부 파일은 `oquiz.html` 하나이며 배포용 HTML과 바이트가 일치합니다.
- 다운로드 링크를 유지했고 단일 HTML의 SHA-256은 이전 GitHub 배포본과 같습니다. 이번 변경은 소스·문서·빌드 절차 정리이며 앱 동작은 유지합니다.
- 공개 대상 텍스트에서 Dify 실제 앱 키 형태, GitHub 토큰 형태, 개인 키를 검사해 발견하지 못했습니다. 실제 `.env`, 로컬 런타임 파일, 테스트 결과는 Git에서 제외합니다.

## 초기 구현 검증 이력

- Node 테스트 11개 통과: 인코딩·문항 검증·채점·최근 기록·입력 whitelist·Dify 요청 계약·오류 계층·호출 간격·모드 어댑터.
- 기존 브라우저 시나리오 14개 통과: 선택/제출/답안 잠금, 80점 계산, 저장, 복습, 기록 삭제 확인, 오류 안내, 손상 기록, 모바일, 미처리 예외 없음.
- 실제 OpenTDB 요청: Node HTTP 200, response_code 0, 5문제, CORS `*` 확인. Chrome에서도 실제 문제 5개 수신 성공.
- Mock 실제 브라우저 실행: 외부 퀴즈 요청 0회, 5문제 완주, 기록 생성 없음, 분야·난이도 고정 및 모드 복귀 시 기존 설정 복원.
- Proxy 브라우저 테스트: 실제 서버의 키 누락 오류 표시, 모의 정상 Workflow 응답으로 퀴즈 표시, 브라우저 요청에 Authorization 없음. 실제 Dify 실행을 대신하는 검증은 아닙니다.
- 서버 라우트: /api/health 200·proxyConfigured false, /api/quiz 키 누락 503, 잘못된 분야 400, /.env 404.
- Dify DSL: PyYAML 파싱 성공, start/code/http-request/code/end 5노드 및 4개 연결 확인. 정상 응답, 잘못된 JSON, HTTP 오류, 요청 제한, 문제 부족의 응답 검사 코드 검증. Code의 정상 18개 입력 조합과 부적합 입력 거부 확인.
- 1440px 데스크톱과 390px 모바일 화면 캡처 및 시각 검토. 가로 넘침 없음.

이전 검증 시 외부 API는 실행 환경의 EACCES로 차단되었으나, 이번 작업에서 승인된 외부 통신으로 실제 Direct 연결을 확인했습니다.

## 실제 Dify 및 공개 Proxy 검증 완료

- 온라인 서버에 사용자 제공 Dify 앱 키를 비밀 환경 변수로 등록했습니다.
- Dify Workflow 서비스 API: HTTP 200, `data.status: succeeded`, `question_count: 5`.
- Cloudflare Worker의 요청 옵션을 `redirect: manual`로 수정했습니다. 3xx 응답은 거절하며 키를 다른 주소로 전달하지 않습니다. 회귀 테스트를 포함한 gateway/adapter 테스트 8개가 통과했습니다.
- 공개 주소: https://oquiz.khrhappy0147.chatgpt.site
- 2026-10-02 16:08 KST에 공개 전환했습니다. 인증 없는 웹 요청 HTTP 200을 확인했습니다.
- 별도 폴더에 복사한 제출용 HTML을 새 Chrome 컨텍스트에서 `file://`로 실행했습니다. Proxy 요청에 쿠키·Authorization·소유자 인증 헤더가 없음을 확인했습니다.
- 실제 Proxy HTTP 200, Dify `succeeded`, OpenTDB HTTP 200, 퀴즈 5문제. 5문제 완주·결과 표시·최근 기록 저장까지 성공했습니다.
- localhost 요청 0회, 페이지 JavaScript 오류 0건입니다.

## 검증 범위

- 다른 물리적 PC에서 직접 실행한 것은 아닙니다. 독립 폴더·새 브라우저 컨텍스트·로컬 서버 요청 차단으로 이식성을 확인했습니다.
- Dify 편집 화면에서 Import/Test Run/Publish를 직접 조작한 것은 아닙니다. 사용자가 제공한 앱 키로 게시된 Workflow의 실제 서비스 API 실행을 확인했습니다.
- Direct와 Proxy는 인터넷 및 외부 서비스 가용성이 필요합니다. 최근 기록은 브라우저별이며 PC 간 동기화되지 않습니다.

모의 응답 테스트와 실제 외부 호출 결과를 구분합니다. Proxy나 Direct 실패를 Mock 성공으로 대체하지 않습니다. 비밀 키는 HTML·배포 dist·다운로드 ZIP에 포함하지 않습니다.


## 단일 HTML 이식성 추가 검증

- HTML을 별도 폴더로 복사해 `file://`로 직접 실행했습니다. 별도 브라우저 컨텍스트를 사용했으며 실제 두 번째 PC를 사용한 검증은 아닙니다.
- localhost 요청을 차단한 상태로 Mock 완료, 실제 Direct 5문제 수신 및 완료를 확인했습니다. localhost 요청 수는 0회입니다.
- localStorage 접근을 강제로 차단해도 현재 창에서 기록 생성·조회·삭제가 동작했습니다.
- Worker 테스트 2개 통과: 파일 Origin의 health/오류 CORS, OPTIONS, 잘못된 입력 차단, 단일 HTML 제공.
- 실제 Dify 실행과 공개 HTML의 Proxy 완주 검증을 완료했습니다. 위 공개 검증 결과를 참조하세요.



## 영어 원문 복구 및 공유 주소 변경

- 사용자 요청에 따라 한국어 번역 버튼·번역 API 코드·번역 테스트를 제거하고 번역 추가 이전의 화면과 동작으로 복구했습니다. UI 안내는 한국어이며 문제·보기는 영어 원문입니다.
- 공개 주소를 https://oquiz.khrhappy0147.chatgpt.site 로 단축했습니다. 제출용 HTML의 Proxy 주소도 동일하게 갱신했습니다.
- 2026-10-02 16:22 KST, 로그인 없는 새 브라우저의 file:// HTML에서 새 주소의 실제 Proxy HTTP 200·Dify succeeded·OpenTDB HTTP 200·5문제 수신을 확인했습니다.
- 5문제 완주와 기록 저장 성공. 번역 요청 0회, localhost 요청 0회, 페이지 오류 0건. HTML 내 번역 코드·언어 버튼·이전 서버 주소가 없음을 확인했습니다.

## 공유용 홈 정리

- 홈의 ‘한국어 UI’ 배지와 Mock·Direct·Proxy 선택 패널 전체를 제거했습니다. 문제·보기가 영어라는 안내는 유지합니다.
- 기본 실행 방식을 Proxy로 설정하여 분야·난이도 선택 후 바로 Dify 퀴즈를 시작합니다.
- 독립 HTML을 로그인 없는 새 Chrome에서 실행해 두 UI 영역이 없음을 확인했습니다. 데스크톱·390px 모바일 레이아웃을 확인했으며 가로 넘침이 없습니다.
- 모드 선택 없이 실제 공개 Proxy 5문제 수신·완주·기록 저장 성공. Dify succeeded, API HTTP 200, localhost 요청 및 페이지 오류 0건입니다.
