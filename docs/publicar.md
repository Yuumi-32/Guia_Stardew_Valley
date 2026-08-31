# Publicar o app na Play Store

O código já está pronto: o PWA está no ar, o `twa-manifest.json` está versionado e o
workflow **APK** monta o APK e o AAB assinados. O que falta não é código — é
identidade. Uma chave que só você pode criar, um arquivo que precisa morar na raiz
de um domínio, e uma conta de desenvolvedor.

Este é o roteiro na ordem. Cada passo depende do anterior, e cada um termina com um
jeito de conferir que deu certo antes de seguir.

> [!WARNING]
> Antes de tudo, a decisão que não é técnica: o guia usa arte do jogo. Manter uma
> página no GitHub é uma coisa; publicar app de fã com material de terceiros numa
> loja é outra, e a Play Store atende pedido de remoção por marca. O
> [`NOTICE.md`](../NOTICE.md) diz o que é de quem. Vale decidir isso de olhos
> abertos antes de gastar o resto do roteiro.

---

## 1. A chave de release

Ela decide a identidade do app para sempre. Perder a chave significa nunca mais
poder atualizar o app publicado — só publicar outro, do zero, com outro nome de
pacote. Por isso ela é sua, criada por você, e não entra neste repositório: o
`.gitignore` já barra `*.keystore` e `*.jks`.

### Gerar

O `keytool` vem com o JDK. Nesta máquina ele **não está no PATH** — o Java do PATH é
um JRE 8, velho demais. Use o JDK 21 que veio junto com o Android Studio:

```bash
"/c/Program Files/Android/Android Studio/jbr/bin/keytool" -genkeypair -v -keystore chave-release.keystore -alias guia-stardew -keyalg RSA -keysize 2048 -validity 10000
```

Ele pergunta uma senha do keystore, uma senha da chave e alguns dados de
identificação. Guarde as duas senhas onde você guarda senhas — elas não têm
recuperação.

Dois detalhes que não dá para errar:

- **O alias tem que ser `guia-stardew`.** É o que está em `signingKey.alias` no
  [`twa-manifest.json`](../twa-manifest.json), e é por ele que o Bubblewrap procura
  a chave dentro do keystore. Alias diferente, build quebrado.
- **`-validity 10000`** são uns 27 anos. A Play Store exige uma chave válida até
  pelo menos outubro de 2033; validade curta é recusada na hora do envio.

### Guardar

O arquivo `chave-release.keystore` fica **fora da pasta do repositório**. Não é só
higiene: é o único jeito de não comitar por acidente num `git add -A` distraído.
Faça uma cópia num lugar que não seja esta máquina.

### Conferir

```bash
"/c/Program Files/Android/Android Studio/jbr/bin/keytool" -list -v -keystore chave-release.keystore -alias guia-stardew
```

Tem que aparecer o alias `guia-stardew`, a validade lá em 2053 e o bloco de
impressões digitais. Anote o **SHA-256** — é ele que o passo 2 usa.

### Cadastrar os secrets

O workflow espera três, e o alias não é secret (ele sai do `twa-manifest.json`).
Transforme a chave em base64 primeiro:

```bash
base64 -w0 chave-release.keystore > chave.b64
```

No PowerShell não existe `base64`; lá o equivalente é:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("chave-release.keystore")) | Set-Content chave.b64 -Encoding ascii
```

Depois cadastre os três. O primeiro lê do arquivo; os outros dois perguntam a senha
sem mostrar na tela:

```bash
gh secret set KEYSTORE_BASE64 < chave.b64
```

```bash
gh secret set KEYSTORE_PASSWORD
```

```bash
gh secret set KEY_PASSWORD
```

Apague o `chave.b64` depois — ele é a chave inteira em texto. Confira o que ficou
cadastrado com `gh secret list`; devem aparecer os três nomes, sem os valores.

### Provar que funciona

Enquanto o workflow nunca rodou, a esteira é só teoria. Rode uma vez à mão:

```bash
gh workflow run apk.yml
```

Acompanhe com `gh run watch`. O passo *Confere que o APK está assinado* é o que
importa: se o `apksigner verify` passar, a chave chegou inteira e foi usada. Baixe
o artefato e confirme que o `versionName` não saiu vazio — é a pegadinha do campo
`appVersion` que está anotada no README.

- [ ] chave criada, com alias `guia-stardew`
- [ ] chave guardada fora do repositório, com cópia em outro lugar
- [ ] `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD` e `KEY_PASSWORD` cadastrados
- [ ] `chave.b64` apagado
- [ ] workflow **APK** rodou verde uma vez, com o `apksigner verify` passando
- [ ] SHA-256 anotado

---

## 2. O `assetlinks.json`

É o arquivo que prova que o app e o site são da mesma pessoa. Sem ele o app abre com
a barra de endereço do navegador aparecendo em cima — funciona, mas deixa de parecer
app, que era o motivo de empacotar.

### Por que ele não pode ficar aqui

Ele precisa ficar na **raiz do domínio**:

```
https://yuumi-32.github.io/.well-known/assetlinks.json
```

Não vale `https://yuumi-32.github.io/Guia_Stardew_Valley/.well-known/...` — o Android
só procura na raiz. E a raiz de `yuumi-32.github.io` hoje não serve nada, porque este
repositório publica num subcaminho.

