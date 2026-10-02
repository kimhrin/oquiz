export const CATEGORIES = [
  { id: '', name: '전체 분야', en: 'A little bit of everything', icon: 'grid', color: 'violet' },
  { id: '9', name: '일반상식', en: 'Everyday discoveries', icon: 'bulb', color: 'amber' },
  { id: '18', name: '컴퓨터', en: 'Think like a developer', icon: 'code', color: 'blue' },
  { id: '11', name: '영화', en: 'Lights, camera, quiz', icon: 'film', color: 'rose' },
  { id: '15', name: '게임', en: 'Ready for the next level?', icon: 'game', color: 'green' },
  { id: '21', name: '스포츠', en: 'Put your knowledge in play', icon: 'ball', color: 'orange' }
];
export const DIFFICULTIES = { easy: '쉬움', medium: '보통', hard: '어려움' };
export const STORAGE_KEY = 'oquiz.history.v1';
export function shuffle(items, random = Math.random) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
export function normalizeQuestions(rows, random = Math.random) {
  if (!Array.isArray(rows) || rows.length !== 5) throw new Error('INVALID_DATA');
  const decode = (value) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error('INVALID_DATA');
    return decodeURIComponent(value);
  };
  const questions = rows.map((row, i) => {
    if (row.type !== 'multiple' || !Array.isArray(row.incorrect_answers) || row.incorrect_answers.length !== 3) throw new Error('INVALID_DATA');
    const correct = decode(row.correct_answer);
    const wrong = row.incorrect_answers.map(decode);
    if (new Set([correct, ...wrong]).size !== 4) throw new Error('INVALID_DATA');
    return {
      id: `q${i}`, question: decode(row.question), category: decode(row.category),
      difficulty: row.difficulty, correct,
      answers: shuffle([correct, ...wrong].map((text, j) => ({ id: `q${i}-a${j}`, text, correct: j === 0 })), random)
    };
  });
  if (new Set(questions.map(q => q.question)).size !== 5) throw new Error('INVALID_DATA');
  return questions;
}
export function scoreAnswers(answers) {
  const correct = answers.filter(a => a?.correct).length;
  return { correct, total: answers.length, score: answers.length ? Math.round(correct / answers.length * 100) : 0 };
}
export function readHistory(storage) {
  try {
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(row => row && typeof row.id === 'string' && typeof row.category === 'string' &&
      typeof row.date === 'string' && Number.isFinite(Date.parse(row.date)) &&
      Number.isInteger(row.correct) && row.correct >= 0 && row.correct <= 5 && row.total === 5 &&
      row.score === row.correct * 20 && Object.hasOwn(DIFFICULTIES, row.difficulty)).slice(0, 5);
  } catch { return []; }
}
export function saveResult(storage, record) {
  try {
    const history = readHistory(storage);
    if (!history.some(row => row.id === record.id)) storage.setItem(STORAGE_KEY, JSON.stringify([record, ...history].slice(0, 5)));
    return true;
  } catch { return false; }
}
