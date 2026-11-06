/**
 * "CARTEIRO" CHECKLIST 838T → MONDAY  (Google Apps Script, gratuito)
 *
 * Recebe as não conformidades enviadas pelo tablet/painel e cria um item no quadro
 * "Não Conformidades – Pá Mecânica 838T" do Monday. O token do Monday fica guardado
 * aqui, nas Propriedades do script — nunca no GitHub nem no tablet.
 *
 * Instalação: veja o README do repositório, seção "Integração com o Monday".
 * Propriedades do script necessárias (Configurações do projeto → Propriedades do script):
 *   MONDAY_TOKEN = token pessoal da API do Monday
 *   SEGREDO      = uma senha qualquer, a mesma digitada no painel (Configurações)
 */

const BOARD_ID = '18438848641';
const BOARD_URL = 'https://messigean18s-team.monday.com/boards/' + BOARD_ID;
const PAINEL_URL = 'https://geanfer10.github.io/checklist-caldeira/painel/';
const COL = {
  gravidade: 'color_mm8vz1tj',
  situacao: 'color_mm8v5r2g',
  descricao: 'long_text_mm8vte6b',
  data: 'date_mm8vqdd0',
  turno: 'text_mm8vz6dg',
  operador: 'text_mm8v87gz',
  grupo: 'text_mm8vf3wc',
  horimetro: 'numeric_mm8v84xs',
  idChecklist: 'text_mm8vf35m'
};

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, erro: 'JSON inválido' }); }
  if (!body.segredo || body.segredo !== props.getProperty('SEGREDO')) return json_({ ok: false, erro: 'Senha (SEGREDO) incorreta' });
  const token = props.getProperty('MONDAY_TOKEN');
  if (!token) return json_({ ok: false, erro: 'MONDAY_TOKEN não configurado no Apps Script' });

  const res = (body.itens || []).slice(0, 30).map(function (it) {
    try {
      const cols = {};
      cols[COL.gravidade] = { label: it.gravidade === 'c' ? 'Crítico' : 'Atenção' };
      cols[COL.situacao] = { label: 'Aberta' };
      cols[COL.descricao] = { text: (it.descricao || '') + (it.temFoto ? '\n\nFoto disponível no painel: ' + PAINEL_URL : '') };
      if (it.dataTurno) cols[COL.data] = { date: it.dataTurno };
      cols[COL.turno] = 'Turno ' + (it.turno || '');
      cols[COL.operador] = it.operador || '';
      cols[COL.grupo] = it.grupo || '';
      if (it.horimetro !== null && it.horimetro !== undefined && it.horimetro !== '') cols[COL.horimetro] = String(it.horimetro);
      cols[COL.idChecklist] = it.inspecaoId || '';

      const nome = (it.gravidade === 'c' ? '🔴 ' : '🟡 ') + (it.rotulo || 'Não conformidade');
      const query = 'mutation ($b: ID!, $n: String!, $c: JSON!) { create_item(board_id: $b, item_name: $n, column_values: $c, create_labels_if_missing: true) { id } }';
      const r = UrlFetchApp.fetch('https://api.monday.com/v2', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { Authorization: token },
        payload: JSON.stringify({ query: query, variables: { b: BOARD_ID, n: nome, c: JSON.stringify(cols) } })
      });
      const j = JSON.parse(r.getContentText());
      const id = j && j.data && j.data.create_item && j.data.create_item.id;
      return { ncId: it.ncId, mondayId: id || null, erro: id ? null : JSON.stringify(j.errors || j.error_message || r.getResponseCode()).slice(0, 300) };
    } catch (err) {
      return { ncId: it.ncId, mondayId: null, erro: String(err).slice(0, 300) };
    }
  });
  return json_({ ok: true, url: BOARD_URL, res: res });
}

function doGet() { return json_({ ok: true, servico: 'carteiro checklist 838T → Monday' }); }

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Rode esta função uma vez pelo editor (botão Executar) para testar: cria 1 item de teste no Monday. */
function testar() {
  const props = PropertiesService.getScriptProperties();
  const e = { postData: { contents: JSON.stringify({ segredo: props.getProperty('SEGREDO'), itens: [{ ncId: 'teste', rotulo: 'TESTE – pode excluir', gravidade: 'a', descricao: 'Item de teste do carteiro', grupo: 'Teste', turno: '1', dataTurno: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd'), operador: 'Teste', horimetro: 0, inspecaoId: 'teste' }] }) } };
  Logger.log(doPost(e).getContent());
}
