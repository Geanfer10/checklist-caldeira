// =====================================================================
//  PAINEL DO SUPERVISOR (computador)
// =====================================================================
import {
  configurado, db, auth, collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp,
  query, where, onSnapshot, Timestamp, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from './firebase.js?v=20261106b';
import { CHECKLIST, itensAvaliados, rotinas } from './checklist-838t.js?v=20261106b';
import { TURNOS, LISTA_TURNOS, iso, deIso, somaDias, inicioTurno, fimTurno } from './turnos.js?v=20261106b';

const EQ = CHECKLIST.equipamento;
const DAY = 86400000;
const $r = document.getElementById('raiz'), $g = document.getElementById('gaveta');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hm = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dm = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const dmy = s => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const cor = s => s === 'ok' ? '#1E6B3C' : s === 'a' ? '#F5B800' : s === 'c' ? '#B3261E' : '#FFFFFF';
const corTxt = s => (s === 'a' || !s) ? '#1A1F1C' : '#FFFFFF';
const LBL = { ok: 'OK', a: 'Atenção', c: 'Crítico' };
const pillSt = r => r.contagem?.c ? ['p-c', 'BLOQUEADA'] : r.contagem?.a ? ['p-a', 'ATENÇÃO'] : ['p-ok', 'OK'];
const ico = {
  dl: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  x: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
};

let USER = null, PERFIL = null, NOME = '', ERRO = '', TELA = 'carregando';
let INS = new Map(), NC = new Map(), NC_ABERTAS = new Map(), COL = new Map();
let DIA_CACHE = {}, FOTOS = {}, MONDAY = null, MONDAY_ENVIANDO = new Set();
let D = { periodo: 14, aba: 'painel', tab: 'abertas', osEdit: null, osVal: '', det: null, dia: iso(new Date()), msg: '' };
let unsubs = [], unsubPeriodo = [];

const hoje = () => iso(new Date());
const inicioPeriodo = () => somaDias(hoje(), -(D.periodo - 1));
const quando = r => r.criadoEm?.toDate ? r.criadoEm.toDate() : new Date(r.horaTablet || Date.now());
const lerDoc = d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) });

// ---------------------------------------------------------------- dados
function assinarPeriodo() {
  unsubPeriodo.forEach(u => u()); unsubPeriodo = [];
  const ini = inicioPeriodo();
  unsubPeriodo.push(onSnapshot(query(collection(db, 'inspecoes'), where('dataTurno', '>=', ini)), s => {
    INS = new Map(); s.forEach(d => INS.set(d.id, lerDoc(d))); render();
  }, erro));
  unsubPeriodo.push(onSnapshot(query(collection(db, 'naoConformidades'), where('criadoEm', '>=', Timestamp.fromDate(deIso(ini)))), s => {
    NC = new Map(); s.forEach(d => NC.set(d.id, lerDoc(d))); render();
  }, erro));
}
function assinarFixos() {
  unsubs.push(onSnapshot(query(collection(db, 'naoConformidades'), where('status', 'in', ['aberta', 'os'])), s => {
    NC_ABERTAS = new Map(); s.forEach(d => NC_ABERTAS.set(d.id, lerDoc(d))); render();
  }, erro));
  unsubs.push(onSnapshot(doc(db, 'config', 'monday'), s => { MONDAY = s.exists() ? s.data() : null; render(); }, () => { MONDAY = null; }));
  unsubs.push(onSnapshot(collection(db, 'colaboradores'), s => {
    COL = new Map(); s.forEach(d => COL.set(d.id, d.data())); if (D.aba === 'colaboradores') render();
  }, erro));
}
function erro(e) { console.error(e); D.msg = 'Erro ao ler dados: ' + (e.code || e.message); render(); }
function todasNC() { const m = new Map(NC); NC_ABERTAS.forEach((v, k) => m.set(k, v)); return [...m.values()]; }
function inspecoesOrdenadas() { return [...INS.values()].sort((a, b) => quando(b) - quando(a)); }
async function inspecoesDoDia(dia) {
  if (dia >= inicioPeriodo()) return [...INS.values()].filter(r => r.dataTurno === dia);
  if (!DIA_CACHE[dia]) {
    DIA_CACHE[dia] = 'carregando';
    const s = await getDocs(query(collection(db, 'inspecoes'), where('dataTurno', '==', dia)));
    DIA_CACHE[dia] = []; s.forEach(d => DIA_CACHE[dia].push(lerDoc(d))); render();
  }
  return Array.isArray(DIA_CACHE[dia]) ? DIA_CACHE[dia] : [];
}
function acharInspecao(id) {
  if (INS.has(id)) return INS.get(id);
  for (const l of Object.values(DIA_CACHE)) if (Array.isArray(l)) { const r = l.find(x => x.id === id); if (r) return r; }
  return null;
}

