# Checklist Pá Mecânica 838T · PCM Goiás Verde Luziânia

App de checklist de turno da Pá Mecânica 838T.

- **Tablet do setor:** o operador digita a matrícula e faz o checklist. Depois do envio, o tablet volta sozinho para a tela de matrícula.
- **Painel do supervisor (computador):** diário por turno, não conformidades com nº de OS do Nectar, histórico e exportação para Excel.

Custo: **R$ 0**. Usa GitHub Pages para hospedar o site e Firebase (plano gratuito Spark) para o banco e o login.

| O quê | Endereço |
|---|---|
| App do tablet | `https://geanfer10.github.io/checklist-caldeira/` |
| Painel do supervisor | `https://geanfer10.github.io/checklist-caldeira/painel/` |

---

## Instalação (feita uma única vez)

### 1. Ligar o GitHub Pages
1. No repositório, abra **Settings → Pages**.
2. Em *Source*, escolha **Deploy from a branch**. Em *Branch*, escolha **main** e a pasta **/ (root)**. Clique em **Save**.
3. Depois de 1 ou 2 minutos, o site fica no ar nos endereços acima.

### 2. Criar o projeto no Firebase
1. Acesse <https://console.firebase.google.com> com a sua conta Google.
2. Clique em **Criar projeto**, use o nome `checklist-caldeira` e **desative** o Google Analytics (não é necessário).
3. Na página do projeto, clique no ícone **Web `</>`**, dê um apelido (ex.: `app`) e clique em **Registrar app**. **Não** marque Firebase Hosting.
4. O Firebase mostra um bloco `firebaseConfig = { apiKey: ..., ... }`. Copie os 6 valores para o arquivo **`js/firebase-config.js`** (ou envie esse bloco para o Claude, que preenche).

> Esses dados não são senha e podem ficar públicos no GitHub. Quem protege as informações são as regras do passo 3.

### 3. Criar o banco de dados (Firestore)
1. No menu **Criação → Firestore Database**, clique em **Criar banco de dados**.
2. Localização: **southamerica-east1 (São Paulo)**. Modo: **produção**.
3. Abra a aba **Regras**, apague o conteúdo, cole todo o arquivo **`firestore.rules`** deste repositório e clique em **Publicar**.

### 4. Ligar o login e criar as contas
1. No menu **Criação → Authentication**, clique em **Começar**, escolha **E-mail/senha**, ative e salve.
2. Na aba **Usuários**, clique em **Adicionar usuário** e crie:
   - **Você (admin):** o seu e-mail e uma senha forte.
   - **O tablet:** um e-mail só para o aparelho, que não precisa existir de verdade, por exemplo `tablet.838t@checklist-caldeira.app`, com uma senha forte. Anote a senha: ela é usada uma única vez, para conectar o tablet.
   - **Cada supervisor:** o e-mail dele e uma senha provisória.
3. Copie o **UID** de cada conta (coluna "UID do usuário").
4. Volte ao **Firestore Database → Dados → Iniciar coleção**:
   - ID da coleção: `usuarios`
   - ID do documento: **o UID da conta**
   - Campos (tipo *string*): `perfil` = `admin`, `tablet` ou `supervisor`, e `nome` = nome que aparece no painel.
   - Repita **Adicionar documento** para cada conta.

### 5. Cadastrar os colaboradores (matrículas)
1. Abra o **painel** no computador e entre com a sua conta admin.
2. Na aba **Colaboradores**, adicione a matrícula e o nome de cada operador (ex.: `00123` · `Carlos M.`).
3. O nome aparece no tablet para confirmação: "Você é Carlos M.?".

### 6. Preparar o tablet
1. Abra o endereço do app no **Chrome** do tablet e entre com a **conta do tablet** (passo 4).
2. Menu **⋮ → Adicionar à tela inicial**. O app abre em tela cheia pelo ícone.
3. Recomendado, para prender o tablet no app: **Configurações → Segurança → Fixação de apps** (o nome pode variar por marca). Ative, abra o app e fixe-o na tela de apps recentes.

---

## Uso no dia a dia

**Operador (tablet):** digita a matrícula, confirma o nome e toca em **Iniciar checklist**. Percorre as etapas (abertura, níveis, cabine, sinalização, pneus, rotinas) e envia. Depois de 8 segundos, o tablet volta sozinho para a matrícula.
- Item em **Atenção** ou **Crítico** exige descrição; a foto é opcional.
- Qualquer item **Crítico** faz a inspeção sair como **MÁQUINA BLOQUEADA**.
- Se o tablet ficar 10 minutos parado no meio de um checklist, ele volta para a tela de matrícula.
- Se o Wi-Fi cair, a inspeção fica guardada no tablet e é enviada sozinha quando a conexão voltar.

**Supervisor (computador):** abre o painel, que se atualiza sozinho.
- **Diário:** os 3 turnos do dia escolhido.
- **Não conformidades:** registre o **nº da OS do Nectar** e depois marque como **Resolvida**.
- **Exportar Excel:** baixa as inspeções (item por item) e as não conformidades do período. Recomendado: exportar 1 vez por semana e guardar no SharePoint como backup.

---

## Manutenção

