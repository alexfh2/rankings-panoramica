import * as XLSX from 'xlsx';
import { parsePairExcelResults } from '../lib/parsePairExcelResults';
for (const f of process.argv.slice(2)) {
  const wb = XLSX.read(require('fs').readFileSync(f));
  const r = parsePairExcelResults(wb);
  const bad = r.pairs.filter(p => [p.player1.name, p.player2.name].filter(Boolean).length !== 2);
  console.log('==', f);
  console.log(' pairs', r.summary.totalPairs, 'valid', r.summary.validPairs, 'players', r.summary.totalPlayers);
  console.log(' bloques!=2:', bad.length);
  console.log(' blocking errors:', r.errors.filter(e=>e.blocking).map(e=>e.code+':'+e.row).join(', ') || 'none');
  console.log(' positions:', r.pairs.map(p=>p.position).join(','));
  console.log(' inferred:', r.pairs.filter(p=>p.warnings.some(w=>w.code==='POSITION_INFERRED_FROM_TIE')).length);
  console.log(' missing hpu warnings:', r.warnings.filter(w=>w.code==='MALFORMED_PLAYING_HANDICAP').length, 'null hpu:', r.pairs.filter(p=>p.player2.playingHandicap===null).length);
}
