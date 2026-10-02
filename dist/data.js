import { normalizeQuestions } from './core.js';
import { proxyEndpoint } from './config.js';

export const MODES = {
  mock: { label: 'Mock', title: '연습 데이터', note: '직접 만든 컴퓨터 기초 5문제로 연습합니다. 인터넷 연결이 필요 없으며 기록에 저장하지 않습니다.' },
  direct: { label: 'Direct', title: 'API 직접 연결', note: '브라우저가 Open Trivia DB에 GET 요청을 보내 새로운 문제 5개를 받습니다.' },
  proxy: { label: 'Proxy', title: 'Dify 백엔드', note: '서버가 Dify 워크플로를 실행하여 문제를 가져옵니다. Dify 앱 키는 서버에만 보관합니다.' }
};

// Original practice questions. No request to an external API in Mock mode.
export const MOCK_DATA = { response_code: 0, results: [
  ['What does CPU stand for?', 'Central Processing Unit', ['Computer Personal Unit', 'Central Program Utility', 'Control Processing User']],
  ['Which language adds interactivity to web pages?', 'JavaScript', ['HTML', 'CSS', 'SQL']],
  ['Which symbol means less than?', '<', ['>', '=', '+']],
  ['How is the decimal number two written in binary?', '10', ['01', '11', '00']],
  ['Which component keeps files when power is turned off?', 'SSD', ['RAM', 'CPU register', 'Cache memory']]
].map(([question, correct, incorrect]) => ({
  type: 'multiple', difficulty: 'easy', category: encodeURIComponent('Computer basics · Practice'),
  question: encodeURIComponent(question), correct_answer: encodeURIComponent(correct),
  incorrect_answers: incorrect.map(encodeURIComponent)
})) };

export async function getQuizQuestions({ mode, category, difficulty, signal, fetchImpl = fetch }) {
  const begin = performance.now();
  let data, meta;
  if (mode === 'mock') {
    data = MOCK_DATA;
    meta = { source: 'mock', responseCode: 0, layer: 'local' };
  } else {
    const query = new URLSearchParams({ difficulty });
    if (category) query.set('category', category);
    let url;
    if (mode === 'direct') {
      query.set('amount', '5'); query.set('type', 'multiple'); query.set('encode', 'url3986');
      url = `https://opentdb.com/api.php?${query}`;
    } else if (mode === 'proxy') url = proxyEndpoint(`/api/quiz?${query}`);
    else throw Error('PARAMETER');
    const response = await fetchImpl(url, { signal, credentials: 'omit', cache: 'no-store' });
    if (response.status === 429 && mode === 'direct') throw Object.assign(Error('RATE'), { meta: { source: mode, upstreamHttpStatus: 429, layer: 'opentdb' } });
    let body;
    try { body = await response.json(); } catch { throw Error(mode === 'proxy' ? 'PROXY_UNAVAILABLE' : 'INVALID_DATA'); }
    meta = mode === 'proxy' ? body.meta : { source: mode, upstreamHttpStatus: response.status };
    if (!response.ok) throw Object.assign(Error(mode === 'proxy' ? body.error?.code || 'PROXY_UNAVAILABLE' : 'NETWORK'), { meta });
    data = mode === 'proxy' ? body.quiz : body;
  }
  if (data?.response_code !== 0) throw Object.assign(Error(({ 1: 'EMPTY', 2: 'PARAMETER', 3: 'SESSION', 4: 'EMPTY', 5: 'RATE' })[data?.response_code] || 'INVALID_DATA'), { meta: { ...meta, responseCode: data?.response_code } });
  let questions;
  try { questions = normalizeQuestions(data.results); }
  catch { throw Object.assign(Error('INVALID_DATA'), { meta }); }
  return { questions, meta: { ...meta, source: mode, responseCode: 0, count: questions.length, elapsedMs: Math.round(performance.now() - begin) } };
}