| Quero… | Onde mexer |
|---|---|
| Incluir, remover ou renomear itens do checklist | `js/checklist-838t.js` (instruções no topo do arquivo) |
| Mudar o horário dos turnos | `js/turnos.js` |
| Mudar o tempo de volta automática ou de inatividade | topo do `js/app.js` (`SEG_VOLTAR`, `INATIVIDADE_MIN`) |
| Adicionar ou desativar operador | painel → aba **Colaboradores** |
| Novo supervisor | passo 4 (criar conta + documento em `usuarios`) |
| Supervisor esqueceu a senha | Firebase → Authentication → Usuários → ⋮ → **Redefinir senha** (envia e-mail) ou excluir e recriar a conta com o mesmo e-mail (atualize o UID em `usuarios`) |

Toda alteração enviada ao GitHub é publicada sozinha em 1 a 2 minutos. No tablet, basta fechar e abrir o app.

**Versão dos arquivos:** os endereços dos scripts terminam em `?v=AAAAMMDDx` (em `index.html`, `painel/index.html` e nos `import` dos arquivos `js/`). Ao publicar uma alteração, troque esse número em todos eles: isso obriga os navegadores a baixar a versão nova em vez de usar a guardada em cache.

**Importante:** não mude o `id` de um item que já tem histórico. Para trocar o texto que aparece, mude só o `rotulo`.

---

## Integração com o Monday (não conformidades → quadro do Monday)

Cada item marcado como **Atenção** ou **Crítico** no tablet vira um item no quadro **"Não Conformidades – Pá Mecânica 838T"** do Monday, no workspace *Planejamento & Controle da Manutenção*. Uma automação do próprio Monday notifica os responsáveis assim que o item é criado.

O envio passa por um **"carteiro" no Google Apps Script** (gratuito). Assim, o token do Monday fica guardado no Google, nunca no GitHub nem no tablet.

### Instalação (uma única vez)
1. **Token do Monday:** no Monday, clique na sua foto → **Developers** → **My access tokens** → **Show** → copie.
2. **Criar o carteiro:** acesse <https://script.google.com> → **Novo projeto**. Apague o conteúdo e cole todo o arquivo **`integracao/monday-apps-script.gs`**. Salve (ícone de disquete) com o nome `Carteiro Checklist 838T`.
3. **Guardar o token e a senha:** clique na engrenagem **Configurações do projeto** → **Propriedades do script** → **Adicionar propriedade**:
   - `MONDAY_TOKEN` = o token copiado no passo 1
   - `SEGREDO` = uma senha inventada (ex.: `pcm838t-2026-xyz`)
   - Clique em **Salvar propriedades do script**.
4. **Testar:** volte ao editor, escolha a função **`testar`** no menu do topo e clique em **Executar**. Na primeira vez o Google pede autorização: *Revisar permissões → sua conta → Avançado → Acessar (não seguro) → Permitir*. Um item "TESTE" deve aparecer no quadro do Monday (pode excluir).
5. **Publicar:** clique em **Implantar → Nova implantação** → engrenagem → **App da Web**:
   - *Executar como:* **Eu**
   - *Quem pode acessar:* **Qualquer pessoa**
   - Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).
6. **Ligar no painel:** no painel, abra a aba **Configurações → Integração com o Monday**. Cole a URL, digite o mesmo `SEGREDO`, marque **Ativo** e clique em **Salvar**. Depois clique em **Testar conexão**.

### Como funciona
- O tablet envia as não conformidades logo após o checklist. Se a internet falhar, elas ficam numa fila no tablet e são reenviadas a cada 3 minutos.
- No painel, cada não conformidade mostra **"Ver no Monday ↗"**. Se o envio automático falhou, aparece o botão **"Enviar ao Monday"** para mandar manualmente.
- Notificações: são configuradas no Monday (quadro → **Automatizar**). Já existe uma automação que avisa o Gean a cada item novo. Para avisar outras pessoas, edite essa automação ou crie outra (ex.: "quando Gravidade mudar para Crítico, notificar…").
- Se você alterar o código do carteiro, use **Implantar → Gerenciar implantações → editar → Nova versão**, para manter a mesma URL.

---

## Estrutura

```
index.html              app do tablet
painel/index.html       painel do supervisor
css/app.css             visual do tablet
css/painel.css          visual do painel
js/firebase-config.js   dados do projeto Firebase (preencher)
js/firebase.js          conexão com o banco e modo offline
js/checklist-838t.js    ITENS DO CHECKLIST
js/turnos.js            horários dos turnos 1, 2 e 3
js/app.js               lógica do tablet
js/painel.js            lógica do painel
firestore.rules         regras de segurança do banco
manifest.webmanifest    ícone e tela cheia no tablet
```

### Dados no Firestore
| Coleção | Conteúdo |
|---|---|
| `usuarios` | perfil de cada conta (admin, supervisor, tablet) |
| `colaboradores` | matrícula → nome, ativo |
| `inspecoes` | cada checklist enviado: turno, operador, horímetro, respostas, pneus, rotinas, status |
| `naoConformidades` | cada item em Atenção/Crítico, com situação (aberta, OS, resolvida) e nº da OS |
| `fotos` | fotos comprimidas dos problemas |
| `config` | configurações (ex.: `monday`: URL do carteiro, senha, ativo) |
| `status` | resumo da última inspeção, mostrado na tela inicial do tablet |

### Limites do plano gratuito (Spark)
50 mil leituras e 20 mil gravações por dia, e 1 GB de dados. Com 3 checklists por dia, o uso fica muito abaixo disso. Se um limite for atingido, o serviço para até o dia seguinte, sem gerar cobrança.
