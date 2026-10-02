# 배포와 Git 작업

## 현재 구성

- 저장소: https://github.com/kimhrin/oquiz
- 공유 웹앱: https://kimhrin.github.io/oquiz/
- Pages 설정: `main` 브랜치, `/ (root)`, HTTPS
- 단일 HTML: https://kimhrin.github.io/oquiz/oquiz.html
- HTML ZIP: https://kimhrin.github.io/oquiz/oquiz-html.zip
- 공개 API 게이트웨이: `dist/config.js`의 `ONLINE_PROXY_ORIGIN`

GitHub Pages는 정적 파일만 호스팅합니다. 게이트웨이는 기존 온라인 Worker에서 운영하며 Dify 앱 키를 서버 환경 변수로 읽습니다. 프런트엔드 URL을 GitHub Pages로 옮긴 뒤에도 백엔드는 기존 주소를 사용합니다. 소스의 해당 주소는 API 연결 설정으로 유지합니다.

## 수정 후 반영

이 저장소는 이미 만들어져 있으므로 다시 생성할 필요가 없습니다. 처음에는 README의 clone 절차를 따르고, 이후에는 저장소 디렉터리에서 아래 순서로 작업합니다.

1. `git status`로 변경사항을 확인합니다. 기존 작업을 보존하거나 커밋한 뒤 `git pull --ff-only origin main`으로 원격 변경사항을 가져옵니다. 분기가 갈라져 명령이 실패하면 변경 이력을 확인하고 해결하며 강제 푸시하지 않습니다.
2. `dist/`의 화면 코드, `scripts/`의 서버 코드, 필요한 문서를 수정합니다.
3. `npm run build`와 `npm test`를 실행합니다.
4. `git diff`로 내용을 확인하고, 변경한 파일만 `git add`로 준비합니다. `.env`와 실제 키는 추가하지 않습니다.
5. `git commit -m "Describe the change"`로 변경 목적을 기록합니다.
6. `git push origin main`으로 업로드합니다. 최초 푸시에서는 GitHub 인증이 필요할 수 있습니다.
7. GitHub 저장소의 Actions에서 Pages 배포 성공을 확인하고 웹앱과 다운로드를 엽니다.

예시:

```sh
git add dist/app.js index.html oquiz.html oquiz-html.zip
git commit -m "Update quiz screen"
git push origin main
```

루트 `index.html`은 단일 HTML에 다운로드 링크를 더한 생성 파일입니다. `oquiz.html`에는 다운로드 링크를 넣지 않아 다른 컴퓨터의 `file://`에서도 상대 다운로드 경로가 생기지 않습니다. ZIP에는 `oquiz.html` 하나만 들어갑니다. `.nojekyll`은 Pages가 정적 파일을 그대로 제공하도록 유지합니다.

## 백엔드를 다른 계정에서 운영할 때

1. `docs/DIFY.md`에 따라 DSL을 가져오고 테스트·게시하여 자신의 앱 키를 만듭니다.
2. 로컬에서는 `.env`로, 온라인에서는 호스팅 서비스의 비밀 환경 변수 `DIFY_API_KEY`로 등록합니다. 필요하면 `DIFY_API_BASE_URL`도 설정합니다.
3. `npm run build:worker`로 생성한 `dist/server/index.js`를 ES module Worker를 지원하는 서버에 배포합니다. 이 명령은 파일만 생성하며 서버를 자동 배포하지 않습니다.
4. 새 서버의 `/api/health`와 `/api/quiz?category=18&difficulty=easy`를 확인합니다. 공개 HTML이 사용할 수 있도록 CORS 응답을 유지합니다.
5. `dist/config.js`의 `ONLINE_PROXY_ORIGIN`을 새 HTTPS 주소로 바꾸고 프런트엔드를 다시 빌드·테스트·커밋·푸시합니다.

현재 공개본은 운영 중인 게이트웨이에 의존합니다. 이 저장소를 포크하는 것만으로 개인 Dify 백엔드가 새로 생성되지는 않습니다.
