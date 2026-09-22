# Scoutly Internal

Backoffice separado da aplicação pública da Scoutly.

## Arquitetura

- App independente em `/internal`
- Deploy recomendado: projeto Vercel separado com **Root Directory = internal**
- Domínio: `internal.scoutly.pro`
- Firebase Auth para login Google
- Supabase existente para dados operacionais
- APIs próprias em `internal/api`
- Autorização server-side via tabela `internal_staff`
- Audit log para operações de suporte

Como o bundle e o deploy são separados, o Scoutly Internal **não aumenta o JavaScript nem o tempo de carregamento de scoutly.pro**.

## Antes do primeiro deploy

1. Aplicar a migration:
   - `supabase/migrations/007_internal_support.sql`
2. Criar um novo projeto na Vercel apontando para este mesmo repositório.
3. Definir Root Directory como `internal`.
4. Copiar as variáveis:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `FIREBASE_PROJECT_ID`
   - `SCOUTLY_APP_SUPABASE_URL`
   - `SCOUTLY_APP_SUPABASE_SECRET_KEY`
5. Adicionar:
   - `SCOUTLY_INTERNAL_ADMIN_EMAILS`
   - valor: lista de e-mails administrativos separada por vírgula
6. Configurar o domínio `internal.scoutly.pro`.
7. Adicionar `internal.scoutly.pro` aos domínios autorizados do Firebase Auth, se necessário.

## Segurança

O cliente nunca recebe a service-role key do Supabase. Toda chamada administrativa passa por API server-side, valida o ID token do Firebase e exige uma entrada ativa em `internal_staff`.

O primeiro administrador pode ser provisionado automaticamente usando `SCOUTLY_INTERNAL_ADMIN_EMAILS`. Depois disso, os acessos ficam registrados em `internal_staff`.

## MVP atual

- Dashboard operacional
- Tickets de suporte
- Respostas e notas internas
- Status/prioridade dos tickets
- Busca de clientes
- Perfil do cliente
- Plano e billing
- Contadores de uso
- Pipeline/favoritos do cliente
- Atividade recente
- Audit log
- Layout desktop e mobile dark
