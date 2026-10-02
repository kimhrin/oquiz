import { CATEGORIES, DIFFICULTIES, normalizeQuestions, scoreAnswers, readHistory, saveResult, STORAGE_KEY } from './core.js';
import { MODES, getQuizQuestions } from './data.js';
import { proxyEndpoint } from './config.js';

const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  bulb: '<path d="M9 18h6M10 21h4M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/>',
  code: '<rect x="2" y="4" width="20" height="15" rx="3"/><path d="m9 9-3 3 3 3m6-6 3 3-3 3M8 22h8"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m10 0h4M3 16h4m10 0h4"/>',
  game: '<path d="M7 7h10c4 0 6 12 3 13-2 1-4-4-5-4H9c-1 0-3 5-5 4C1 19 3 7 7 7Z"/><path d="M6 11h5M8.5 8.5v5M16 11h.01M19 13h.01"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M6 5c6 4 6 10 0 14M18 5c-6 4-6 10 0 14"/>',
  play: '<path d="m9 5 11 7-11 7V5Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  book: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-2-1-6-2-10 1Z"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v5M8 21h8M10 19h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  reset: '<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a19 19 0 0 1 0 18 19 19 0 0 1 0-18Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  chart: '<path d="M4 20V4M4 20h17M9 16v-5m5 5V6m5 10v-8"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  flag: '<path d="M5 22V3m0 0c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = document.querySelector('#app');
let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw Error(); } }; }
const state = {
  view: 'home', category: '', difficulty: 'easy', history: readHistory(storage), mode: 'proxy', meta: null, proxyConfigured: null, connectionError: '', storageVolatile: false,
  questions: [], index: 0, selected: null, answers: [], submitted: false,
  loading: false, error: '', cooldownUntil: 0, roundId: '', review: false,
  reviewOriginal: null, startedAt: 0, saved: true, dialog: '', historyError: '', dialogOpener: ''
};
let controller, requestId = 0;
const currentCategory = () => CATEGORIES.find(c => c.id === state.category) || CATEGORIES[0];
const remaining = () => state.mode === 'mock' ? 0 : Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000));
const footer = () => `<footer class="footer"><span>하루의 작은 지적 모험, 오퀴즈</span><span>실제 문제 출처 <a href="https://opentdb.com/" target="_blank" rel="noopener">Open Trivia DB</a><span class="footer-dot">·</span><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a></span></footer>`;

