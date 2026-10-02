import { normalizeQuestions } from '../dist/core.js';

export class GatewayError extends Error {
  constructor(code, status = 502, meta = {}) { super(code); this.code = code; this.status = status; this.meta = meta; }
}
const fail = (code, status, meta) => { throw new GatewayError(code, status, meta); };
export function validateFilters(params) {
  const category = params.get('category') || '';
  const difficulty = params.get('difficulty') || 'easy';
  if (![...params.keys()].every(k => ['category', 'difficulty'].includes(k)) ||
      params.getAll('category').length > 1 || params.getAll('difficulty').length > 1 ||
      !['', '9', '18', '11', '15', '21'].includes(category) || !['easy', 'medium', 'hard'].includes(difficulty)) fail('PARAMETER', 400, { layer: 'gateway' });
  return { category: category || 'any', difficulty };
}
export function parseWorkflow(body, meta = {}) {
  const data = body?.data;
  meta = { ...meta, difyStatus: data?.status || 'unknown', layer: 'workflow' };
  if (data?.status !== 'succeeded') fail('DIFY_WORKFLOW', 502, meta);
  const outputs = data.outputs;
  meta = { ...meta, upstreamHttpStatus: outputs?.upstream_http_status, layer: 'opentdb' };
  if (meta.upstreamHttpStatus === 429) fail('RATE', 429, meta);
  if (meta.upstreamHttpStatus !== 200) fail('UPSTREAM_HTTP', 502, meta);
  let quiz;
  try { quiz = JSON.parse(outputs.result); } catch { fail('INVALID_DATA', 502, meta); }
  meta.responseCode = quiz?.response_code;
  if (quiz?.response_code !== 0) {
    const code = ({ 1: 'EMPTY', 2: 'PARAMETER', 3: 'SESSION', 4: 'EMPTY', 5: 'RATE' })[quiz?.response_code] || 'INVALID_DATA';
    fail(code, code === 'RATE' ? 429 : 502, meta);
  }
  try { normalizeQuestions(quiz.results); } catch { fail('INVALID_DATA', 502, meta); }
  // Return only the quiz contract, never raw workflow logs, inputs, headers or errors.
  const results = quiz.results.map(q => ({ type: q.type, difficulty: q.difficulty, category: q.category, question: q.question, correct_answer: q.correct_answer, incorrect_answers: q.incorrect_answers }));
  return { quiz: { response_code: 0, results }, meta: { ...meta, count: 5 } };
}

export function createDifyGateway({ env = process.env, fetchImpl = fetch, now = Date.now } = {}) {
  let nextCallAt = 0;
  const configured = () => Boolean(env.DIFY_API_KEY?.trim());
  async function run(params) {
    const inputs = validateFilters(params);
    if (!configured()) fail('DIFY_NOT_CONFIGURED', 503, { source: 'proxy', layer: 'configuration' });
    let base;
    try { base = new URL(env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1'); } catch { fail('DIFY_CONFIGURATION', 503); }
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) fail('DIFY_CONFIGURATION', 503);
    if (now() < nextCallAt) fail('RATE', 429, { source: 'proxy', layer: 'gateway' });
    nextCallAt = now() + 5500;
    const begin = now();
    const meta = { source: 'proxy', layer: 'dify' };
    let response;
    try {
      response = await fetchImpl(`${base.href.replace(/\/$/, '')}/workflows/run`, {
        // Workers supports manual redirects; all 3xx responses are rejected below.
        method: 'POST', redirect: 'manual',
        headers: { Authorization: `Bearer ${env.DIFY_API_KEY.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, response_mode: 'blocking', user: 'oquiz-local-user' }),
        signal: AbortSignal.timeout(40000)
      });
      meta.difyHttpStatus = response.status;
      if (response.status === 401 || response.status === 403) fail('DIFY_AUTH', 502, meta);
      if (response.status === 404) fail('DIFY_NOT_PUBLISHED', 502, meta);
      if (response.status === 429) fail('RATE', 429, meta);
      if (!response.ok) fail('DIFY_HTTP', 502, meta);
      let body;
      try { body = await response.json(); } catch { fail('INVALID_DATA', 502, meta); }
      const result = parseWorkflow(body, meta);
      return { ...result, meta: { ...result.meta, elapsedMs: now() - begin } };
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      // Server-only diagnostics; keep credentials and provider details out of API responses.
      console.error('Dify transport failure', error.name, String(error.message || '').replaceAll(env.DIFY_API_KEY.trim(), '[REDACTED]').slice(0, 300));
      fail(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'DIFY_TIMEOUT' : 'DIFY_NETWORK', 502, meta);
    }
  }
  return { configured, run };
}
