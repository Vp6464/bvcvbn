# CPMA — Controle Motorista

Conversão do `teste.html` para React Native com Expo, Android, iOS e web. O HTML original permanece como referência.

## Executar

Requer Node.js 22.13 ou superior e npm.

```sh
npm install
npm start
```

No Windows PowerShell, caso a política de execução bloqueie os scripts, use `npm.cmd install` e `npm.cmd start`.
Abra o QR code no Expo Go compatível com o SDK 55 ou use um development build. Pressione `a` para emulador Android ou `w` para navegador. O simulador iOS exige macOS.

## Funcionalidades

- Lançamentos por data, horas e quilômetros com salvamento automático.
- Adição, edição e exclusão de ganhos e despesas diárias, fixas e pontuais.
- Resumos diário, semanal (segunda a domingo) e mensal.
- Valores em reais e entrada decimal com vírgula ou ponto.
- Dados locais com AsyncStorage, sem necessidade de servidor.

Informe datas em `AAAA-MM-DD` e toque em **Carregar data**. O mês do resumo usa `AAAA-MM`.

O resumo diário desconta apenas despesas do dia. No semanal, despesas mensais são divididas por 4 e anuais por 52, como no HTML. No mensal, anuais são divididas por 12; despesas semanais usam 52/12 (correção de omissão do original). Despesas pontuais continuam rateadas de acordo com o tipo mensal/anual do HTML; não representam cobranças com vencimento específico. Alterar despesas fixas ou pontuais recalcula também os resumos anteriores.

Dados do navegador do HTML não são transferidos automaticamente para o app. Desinstalar o aplicativo pode apagar os registros locais.

## Verificação

`npm test` verifica datas, valores e cálculos dos resumos. `npx expo install --check` verifica compatibilidade das dependências. `npx expo export --platform all` verifica a compilação dos bundles.

Compatibilidade de versões: [documentação oficial do Expo SDK](https://docs.expo.dev/versions/v55.0.0/).
