# Lista de compras compartilhada

App web responsivo, pensado primeiro para celular. A lista fica no Supabase, com login Google, controle de acesso por e-mail e atualização em tempo real entre os dispositivos.

## O que o projeto faz

- Adiciona, marca como comprado e remove itens.
- Atualiza a lista nos navegadores conectados.
- Restringe leitura e edição aos e-mails autorizados no banco.
- Importa vários itens colados em linhas separadas ou um JSON exportado pelo próprio app.
- Exporta uma cópia JSON da lista.
- Mantém a preferência de tema claro/escuro neste dispositivo.

## Custos e privacidade

O GitHub Free permite publicar no GitHub Pages, mas o repositório precisa ser público. A página de login também ficará publicamente acessível; os dados da lista ficam protegidos no Supabase por login e políticas RLS. O código-fonte publicado não deve conter e-mails pessoais, senhas ou chaves de serviço.

O plano Free do Supabase inclui uma instância Postgres de 500 MB e recursos de autenticação e Realtime suficientes para uma lista doméstica pequena. Projetos Free com pouca atividade podem ser pausados após uma semana. A autenticação aqui usa Google, então não depende do serviço de e-mail de confirmação do Supabase.

## Configurar o banco

1. Crie um projeto Free no Supabase.
2. Abra **SQL Editor**, copie `supabase/schema.sql` e execute uma vez.
3. Ainda no SQL Editor, autorize apenas as duas contas Google que vão usar a lista. Substitua os exemplos pelos e-mails corretos e execute sem salvar e-mails no repositório:

   ```sql
   insert into public.allowed_users (email)
   values (lower(trim('seu-email-google'))), (lower(trim('email-google-da-ju')))
   on conflict (email) do nothing;
   ```

4. Ative Realtime para a tabela `shopping_items` em **Database → Publications → supabase_realtime**. A permissão RLS também é aplicada aos eventos recebidos pelos clientes.
5. Em **Project Settings → API**, copie a Project URL e a publishable key (ou a chave `anon` legada) para `config.js`:

   ```js
   window.APP_CONFIG = {
     supabaseUrl: "https://SEU_PROJECT_REF.supabase.co",
     supabaseAnonKey: "SUA_CHAVE_PUBLICA"
   };
   ```

   A chave `publishable`/`anon` é usada no navegador. **Nunca** use `service_role` ou outra chave secreta neste arquivo.

## Configurar login Google

O login Google evita depender dos e-mails de confirmação do Supabase.

1. No Google Cloud Console, crie um OAuth Client do tipo **Web application**. Cadastre como URI de redirecionamento autorizado o callback mostrado em **Supabase → Authentication → Sign In / Providers → Google**, no formato `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`.
2. Copie o Client ID e o Client Secret para o provedor Google no Supabase.
3. Em **Supabase → Authentication → URL Configuration**, configure a Site URL e as Redirect URLs com a URL final do GitHub Pages, incluindo o caminho do repositório, por exemplo `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`.
4. Enquanto o app estiver em teste, adicione as duas contas como usuários de teste na tela de consentimento OAuth do Google. Não solicite escopos além de e-mail, perfil e OpenID.

## Publicar no GitHub Pages

1. Crie um repositório GitHub **público** para este projeto e envie os arquivos desta pasta mantendo a estrutura.
2. No repositório, abra **Settings → Pages**. Escolha a branch `main` e a pasta `/ (root)` como fonte de publicação.
3. Aguarde o GitHub Pages publicar e copie a URL exibida. Atualize as Redirect URLs do Supabase com essa URL e autorize o mesmo endereço no OAuth do Google se ele for pedido como origem JavaScript.
4. Abra a página no iPhone, entre com uma das contas Google autorizadas e adicione a lista. A Ju entra com a conta autorizada dela. Os dois precisam de conexão para ver as atualizações em tempo real.

## Trazer os itens da lista antiga

O navegador não permite que este novo domínio leia o `localStorage` do site antigo. No primeiro acesso, use **Adicionar vários** e cole os itens, um por linha. Se você tiver um JSON exportado no formato `{ "items": [{ "name": "Leite", "done": false }] }`, também pode colar esse conteúdo no mesmo campo.

## Estrutura

- `index.html`, `styles.css`, `app.js`: interface e interações.
- `config.js`: URL e chave pública do Supabase.
- `supabase/schema.sql`: tabelas, grants e políticas RLS.
- `manifest.webmanifest`, `icon.svg`: metadados para a experiência móvel.
