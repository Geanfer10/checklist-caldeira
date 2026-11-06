// =====================================================================
//  TURNOS
//  Ajuste os horários aqui se mudarem. "inicio" e "fim" são horas cheias.
//  Um turno que passa da meia-noite (ex.: 22h às 06h) pertence ao dia em
//  que COMEÇOU: um checklist feito às 02h de terça conta como Turno 3 de segunda.
// =====================================================================
export const TURNOS = {
  '1': { inicio: 6,  fim: 14, rotulo: '06h às 14h' },
  '2': { inicio: 14, fim: 22, rotulo: '14h às 22h' },
  '3': { inicio: 22, fim: 6,  rotulo: '22h às 06h' }
};
export const LISTA_TURNOS = Object.keys(TURNOS);

const z = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
export const deIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const somaDias = (s, n) => { const d = deIso(s); d.setDate(d.getDate() + n); return iso(d); };

/** Retorna { turno, dataTurno } para um instante. */
export function turnoDe(d = new Date()) {
  const h = d.getHours();
  for (const [id, t] of Object.entries(TURNOS)) {
    if (t.inicio < t.fim) {
      if (h >= t.inicio && h < t.fim) return { turno: id, dataTurno: iso(d) };
    } else {
      if (h >= t.inicio) return { turno: id, dataTurno: iso(d) };
      if (h < t.fim) { const p = new Date(d); p.setDate(p.getDate() - 1); return { turno: id, dataTurno: iso(p) }; }
    }
  }
  return { turno: LISTA_TURNOS[0], dataTurno: iso(d) };
}

/** Data/hora de início de um turno. */
export function inicioTurno(dataTurno, turno) {
  const d = deIso(dataTurno); d.setHours(TURNOS[turno].inicio, 0, 0, 0); return d;
}
/** Data/hora de fim de um turno. */
export function fimTurno(dataTurno, turno) {
  const t = TURNOS[turno]; const d = deIso(dataTurno);
  if (t.fim <= t.inicio) d.setDate(d.getDate() + 1);
  d.setHours(t.fim, 0, 0, 0); return d;
}
