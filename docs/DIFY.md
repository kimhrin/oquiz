# Dify 백엔드 연결

현재 상태: 사용자 제공 앱 키를 온라인 서버의 비밀 설정에 등록했으며, 실제 Dify Workflow 실행과 공개 Proxy 연결을 확인했습니다. 2026-10-02 로그인하지 않은 새 브라우저에서 제출용 HTML을 `file://`로 열어 퀴즈 5문제 완주와 기록 저장을 검증했습니다. 키는 HTML이나 제출 ZIP에 포함하지 않습니다. Dify 편집 화면 자체의 조작은 이 세션에서 수행하지 않았으며, 게시된 Workflow의 서비스 API로 실행을 확인했습니다.

## 준비한 워크플로

`dify/oquiz-workflow.yml`을 Dify Studio의 Import DSL에서 가져옵니다. Studio의 가져오기는 새 앱을 만들 수 있으며, 제공하신 기존 앱을 자동으로 덮어쓰는 것은 아닙니다. 기존 편집 화면에서 가져오기 메뉴가 제공되면 그 메뉴를 사용할 수 있습니다. 앱 유형은 Workflow입니다. 입력 검증 Code → 외부 API HTTP 요청 → End 출력으로 구성되며, Start를 포함하여 다섯 노드입니다. HTTP 뒤의 응답 검증 Code가 문제 수와 오류를 확인합니다. 모델이나 추가 플러그인이 필요하지 않습니다.

| 노드 | 설정 |
|---|---|
| Quiz filters | category: any / 9 / 18 / 11 / 15 / 21, difficulty: easy / medium / hard |
| Validate filters and build URL | 허용한 입력만 고정 OpenTDB 주소에 조합 |
| GET Open Trivia DB | GET, amount=5, type=multiple, encode=url3986, 자동 재시도 없음 |
| 응답 검사와 오류 안내 | JSON·응답 코드·객관식 5문제·보기 4개 검증 |
| 웹앱으로 응답 | result, upstream_http_status, status_code, response_code, question_count, application_status, error_code, message |

DSL은 이전 버전과의 호환을 위해 0.3.1 형식을 사용합니다. 가져오기 시 버전 경고가 표시될 수 있습니다. 현재 연결된 게시 Workflow는 서비스 API에서 정상 실행됨을 확인했습니다. 별도 계정으로 재구축할 경우 가져오기와 게시를 다시 진행합니다.

## 다른 계정에 새로 구축하거나 로컬에서 개발할 단계

1. 본인의 Dify 계정에 로그인하고 Studio → Import DSL → 위 YAML 파일을 선택합니다.
2. Test Run: category `18`, difficulty `easy`. `application_status: ready`, `upstream_http_status: 200`, `response_code: 0`, `question_count: 5`를 확인합니다. 전체 분야는 category `any`입니다.
3. Publish로 게시합니다. 편집 후에는 다시 게시해야 API 호출에 반영됩니다.
4. API Access에서 이 Workflow의 앱 API 키를 생성합니다. 키를 채팅·HTML·Git에 붙여 넣지 않습니다.
5. 프로젝트의 `.env.example`을 `.env`로 복사한 다음 `DIFY_API_KEY=` 뒤에 키를 넣고 저장합니다. 기본 Cloud API 주소는 그대로 사용합니다.
6. 실행 중인 로컬 서버가 있으면 종료하고 `start.cmd`를 다시 실행합니다. 웹앱에서 퀴즈 시작 버튼을 누릅니다. 공유용 화면은 Proxy를 기본으로 사용합니다.
7. `npm run check:dify`로 실제 서버 호출을 검증할 수 있습니다. 성공 기준은 `verified: true`, `difyStatus: succeeded`, `upstreamHttpStatus: 200`, `responseCode: 0`, `count: 5`입니다. 이 명령 실행 직후에는 6초 정도 기다린 뒤 앱에서 시작합니다.

## 요청 경로와 계약

GitHub Pages의 공유 화면과 제출용 HTML은 `dist/config.js`에 설정된 온라인 게이트웨이의 `GET /api/quiz?category=18&difficulty=easy`를 호출합니다. GitHub Pages 자체에서는 서버 API를 실행하지 않습니다. 로컬 개발 화면에서는 로컬 서버의 같은 경로를 사용합니다. 서버는 Dify로 다음 요청을 보냅니다. Authorization은 서버 환경 변수로 설정하고 브라우저로 반환하지 않습니다.

`POST https://api.dify.ai/v1/workflows/run`

```json
{
  "inputs": {"category":"18", "difficulty":"easy"},
  "response_mode":"blocking",
  "user":"oquiz-local-user"
}
```