// ---------------------------------------------------------------- telas
function tLogin() {
  return `<form class="login" id="f-login"><h1>Painel de inspeções</h1><span style="color:var(--mut)">${esc(CHECKLIST.nome)} · acesso de supervisores</span>
  <label for="em">E-mail</label><input id="em" type="email" autocomplete="username" required>
  <label for="pw">Senha</label><input id="pw" type="password" autocomplete="current-password" required>
  ${ERRO ? `<span class="err">${esc(ERRO)}</span>` : ''}<button class="btn" type="submit">ENTRAR</button></form>`;
}
function tSemAcesso() {
  return `<div class="login"><h1>Sem acesso ao painel</h1><span>A conta <b>${esc(USER?.email)}</b> não tem perfil de supervisor. Peça ao administrador para liberar.</span><button class="btn" data-act="sair">Sair</button></div>`;
}
function cabecalho() {
  return `<div class="dhead"><div class="ttl"><small>GOIÁS VERDE · PCM LUZIÂNIA</small><span>Painel de inspeções · ${esc(CHECKLIST.nome)}</span></div>
  <div class="dctl">
   <button class="dbtn ${D.aba === 'painel' ? 'on' : ''}" data-act="aba" data-to="painel">Painel</button>
   <button class="dbtn ${D.aba === 'colaboradores' ? 'on' : ''}" data-act="aba" data-to="colaboradores">Configurações</button>
   ${D.aba === 'painel' ? `<label for="per">Período</label><select id="per" data-in="periodo">${[7, 14, 30, 60, 90].map(n => `<option value="${n}" ${D.periodo === n ? 'selected' : ''}>Últimos ${n} dias</option>`).join('')}</select>
   <button class="dbtn" data-act="excel">${ico.dl}Exportar Excel</button>` : ''}
   <span class="quem">${esc(NOME || USER.email)}</span><button class="dbtn" data-act="sair">Sair</button></div></div>
  ${D.msg ? `<div class="aviso" style="background:var(--bl);color:#1F3A5F">${esc(D.msg)}</div>` : ''}`;
}
function turnosNoPeriodo() {
  const agora = new Date(), lista = [];
  for (let i = D.periodo - 1; i >= 0; i--) { const dia = somaDias(hoje(), -i); LISTA_TURNOS.forEach(t => { if (inicioTurno(dia, t) <= agora) lista.push({ dia, t }); }); }
  return lista;
}
function tPainel() {
  const recs = inspecoesOrdenadas();
  const ncs = todasNC();
  const abertas = ncs.filter(n => n.status !== 'resolvida');
  const ncPer = ncs.filter(n => n.dataTurno >= inicioPeriodo());
  const crit = ncPer.filter(n => n.gravidade === 'c').length;
  const tp = turnosNoPeriodo(); const feitosSet = new Set(recs.map(r => r.dataTurno + '|' + r.turno));
  const feitos = tp.filter(x => feitosSet.has(x.dia + '|' + x.t)).length;
  const vent = recs.length ? Math.round(recs.filter(r => r.rotinas?.ventoinha).length / recs.length * 100) : 0;
  const ult = recs[0];
  const bloqueada = abertas.some(n => n.gravidade === 'c');
  const st = bloqueada ? ['p-c', 'BLOQUEADA'] : abertas.length ? ['p-a', 'COM PENDÊNCIAS'] : ['p-ok', 'OK'];
  const pneusAgora = { DE: 'ok', DD: 'ok', TE: 'ok', TD: 'ok' };
  abertas.forEach(n => { const m = /^pneu_(DE|DD|TE|TD)$/.exec(n.item || ''); if (m && (n.gravidade === 'c' || pneusAgora[m[1]] !== 'c')) pneusAgora[m[1]] = n.gravidade; });

  // gráfico por turno
  const dias = []; for (let i = D.periodo - 1; i >= 0; i--) dias.push(somaDias(hoje(), -i));
  const cw = Math.max(8, Math.min(34, Math.floor(900 / dias.length) - 4)), gap = cw > 14 ? 5 : 2;
  const passo = Math.ceil(dias.length / 15);
  const agora = new Date();
  const barras = dias.map((dia, i) => {
    const x = 36 + i * (cw + gap);
    return LISTA_TURNOS.map((t, j) => {
      const y = 10 + (LISTA_TURNOS.length - 1 - j) * 54, h = 46;
      const r = recs.find(r => r.dataTurno === dia && r.turno === t);
      if (!r) {
        if (inicioTurno(dia, t) > agora) return '';
        return `<rect x="${x}" y="${y}" width="${cw}" height="${h}" rx="3" fill="#fff" stroke="#9AA39D" stroke-dasharray="3 2"><title>${dmy(dia)} turno ${t}: sem checklist</title></rect>`;
      }
      const [, lab] = pillSt(r);
      return `<rect x="${x}" y="${y}" width="${cw}" height="${h}" rx="3" fill="${r.contagem?.c ? '#B3261E' : r.contagem?.a ? '#F5B800' : '#1E6B3C'}" class="bar-click" data-act="det" data-id="${r.id}"><title>${dmy(dia)} turno ${t}: ${lab} · ${esc(r.operador?.nome)}</title></rect>`;
    }).join('') + (i % passo === 0 ? `<text x="${x + cw / 2}" y="182" text-anchor="middle" font-size="11" fill="#5B6660">${dia.slice(8)}/${dia.slice(5, 7)}</text>` : '');
  }).join('');
  const largura = 36 + dias.length * (cw + gap);
  const rotulosT = LISTA_TURNOS.map((t, j) => `<text x="0" y="${10 + (LISTA_TURNOS.length - 1 - j) * 54 + 27}" font-size="12" font-weight="700" fill="#3F4A44">T${t}</text>`).join('');

  // itens que mais falham
  const cnt = {}; ncPer.forEach(n => { cnt[n.rotulo] = (cnt[n.rotulo] || 0) + 1; });
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8); const mx = top[0]?.[1] || 1;

  // não conformidades
  const filtros = { abertas: n => n.status === 'aberta', os: n => n.status === 'os', resolvidas: n => n.status === 'resolvida' && n.dataTurno >= inicioPeriodo(), todas: n => n.status !== 'resolvida' || n.dataTurno >= inicioPeriodo() };
  const lista = ncs.filter(filtros[D.tab]).sort((a, b) => (b.gravidade === 'c') - (a.gravidade === 'c') || quando(b) - quando(a)).slice(0, 80);
  const qt = k => ncs.filter(filtros[k]).length;
  const linhaNC = n => `<tr><td style="white-space:nowrap">${dm(quando(n))} ${hm(quando(n))}<br><span style="color:var(--mut);font-size:12px">Turno ${esc(n.turno)}</span></td>
   <td><span class="pill ${n.gravidade === 'c' ? 'p-c' : 'p-a'}">${n.gravidade === 'c' ? 'CRÍTICO' : 'ATENÇÃO'}</span></td>
   <td><b>${esc(n.rotulo)}</b><br><span style="color:var(--mut)">${esc(n.descricao)}</span>${n.fotoId ? ` · <button class="sbtn" data-act="det" data-id="${n.inspecaoId}">ver foto</button>` : ''}
   <br>${n.mondayUrl ? `<a class="sbtn" style="display:inline-flex;align-items:center;margin-top:4px;text-decoration:none;color:#1F3A5F;background:var(--bl);border-color:#9DB4D3" href="${esc(n.mondayUrl)}" target="_blank" rel="noopener">Ver no Monday ↗</a>`
     : MONDAY?.ativo ? `<button class="sbtn" style="margin-top:4px" data-act="nc-monday" data-id="${n.id}" ${MONDAY_ENVIANDO.has(n.id) ? 'disabled' : ''}>${MONDAY_ENVIANDO.has(n.id) ? 'Enviando…' : 'Enviar ao Monday'}</button>${n.mondayErro ? ` <span style="color:#8C1D18;font-size:12px" title="${esc(n.mondayErro)}">falhou no envio automático</span>` : ''}` : ''}</td>
   <td>${esc(n.operador?.nome)}</td>
   <td style="white-space:nowrap">${n.status === 'aberta' ? (D.osEdit === n.id ? `<input class="inp" style="width:100px" inputmode="numeric" data-in="osVal" value="${esc(D.osVal)}" placeholder="Nº OS" aria-label="Número da OS no Nectar"> <button class="sbtn pri" data-act="os-salvar" data-id="${n.id}">Salvar</button> <button class="sbtn" data-act="os-cancelar">×</button>` : `<span class="pill p-n">ABERTA</span> <button class="sbtn" data-act="os-editar" data-id="${n.id}">Registrar OS</button> <button class="sbtn" data-act="nc-resolver" data-id="${n.id}">Resolvida</button>`)
     : n.status === 'os' ? `<span class="pill p-b">OS ${esc(n.os)}</span> <button class="sbtn" data-act="nc-resolver" data-id="${n.id}">Resolvida</button>`
     : `<span class="pill p-ok">RESOLVIDA</span>${n.os ? ` <span style="color:var(--mut);font-size:12px">OS ${esc(n.os)}</span>` : ''}${n.atualizadoPor ? `<br><span style="color:var(--mut);font-size:12px">por ${esc(n.atualizadoPor)}</span>` : ''}`}</td></tr>`;

  return `${cabecalho()}
<div class="grid5">
<div class="dk"><span>Inspeções realizadas</span><b>${recs.length}</b><em>últimos ${D.periodo} dias</em></div>
<div class="dk"><span>Turnos com checklist</span><b>${feitos}/${tp.length}</b><em>${tp.length ? Math.round(feitos / tp.length * 100) : 0}% · ${tp.length - feitos} sem checklist</em></div>
<div class="dk"><span>Não conformidades abertas</span><b style="color:var(--yt)">${abertas.length}</b><em>${abertas.filter(n => n.status === 'os').length} já com OS no Nectar</em></div>
<div class="dk"><span>Itens críticos</span><b style="color:var(--r)">${crit}</b><em>no período</em></div>
<div class="dk"><span>Reversão da ventoinha</span><b>${vent}%</b><em>das inspeções do período</em></div>
</div>
${tDiario()}
<div class="grid2">
<div class="panel"><h3>Situação atual <span class="pill ${st[0]}">${st[1]}</span></h3>
${ult ? `<div style="display:flex;gap:18px;align-items:center">
<svg width="120" height="160" viewBox="0 0 64 84" role="img" aria-label="Pneus com pendências em aberto"><rect x="18" y="6" width="28" height="72" rx="6" fill="#E3E6E2"/>${[['DE', 2, 10], ['DD', 46, 10], ['TE', 2, 50], ['TD', 46, 50]].map(([w, x, y]) => `<rect x="${x}" y="${y}" width="16" height="24" rx="4" fill="${cor(pneusAgora[w])}"/><text x="${x + 8}" y="${y + 15}" text-anchor="middle" font-size="6.5" font-weight="700" fill="${corTxt(pneusAgora[w])}">${w}</text>`).join('')}</svg>
<div style="display:flex;flex-direction:column;gap:6px;font-size:15px"><span style="color:var(--mut);font-size:13px">ÚLTIMA INSPEÇÃO</span>
<b style="font-size:17px">${dm(quando(ult))} ${hm(quando(ult))} · Turno ${esc(ult.turno)}</b><span>${esc(ult.operador?.nome)} (${esc(ult.operador?.matricula)})</span><span>Horímetro <b>${esc(ult.horimetro)} h</b></span>
<button class="sbtn" data-act="det" data-id="${ult.id}" style="align-self:flex-start">Ver checklist completo</button></div></div>
<div class="legend"><span><i style="background:#1E6B3C"></i>OK</span><span><i style="background:#F5B800"></i>Atenção em aberto</span><span><i style="background:#B3261E"></i>Crítico em aberto</span></div>` : '<span style="color:var(--mut)">Nenhuma inspeção no período.</span>'}</div>
<div class="panel"><h3>Checklists por turno <small>clique numa barra para abrir</small></h3>
<div class="scroll"><svg width="${largura}" height="190" viewBox="0 0 ${largura} 190" role="img" aria-label="Checklists por dia e turno">${rotulosT}${barras}</svg></div>
<div class="legend"><span><i style="background:#1E6B3C"></i>Liberada sem pendência</span><span><i style="background:#F5B800"></i>Com item em atenção</span><span><i style="background:#B3261E"></i>Bloqueada</span><span><i style="background:#fff;border:2px dashed #9AA39D"></i>Turno sem checklist</span></div></div>
</div>
<div class="grid2b">
<div class="panel"><h3>Itens que mais falham <small>no período</small></h3>
${top.length ? `<div class="hbars">${top.map(([t, c]) => `<div class="hb"><span>${esc(t)}</span><div class="tr"><div style="width:${c / mx * 100}%"></div></div><b>${c}</b></div>`).join('')}</div>` : '<span style="color:var(--mut)">Nenhuma não conformidade no período.</span>'}</div>
<div class="panel"><h3>Não conformidades</h3>
<div class="tabs">${[['abertas', 'Abertas'], ['os', 'Com OS'], ['resolvidas', 'Resolvidas'], ['todas', 'Todas']].map(([k, l]) => `<button class="${D.tab === k ? 'on' : ''}" data-act="tab" data-to="${k}">${l} (${qt(k)})</button>`).join('')}</div>
<div class="scroll"><table class="t"><thead><tr><th>Data</th><th>Gravidade</th><th>Item / descrição</th><th>Operador</th><th>Situação</th></tr></thead><tbody>${lista.length ? lista.map(linhaNC).join('') : '<tr><td colspan="5" style="color:var(--mut)">Nada aqui.</td></tr>'}</tbody></table></div></div>
</div>
<div class="panel"><h3>Histórico de inspeções <small>clique numa linha para ver o checklist</small></h3>
<div class="scroll"><table class="t"><thead><tr><th>Data</th><th>Turno</th><th>Operador</th><th>Horímetro</th><th>OK</th><th>Atenção</th><th>Crítico</th><th>Ventoinha</th><th>Status</th></tr></thead><tbody>
${recs.length ? recs.slice(0, 200).map(r => { const [c, l] = pillSt(r); return `<tr class="click" data-act="det" data-id="${r.id}"><td>${dm(quando(r))} ${hm(quando(r))}</td><td>${esc(r.turno)}</td><td>${esc(r.operador?.nome)} <span style="color:var(--mut)">${esc(r.operador?.matricula)}</span></td><td>${esc(r.horimetro)} h</td><td>${r.contagem?.ok ?? ''}</td><td>${r.contagem?.a || '–'}</td><td>${r.contagem?.c || '–'}</td><td>${r.rotinas?.ventoinha ? 'Feita ' + esc(r.rotinas.ventoinha) : '<span style="color:var(--yt);font-weight:600">Pendente</span>'}</td><td><span class="pill ${c}">${l}</span></td></tr>`; }).join('') : '<tr><td colspan="9" style="color:var(--mut)">Nenhuma inspeção no período.</td></tr>'}
</tbody></table></div></div>`;
}
function tDiario() {
  let recsDia = [];
  if (D.dia >= inicioPeriodo()) recsDia = [...INS.values()].filter(r => r.dataTurno === D.dia);
  else { inspecoesDoDia(D.dia); recsDia = Array.isArray(DIA_CACHE[D.dia]) ? DIA_CACHE[D.dia] : []; }
  const carregando = DIA_CACHE[D.dia] === 'carregando';
  const nome = deIso(D.dia).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const agora = new Date();
  const porTurno = LISTA_TURNOS.map(t => recsDia.filter(r => r.turno === t).sort((a, b) => quando(b) - quando(a)));
  const feitos = porTurno.filter(l => l.length).length;
  const ncDia = recsDia.reduce((n, r) => n + (r.problemas?.length || 0), 0);
  const card = (t, l) => {
    if (!l.length) {
      const ini = inicioTurno(D.dia, t), fim = fimTurno(D.dia, t);
      const msg = agora < ini ? 'Turno ainda não começou' : agora < fim ? 'Turno em andamento · checklist pendente' : 'Sem checklist neste turno';
      return `<div class="tcard none"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:18px">Turno ${t}</b><span class="pill p-n">${agora < ini ? '—' : 'PENDENTE'}</span></div><span style="font-size:13px;color:var(--mut)">${TURNOS[t].rotulo}</span><span style="font-size:15px;font-weight:600;color:${agora < fim ? '#3F4A44' : '#8C1D18'}">${carregando ? 'Carregando…' : msg}</span></div>`;
    }
    const r = l[0], [c, lab] = pillSt(r);
    return `<div class="tcard ${r.contagem?.c ? 'c' : r.contagem?.a ? 'a' : ''}"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:18px">Turno ${t}</b><span class="pill ${c}">${lab}</span></div>
    <span style="font-size:13px;color:var(--mut)">${TURNOS[t].rotulo}</span>
    <span style="font-size:15px"><b>${hm(quando(r))}</b> · ${esc(r.operador?.nome)} · ${esc(r.horimetro)} h</span>
    ${(r.problemas || []).length ? r.problemas.map(p => `<span style="font-size:14px"><span class="pill ${p.s === 'c' ? 'p-c' : 'p-a'}" style="padding:1px 7px">${p.s === 'c' ? 'C' : 'A'}</span> ${esc(p.rotulo)} · <span style="color:var(--mut)">${esc(p.obs)}</span></span>`).join('') : '<span style="font-size:14px;color:var(--g2)">Todos os itens OK</span>'}
    <span style="font-size:13px;color:var(--mut)">${rotinas().map(x => `${esc(x.rotulo)}: ${r.rotinas?.[x.id] ? esc(r.rotinas[x.id]) : 'pendente'}`).join(' · ')}</span>
    ${l.length > 1 ? `<span style="font-size:13px;color:var(--mut)">+ ${l.length - 1} outro${l.length > 2 ? 's' : ''} checklist${l.length > 2 ? 's' : ''} neste turno (ver histórico)</span>` : ''}
    <button class="sbtn" data-act="det" data-id="${r.id}" style="align-self:flex-start">Abrir checklist</button></div>`;
  };
  return `<div class="panel"><h3><span>Diário · <span style="text-transform:capitalize">${nome}</span></span>
  <span class="dnav"><button class="sbtn" data-act="dia" data-d="-1">‹ Anterior</button><input type="date" data-in="dia" value="${D.dia}" max="${hoje()}" aria-label="Escolher data"><button class="sbtn" data-act="dia" data-d="1" ${D.dia >= hoje() ? 'disabled' : ''}>Próximo ›</button><button class="sbtn" data-act="dia" data-d="0">Hoje</button></span></h3>
  <span style="font-size:14px;color:#3F4A44"><b>${feitos} de ${LISTA_TURNOS.length}</b> turnos com checklist · <b>${ncDia}</b> não conformidade${ncDia === 1 ? '' : 's'} no dia</span>
  <div class="grid3">${LISTA_TURNOS.map((t, i) => card(t, porTurno[i])).join('')}</div></div>`;
}
function tColaboradores() {
  const adm = PERFIL === 'admin';
  const lista = [...COL.entries()].sort((a, b) => (a[1].nome || '').localeCompare(b[1].nome || ''));
  return `${cabecalho()}
  <div class="panel"><h3>Colaboradores habilitados no tablet <small>${lista.filter(([, c]) => c.ativo !== false).length} ativos</small></h3>
  ${adm ? `<form id="f-col" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input class="inp" id="c-mat" placeholder="Matrícula" inputmode="numeric" required style="width:140px"><input class="inp" id="c-nome" placeholder="Nome como aparece no tablet (ex.: Carlos M.)" required style="flex:1;min-width:240px"><button class="sbtn pri" type="submit">Adicionar</button></form>` : '<span style="color:var(--mut);font-size:14px">Somente o administrador pode adicionar ou desativar colaboradores.</span>'}
  <div class="scroll"><table class="t"><thead><tr><th>Matrícula</th><th>Nome</th><th>Situação</th>${adm ? '<th></th>' : ''}</tr></thead><tbody>
  ${lista.length ? lista.map(([m, c]) => `<tr><td>${esc(m)}</td><td>${esc(c.nome)}</td><td><span class="pill ${c.ativo === false ? 'p-n' : 'p-ok'}">${c.ativo === false ? 'INATIVO' : 'ATIVO'}</span></td>${adm ? `<td><button class="sbtn" data-act="col-ativo" data-m="${esc(m)}">${c.ativo === false ? 'Reativar' : 'Desativar'}</button></td>` : ''}</tr>`).join('') : `<tr><td colspan="4" style="color:var(--mut)">Nenhum colaborador cadastrado.</td></tr>`}
  </tbody></table></div>
  <span style="font-size:13px;color:var(--mut)">Colaborador desativado não consegue mais entrar no tablet, mas o histórico dele continua guardado.</span></div>
  ${tMonday()}`;
}
function tMonday() {
  const adm = PERFIL === 'admin';
  const c = MONDAY || {};
  return `<div class="panel"><h3>Integração com o Monday <span class="pill ${c.ativo && c.url ? 'p-ok' : 'p-n'}">${c.ativo && c.url ? 'ATIVA' : 'DESLIGADA'}</span></h3>
  <span style="font-size:14px;color:#3F4A44">Cada item em Atenção/Crítico enviado pelo tablet vira um item no quadro <b>Não Conformidades – Pá Mecânica 838T</b> do Monday, que notifica os responsáveis. O envio passa pelo "carteiro" do Google Apps Script (passo a passo no README).</span>
  ${adm ? `<form id="f-monday" style="display:grid;grid-template-columns:1fr 220px auto auto;gap:8px;align-items:center">
   <input class="inp" id="m-url" placeholder="URL do app da Web do Apps Script (termina em /exec)" value="${esc(c.url || '')}" required>
   <input class="inp" id="m-seg" placeholder="Senha do carteiro (SEGREDO)" value="${esc(c.segredo || '')}" required>
   <label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" id="m-ativo" ${c.ativo ? 'checked' : ''}> Ativo</label>
   <button class="sbtn pri" type="submit">Salvar</button></form>
   <div style="display:flex;gap:8px;align-items:center"><button class="sbtn" data-act="monday-testar" ${c.url ? '' : 'disabled'}>Testar conexão</button><span style="font-size:13px;color:var(--mut)">O teste confere a URL e a senha, sem criar item no Monday.</span></div>`
    : '<span style="color:var(--mut);font-size:14px">Somente o administrador altera esta configuração.</span>'}</div>`;
}
async function chamarCarteiro(itens) {
  if (!MONDAY?.url || !MONDAY?.segredo) throw new Error('Integração não configurada');
  const r = await fetch(MONDAY.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ segredo: MONDAY.segredo, itens }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.erro || 'falha no carteiro'); return j;
}
function tGaveta() {
  if (!D.det) return '';
  const r = acharInspecao(D.det);
  if (!r) { carregarInspecao(D.det); return `<div class="gaveta-fundo" data-act="fechar"><div class="gaveta" data-fica="1">Carregando…</div></div>`; }
  const [c, l] = pillSt(r);
  const linhas = itensAvaliados().map(it => {
    const x = it.pneu ? r.pneus?.[it.pneu] : r.respostas?.[it.id];
    const s = x?.s; const p = (r.problemas || []).find(q => q.item === it.id);
    return `<div class="linha"><span>${esc(it.rotulo)}${x?.obs ? `<br><span style="color:var(--mut)">${esc(x.obs)}</span>` : ''}${p?.fotoId ? `<br>${FOTOS[p.fotoId] ? `<img class="foto-g" src="${FOTOS[p.fotoId]}" alt="Foto do problema">` : `<button class="sbtn" data-act="foto" data-id="${p.fotoId}">Ver foto</button>`}` : ''}</span><span class="pill ${s === 'c' ? 'p-c' : s === 'a' ? 'p-a' : s === 'ok' ? 'p-ok' : 'p-n'}" style="align-self:flex-start">${s ? LBL[s] : '—'}</span></div>`;
  }).join('');
  return `<div class="gaveta-fundo" data-act="fechar"><div class="gaveta" role="dialog" aria-label="Checklist" data-fica="1">
  <div style="display:flex;justify-content:space-between;align-items:center"><span class="ht">Checklist ${dmy(r.dataTurno)} · Turno ${esc(r.turno)}</span><button class="sbtn" aria-label="Fechar" data-act="fechar" style="height:40px;width:40px">${ico.x}</button></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="pill ${c}">${l}</span><span class="pill p-n">${esc(r.operador?.nome)} · ${esc(r.operador?.matricula)}</span><span class="pill p-n">Enviado ${dm(quando(r))} ${hm(quando(r))}</span><span class="pill p-n">Horímetro ${esc(r.horimetro)} h</span></div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center"><div class="aviso" style="background:var(--gl);color:var(--g2)"><b style="font-size:26px">${r.contagem?.ok ?? 0}</b><br>OK</div><div class="aviso" style="background:var(--yl);color:var(--yt)"><b style="font-size:26px">${r.contagem?.a ?? 0}</b><br>Atenção</div><div class="aviso" style="background:var(--rl);color:var(--r)"><b style="font-size:26px">${r.contagem?.c ?? 0}</b><br>Crítico</div></div>
  <div><b>Itens</b>${linhas}</div>
  <div><b>Rotinas do turno</b>${rotinas().map(x => `<div class="linha"><span>${esc(x.rotulo)}</span><span class="pill ${r.rotinas?.[x.id] ? 'p-ok' : 'p-a'}">${r.rotinas?.[x.id] ? esc(r.rotinas[x.id]) : 'PENDENTE'}</span></div>`).join('')}</div>
  ${r.observacoes ? `<div><b>Observações</b><p style="margin:6px 0">${esc(r.observacoes)}</p></div>` : ''}
  <span class="rodape">Checklist versão ${esc(r.checklistVersao)} · ID ${esc(r.id)}</span>
  </div></div>`;
}
async function carregarInspecao(id) {
  if (carregarInspecao.em === id) return; carregarInspecao.em = id;
  const s = await getDoc(doc(db, 'inspecoes', id));
  if (s.exists()) { DIA_CACHE['_' + id] = [lerDoc(s)]; render(); }
}