function shell(content) {
  const stats = state.history;
  const best = stats.length ? Math.max(...stats.map(r => r.score)) : '—';
  return `<aside class="sidebar">
    <button class="brand" data-action="home" aria-label="오퀴즈 홈"><span class="brand-mark">5<span></span></span><span>오퀴즈<small>FIVE QUESTIONS. BIG DISCOVERIES.</small></span></button>
    <div class="nav-label">MY PLAYGROUND</div>
    <nav class="navigation" aria-label="주 메뉴">
      <button class="nav-item ${state.view !== 'history' ? 'active' : ''}" data-action="home">${icon('grid')}<span>퀴즈 챌린지</span></button>
      <button class="nav-item ${state.view === 'history' ? 'active' : ''}" data-action="history">${icon('clock')}<span>나의 기록</span><span class="nav-count">${stats.length}</span></button>
    </nav>
    <div class="side-note">${icon('bulb')}<p>다섯 번의 질문,<br><strong>하나의 새로운 발견.</strong></p><span>잘 몰라도 괜찮아요.<br>알아가는 재미가 있으니까요.</span></div>
    <div class="side-bottom"><span class="avatar">Q</span><div><strong>오늘의 도전자</strong><span>나만의 속도로, 한 문제씩</span></div></div>
  </aside>
  <div class="workspace"><header class="topbar"><div class="breadcrumb">나의 플레이그라운드 <span>/</span><strong>${state.view === 'history' ? '나의 기록' : state.view === 'quiz' ? (state.review ? '오답 복습' : '챌린지 진행 중') : state.view === 'result' ? (state.review ? '복습 결과' : '챌린지 결과') : '퀴즈 챌린지'}</strong></div><div class="top-meta">${icon('trophy')}<span>최근 최고 <strong>${best}${best === '—' ? '' : '점'}</strong></span><span class="mini-avatar">Q</span></div></header>
  <main id="main" tabindex="-1">${state.view === "quiz" || state.view === "result" ? provenance() : ""}${content}</main>${footer()}</div>${dialog()}`;
}
function title(eyebrow, heading, sub) {
  return `<div class="page-heading"><span class="eyebrow">${eyebrow}</span><h1>${heading}</h1><p>${sub}</p></div>`;
}
function historyRows(limit = 5) {
  return state.history.slice(0, limit).map(row => `<div class="history-row"><span class="history-icon">${icon(CATEGORIES.find(c => c.id === row.category)?.icon || 'grid')}</span><div class="history-name"><strong>${esc(CATEGORIES.find(c => c.id === row.category)?.name || '전체 분야')}</strong><span>${esc(DIFFICULTIES[row.difficulty])} · ${MODES[row.mode]?.label || 'Direct'}<span class="dot">·</span>${new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(row.date))}</span></div><div class="history-score"><strong>${row.score}<small>점</small></strong><span>${row.correct} / 5 정답</span></div></div>`).join('');
}
function provenance() {
  return `<div class="provenance"><span class="source-badge">${MODES[state.mode].label}</span><span>${state.mode === 'mock' ? '연습 문제 · 기록에 저장하지 않아요' : state.mode === 'proxy' ? 'Dify 백엔드에서 가져온 문제' : 'Open Trivia DB에서 직접 가져온 문제'}</span>${state.meta ? `<span class="source-time">${state.meta.count}문제 · ${state.meta.elapsedMs}ms</span>` : ''}</div>`;
}
function home() {
  return `${title('YOUR DAILY FIVE', '오늘은 무엇이 궁금하세요?', '좋아하는 분야를 고르고, 가볍게 다섯 문제에 도전해 보세요.')}
  <div class="home-layout"><section class="setup-panel panel" aria-label="챌린지 설정">
    <div class="section-heading"><h2><span class="step">01</span>관심 분야를 선택하세요</h2><span class="small-meta">하나만 골라주세요</span></div>
    <div class="category-grid" role="group" aria-label="분야">${CATEGORIES.map(c => `<button class="category-card ${state.category === c.id ? 'selected' : ''}" data-category="${c.id}" ${state.mode === 'mock' || state.loading ? 'disabled' : ''} aria-pressed="${state.category === c.id}"><span class="category-icon ${c.color}">${icon(c.icon)}</span><span class="category-name">${c.name}</span><span class="category-en" lang="en">${c.en}</span><span class="selection-check">${icon('check')}</span></button>`).join('')}</div>
    <div class="section-heading difficulty-heading"><h2><span class="step">02</span>어느 정도로 도전할까요?</h2></div>
    <div class="difficulty-options" role="group" aria-label="난이도">${Object.entries(DIFFICULTIES).map(([key, label], i) => `<button ${state.mode === 'mock' || state.loading ? 'disabled' : ''} data-difficulty="${key}" class="difficulty ${state.difficulty === key ? 'selected' : ''}" aria-pressed="${state.difficulty === key}"><span class="difficulty-bars" aria-hidden="true">${[0,1,2].map(j => `<i class="${j <= i ? 'filled' : ''}"></i>`).join('')}</span><span><strong>${label}</strong><small>${['가볍게 워밍업', '조금 더 생각하기', '제대로 도전하기'][i]}</small></span>${state.difficulty === key ? icon('check') : ''}</button>`).join('')}</div>
    <div class="language-note">${icon('globe')}<span>문제와 보기는 <strong>영어</strong>로 제공됩니다.</span></div>
    ${state.error ? `<div class="error-box" role="alert">${icon('info')}<span>${esc(state.error)}</span></div>` : ''}
    <button id="start-button" class="primary start-button" data-action="start" ${state.loading || remaining() ? 'disabled' : ''}>${state.loading ? '<span class="spinner"></span>' : icon('play')}<span>${state.loading ? '문제 5개를 준비하고 있어요' : remaining() ? `${remaining()}초 후 시작할 수 있어요` : '5문제 챌린지 시작'}</span></button>
    <p class="setup-foot">${icon('check')}가입 없이 바로 시작<span>·</span>문제당 20점<span>·</span>시간제한 없음</p>
  </section><aside class="home-right">
    <section class="challenge-card"><div class="challenge-top"><span>SMALL CHALLENGE,<br>FRESH PERSPECTIVE.</span>${icon('spark')}</div><div class="big-five">05<span>QUESTIONS</span></div><h2>작은 도전이<br>쌓이는 곳.</h2><p>정답을 맞히는 즐거움도,<br>몰랐던 걸 알아가는 재미도.</p><div class="challenge-tags"><span>5문제</span><span>4지선다</span><span>바로 채점</span></div></section>
    <section class="recent-panel panel"><div class="section-heading"><h2>최근 챌린지</h2>${state.history.length ? '<button class="text-button" data-action="history">전체 보기</button>' : '<span class="small-meta">최근 5회</span>'}</div>${state.history.length ? historyRows(2) : `<div class="empty-history"><span class="empty-icon">${icon('flag')}</span><strong>첫 번째 기록을 남겨보세요</strong><p>챌린지를 마치면 이곳에 쌓여요.</p></div>`}</section>
  </aside></div>`;
}
function quiz() {
  const q = state.questions[state.index];
  const answer = state.answers[state.index];
  const correctSoFar = state.answers.filter(a => a.correct).length;
  return `<div class="quiz-top"><span class="eyebrow">${state.review ? 'ONE MORE CHANCE' : 'LET’S PLAY'}</span><button class="text-button quit-button" data-action="home">그만하기</button></div>
    <div class="quiz-layout"><section class="quiz-panel panel">
      <div class="quiz-labels"><span class="pill">${state.review ? '오답 복습' : currentCategory().name}</span><span class="pill neutral">${DIFFICULTIES[state.difficulty]}</span><span class="question-number">QUESTION <strong>${String(state.index + 1).padStart(2,'0')}</strong> / ${String(state.questions.length).padStart(2,'0')}</span></div>
      <div class="progress" role="progressbar" aria-label="퀴즈 진행률" aria-valuemin="0" aria-valuemax="${state.questions.length}" aria-valuenow="${state.index + (state.submitted ? 1 : 0)}"><span style="width:${(state.index + (state.submitted ? 1 : 0))/state.questions.length*100}%"></span></div>
      <span class="question-category" lang="en">${esc(q.category)}</span>
      <h1 id="question-title" class="question-title" lang="en">${esc(q.question)}</h1>
      <p class="question-instruction">가장 알맞은 답을 하나 선택하세요.</p>
      <div class="answer-options" role="group" aria-label="답안 보기">${q.answers.map((a,i) => {
        const selected = state.selected === a.id;
        const status = state.submitted ? (a.correct ? 'correct' : selected ? 'incorrect' : 'muted') : selected ? 'chosen' : '';
        return `<button class="answer-option ${status}" data-answer="${a.id}" aria-pressed="${selected}" ${state.submitted ? 'disabled' : ''}><span class="option-letter">${'ABCD'[i]}</span><span class="option-text" lang="en">${esc(a.text)}</span>${state.submitted && a.correct ? `<span class="answer-status">${icon('check')}정답</span>` : state.submitted && selected ? `<span class="answer-status">${icon('close')}내 답</span>` : selected ? icon('check') : ''}</button>`;
      }).join('')}</div>
      <div id="answer-feedback" class="feedback-slot" aria-live="polite" aria-atomic="true">${state.submitted ? `<div class="feedback ${answer.correct ? 'success' : 'wrong'}">${icon(answer.correct ? 'check' : 'bulb')}<div><strong>${answer.correct ? '정답이에요! 잘 알고 계시네요.' : '아쉽지만, 새로운 걸 하나 알게 됐어요.'}</strong>${!answer.correct ? `<p>정답: <span lang="en">${esc(q.correct)}</span></p>` : '<p>이 감각 그대로 다음 문제도 도전해 보세요.</p>'}</div></div>` : ''}</div>
      <div class="quiz-bottom"><span>${state.submitted ? '답안이 확정되었습니다.' : '선택한 뒤 정답을 확인하세요.'}</span><button class="primary" data-action="${state.submitted ? 'next' : 'submit'}" ${state.submitted ? 'aria-describedby="answer-feedback"' : ''} ${!state.selected ? 'disabled' : ''}>${state.submitted ? (state.index === state.questions.length-1 ? '결과 보기' : '다음 문제') : '정답 확인'}</button></div>
    </section><aside class="quiz-aside"><section class="round-progress panel"><span class="eyebrow">${state.review ? 'REVIEW SESSION' : 'YOUR CHALLENGE'}</span><h2>한 문제씩, 차근차근.</h2><div class="progress-circles">${state.questions.map((_,i) => `<span class="progress-circle ${state.answers[i] ? (state.answers[i].correct ? 'passed' : 'missed') : i === state.index ? 'current' : ''}" aria-label="${i+1}번 ${state.answers[i] ? (state.answers[i].correct ? '정답' : '오답') : i === state.index ? '현재 문제' : '미응답'}">${state.answers[i] ? icon(state.answers[i].correct ? 'check' : 'close') : i+1}</span>`).join('')}</div><div class="round-stats"><div><span>맞힌 문제</span><strong>${correctSoFar}<small> / ${state.questions.length}</small></strong></div><div><span>남은 문제</span><strong>${state.questions.length-state.answers.length}</strong></div></div></section><div class="quiz-tip">${icon('book')}<strong>영어가 낯설어도 괜찮아요</strong><p>시간제한은 없어요.<br>천천히 읽고 생각해 보세요.</p></div>${state.review ? '<div class="review-note">복습 결과는 새 챌린지 기록에 추가되지 않습니다.</div>' : ''}</aside></div>`;
}
function result() {
  const scores = scoreAnswers(state.answers);
  const perfect = scores.correct === scores.total;
  return `${title(state.review ? 'REVIEW COMPLETE' : 'CHALLENGE COMPLETE', state.review ? '한 번 더, 내 지식으로.' : perfect ? '다섯 문제, 모두 정답!' : '오늘의 도전, 멋지게 완료!', perfect ? '모든 문제를 정확하게 풀었어요. 다음 난이도에도 도전해 보세요.' : '새롭게 알게 된 것까지, 모두 오늘의 수확이에요.')}
  <section class="result-banner"><div class="score-ring" style="--score:${scores.score}%"><div><strong>${scores.score}<small>점</small></strong><span>${state.review ? '복습 점수' : 'MY SCORE'}</span></div></div><div class="result-summary"><span class="result-label">${currentCategory().name} · ${DIFFICULTIES[state.difficulty]}${state.review ? ' · 오답 복습' : ''}</span><h2>${scores.total}문제 중 <em>${scores.correct}문제</em> 정답</h2><p>${perfect ? '완벽한 마무리예요. 이 기분, 다음 도전까지!' : `${scores.total-scores.correct}문제를 다시 보면 더 오래 기억할 수 있어요.`}</p>${!state.saved && !state.review ? '<p role="status">브라우저 저장을 사용할 수 없어 이번 기록은 현재 화면에만 표시됩니다.</p>' : ''}</div><div class="result-actions">${!perfect ? `<button class="primary light" data-action="review">${icon('reset')}오답 다시 풀기</button>` : ''}<button class="${perfect ? 'primary light' : 'outline-light'}" data-action="home">새 챌린지</button></div></section>
  <section class="result-list panel"><div class="section-heading"><h2>문제별 돌아보기</h2><span class="small-meta">내 답과 정답을 비교해 보세요</span></div>${state.questions.map((q,i) => `<details class="review-row" ${!state.answers[i].correct ? 'open' : ''}><summary><span class="review-index ${state.answers[i].correct ? 'good' : 'bad'}">${icon(state.answers[i].correct ? 'check' : 'close')}</span><span class="review-question" lang="en"><small>QUESTION ${String(i+1).padStart(2,'0')}</small>${esc(q.question)}</span><span class="review-label">${state.answers[i].correct ? '정답' : '오답'}</span>${icon('chevron')}</summary><div class="review-details"><div><span>내가 고른 답</span><strong lang="en">${esc(state.answers[i].text)}</strong></div><div><span>정답</span><strong class="correct-text" lang="en">${esc(q.correct)}</strong></div></div></details>`).join('')}</section>`;
}
function history() {
  const rows = state.history;
  const average = rows.length ? Math.round(rows.reduce((sum,r) => sum+r.score, 0)/rows.length) : '—';
  return `${title('YOUR LITTLE WINS', '차곡차곡, 나의 챌린지.', '최근 다섯 번의 도전을 돌아보세요. 기록은 이 브라우저에 저장됩니다. 저장이 제한되면 현재 창에서만 유지됩니다.')}
  <div class="history-stats"><section class="stat-card panel">${icon('flag')}<span>저장된 챌린지</span><strong>${rows.length}<small>회</small></strong></section><section class="stat-card panel">${icon('trophy')}<span>최근 최고 점수</span><strong>${rows.length ? Math.max(...rows.map(r=>r.score)) : '—'}<small>점</small></strong></section><section class="stat-card panel">${icon('chart')}<span>최근 평균 점수</span><strong>${average}<small>점</small></strong></section></div>
  <section class="history-panel panel"><div class="section-heading"><h2>최근 기록</h2>${rows.length ? '<button class="text-button" data-action="clear-history">기록 지우기</button>' : ''}</div>${rows.length ? historyRows() : `<div class="large-empty">${icon('book')}<h2>아직 비어 있는 나의 기록</h2><p>첫 챌린지를 완료하고 나만의 기록을 시작해 보세요.</p><button class="primary" data-action="home">챌린지 고르기</button></div>`}</section>`;
}
function dialog() {
  if (!state.dialog) return '';
  const quit = state.dialog !== 'clear';
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-heading"><span class="modal-icon">${icon(quit ? 'flag' : 'clock')}</span><h2 id="dialog-heading">${quit ? '챌린지를 그만할까요?' : '최근 기록을 지울까요?'}</h2><p>${quit ? '진행 중인 답안은 저장되지 않습니다.' : '이 브라우저에 저장된 최근 기록이 삭제됩니다.'}</p><div class="modal-actions"><button class="secondary" data-action="cancel-dialog">${quit ? '계속 풀기' : '취소'}</button><button class="primary" data-action="confirm-dialog">${quit ? '그만하기' : '기록 지우기'}</button></div></section></div>`;
}
function render(focus = false) {
  app.innerHTML = shell(({home, quiz, result, history}[state.view] || home)());
  if (state.dialog) app.querySelector('[data-action="cancel-dialog"]').focus();
  else if (focus) { document.querySelector('#main').focus({ preventScroll: true }); window.scrollTo({top:0, behavior:'instant'}); }
}
function navigate(view) {
  if (state.view === 'quiz') { state.dialogOpener = document.activeElement?.matches('.quit-button') ? '.quit-button' : document.activeElement?.matches('.nav-item') ? `.nav-item[data-action="${view}"]` : '.brand'; state.dialog = view; render(); return; }
  if (state.loading) { controller?.abort(); requestId++; state.loading = false; }
  state.error = ''; state.view = view; render(true);
}
async function start() {
  if (state.loading || remaining()) return;
  state.loading = true; state.error = ''; state.meta = null; if (state.mode !== 'mock') state.cooldownUntil = Date.now()+5500;
  const id = ++requestId;
  controller?.abort(); const requestController = new AbortController(); controller = requestController;
  const timeout = setTimeout(() => requestController.abort(), state.mode === 'proxy' ? 45000 : 16000);
  render();
  try {
    const response = await getQuizQuestions({ mode: state.mode, category: state.category, difficulty: state.difficulty, signal: requestController.signal });
    if (id !== requestId) return;
    state.questions = response.questions; state.meta = response.meta;
    state.answers = []; state.index = 0; state.selected = null; state.submitted = false;
    state.review = false; state.reviewOriginal = null; state.saved = true; state.roundId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    state.startedAt = Date.now(); state.view = 'quiz';
  } catch(error) {
    if (id !== requestId) return;
    state.meta = error.meta || { source: state.mode, layer: 'connection' };
    if (error.message === 'RATE') state.cooldownUntil = Date.now()+6000;
    state.error = ({
      DIFY_NOT_CONFIGURED:'Dify 앱 키가 아직 서버에 설정되지 않았습니다. 설정을 완료한 뒤 서버를 다시 실행해 주세요.',
      DIFY_CONFIGURATION:'서버의 DIFY_API_BASE_URL 설정을 확인해 주세요.',
      DIFY_AUTH:'Dify 앱 키가 유효하지 않거나 접근 권한이 없습니다. 서버 설정을 확인해 주세요.',
      DIFY_NOT_PUBLISHED:'Dify 워크플로의 게시 여부와 API 주소를 확인해 주세요.',
      DIFY_WORKFLOW:'Dify 워크플로 실행에 실패했습니다. Dify 실행 기록에서 실패한 노드를 확인해 주세요.',
      DIFY_HTTP:'Dify가 요청을 처리하지 못했습니다. 앱 종류와 입력 변수를 확인해 주세요.',
      DIFY_NETWORK:'서버에서 Dify에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.',
      DIFY_TIMEOUT:'Dify 응답 시간이 길어 요청을 종료했습니다. 잠시 후 다시 시도해 주세요.',
      UPSTREAM_HTTP:'Dify는 실행됐지만 퀴즈 API가 정상 응답을 주지 않았습니다. 잠시 후 다시 시도해 주세요.',
      PROXY_UNAVAILABLE:'온라인 Proxy 서버에 연결할 수 없습니다. 인터넷 연결과 서버 접근 상태를 확인해 주세요.',
      PROXY_NOT_DEPLOYED:'온라인 백엔드 주소가 아직 설정되지 않았습니다. 연결된 최종 HTML 파일이 필요합니다.',
      LOCAL_SERVER_REQUIRED:'Proxy는 HTML 파일을 직접 열면 사용할 수 없습니다. start.cmd를 실행해 주세요.',
      RATE:'요청이 잠시 몰렸어요. 잠깐 기다린 뒤 다시 시작해 주세요. 같은 네트워크의 요청도 함께 계산됩니다.',
      EMPTY:'선택한 조건에 맞는 문제가 5개보다 적어요. 다른 분야나 난이도를 선택해 주세요.',
      PARAMETER:'선택 조건을 전달하지 못했어요. 분야와 난이도를 다시 선택해 주세요.',
      INVALID_DATA:'문제 데이터를 정상적으로 읽지 못했어요. 잠시 후 다시 시도해 주세요.',
      SESSION:'퀴즈 연결이 만료되었어요. 다시 시작해 주세요.'
    })[error.message] || (error.name === 'AbortError' ? '응답이 오래 걸리고 있어요. 연결 상태를 확인하고 다시 시도해 주세요.' : '문제를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
  } finally {
    clearTimeout(timeout);
    if (id === requestId) { state.loading = false; render(true); }
  }
}
function submit() {
  if (state.view !== 'quiz' || state.submitted || !state.selected) return;
  const answer = state.questions[state.index].answers.find(a=>a.id===state.selected);
  if (!answer) return;
  state.submitted = true;
  state.answers[state.index] = { ...answer };
  render(); app.querySelector('[data-action="next"]').focus({ preventScroll:true });
}
function next() {
  if (state.view !== 'quiz' || !state.submitted) return;
  if (state.index < state.questions.length-1) {
    state.index++; state.selected = null; state.submitted = false; render(true); return;
  }
  if (!state.review && state.mode !== 'mock') {
    const scores = scoreAnswers(state.answers);
    const record = { id:state.roundId,date:new Date().toISOString(),category:state.category,difficulty:state.difficulty,mode:state.mode,...scores };
    state.saved = saveResult(storage,record);
    if (!state.saved) state.storageVolatile = true;
    state.history = state.saved ? readHistory(storage) : [record,...state.history.filter(r=>r.id!==record.id)].slice(0,5);
  }
  state.view = 'result'; render(true);
}
function review() {
  if (state.view !== 'result') return;
  const missed = state.questions.filter((_,i)=>!state.answers[i].correct);
  if (!missed.length) return;
  state.questions = missed; state.answers = []; state.review = true; state.index = 0;
  state.selected = null; state.submitted = false; state.view = 'quiz'; render(true);
}
function closeDialog() {
  const opener = state.dialogOpener;
  state.dialog = ''; state.historyError = ''; render();
  (app.querySelector(opener || '#main') || document.querySelector('#main')).focus({ preventScroll: true });
}
app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.mode && state.view === 'home' && !state.loading && button.dataset.mode !== state.mode) {
    if (button.dataset.mode === 'mock') { state.liveFilters = { category: state.category, difficulty: state.difficulty }; state.category = '18'; state.difficulty = 'easy'; }
    else if (state.mode === 'mock' && state.liveFilters) Object.assign(state, state.liveFilters);
    state.mode = button.dataset.mode; state.error = ''; state.meta = null; render();
    app.querySelector(`[data-mode="${state.mode}"]`).focus({preventScroll:true});
  }
  if (button.dataset.category !== undefined && state.mode !== 'mock' && !state.loading) { state.category = button.dataset.category; state.error=''; render(); app.querySelector(`[data-category="${state.category}"]`).focus({preventScroll:true}); }
  if (button.dataset.difficulty && state.mode !== 'mock' && !state.loading) { state.difficulty = button.dataset.difficulty; state.error=''; render(); app.querySelector(`[data-difficulty="${state.difficulty}"]`).focus({preventScroll:true}); }
  if (button.dataset.answer && state.view === 'quiz' && !state.submitted) { state.selected = button.dataset.answer; render(); app.querySelector(`[data-answer="${state.selected}"]`).focus({preventScroll:true}); }
  const action = button.dataset.action;
  if (action === 'home' || action === 'history') navigate(action);
  if (action === 'start') start();
  if (action === 'submit') submit();
  if (action === 'next') next();
  if (action === 'review') review();
  if (action === 'check-connection') checkConnection();
  if (action === 'clear-history') { state.dialogOpener = '[data-action="clear-history"]'; state.dialog='clear'; render(); }
  if (action === 'cancel-dialog') closeDialog();
  if (action === 'confirm-dialog') {
    if (state.dialog === 'clear') {
      try { storage.removeItem(STORAGE_KEY); state.history = readHistory(storage); }
      catch { state.history = []; state.storageVolatile = true; }
    }
    else { state.view = state.dialog; state.questions=[]; state.answers=[]; }
    state.dialog=''; render(true);
  }
});
document.addEventListener('keydown', event => {
  if (!state.dialog) return;
  if (event.key === 'Escape') { closeDialog(); return; }
  if (event.key === 'Tab') {
    const buttons = [...app.querySelectorAll('.modal button')];
    if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
  }
});
window.addEventListener('beforeunload', event => { if (state.view === 'quiz') { event.preventDefault(); event.returnValue=''; } });
setInterval(() => {
  const button = document.querySelector('#start-button');
  if (!button || state.loading) return;
  const seconds = remaining(); button.disabled = seconds > 0;
  button.innerHTML = `${icon('play')}<span>${seconds ? `${seconds}초 후 시작할 수 있어요` : '5문제 챌린지 시작'}</span>`;
}, 500);
render();

async function checkConnection() {
  state.connectionError = '';
  try {
    const response = await fetch(proxyEndpoint('/api/health'), { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(8000) });
    const info = response.ok ? await response.json() : null;
    if (typeof info?.proxyConfigured !== 'boolean') throw Error('UNAVAILABLE');
    state.proxyConfigured = info.proxyConfigured;
  } catch (error) {
    state.proxyConfigured = null;
    state.connectionError = error.message === 'PROXY_NOT_DEPLOYED' ? '온라인 백엔드 주소 설정 대기 중입니다.' : '온라인 서버에 연결할 수 없습니다. 인터넷 연결과 서버 접근 상태를 확인해 주세요.';
  }
  if (state.view === 'home' && !state.loading && state.mode === 'proxy') render();
}
checkConnection();
