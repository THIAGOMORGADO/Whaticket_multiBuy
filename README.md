1- API 6.2.1

2- Estilo Conversa (NEW)

3- Correção ao criar conta
(Agora cliente consegue entrar com senha criada)

4- Alteração CRON JOB para gerar fatura após 5 minutos
(5 minutos da conta criada)

```
Perdeu a senha ou removeu ADMIN?
Quer setar super admin para outro ID?

Primeiro: sudo -i -u postgres psql nome_db

Expande display para exibir dados
\x

SELECT * FROM "Users" WHERE "Users"."companyId" =x;
UPDATE "Users" SET super='t' WHERE id=X; (Corrigido)

NO LUGAR DO X COLOQUE ID DA COMANY.
NO LUGAR DO X (UPDATE) COLOQUE ID DO CLIENTE OU SEU.
```

```
Quer alterar logo?

Navegue até pasta /home/deploy/nomedaintancia/frontend/src/assets

Substitua sua logo pelos arquivos zapsimples e zapsimples_login (Jogue e só altere o nome)

Como alterar cores?

/home/deploy/nomedaintancia/frontend/src (Arquivo App.js) use sua creatividade!
```