Para servir a raiz existe um repositório especial: um chamado **`Yuumi-32.github.io`**
(o nome tem que ser exatamente o usuário) vira o site raiz da conta. Um `.well-known/`
com o arquivo dentro, e o endereço acima passa a existir. A alternativa é um domínio
próprio apontado para o Pages.

### Gerar o conteúdo

Depois que a chave do passo 1 existir:

```bash
bubblewrap fingerprint generateAssetLinks --output assetlinks.json
```

O que sai é isto, com o SHA-256 da sua chave no lugar do `AA:BB:CC:...`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "io.github.yuumi32.guiastardew",
    "sha256_cert_fingerprints": ["AA:BB:CC:..."]
  }
}]
```

> [!IMPORTANT]
> Se você entrar no **Play App Signing** — e app novo na Play Store entra
> obrigatoriamente —, o Google reassina o app com uma chave dele. A sua vira só a
> chave de envio. A partir daí a impressão digital que vale aqui é a **do Google**,
> que aparece no Play Console em *Configuração → Integridade do app*, e não a que
> você anotou no passo 1. Trocar as duas é o motivo mais comum de a barra de endereço
> continuar aparecendo com tudo o resto pronto. O seguro é listar as duas.

### Conferir

```bash
curl -i https://yuumi-32.github.io/.well-known/assetlinks.json
```

Tem que voltar `200` com `Content-Type: application/json`. O Google mantém um
validador oficial em `developers.google.com/digital-asset-links/tools/generator`, que
diz se o Android vai aceitar. Depois de instalar o APK, o teste real é abrir o app:
sem barra de endereço, deu certo.

- [ ] repositório `Yuumi-32.github.io` criado e publicando
- [ ] `.well-known/assetlinks.json` no ar, respondendo 200
- [ ] impressão digital do Play App Signing incluída, quando ela existir
- [ ] app abre em tela cheia, sem barra de endereço

---

## 3. A Play Store

Só depois dos dois anteriores.

**A conta.** Conta de desenvolvedor do Google Play, taxa única de US$ 25, com
verificação de identidade — leva alguns dias. Conta pessoal criada recentemente
ainda precisa cumprir um período de teste fechado, com um punhado de testadores por
algumas semanas, antes de poder publicar em produção. Essa regra já mudou mais de uma
vez; confira a versão atual no próprio Play Console antes de contar com um prazo.

**O arquivo.** Sobe o **`.aab`**, não o APK — app novo na loja é obrigado a mandar
bundle. O workflow já produz os dois: o `app-release-bundle.aab` é o que interessa
aqui, e o APK serve para instalar direto no aparelho e testar antes.

**A ficha.** O que a loja pede, e o que já existe:

| A loja pede | Onde está |
|---|---|
| Ícone 512×512 | [`icones/icone-512.png`](../icones/icone-512.png) |
| Capturas de celular | [`capturas/`](../capturas) — as três `celular-*` |
| Descrição curta | dá para partir do `description` do [`manifest.webmanifest`](../manifest.webmanifest) |
| Descrição longa | dá para partir do "O que é isto" do README |
| Imagem de destaque 1024×500 | não existe ainda |
| Política de privacidade, com URL pública | [`privacidade.html`](../privacidade.html), publicada em `https://yuumi-32.github.io/Guia_Stardew_Valley/privacidade.html` |
| Classificação indicativa | questionário no Console |

A política de privacidade já está escrita e sobe junto com o site — o guia não coleta
nada, não tem conta, não tem rastreamento e o progresso não sai do aparelho, mas a
loja exige a URL de qualquer jeito. Leia antes de colar o endereço no Console: quem
responde por ela é você.

- [ ] conta de desenvolvedor criada e verificada
- [ ] período de teste cumprido, se ainda for exigido
- [x] política de privacidade escrita — publica junto com o site, no próximo push
- [ ] imagem de destaque feita
- [ ] `.aab` enviado
- [ ] ficha preenchida e classificação respondida
