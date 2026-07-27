# Planejador Financeiro Mensal — PWA

Aplicativo 100% local (IndexedDB), sem backend, para planejar antecipadamente receitas,
despesas, compras no cartão, parcelas e assinaturas do próximo mês. Identidade visual
"Liquid Glass" (tema claro).

## Como usar

Abra `index.html` num navegador. Para instalar como PWA (ícone na tela inicial, uso
offline completo com Service Worker), sirva a pasta por HTTPS ou `http://localhost`
(Service Workers não funcionam em `file://`, restrição do próprio navegador) — por
exemplo: `npx serve .` ou qualquer servidor estático, e abra a URL indicada. Em
`http://localhost` a instalação e o cache offline funcionam normalmente.

## Estrutura

```
index.html          shell principal, carrega todos os módulos
css/style.css        design system "Liquid Glass"
js/db.js             IndexedDB (schema + CRUD genérico)
js/calc.js           motor central de cálculo (fonte única de verdade)
js/store.js          regras de negócio (recorrência, parcelas, assinaturas, reembolsos)
js/ui.js              helpers de interface (modais, toasts, formatação)
js/charts.js          gráficos SVG sem dependências externas (funciona offline)
js/forms.js           formulários/modais de cadastro
js/details.js         modais de detalhe (editar/excluir/duplicar)
js/views/*.js         telas: dashboard, movimentações, cartões, parcelas, pessoas, relatórios, configurações
js/tests.js           rotina interna de testes do motor de cálculo
js/app.js             roteamento e casca da aplicação
manifest.json, sw.js  PWA (instalação + cache offline)
```

## Decisões de arquitetura e regras de negócio

Onde o pedido deixava mais de uma interpretação razoável, optei pela solução mais
intuitiva para um planejador financeiro mensal, documentada aqui:

1. **Fatura é identificada pelo mês de fechamento.** Uma compra feita até o dia de
   fechamento entra na fatura que fecha naquele mês; após o fechamento, entra na
   fatura seguinte. O vencimento é calculado a partir do dia de vencimento do cartão,
   no mesmo mês do fechamento (se o vencimento for depois do fechamento) ou no mês
   seguinte (se o vencimento for antes/igual, ex: fecha dia 28, vence dia 5).

2. **Saldo projetado = Receitas − Despesas próprias − Faturas totais dos cartões.**
   O valor total da fatura (incluindo a parte de terceiros) é o que efetivamente sai
   da conta do usuário no pagamento da fatura; por isso entra inteiro no cálculo do
   saldo. "Quanto uma pessoa deve" é controlado separadamente (tela Pessoas) e não
   reduz o comprometido — ele só se reflete no saldo quando o reembolso é lançado
   como uma entrada (o usuário pode registrar isso como receita, se desejar).

3. **Divisão de compras é guardada por valores absolutos por pessoa** (não por
   percentual), validando que a soma seja exatamente igual ao valor total da compra.
   Em compras parceladas, a divisão de cada parcela é calculada por alocação
   cumulativa (não parcela a parcela isolada), garantindo que a soma das parcelas de
   cada pessoa feche exatamente com o valor total dividido a ela, sem sobra/perda de
   centavos.

4. **Assinaturas indeterminadas** geram um horizonte de 36 meses de lançamentos
   futuros a partir da data de início; ao cancelar, os lançamentos futuros a partir do
   mês informado são removidos e o histórico é preservado.

5. **Edição de compras parceladas/assinaturas** oferece duas opções: atualizar
   "esta e as próximas" (mantém parcelas já passadas) ou "toda a série" (regenera
   tudo). Exclusão oferece "somente esta parcela" ou "compra inteira".

6. **Estornos** são modelados como uma compra no cartão com valor negativo,
   marcada com a tag "ESTORNO", podendo ser vinculada à compra original; o valor
   negativo já reduz automaticamente o total da fatura do mês em que ocorre.

7. **Limite utilizado do cartão** é calculado como a soma de todas as faturas em
   aberto (mês atual em diante), refletindo o compromisso futuro no limite —
   interpretação mais conservadora e comum entre apps financeiros.

8. **Categorias, pessoas e cartões** usam UUID como identificador e nunca são
   apagados fisicamente das movimentações já lançadas ao excluir o cadastro (a
   movimentação preserva o vínculo histórico); excluir uma pessoa não apaga
   compras já lançadas, apenas a removerá das listas de cadastro.

## Testes internos

Em Configurações → "Executar testes internos" o app roda uma suíte de 20 verificações
cobrindo os cenários financeiros do briefing (saldo projetado, divisão de compras,
parcelamento com arredondamento exato, motor de fechamento/vencimento de fatura,
estornos e assinaturas com data final). Todos os 20 passam na versão entregue.