서버 응답은 `{quiz: {response_code: 0, results: [...]}, meta: {...}}`입니다. 검증 순서는 Dify HTTP → data.status → outputs.upstream_http_status → outputs.result JSON 파싱 → OpenTDB response_code → 유효한 5문제입니다. Dify 원본 로그·입력·오류 메시지는 웹앱으로 전달하지 않습니다. 게이트웨이의 Dify 요청 제한은 40초이며, 브라우저는 Proxy 요청을 최대 45초 기다립니다. 교육용 Direct 어댑터의 브라우저 제한은 16초입니다.

## 부록과 연결되는 학습 내용

사전직무교육 2일차 교안_부록.pdf의 8~9쪽(노드 제작·외부 호출), 12쪽(게시·API 실행), 13~14쪽(계층별 응답·오류 진단)을 적용했습니다.

- 날씨의 도시명 q 대신 분야 category와 난이도 difficulty를 입력받습니다.
- OpenTDB는 별도 API 키가 필요 없습니다. Dify 앱 키는 온라인 서버의 비밀 환경 변수에 두며, 로컬 개발에서만 `.env`를 사용합니다.
- 부록의 `outputs.status_code`에 해당하는 필드는 이 프로젝트에서 `outputs.upstream_http_status`로 명명했습니다.
- 부록은 학습용 HTML에 Dify 앱 키를 넣는 예제를 제시하지만, Dify 공식 문서는 앱 키도 클라이언트 코드에 넣지 말라고 안내합니다. 이 프로젝트는 온라인 중계 서버로 앱 키를 보호합니다.
- LLM은 현재 넣지 않았습니다. 퀴즈 정답과 문항을 원본 그대로 유지하며 API 연결 실습에 집중합니다. 부록의 LLM 실습까지 확장하려면 원문을 바꾸지 않는 학습 격려 문구 등의 별도 출력으로 추가하고, 모델·크레딧을 확인한 뒤 실행합니다.

## 오류 진단

| 코드 | 확인할 곳 |
|---|---|
| DIFY_NOT_CONFIGURED | .env의 DIFY_API_KEY 및 서버 재시작 |
| DIFY_AUTH | 올바른 앱 키·폐기 여부 |
| DIFY_NOT_PUBLISHED | Publish 및 API 주소; 404의 가능한 원인 |
| DIFY_WORKFLOW | Dify 실행 기록의 실패 노드 |
| UPSTREAM_HTTP | OpenTDB HTTP 상태 |
| RATE | 최근 연결 정보의 단계: gateway / dify / opentdb |
| INVALID_DATA | End 출력 매핑·인코딩·문항 수 |

OpenTDB는 IP별 5초 호출 간격이 있으므로 반복 클릭을 피합니다. Dify 실행 서버의 공용 IP를 공유하면 다른 호출의 영향을 받을 수 있습니다. Mock으로 자동 전환하지 않고 실패를 명시합니다.

로컬 Node 서버는 개발 확인용으로 127.0.0.1에 바인딩합니다. 공개 프런트엔드는 GitHub Pages, 온라인 게이트웨이는 Cloudflare Worker를 사용하며 파일 Origin의 API 요청도 허용합니다. 온라인 서버와 Dify 키가 유효한 동안 제출용 HTML에서 Proxy를 사용할 수 있습니다. 현재 호출 간격 제한은 서버 실행 인스턴스 단위이며 전체 사용자에 대한 전역 제한은 아닙니다.

## 공식 참고 자료

- https://docs.dify.ai/en/api-reference/guides/get-started
- https://docs.dify.ai/en/api-reference/workflow-runs/run-workflow
- https://docs.dify.ai/en/cloud/use-dify/nodes/http-request
- https://opentdb.com/api_config.php
- https://github.com/langgenius/dify/blob/main/api/core/workflow/generator/prompts/builder_prompts.py


## 최종 단일 HTML 제출

최종 제출 파일은 `oquiz.html` 하나입니다. CSS·JavaScript·아이콘이 내장되어 있고 프로그램 설치 없이 브라우저에서 열 수 있습니다. 공유용 화면은 HTML에 설정된 온라인 서버를 호출하는 Proxy 방식으로 실행되며 인터넷 연결이 필요합니다. Mock·Direct는 교육용 데이터 어댑터 코드로 유지합니다. 서버의 Dify 키 설정과 공개 접근 설정을 완료했으므로 별도 설정 없이 Proxy를 사용할 수 있습니다. HTML에 Dify 앱 키를 넣지 않습니다.

로컬 개발용 Dify 키를 이 컴퓨터에 입력하려면 프로젝트의 `configure-dify.cmd`를 실행합니다. 입력 내용은 화면에 표시되지 않으며 `.env`에만 저장됩니다. 이 키를 온라인 서버에 등록하는 작업은 별도 단계입니다.

워크플로를 수정하려면 본인의 Dify Studio에서 가져온 앱을 엽니다. Studio의 편집 주소는 인증이 필요한 관리 화면이며, HTML이 호출할 공개 API 주소가 아닙니다.
