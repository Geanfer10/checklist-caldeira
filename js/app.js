// =====================================================================
//  APP DO TABLET — checklist da Pá Mecânica 838T
// =====================================================================
import {
  configurado, db, auth, collection, doc, getDoc, updateDoc, writeBatch, serverTimestamp,
  onSnapshot, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from './firebase.js?v=20261106c';
import { CHECKLIST } from './checklist-838t.js?v=20261106c';
import { turnoDe, TURNOS } from './turnos.js?v=20261106c';

const EQ = CHECKLIST.equipamento;
const ETAPAS = [{ id: 'abertura', titulo: 'Abertura do turno', tipo: 'abertura' }, ...CHECKLIST.etapas];
const PNEUS = CHECKLIST.pneus;
const LBL = { ok: 'OK', a: 'Atenção', c: 'Crítico' };
const INATIVIDADE_MIN = 10;       // volta para a matrícula após 10 min parado
const SEG_VOLTAR = 8;             // segundos na tela "Enviado"
const VERSAO = '20261106c';            // igual ao versao.json; troque os dois ao publicar mudanças

let S;                            // estado da inspeção em andamento
let USER = null, PERFIL = null;   // conta do tablet
let COLAB = {};                   // matrícula -> { nome, ativo }
let STATUS = null;                // última inspeção (para a tela inicial)
let TELA = 'carregando', ERRO_LOGIN = '', ENVIO = null;
let timerVoltar = null, ultimoToque = Date.now(), fotoAlvo = null;
let unsubs = [];

function novo() {
  S = { etapa: 0, mat: '', matOk: false, matErr: false, nome: '', hor: '', lenha: false,
        resp: {}, pneus: {}, pneuSel: 'DE', rotinas: {}, decl: false, obsg: '', tentou: false };
}
novo();

const $app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hm = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dm = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const ico = {
  back: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>',
  cam: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  ban: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="flex:none"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  play: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>',
  send: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  check: '<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};
const cor = s => s === 'ok' ? '#1E6B3C' : s === 'a' ? '#F5B800' : s === 'c' ? '#B3261E' : '#FFFFFF';
const corTxt = s => (s === 'a' || !s) ? '#1A1F1C' : '#FFFFFF';

// ---------------------------------------------------------------- regras
function respOk(x) { return x && x.s && (x.s === 'ok' || (x.obs || '').trim() !== ''); }
function etapaCompleta(i) {
  const e = ETAPAS[i];
  if (e.tipo === 'abertura') return String(S.hor).trim() !== '' && Number(S.hor) > 0 && S.lenha;
  if (e.tipo === 'rotinas') return true;
  const itensOk = e.itens.every(it => respOk(S.resp[it.id]));
  if (e.tipo === 'pneus') return itensOk && Object.keys(PNEUS).every(p => respOk(S.pneus[p]));
  return itensOk;
}
function apurar() {
  let ok = 0, a = 0, c = 0; const prob = [];
  ETAPAS.forEach(e => {
    if (e.tipo === 'pneus') Object.entries(PNEUS).forEach(([p, nome]) => {
      const x = S.pneus[p]; if (!x) return;
      if (x.s === 'ok') ok++; else { x.s === 'a' ? a++ : c++; prob.push({ item: 'pneu_' + p, rotulo: `Pneu ${p} · ${nome}`, grupo: e.titulo, s: x.s, obs: x.obs.trim(), foto: x.foto || null }); }
    });
    if (e.tipo === 'itens' || e.tipo === 'pneus') e.itens.forEach(it => {
      const x = S.resp[it.id]; if (!x) return;
      if (x.s === 'ok') ok++; else { x.s === 'a' ? a++ : c++; prob.push({ item: it.id, rotulo: it.rotulo, grupo: e.titulo, s: x.s, obs: x.obs.trim(), foto: x.foto || null }); }
    });
  });
  return { ok, a, c, prob };
}

// ---------------------------------------------------------------- telas
function cab(titulo, sub, voltar, extra = '') {
  return `<header class="top"><div class="hrow">${voltar ? `<button type="button" class="hbtn" aria-label="Voltar" data-act="${voltar}">${ico.back}</button>` : ''}<div style="display:flex;flex-direction:column"><span class="ht">${titulo}</span><span class="hs">${sub}</span></div></div>${extra}`;
}
function progresso(resumo) {
  const n = resumo ? ETAPAS.length : S.etapa, pct = Math.round(n / ETAPAS.length * 100);
  const lab = resumo ? 'Conferir e enviar' : `Etapa ${S.etapa + 1} de ${ETAPAS.length} · ${ETAPAS[S.etapa].titulo}`;
  return `<div class="prog"><div class="prow"><b>${lab}</b><span>${pct}%</span></div><div class="bar"><div style="width:${pct}%"></div></div></div></header>`;
}

function tConfig() {
  return `<main class="centro" style="gap:16px;padding:40px"><span class="ht" style="font-size:32px">Falta configurar o Firebase</span>
  <span style="font-size:18px;max-width:520px">Abra o arquivo <b>js/firebase-config.js</b> e cole os dados do seu projeto Firebase, como explicado no passo 2 do README.</span></main>`;
}
function tDispositivo() {
  return `${cab('Configurar este tablet', 'Feito uma única vez pelo administrador')}</header>
  <main style="max-width:520px;width:100%;margin:0 auto">
  <div class="note" style="background:#fff;border:1px solid var(--bd)">Entre com a <b>conta do tablet</b> criada no Firebase. Depois disso o tablet fica conectado e os operadores usam só a matrícula.</div>
  <form id="f-disp" style="display:flex;flex-direction:column;gap:12px">
  <label class="lb" for="em">E-mail da conta do tablet</label><input id="em" type="email" autocomplete="username" required>
  <label class="lb" for="pw">Senha</label><input id="pw" type="password" autocomplete="current-password" required>
  ${ERRO_LOGIN ? `<span class="err">${esc(ERRO_LOGIN)}</span>` : ''}
  <button class="btn" type="submit" style="flex:none">CONECTAR TABLET</button></form></main>`;
}
function tSemPermissao() {
  return `<main class="centro" style="gap:16px;padding:40px"><span class="ht" style="font-size:30px">Conta sem permissão de tablet</span>
  <span style="font-size:18px;max-width:520px">A conta <b>${esc(USER?.email)}</b> não está cadastrada com perfil "tablet" (coleção <b>usuarios</b> no Firestore). Veja o passo 4 do README.</span>
  <button type="button" class="btn2" data-act="sair-disp" style="flex:none;padding:0 24px">Usar outra conta</button></main>`;
}
function tMatricula() {
  if (S.matOk) {
    return `${cab('INSPEÇÃO DE EQUIPAMENTOS', 'Goiás Verde · PCM Luziânia')}</header>
    <main class="centro" style="gap:20px"><div class="card" style="width:100%;max-width:520px;align-items:center;text-align:center;gap:18px;padding:30px">
    <span style="font-size:19px;color:var(--mut)">Matrícula ${esc(S.mat)}</span>
    <span class="ht" style="font-size:44px">Você é ${esc(S.nome)}?</span>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%"><button type="button" class="btn2" data-act="mat-nao">Não sou eu</button><button type="button" class="btn" data-act="mat-sim">SIM, SOU EU</button></div></div></main>`;
  }
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return `${cab('INSPEÇÃO DE EQUIPAMENTOS', 'Goiás Verde · PCM Luziânia')}</header>
  <main class="centro" style="gap:18px">
  <label class="lb" for="mat" style="font-size:24px">Digite sua matrícula</label>
  <input id="mat" type="text" inputmode="none" readonly value="${esc(S.mat)}" placeholder="_ _ _ _ _" style="max-width:480px;height:80px;font-size:40px;text-align:center;letter-spacing:10px;font-weight:700">
  ${S.matErr ? '<span class="err" style="font-size:18px">Matrícula não cadastrada ou inativa. Procure o supervisor.</span>' : ''}
  <div class="keypad">${teclas.map(k => `<button type="button" data-act="tecla" data-k="${k}" class="${k === 'ok' ? 'k-ok' : k === 'del' ? 'k-del' : ''}">${k === 'del' ? 'Apagar' : k === 'ok' ? 'ENTRAR' : k}</button>`).join('')}</div>
  </main>`;
}
function tInicio() {
  const agora = turnoDe();
  const u = STATUS?.ultima;
  const feito = u && u.dataTurno === agora.dataTurno && u.turno === agora.turno;
  const quando = u?.quando?.toDate ? u.quando.toDate() : null;
  return `${cab('Olá, ' + esc(S.nome), `Matrícula ${esc(S.mat)} · Turno ${agora.turno} (${TURNOS[agora.turno].rotulo}) · ${dm(new Date())}`, '',
    `<button type="button" data-act="trocar" style="align-self:flex-start;height:46px;padding:0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;font-weight:600;font-size:16px;cursor:pointer">Não é você? Trocar colaborador</button>`)}</header>
  <main style="gap:16px">
  <button type="button" class="machine" data-act="iniciar">
   <span style="display:flex;justify-content:space-between;align-items:center;width:100%"><span class="ht" style="font-size:32px">${esc(CHECKLIST.nome.toUpperCase())}</span><span class="pill ${feito ? 'p-ok' : 'p-a'}">${feito ? 'FEITO NESTE TURNO' : 'PENDENTE'}</span></span>
   <span style="font-size:17px">${feito ? `Já enviado por ${esc(u.operador?.nome)}${quando ? ' às ' + hm(quando) : ''}. Pode fazer outro se necessário.` : 'Checklist deste turno ainda não foi feito'}</span>
   <span class="go">INICIAR CHECKLIST ${ico.play}</span>
  </button>
  <div class="warn">${ico.ban}<span>${esc(CHECKLIST.aviso)}</span></div>
  ${u && !feito ? `<div class="card" style="gap:4px"><b>Última inspeção</b><span style="font-size:17px;color:#3F4A44">${quando ? dm(quando) + ' ' + hm(quando) + ' · ' : ''}Turno ${esc(u.turno)} · ${esc(u.operador?.nome)} · <span class="pill ${u.status === 'BLOQUEADA' ? 'p-c' : u.contagem?.a ? 'p-a' : 'p-ok'}">${u.status === 'BLOQUEADA' ? 'BLOQUEADA' : u.contagem?.a ? 'ATENÇÃO' : 'OK'}</span></span></div>` : ''}
  </main>`;
}
function botoes(chave, s, tipo) {
  return `<div class="seg" role="group" aria-label="Estado">${['ok', 'a', 'c'].map(v => `<button type="button" class="${v}${s === v ? ' on' : ''}" aria-pressed="${s === v}" data-act="marcar" data-tipo="${tipo}" data-k="${chave}" data-v="${v}">${s === v ? (v === 'ok' ? '✓ ' : '! ') : ''}${LBL[v]}</button>`).join('')}</div>`;
}
function caixaProblema(chave, x, tipo) {
  if (!x || !x.s || x.s === 'ok') return '';
  const falta = S.tentou && !(x.obs || '').trim();
  return `<label class="lb" for="o-${chave}" style="color:${x.s === 'c' ? '#8C1D18' : '#6B4100'}">Descreva o problema (obrigatório)</label>
  <textarea id="o-${chave}" rows="2" data-in="obs" data-tipo="${tipo}" data-k="${chave}" placeholder="O que foi encontrado?">${esc(x.obs)}</textarea>
  ${falta ? '<span class="err">Falta descrever o problema.</span>' : ''}
  <div class="fotos"><button type="button" class="foto" data-act="foto" data-tipo="${tipo}" data-k="${chave}">${ico.cam}${x.foto ? 'Trocar foto' : 'Tirar foto'}</button>
  ${x.foto ? `<img class="thumb" src="${x.foto}" alt="Foto anexada"><button type="button" class="foto" style="border-color:#C9CEC8" data-act="tirar-foto" data-tipo="${tipo}" data-k="${chave}">Remover</button>` : ''}</div>`;
}
function tEtapa() {
  const i = S.etapa, e = ETAPAS[i]; let corpo = '';
  if (e.tipo === 'abertura') {
    corpo = `<div class="card"><label class="lb" for="hor" style="font-size:19px">Horímetro atual (h)</label>
    <input id="hor" class="big" type="number" inputmode="decimal" data-in="hor" value="${esc(S.hor)}" placeholder="Ex.: 8452">
    ${S.tentou && !(Number(S.hor) > 0) ? '<span class="err">Informe o horímetro.</span>' : ''}
    <span style="font-size:16px;color:var(--mut)">Leia no painel da máquina.</span></div>
    <div class="warn">${ico.ban}<span>${esc(CHECKLIST.aviso.toUpperCase())}</span></div>
    <label class="card chk"><input type="checkbox" data-in="lenha" ${S.lenha ? 'checked' : ''}><span>Li e estou ciente: ${esc(CHECKLIST.aviso.charAt(0).toLowerCase() + CHECKLIST.aviso.slice(1))}.</span></label>
    ${S.tentou && !S.lenha ? '<span class="err">Marque a ciência do aviso para continuar.</span>' : ''}`;
  } else if (e.tipo === 'rotinas') {
    corpo = `<div class="note" style="background:#fff;border:1px solid var(--bd)">Toque em <b>Feito</b> quando terminar. A hora é gravada automaticamente. Se ainda não fez, pode deixar pendente.</div>` +
      e.itens.map(it => { const v = S.rotinas[it.id]; return `<div class="card task"><span style="display:flex;flex-direction:column;gap:2px"><b style="font-size:19px">${esc(it.rotulo)}</b>${it.dica ? `<span style="font-size:15px;color:var(--mut)">${esc(it.dica)}</span>` : ''}</span><button type="button" class="tbtn${v ? ' on' : ''}" data-act="rotina" data-k="${it.id}">${v ? 'Feito ' + hm(new Date(v)) : 'Feito'}</button></div>`; }).join('');
  } else {
    if (e.tipo === 'pneus') {
      const p = S.pneuSel, x = S.pneus[p];
      const R = (id, xx, yy) => { const s = (S.pneus[id] || {}).s; return `<g class="wheel" data-act="pneu" data-p="${id}" role="button" aria-label="${PNEUS[id]}">${S.pneuSel === id ? `<rect x="${xx - 4}" y="${yy - 4}" width="48" height="64" rx="10" fill="none" stroke="#1A1F1C" stroke-width="3" stroke-dasharray="5 3"/>` : ''}<rect x="${xx}" y="${yy}" width="40" height="56" rx="8" fill="${cor(s)}" stroke="#8A948E" stroke-width="${s ? 0 : 2}"/><text x="${xx + 20}" y="${yy + 33}" text-anchor="middle" font-family="Barlow" font-weight="700" font-size="15" fill="${corTxt(s)}">${id}</text></g>`; };
      corpo += `<div class="card" style="align-items:center"><span style="font-size:17px;font-weight:600;align-self:flex-start">Toque em cada pneu (máquina vista de cima, frente para cima)</span>
      <svg width="240" height="276" viewBox="0 0 200 230" role="img" aria-label="Pá vista de cima com os quatro pneus"><rect x="30" y="2" width="140" height="28" rx="6" fill="#5B6660"/><line x1="75" y1="30" x2="75" y2="52" stroke="#5B6660" stroke-width="8"/><line x1="125" y1="30" x2="125" y2="52" stroke="#5B6660" stroke-width="8"/><rect x="60" y="50" width="80" height="62" rx="8" fill="#C9CEC8" stroke="#8A948E" stroke-width="2"/><circle cx="100" cy="120" r="9" fill="#8A948E"/><rect x="55" y="128" width="90" height="98" rx="10" fill="#C9CEC8" stroke="#8A948E" stroke-width="2"/><rect x="73" y="140" width="54" height="38" rx="5" fill="#E8EEF6" stroke="#8A948E" stroke-width="2"/>${R('DE', 12, 54)}${R('DD', 148, 54)}${R('TE', 8, 150)}${R('TD', 152, 150)}</svg>
      <div class="legend"><span><i style="background:#1E6B3C"></i>OK</span><span><i style="background:#F5B800"></i>Atenção</span><span><i style="background:#B3261E"></i>Crítico</span><span><i style="background:#fff;border:2px solid #8A948E"></i>Falta</span></div></div>
      <div class="card item ${x?.s || ''}"><div class="it">Pneu ${p} · ${PNEUS[p]}</div><span style="font-size:16px;color:var(--mut)">Cortes, bolhas, desgaste, calibragem, porcas</span>${botoes(p, x?.s, 'pneu')}${caixaProblema(p, x, 'pneu')}</div>`;
      if (S.tentou && !Object.keys(PNEUS).every(k => respOk(S.pneus[k]))) corpo += '<span class="err">Avalie os 4 pneus (toque em cada um no desenho).</span>';
    }
    corpo += e.itens.map((it, j) => { const x = S.resp[it.id]; return `<div class="card item ${x?.s || ''}"><div class="it"><span class="n">${i}.${j + 1}</span><span>${esc(it.rotulo)}</span></div>${botoes(it.id, x?.s, 'item')}${caixaProblema(it.id, x, 'item')}</div>`; }).join('');
  }
  const prox = i < ETAPAS.length - 1 ? 'PRÓXIMO: ' + ETAPAS[i + 1].titulo.toUpperCase() : 'IR PARA O RESUMO';
  return `${cab(esc(CHECKLIST.nome), (S.hor ? 'Horímetro ' + esc(S.hor) + ' h · ' : '') + esc(S.nome) + (e.dica ? ' · ' + esc(e.dica) : ''), 'anterior')}${progresso(false)}
  <main id="rolagem">${corpo}${S.tentou && !etapaCompleta(i) ? '<div class="err" style="text-align:center">Responda todos os itens desta etapa para continuar.</div>' : ''}</main>
  <footer><button type="button" class="btn2" data-act="anterior">Anterior</button><button type="button" class="btn" data-act="proximo" style="font-size:${prox.length > 26 ? 19 : 24}px">${prox}</button></footer>`;
}
function tResumo() {
  const t = apurar(), bloq = t.c > 0;
  const rot = ETAPAS.filter(e => e.tipo === 'rotinas').flatMap(e => e.itens);
  return `${cab('Resumo da inspeção', `${esc(CHECKLIST.equipamento)} · ${esc(S.nome)} · ${dm(new Date())} ${hm(new Date())}`, 'anterior')}${progresso(true)}
  <main id="rolagem" style="gap:14px">
  <div class="kpis"><div class="kpi" style="background:var(--gl);color:var(--g2)"><b>${t.ok}</b>OK</div><div class="kpi" style="background:var(--yl);color:var(--yt)"><b>${t.a}</b>Atenção</div><div class="kpi" style="background:var(--rl);color:var(--r)"><b>${t.c}</b>Crítico</div></div>
  <div style="background:${bloq ? '#B3261E' : '#1E6B3C'};color:#fff;border-radius:14px;padding:16px 18px;display:flex;flex-direction:column"><span class="ht" style="font-size:30px">${bloq ? 'MÁQUINA BLOQUEADA' : 'MÁQUINA LIBERADA'}</span><span style="font-size:17px">${bloq ? 'Não operar. Avise o supervisor imediatamente.' : t.a ? 'Itens em atenção serão enviados para o PCM.' : 'Tudo em ordem.'}</span></div>
  ${t.prob.length ? `<div class="card"><b style="font-size:18px">Itens com problema</b>${t.prob.map(p => `<div style="display:flex;gap:10px;font-size:17px"><span class="pill ${p.s === 'c' ? 'p-c' : 'p-a'}" style="align-self:flex-start">${p.s === 'c' ? 'C' : 'A'}</span><span><b>${esc(p.rotulo)}</b> · ${esc(p.obs)}${p.foto ? ' (com foto)' : ''}</span></div>`).join('')}</div>` : ''}
  <div class="card"><b style="font-size:18px">Rotinas do turno</b>${rot.map(r => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:17px"><span>${esc(r.rotulo)}</span><span class="pill ${S.rotinas[r.id] ? 'p-ok' : 'p-a'}">${S.rotinas[r.id] ? hm(new Date(S.rotinas[r.id])) : 'PENDENTE'}</span></div>`).join('')}</div>
  <label class="lb" for="og">Observações gerais (opcional)</label><textarea id="og" rows="2" data-in="obsg" placeholder="Algo mais que o PCM precisa saber?">${esc(S.obsg)}</textarea>
  <label class="chk"><input type="checkbox" data-in="decl" ${S.decl ? 'checked' : ''}><span>Declaro que fiz esta inspeção pessoalmente, com a máquina parada.</span></label>
  ${S.tentou && !S.decl ? '<span class="err">Marque a declaração para enviar.</span>' : ''}
  </main><footer><button type="button" class="btn" data-act="enviar">${ico.send}ENVIAR INSPEÇÃO</button></footer>`;
}
function tEnviando() {
  return `<main class="centro" style="gap:20px"><div class="spin"></div><span class="ht" style="font-size:30px">Enviando…</span></main>`;
}
function tEnviado() {
  const r = ENVIO;
  return `<main class="centro" style="gap:20px;padding:40px">
  <span style="color:${r.bloq ? '#B3261E' : '#1E6B3C'}">${ico.check}</span><span class="ht" style="font-size:38px">${r.fila ? 'INSPEÇÃO SALVA' : 'INSPEÇÃO ENVIADA'}</span>
  <span style="font-size:20px;color:#3F4A44">${hm(r.quando)} · ${esc(r.nome)}<br>Status: <b>${r.bloq ? 'BLOQUEADA' : 'LIBERADA'}</b></span>
  ${r.fila ? '<div class="note" style="background:var(--yl);color:#6B4100;max-width:520px">Sem conexão no momento. A inspeção ficou guardada no tablet e será enviada automaticamente quando o Wi-Fi voltar. Não apague os dados do navegador.</div>' : ''}
  ${r.bloq ? '<div class="warn" style="max-width:520px">Máquina bloqueada: avise o supervisor agora.</div>' : ''}
  <div style="font-size:22px;font-weight:700;background:#fff;border:2px solid var(--g);border-radius:14px;padding:16px 26px">Voltando para a tela de matrícula em ${r.seg}s…</div></main>
  <footer><button type="button" class="btn" data-act="proximo-colab">PRÓXIMO COLABORADOR AGORA</button></footer>`;
}

function render() {
  const m = document.getElementById('rolagem'); const sc = m ? m.scrollTop : 0;
  const chave = TELA + S.etapa; const mesma = render.ultima === chave;
  const v = { config: tConfig, dispositivo: tDispositivo, semPermissao: tSemPermissao, matricula: tMatricula, inicio: tInicio, etapa: tEtapa, resumo: tResumo, enviando: tEnviando, enviado: tEnviado }[TELA];
  $app.innerHTML = v ? v() : '<main class="centro"><span class="ht">Carregando…</span></main>';
  const m2 = document.getElementById('rolagem'); if (m2) m2.scrollTop = mesma ? sc : 0;
  render.ultima = chave;
}
function irPara(t) { TELA = t; render(); }
function voltarMatricula() { clearInterval(timerVoltar); timerVoltar = null; novo(); irPara('matricula'); }

// ---------------------------------------------------------------- envio
async function enviar() {
  const t = apurar(); const agora = new Date(); const { turno, dataTurno } = turnoDe(agora);
  const uid = USER.uid; const operador = { matricula: S.mat, nome: S.nome };
  irPara('enviando');
  const lote = writeBatch(db);
  const insRef = doc(collection(db, 'inspecoes'));
  const problemas = t.prob.map(p => {
    let fotoId = null;
    if (p.foto) { const f = doc(collection(db, 'fotos')); fotoId = f.id; lote.set(f, { inspecaoId: insRef.id, item: p.item, dataUrl: p.foto, criadoEm: serverTimestamp(), criadoPor: uid }); }
    return { item: p.item, rotulo: p.rotulo, grupo: p.grupo, s: p.s, obs: p.obs, fotoId };
  });
  const resp = {}; Object.entries(S.resp).forEach(([k, x]) => { resp[k] = { s: x.s, obs: (x.obs || '').trim() }; });
  const pneus = {}; Object.entries(S.pneus).forEach(([k, x]) => { pneus[k] = { s: x.s, obs: (x.obs || '').trim() }; });
  const rot = {}; ETAPAS.filter(e => e.tipo === 'rotinas').flatMap(e => e.itens).forEach(r => { rot[r.id] = S.rotinas[r.id] ? hm(new Date(S.rotinas[r.id])) : null; });
  const status = t.c ? 'BLOQUEADA' : 'LIBERADA';
  lote.set(insRef, {
    equipamento: EQ, checklistVersao: CHECKLIST.versao, dataTurno, turno,
    criadoEm: serverTimestamp(), horaTablet: agora.toISOString(), criadoPor: uid,
    operador, horimetro: Number(S.hor), respostas: resp, pneus, rotinas: rot,
    observacoes: S.obsg.trim(), contagem: { ok: t.ok, a: t.a, c: t.c }, status, problemas
  });
  const paraMonday = [];
  const horimetro = Number(S.hor);
  problemas.forEach(p => {
    const ncRef = doc(collection(db, 'naoConformidades'));
    paraMonday.push({ ncId: ncRef.id, rotulo: p.rotulo, gravidade: p.s, descricao: p.obs, grupo: p.grupo, turno, dataTurno,
      operador: `${operador.nome} (${operador.matricula})`, horimetro, inspecaoId: insRef.id, temFoto: !!p.fotoId });
    lote.set(ncRef, {
      inspecaoId: insRef.id, equipamento: EQ, dataTurno, turno, item: p.item, rotulo: p.rotulo, grupo: p.grupo,
      gravidade: p.s, descricao: p.obs, fotoId: p.fotoId, operador,
      criadoEm: serverTimestamp(), criadoPor: uid, status: 'aberta', os: ''
    });
  });
  lote.set(doc(db, 'status', EQ), { ultima: { inspecaoId: insRef.id, dataTurno, turno, operador, status, contagem: { ok: t.ok, a: t.a, c: t.c }, quando: serverTimestamp() } }, { merge: true });

  const commit = lote.commit().then(() => 'ok').catch(err => { console.error(err); return 'erro'; });
  const r = await Promise.race([commit, new Promise(res => setTimeout(() => res('fila'), 8000))]);
  if (r === 'erro') {
    TELA = 'resumo'; render();
    const box = document.createElement('div'); box.className = 'warn'; box.textContent = 'Não foi possível enviar (permissão negada). Avise o administrador.';
    document.getElementById('rolagem')?.prepend(box); return;
  }
  if (paraMonday.length) enviarMonday(paraMonday);
  ENVIO = { quando: agora, nome: S.nome, bloq: t.c > 0, fila: r === 'fila' || !navigator.onLine, seg: SEG_VOLTAR };
  novo(); irPara('enviado');
  clearInterval(timerVoltar);
  timerVoltar = setInterval(() => { ENVIO.seg--; if (ENVIO.seg <= 0) voltarMatricula(); else if (TELA === 'enviado') render(); }, 1000);
}

// ---------------------------------------------------------------- Monday
// As não conformidades vão para o Monday por meio do "carteiro" no Google Apps Script
// (ver pasta integracao/). Se a internet falhar, ficam numa fila no tablet e são reenviadas.
let MONDAY = null;
let filaMonday = [];
try { filaMonday = JSON.parse(localStorage.getItem('filaMonday') || '[]'); } catch { filaMonday = []; }
const salvarFila = () => { try { localStorage.setItem('filaMonday', JSON.stringify(filaMonday)); } catch { } };
async function enviarMonday(itens) {
  if (!MONDAY?.ativo || !MONDAY.url || !MONDAY.segredo) {
    itens.forEach(i => { if (!filaMonday.find(f => f.ncId === i.ncId)) filaMonday.push(i); }); salvarFila(); return;
  }
  try {
    const r = await fetch(MONDAY.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ segredo: MONDAY.segredo, itens }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'falha no carteiro');
    for (const x of j.res || []) {
      const dados = x.mondayId ? { mondayId: String(x.mondayId), mondayUrl: `${j.url}/pulses/${x.mondayId}` } : { mondayErro: String(x.erro || 'erro').slice(0, 300) };
      await updateDoc(doc(db, 'naoConformidades', x.ncId), dados).catch(e => console.warn(e));
    }
    filaMonday = filaMonday.filter(f => !itens.find(i => i.ncId === f.ncId)); salvarFila();
  } catch (e) {
    console.warn('Monday: ficou na fila para reenvio', e);
    itens.forEach(i => { if (!filaMonday.find(f => f.ncId === i.ncId)) filaMonday.push(i); }); salvarFila();
  }
}
setInterval(() => { if (filaMonday.length && navigator.onLine && MONDAY?.ativo) enviarMonday(filaMonday.slice()); }, 180000);

// ---------------------------------------------------------------- fotos
function comprimir(arquivo) {
  return new Promise((ok, falha) => {
    const img = new Image(); const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const max = 1024; let { width: w, height: h } = img;
      if (w > max || h > max) { const f = max / Math.max(w, h); w = Math.round(w * f); h = Math.round(h * f); }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      ok(cv.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = falha; img.src = url;
  });
}
document.getElementById('camera').addEventListener('change', async e => {
  const f = e.target.files?.[0]; e.target.value = '';
  if (!f || !fotoAlvo) return;
  try {
    const dataUrl = await comprimir(f);
    const alvo = fotoAlvo.tipo === 'pneu' ? S.pneus[fotoAlvo.k] : S.resp[fotoAlvo.k];
    if (alvo) alvo.foto = dataUrl;
  } catch (err) { console.error(err); }
  fotoAlvo = null; render();
});

// ---------------------------------------------------------------- eventos
document.addEventListener('click', e => {
  ultimoToque = Date.now();
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, k = el.dataset.k;
  if (a === 'tecla') {
    S.matErr = false;
    if (k === 'del') S.mat = S.mat.slice(0, -1);
    else if (k === 'ok') { const c = COLAB[S.mat]; if (c && c.ativo !== false) { S.matOk = true; S.nome = c.nome; } else S.matErr = true; }
    else if (S.mat.length < 10) S.mat += k;
  }
  else if (a === 'mat-sim') { TELA = 'inicio'; }
  else if (a === 'mat-nao' || a === 'trocar') { voltarMatricula(); return; }
  else if (a === 'iniciar') { S.etapa = 0; S.tentou = false; TELA = 'etapa'; }
  else if (a === 'marcar') {
    const alvo = el.dataset.tipo === 'pneu' ? S.pneus : S.resp;
    alvo[k] = alvo[k] || { s: '', obs: '', foto: null }; alvo[k].s = el.dataset.v;
    if (el.dataset.tipo === 'pneu' && el.dataset.v === 'ok') { const prox = Object.keys(PNEUS).find(p => !S.pneus[p]?.s); if (prox) S.pneuSel = prox; }
  }
  else if (a === 'pneu') { S.pneuSel = el.dataset.p; }
  else if (a === 'foto') { fotoAlvo = { tipo: el.dataset.tipo, k }; document.getElementById('camera').click(); return; }
  else if (a === 'tirar-foto') { const alvo = el.dataset.tipo === 'pneu' ? S.pneus[k] : S.resp[k]; if (alvo) alvo.foto = null; }
  else if (a === 'rotina') { S.rotinas[k] = S.rotinas[k] ? null : Date.now(); }
  else if (a === 'proximo') {
    if (!etapaCompleta(S.etapa)) { S.tentou = true; render(); return; }
    S.tentou = false; if (S.etapa < ETAPAS.length - 1) S.etapa++; else TELA = 'resumo';
  }
  else if (a === 'anterior') {
    S.tentou = false;
    if (TELA === 'resumo') { TELA = 'etapa'; S.etapa = ETAPAS.length - 1; }
    else if (S.etapa > 0) S.etapa--; else TELA = 'inicio';
  }
  else if (a === 'enviar') { if (!S.decl) { S.tentou = true; render(); return; } enviar(); return; }
  else if (a === 'proximo-colab') { voltarMatricula(); return; }
  else if (a === 'sair-disp') { signOut(auth); return; }
  render();
});
document.addEventListener('input', e => {
  ultimoToque = Date.now();
  const el = e.target, f = el.dataset.in; if (!f) return;
  if (f === 'obs') { const alvo = el.dataset.tipo === 'pneu' ? S.pneus : S.resp; if (alvo[el.dataset.k]) alvo[el.dataset.k].obs = el.value; }
  else if (f === 'lenha' || f === 'decl') S[f] = el.checked;
  else S[f] = el.value;
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'f-disp') return;
  e.preventDefault(); ERRO_LOGIN = '';
  try { await signInWithEmailAndPassword(auth, document.getElementById('em').value.trim(), document.getElementById('pw').value); }
  catch (err) { ERRO_LOGIN = 'E-mail ou senha incorretos, ou sem internet.'; render(); }
});
// atualização automática: se houver versão nova publicada e o tablet estiver livre na tela de matrícula, recarrega
setInterval(async () => {
  try {
    const r = await fetch('versao.json?t=' + Date.now(), { cache: 'no-store' });
    const { versao } = await r.json();
    if (versao && versao !== VERSAO && TELA === 'matricula' && !S.mat && !S.matOk) location.replace('./?v=' + versao);
  } catch { }
}, 300000);
// volta para a matrícula se o tablet ficar parado no meio de uma inspeção
setInterval(() => {
  if (['inicio', 'etapa', 'resumo'].includes(TELA) || (TELA === 'matricula' && (S.matOk || S.mat)))
    if (Date.now() - ultimoToque > INATIVIDADE_MIN * 60000) voltarMatricula();
}, 30000);

// ---------------------------------------------------------------- início
if (!configurado) irPara('config');
else onAuthStateChanged(auth, async user => {
  unsubs.forEach(u => u()); unsubs = []; USER = user;
  if (!user) { irPara('dispositivo'); return; }
  try {
    const u = await getDoc(doc(db, 'usuarios', user.uid));
    PERFIL = u.exists() ? u.data().perfil : null;
  } catch (err) { PERFIL = null; }
  if (!['tablet', 'admin'].includes(PERFIL)) { irPara('semPermissao'); return; }
  unsubs.push(onSnapshot(collection(db, 'colaboradores'), snap => { COLAB = {}; snap.forEach(d => { COLAB[d.id] = d.data(); }); }));
  unsubs.push(onSnapshot(doc(db, 'config', 'monday'), snap => {
    MONDAY = snap.exists() ? snap.data() : null;
    if (filaMonday.length && MONDAY?.ativo) enviarMonday(filaMonday.slice());
  }, () => { MONDAY = null; }));
  unsubs.push(onSnapshot(doc(db, 'status', EQ), snap => { STATUS = snap.exists() ? snap.data() : null; if (TELA === 'inicio') render(); }));
  voltarMatricula();
});
