// =====================================================================
//  CHECKLIST DA PÁ MECÂNICA 838T
//  Para incluir, remover ou renomear um item, edite as listas abaixo.
//  - "id": código interno do item (sem espaço nem acento). NÃO mude o id de
//    um item que já tem histórico; para renomear, mude só o "rotulo".
//  - "rotulo": o texto que o operador vê.
//  Tipos de etapa: "itens" (OK / Atenção / Crítico), "pneus" (desenho com as
//  4 rodas + itens) e "rotinas" (botão Feito com hora automática).
//  Depois de editar, aumente o número da "versao".
// =====================================================================
export const CHECKLIST = {
  equipamento: '838T',
  nome: 'Pá Mecânica 838T',
  versao: '1',
  aviso: 'Proibido movimentar lenha com a pá mecânica 838T',
  pneus: { DE: 'Dianteira esquerda', DD: 'Dianteira direita', TE: 'Traseira esquerda', TD: 'Traseira direita' },
  etapas: [
    {
      id: 'niveis', titulo: 'Níveis', dica: 'Com o motor desligado', tipo: 'itens',
      itens: [
        { id: 'agua_radiador', rotulo: 'Água do radiador' },
        { id: 'oleo_transmissao', rotulo: 'Nível do óleo de transmissão' },
        { id: 'oleo_hidraulico', rotulo: 'Nível do óleo hidráulico' },
        { id: 'oleo_motor', rotulo: 'Nível do óleo do motor' },
        { id: 'agua_esguicho', rotulo: 'Nível de água do esguicho do para-brisa' }
      ]
    },
    {
      id: 'cabine', titulo: 'Cabine, fechaduras e tampas', tipo: 'itens',
      itens: [
        { id: 'fechadura_1', rotulo: 'Fechadura 1 · acesso à cabine' },
        { id: 'fechadura_2', rotulo: 'Fechadura 2 · acesso ao motor, lado direito' },
        { id: 'fechadura_3', rotulo: 'Fechadura 3 · acesso ao motor, lado esquerdo' },
        { id: 'fechadura_4', rotulo: 'Fechadura 4 · parte traseira da máquina' },
        { id: 'tampa_porta_garrafa', rotulo: 'Tampa do porta-garrafa de água' },
        { id: 'limpadores', rotulo: 'Limpador de para-brisa · dianteiro e traseiro' },
        { id: 'comandos_cabine', rotulo: 'Comandos internos da cabine em perfeitas condições de uso' }
      ]
    },
    {
      id: 'sinalizacao', titulo: 'Iluminação e sinalização', tipo: 'itens',
      itens: [
        { id: 'lanternas', rotulo: 'Lanternas' },
        { id: 'farois', rotulo: 'Faróis' },
        { id: 'buzina', rotulo: 'Buzina' },
        { id: 'giroflex', rotulo: 'Giroflex' },
        { id: 'sensor_sonoro', rotulo: 'Sensor sonoro (alarme de ré)' }
      ]
    },
    {
      id: 'pneus', titulo: 'Pneus e estado geral', tipo: 'pneus',
      itens: [
        { id: 'vazamentos', rotulo: 'Vazamento de óleo ou água' },
        { id: 'avarias', rotulo: 'Avarias gerais na máquina' }
      ]
    },
    {
      id: 'rotinas', titulo: 'Rotinas do turno', tipo: 'rotinas',
      itens: [
        { id: 'ventoinha', rotulo: 'Reversão da ventoinha do radiador', dica: '1 vez no turno, com as tampas laterais do motor abertas' },
        { id: 'limpeza_cabine', rotulo: 'Limpeza da cabine' },
        { id: 'limpeza_maquina', rotulo: 'Limpeza da máquina' }
      ]
    }
  ]
};

/** Todos os itens avaliados (OK/Atenção/Crítico), incluindo os 4 pneus, na ordem do checklist. */
export function itensAvaliados() {
  const lista = [];
  CHECKLIST.etapas.forEach(e => {
    if (e.tipo === 'pneus') Object.entries(CHECKLIST.pneus).forEach(([p, nome]) =>
      lista.push({ id: 'pneu_' + p, rotulo: `Pneu ${p} · ${nome}`, etapa: e.titulo, pneu: p }));
    if (e.tipo === 'itens' || e.tipo === 'pneus') e.itens.forEach(i => lista.push({ ...i, etapa: e.titulo }));
  });
  return lista;
}
export function rotinas() {
  return CHECKLIST.etapas.filter(e => e.tipo === 'rotinas').flatMap(e => e.itens);
}
