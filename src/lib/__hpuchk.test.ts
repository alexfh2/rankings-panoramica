import { describe, it } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { parsePairExcelResults } from '@/lib/parsePairExcelResults';

for (const f of ['OMP_25_ABRIL.xlsx','OMP_12_JULIO.xlsx']) {
  describe(f, () => {
    it('hpu', () => {
      const wb = XLSX.read(readFileSync('/tmp/user-uploads/'+f), { type: 'buffer' });
      const r = parsePairExcelResults(wb);
      console.log(f, 'pairs', r.summary.totalPairs, 'players', r.summary.totalPlayers, 'blocking', r.errors.filter(e=>e.blocking).length);
      r.pairs.forEach((p,i)=>console.log(i+1, p.player1.name, p.player1.playingHandicap, '||', p.player2.name, p.player2.playingHandicap));
    });
  });
}
