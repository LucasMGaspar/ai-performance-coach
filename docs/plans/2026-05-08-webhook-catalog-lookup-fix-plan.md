# Plano: Corrigir lookup de exercícios no webhook
Data: 2026-05-08
Branch: fix/webhook-catalog-lookup

## Contexto

Em `src/routes/webhook.ts`, o `case "workout"` do switch tem dois problemas:

1. **N queries desnecessárias**: `prisma.exerciseCatalog.findMany()` é chamado dentro do `for` loop de exercícios (linha 103). Para um treino com 5 exercícios = 5 chamadas idênticas ao banco.

2. **Fallback silencioso para `catalog[0]`**: linha 117 usa `catalogEntry ?? catalog[0]`. Se o exercício não for reconhecido, grava tudo como o primeiro exercício do catálogo (normalmente "Supino Reto") sem avisar o utilizador. Isto corrompe PR, progressão e volume silenciosamente.

## Objectivo

- Busca do catálogo feita **uma única vez** antes do loop.
- Se exercício não for reconhecido: **skip** (não grava) + acumula nome para informar o utilizador no final.
- Exercícios reconhecidos continuam a ser registados normalmente.
- Utilizador recebe mensagem clara quando há exercícios não reconhecidos.

## Passos de Implementação

### Passo 1 — Mover `findMany` para fora do loop

**Ficheiro:** `src/routes/webhook.ts`

Antes do `for (const exercise of result.exercises)`, adicionar:

```ts
// @ts-ignore — prisma generate necessário
const catalog = await prisma.exerciseCatalog.findMany();
```

Remover a declaração `const catalog = ...` que está dentro do loop (linha 103).

**Verificação:** Apenas uma chamada ao banco independentemente do número de exercícios no treino.

---

### Passo 2 — Eliminar fallback silencioso e acumular não reconhecidos

**Ficheiro:** `src/routes/webhook.ts`

Antes do loop, declarar:

```ts
const unrecognizedExercises: string[] = [];
```

Dentro do loop, substituir:

```ts
// ANTES (linha 117):
const resolvedEntry = catalogEntry ?? catalog[0];

if (!resolvedEntry) { ... } // guarda de catálogo vazio
```

Por:

```ts
if (!catalogEntry) {
  unrecognizedExercises.push(exercise.exerciseName);
  continue; // skip — não grava exercício não reconhecido
}

const resolvedEntry = catalogEntry;
```

A guarda de `catalog[0]` existente (catálogo vazio → aviso ao admin) é mantida **antes do loop** como verificação única:

```ts
if (catalog.length === 0) {
  responseMessage = "⚠️ Catálogo de exercícios vazio. Contacta o administrador.";
  break;
}
```

---

### Passo 3 — Informar utilizador sobre exercícios não reconhecidos

**Ficheiro:** `src/routes/webhook.ts`

Após o loop, antes do `progressionService.updateStreak`, adicionar:

```ts
if (unrecognizedExercises.length > 0) {
  const listagem = unrecognizedExercises.map(n => `• ${n}`).join("\n");
  const avisoNaoReconhecido = `\n\n⚠️ Não reconheci ${unrecognizedExercises.length === 1 ? "este exercício" : "estes exercícios"} — não foram registados:\n${listagem}\n_Verifica o nome ou pede para adicionar ao catálogo._`;
  responseMessage = responseMessage
    ? `${responseMessage}${avisoNaoReconhecido}`
    : avisoNaoReconhecido.trim();
}
```

---

### Passo 4 — Ajuste: só actualizar streak se pelo menos um exercício foi registado

**Ficheiro:** `src/routes/webhook.ts`

Encapsular `progressionService.updateStreak(user.id)` numa condição:

```ts
const algumRegistado = result.exercises.length > unrecognizedExercises.length;
if (algumRegistado) {
  await progressionService.updateStreak(user.id);
}
```

Não faz sentido incrementar streak se todos os exercícios foram inválidos.

---

## Verificação Final

- [ ] `bun run typecheck` (ou `npx tsc --noEmit`) sem erros
- [ ] `bun run build` passa
- [ ] Teste manual: enviar treino com exercício inválido → deve receber aviso + exercícios válidos registados
- [ ] Teste manual: enviar treino com todos os exercícios válidos → comportamento inalterado
- [ ] Teste manual: enviar treino sem nenhum exercício válido → só recebe aviso, streak não incrementa

## Fora de Escopo

- Fuzzy matching melhorado (issue separada)
- Cache do catálogo em Redis (issue separada)
- Qualquer outra mudança no webhook além do case "workout"

## Package Manager

`bun` — existe `bun.lock` na raiz.
