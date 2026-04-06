export function rawToStatusScore(s=''){
  const t = String(s||'').toLowerCase();
  if (t.includes('out')) return 0;
  if (t.includes('doubt')) return 10;
  if (t.includes('question')) return 50;
  if (t.includes('probable')) return 90;
  return 100;
}