function render() {
  if (TELA === 'login') { $r.innerHTML = tLogin(); $g.innerHTML = ''; return; }
  if (TELA === 'semAcesso') { $r.innerHTML = tSemAcesso(); $g.innerHTML = ''; return; }
  if (TELA === 'config') { $r.innerHTML = '<div class="login"><h1>Falta configurar o Firebase</h1><span>Preencha o arquivo <b>js/firebase-config.js</b> (passo 2 do README).</span></div>'; return; }
  if (TELA !== 'ok') return;
  const y = window.scrollY;
  $r.innerHTML = D.aba === 'colaboradores' ? tColaboradores() : tPainel();
  $g.innerHTML = tGaveta();
  window.scrollTo(0, y);
}

// ---------------------------------------------------------------- Excel
async function exportarExcel() {
  D.msg = 'Gerando planilha…'; render();
  try {
    let XLSX;
    try { XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs'); }
    catch { XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs'); }
    const itens = itensAvaliados(), rot = rotinas();
    const recs = inspecoesOrdenadas().reverse();
    const linhas = recs.map(r => {
      const o = { 'Data do turno': dmy(r.dataTurno), 'Turno': r.turno, 'Enviado em': quando(r).toLocaleString('pt-BR'), 'Matrícula': r.operador?.matricula, 'Operador': r.operador?.nome, 'Horímetro (h)': r.horimetro, 'Status': pillSt(r)[1], 'OK': r.contagem?.ok, 'Atenção': r.contagem?.a, 'Crítico': r.contagem?.c };
      itens.forEach(it => { const x = it.pneu ? r.pneus?.[it.pneu] : r.respostas?.[it.id]; o[it.rotulo] = x?.s ? LBL[x.s] + (x.obs ? ' - ' + x.obs : '') : ''; });
      rot.forEach(x => { o[x.rotulo] = r.rotinas?.[x.id] || 'pendente'; });
      o['Observações'] = r.observacoes || ''; return o;
    });
    const ncs = todasNC().filter(n => n.dataTurno >= inicioPeriodo()).sort((a, b) => quando(a) - quando(b)).map(n => ({
      'Data': quando(n).toLocaleString('pt-BR'), 'Turno': n.turno, 'Item': n.rotulo, 'Gravidade': n.gravidade === 'c' ? 'Crítico' : 'Atenção', 'Descrição': n.descricao,
      'Operador': n.operador?.nome, 'Situação': n.status === 'aberta' ? 'Aberta' : n.status === 'os' ? 'Com OS' : 'Resolvida', 'Nº OS Nectar': n.os || '', 'Atualizado por': n.atualizadoPor || ''
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas.length ? linhas : [{ Aviso: 'Sem inspeções no período' }]), 'Inspeções');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ncs.length ? ncs : [{ Aviso: 'Sem não conformidades no período' }]), 'Não conformidades');
    XLSX.writeFile(wb, `checklist-${EQ}_${inicioPeriodo()}_a_${hoje()}.xlsx`);
    D.msg = '';
  } catch (e) { console.error(e); D.msg = 'Não foi possível gerar a planilha: ' + e.message; }
  render();
}

// ---------------------------------------------------------------- eventos
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.dataset.act === 'fechar' && e.target.closest('[data-fica]') && !e.target.closest('button')) return;
  const a = el.dataset.act, id = el.dataset.id;
  try {
    if (a === 'sair') { await signOut(auth); return; }
    else if (a === 'aba') D.aba = el.dataset.to;
    else if (a === 'tab') D.tab = el.dataset.to;
    else if (a === 'det') { D.det = id; const r = acharInspecao(id); if (r) D.dia = r.dataTurno; }
    else if (a === 'fechar') D.det = null;
    else if (a === 'foto') { const s = await getDoc(doc(db, 'fotos', id)); if (s.exists()) FOTOS[id] = s.data().dataUrl; }
    else if (a === 'dia') { const n = +el.dataset.d; if (n === 0) D.dia = hoje(); else { const nd = somaDias(D.dia, n); if (nd <= hoje()) D.dia = nd; } }
    else if (a === 'os-editar') { D.osEdit = id; D.osVal = ''; }
    else if (a === 'os-cancelar') D.osEdit = null;
    else if (a === 'os-salvar') { if (D.osVal.trim()) await updateDoc(doc(db, 'naoConformidades', id), { status: 'os', os: D.osVal.trim(), atualizadoEm: serverTimestamp(), atualizadoPor: NOME || USER.email }); D.osEdit = null; }
    else if (a === 'nc-resolver') await updateDoc(doc(db, 'naoConformidades', id), { status: 'resolvida', atualizadoEm: serverTimestamp(), atualizadoPor: NOME || USER.email });
    else if (a === 'col-ativo') { const m = el.dataset.m; const c = COL.get(m); await updateDoc(doc(db, 'colaboradores', m), { ativo: c.ativo === false }); }
    else if (a === 'excel') { exportarExcel(); return; }
    else if (a === 'monday-testar') { const j = await chamarCarteiro([]); D.msg = j.ok ? 'Conexão com o Monday OK: URL e senha corretas.' : 'Falhou.'; }
    else if (a === 'nc-monday') {
      const n = todasNC().find(x => x.id === id); if (!n) return;
      MONDAY_ENVIANDO.add(id); render();
      try {
        const ins = acharInspecao(n.inspecaoId);
        const j = await chamarCarteiro([{ ncId: n.id, rotulo: n.rotulo, gravidade: n.gravidade, descricao: n.descricao, grupo: n.grupo, turno: n.turno, dataTurno: n.dataTurno,
          operador: `${n.operador?.nome} (${n.operador?.matricula})`, horimetro: ins?.horimetro ?? null, inspecaoId: n.inspecaoId, temFoto: !!n.fotoId }]);
        const x = (j.res || [])[0];
        if (x?.mondayId) { await updateDoc(doc(db, 'naoConformidades', id), { mondayId: String(x.mondayId), mondayUrl: `${j.url}/pulses/${x.mondayId}` }); D.msg = 'Enviado ao Monday.'; }
        else D.msg = 'O Monday recusou: ' + (x?.erro || 'erro desconhecido');
      } finally { MONDAY_ENVIANDO.delete(id); }
    }
  } catch (err) { console.error(err); D.msg = 'Não foi possível salvar: ' + (err.code || err.message); }
  render();
});
document.addEventListener('input', e => {
  const f = e.target.dataset.in; if (!f) return;
  if (f === 'periodo') { D.periodo = +e.target.value; DIA_CACHE = {}; assinarPeriodo(); render(); }
  else if (f === 'dia') { if (e.target.value) { D.dia = e.target.value; render(); } }
  else if (f === 'osVal') D.osVal = e.target.value;
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id === 'f-login') {
    ERRO = '';
    try { await signInWithEmailAndPassword(auth, document.getElementById('em').value.trim(), document.getElementById('pw').value); }
    catch (err) { ERRO = 'E-mail ou senha incorretos.'; render(); }
  } else if (e.target.id === 'f-monday') {
    const url = document.getElementById('m-url').value.trim(), segredo = document.getElementById('m-seg').value.trim(), ativo = document.getElementById('m-ativo').checked;
    try { await setDoc(doc(db, 'config', 'monday'), { url, segredo, ativo, atualizadoEm: serverTimestamp(), atualizadoPor: NOME || USER.email }); D.msg = 'Integração com o Monday salva.'; }
    catch (err) { D.msg = 'Não foi possível salvar: ' + (err.code || err.message); }
    render();
  } else if (e.target.id === 'f-col') {
    const m = document.getElementById('c-mat').value.replace(/\D/g, ''), nome = document.getElementById('c-nome').value.trim();
    if (!m || !nome) return;
    try { await setDoc(doc(db, 'colaboradores', m), { nome, ativo: true, criadoEm: serverTimestamp(), criadoPor: NOME || USER.email }); D.msg = `Colaborador ${nome} (${m}) adicionado.`; }
    catch (err) { D.msg = 'Não foi possível adicionar: ' + (err.code || err.message); }
    render();
  }
});

// ---------------------------------------------------------------- início
if (!configurado) { TELA = 'config'; render(); }
else onAuthStateChanged(auth, async user => {
  unsubs.forEach(u => u()); unsubPeriodo.forEach(u => u()); unsubs = []; unsubPeriodo = [];
  USER = user;
  if (!user) { TELA = 'login'; render(); return; }
  try { const u = await getDoc(doc(db, 'usuarios', user.uid)); PERFIL = u.exists() ? u.data().perfil : null; NOME = u.exists() ? (u.data().nome || '') : ''; }
  catch (err) { PERFIL = null; }
  if (!['supervisor', 'admin'].includes(PERFIL)) { TELA = 'semAcesso'; render(); return; }
  TELA = 'ok'; assinarFixos(); assinarPeriodo(); render();
});
