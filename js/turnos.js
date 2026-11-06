// =====================================================================
//  TURNOS
//  Ajuste os horários aqui se mudarem (formato "HH:MM").
//  "inicio" = primeiro minuto do turno; "fim" = último minuto do turno.
//  Um turno que passa da meia-noite (ex.: 22:51 às 06:34) pertence ao dia em
//  que COMEÇOU: um checklist feito às 02h de terça conta como Turno 3 de segunda.
// =====================================================================
const HORARIOS = {
  '1': { inicio: '06:35', fim: '14:45' },
  '2': { inicio: '14:46', fim: '22:50' },
  '3': { inicio: '22:51', fim: '06:34' }
};

const minutos = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

export const TURNOS = Object.fromEntries(Object.entries(HORARIOS).map(([id, t]) => [id, {
  ...t, ini: minutos(t.inicio), fimMin: minutos(t.fim), rotulo: `${t.inicio} às ${t.fim}`
}]));
export const LISTA_TURNOS = Object.keys(TURNOS);

const z = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
export const deIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const somaDias = (s, n) => { const d = deIso(s); d.setDate(d.getDate() + n); return iso(d); };

/** Retorna { turno, dataTurno } para um instante. */
export function turnoDe(d = new Date()) {
  const agora = d.getHours() * 60 + d.getMinutes();
  for (const [id, t] of Object.entries(TURNOS)) {
    if (t.ini <= t.fimMin) {
      if (agora >= t.ini && agora <= t.fimMin) return { turno: id, dataTurno: iso(d) };
    } else {
      if (agora >= t.ini) return { turno: id, dataTurno: iso(d) };
      if (agora <= t.fimMin) { const p = new Date(d); p.setDate(p.getDate() - 1); return { turno: id, dataTurno: iso(p) }; }
    }
  }
  return { turno: LISTA_TURNOS[0], dataTurno: iso(d) };
}

/** Data/hora de início de um turno. */
export function inicioTurno(dataTurno, turno) {
  const d = deIso(dataTurno); d.setMinutes(TURNOS[turno].ini); return d;
}
/** Data/hora em que o turno termina (logo após o último minuto). */
export function fimTurno(dataTurno, turno) {
  const t = TURNOS[turno]; const d = deIso(dataTurno);
  if (t.fimMin < t.ini) d.setDate(d.getDate() + 1);
  d.setMinutes(t.fimMin + 1); return d;
}
