# CLAUDE.md — Dashboard Odoo / facilitiesbr

> Leia este arquivo no início de TODA sessão. Regras aqui têm prioridade sobre comportamentos padrão do modelo. São inegociáveis — sem exceções sem aprovação explícita.

---

## Projeto

**Repo:** `/Users/lucasernesto/Documents/dashboard geral odoo/facilitiesbr`
**Vault Obsidian:** `/Users/lucasernesto/Documents/Lucão_MAC/Projetos/Dashboard_Odoo/`
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts + Supabase + Bun

---

## Fluxo obrigatório — toda demanda de código

```
1. ENTENDER    → ler demanda + ler toda {instructions}/{for-code}/ + confirmar ambiguidades
2. ESTRUTURAR  → plano com tiers, arquivos afetados, riscos, estimativas
3. APRESENTAR  → exibir plano, aguardar "ok" explícito
4. EXECUTAR    → tier por tier, pedir aprovação após cada tier
5. DOCUMENTAR  → ler obsidian-documentation.md, atualizar vault com mudanças e decisões
```

**Nunca pular etapas. Nunca encadear tiers automaticamente.**

### Step 1 — Leitura obrigatória antes de qualquer plano

Ler todos os arquivos de `{instructions}/{for-code}/`:

- `coding-conventions.md` — nomenclatura, estrutura de componente, state management
- `project-structure.md` — onde arquivos novos vão, regras por tipo
- `dry-refactoring.md` — utils extraídas, divergências intencionais
- `separation-of-concerns.md` — padrão container/presentational, pendências
- `dead-code-audit.md` — o que já foi identificado como morto
- `performance-audit.md` — otimizações pendentes e aprovadas

### Step 5 — Documentação obrigatória após mudanças

Ler `obsidian-documentation.md` antes de escrever qualquer nota. Regras:
- Frontmatter obrigatório (title, date, tags, aliases)
- Wikilinks `[[nome]]` para referências internas — nunca repetir conteúdo
- Callouts `> [!warning]` / `> [!note]` para destaques
- Tags hierárquicas: `direct-sales/componente`, `instructions/claude`
- Verificar se nota já existe antes de criar nova

| O que mudou | Onde documentar |
|-------------|-----------------|
| Nova feature / componente | Nota de página em `{page}` correspondente |
| Nova regra de negócio | Nova nota em `{info}bussiness-rule/` |
| Decisão arquitetural | `{general}/changelog.md` |
| Novo arquivo em `src/lib/` | `project-structure.md` tabela de `src/lib/` |
| DRY / extração | `dry-refactoring.md` seção "Estrutura atual" |
| Dead code removido | `dead-code-audit.md` seção "Arquivos removidos" |

---

## Tom — Caveman full por padrão

Caveman full em todas as respostas. Sem artigos, sem filler, fragmentos OK, sinônimos curtos.

Exceções (usar linguagem normal):
- Operações destrutivas / irreversíveis
- Sequências multi-step onde ordem é ambígua
- Apresentação de plano/arquitetura para aprovação → caveman lite

---

## Estrutura de tiers

Tier = grupo de mudanças por nível de risco. Formato obrigatório:

```
Tier X — [nome]
  Arquivos: [lista]
  Risco: baixo / médio / alto
  Dependências: [o que precisa estar pronto antes]
  Estimativa: ~N linhas alteradas
```

Exemplo de progressão correta:
```
Tier 1 — Criar util (risco zero)
Tier 2 — Atualizar consumidores (risco baixo)
Tier 3 — Atualizar estado global / pages (risco médio)
Tier 4 — Remover código substituído (risco: verificar imports)
```

---

## Regras inegociáveis

### Commits git
Agente NUNCA faz commit. Responsabilidade exclusiva do usuário. Pode:
- Sinalizar bom ponto de commit ao final de tier
- Preparar mensagem sugerida quando solicitado (só texto, não executar)

Nunca: `git commit`, `git push`, `git add` + commit, amend.

### Dead code
Nunca remover sem aprovação. Apresentar lista, aguardar ok, remover em lotes pequenos.

### Performance
Nunca aplicar otimizações React sem aprovação. Apresentar impacto, aguardar ok.

### Operações destrutivas

**Warning:** Antes de qualquer operação irreversível (delete arquivo, drop table, git reset --hard, rm -rf), pausar e apresentar:

```
⚠️ OPERAÇÃO DESTRUTIVA
Ação: [descrição exata]
Afeta: [arquivos / dados / branches]
Reversível: Não (ou: sim, via git)
Prosseguir?
```

Aguardar confirmação explícita. "Pode fazer tudo" de sessão anterior não autoriza operações destrutivas futuras.

### Discordância técnica
Nunca implementar silenciosamente se abordagem tem problema técnico. Sempre:
1. Reportar problema antes de qualquer código
2. Identificar onde vai quebrar
3. Apresentar tabela Prós/Contras/Onde quebra
4. Aguardar decisão do usuário — executar o que for aprovado

### Múltiplas arquiteturas válidas
Nunca escolher sozinho. Apresentar Opção A / Opção B + Recomendação. Aguardar aprovação.

### Reutilização de componentes — brand guideline

Antes de criar qualquer componente, card, badge, botão, formatação ou elemento visual novo:

1. **Varrer o codebase** em busca de componente existente com mesmo propósito/visual (`grep` ou `find` por nome/prop/estilo)
2. **Se encontrar match exato** → reutilizar sem criar novo
3. **Se encontrar match parcial ou ambíguo** → perguntar ao usuário antes de criar:
   > "Esse componente novo, você quer parecido com `{ComponenteEncontrado}`?"
4. **Só criar novo** se nenhum existente for aplicável — e documentar no vault como novo padrão

Objetivo: brand guideline consistente. Mesmos botões, badges, cards, ícones, estilos em todo o codebase.

### Lógica de negócio ambígua
Nunca assumir e implementar. Formular pergunta direta, aguardar resposta, registrar decisão no vault.

### Build failures durante execução
Máx. 2–3 tentativas de correção autônoma. Se não resolver: parar, reportar erro exato + arquivo + linha + o que tentei. Aguardar instrução.

Nunca: `--no-verify`, `--force` ou bypass similar sem aprovação explícita.

### Problemas em arquivos adjacentes
Não interromper tier em andamento. Registrar internamente, reportar ao final do tier: `"Encontrei também: [descrição] em [arquivo:linha]"`. Propor remoção em lote separado.

---

## Stack e convenções de código

### Stack técnica

| Decisão | Padrão |
|---------|--------|
| Estilização | Tailwind CSS — sem CSS modules, sem styled-components |
| Componentes base | shadcn/ui (Radix primitives) |
| Gráficos | Recharts |
| Animações | framer-motion (exceção: CSS @keyframes para animações simples sem estado) |
| Roteamento | react-router-dom v6 |
| Auth | Supabase |
| Build | Vite |
| Package manager | Bun — lock file: `bun.lockb` (NUNCA `package-lock.json` em paralelo) |

### Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Componentes | `PascalCase` | `DirectSalesPageControls` |
| Hooks | `camelCase` + prefixo `use` | `useDirectSalesRole` |
| Páginas | `PascalCase` + sufixo descritivo | `DesempenhoMensalPage.tsx` |
| Utilitários | `camelCase` | `dataValidation.ts` |
| Constantes | `UPPER_SNAKE_CASE` | `JGMS_MANAGER` |

### State management

| Situação | Padrão |
|----------|--------|
| Estado local simples | `useState` |
| Estado derivado | `useMemo` — nunca `useState` redundante |
| Efeito colateral | `useEffect` com deps explícitas |
| Estado global do módulo | Context (`DirectSalesContext`) |

### Comentários no código
- Comentar só o **porquê**, nunca o **o quê**
- Nunca multi-linha / docstrings — máx. 1 linha curta
- TODOs com contexto: `// TODO: [motivo] — [quando]`
- Não deixar código comentado sem explicação

### O que NÃO fazer
- Não adicionar features, abstrações ou refatorações além do pedido
- Não criar error handling para cenários impossíveis
- Não usar feature flags ou shims de retrocompatibilidade quando dá pra mudar código
- Não escrever docstrings multi-linha

---

## Estrutura de pastas — regras

```
src/
├── assets/           ← imagens/SVGs importados no código
├── components/
│   ├── direct-sales/ ← componentes de domínio (NÃO primitivas)
│   └── ui/           ← EXCLUSIVO shadcn/Radix primitives
├── contexts/         ← React Contexts
├── hooks/            ← custom hooks (prefixo use obrigatório)
├── lib/              ← utilitários, helpers, lógica de negócio
├── pages/
│   ├── direct-sales/
│   │   └── views/
│   │       └── manager/  ← subpainéis do gestor
│   ├── facilities/
│   └── tv-mode/
└── test/             ← testes
```

### Onde cada arquivo novo vai

| Tipo | Destino |
|------|---------|
| Componente domínio direct-sales | `src/components/direct-sales/` |
| Primitiva shadcn | `src/components/ui/` |
| Página / rota | `src/pages/[módulo]/NomePage.tsx` |
| View por role | `src/pages/[módulo]/views/NomeView.tsx` |
| Utilitário / helper | `src/lib/` |
| Custom hook | `src/hooks/useNome.ts` |
| Context | `src/contexts/NomeContext.tsx` |
| Asset | `src/assets/` |
| Edge Function | `supabase/functions/nome/index.ts` |

**Regra:** função em 2+ arquivos → extrai para `src/lib/`.

### Utilitários em `src/lib/` (mapeamento atual)

| Arquivo | Conteúdo |
|---------|----------|
| `directSalesUtils.ts` | Constantes + helpers compartilhados direct-sales/TV |
| `desempenhoUtils.ts` | Tipos + agregações DesempenhoMensalPage; `getInitials()` usado por BSA |
| `rankingUtils.ts` | Aggregations de ranking |
| `previaUtils.ts` | Tipos + agregações TV Mode |
| `tlUtils.ts` | `TlOp`, `TlMultiplierRow`, `computeTlCommission` |
| `dataValidation.ts` | Validação de dados externos |
| `filters.tsx` | Helpers de filtro com JSX |
| `utils.ts` | Helpers genéricos (cn, formatações) |
| `data.ts` | Dados estáticos |
| `facilitiesUtils.ts` | Constantes + helpers facilities (`MONTH_NAMES`, `getBadgeColor`, `formatMonthLabel` com espaço "Jan 2025") |
| `estoquUtils.ts` | Lógica de negócio estoque: `CategoryConfig`, `classifyItem`, `computeValidations`, `CATEGORY_CONFIG` (10 categorias) |

---

## Divergências intencionais — NÃO unificar sem discussão

| Item | Arquivo divergente | Motivo |
|------|--------------------|--------|
| `pctColor` | `DesempenhoMensalPage.tsx` → `pctColorDsm` | Tailwind literals, threshold 80% vs 70% |
| `StatusBadge` | `DesempenhoShared.tsx` | Mostra "Ativo", design diferente do global |
| `aggregateByManager` | `HistoricoRankingPage` vs `RankingPage` | `TeamMetrics` diverge — falta campo `teamName` |

---

## Arquitetura atual — módulo Direct Sales

```
DesempenhoMensalPage.tsx (~981 linhas)  ← orquestrador: fetch + state + render condicional
├── DesempenhoEmployee.tsx              ← view employee
├── DesempenhoTeamLeader.tsx            ← view team_leader
├── DesempenhoManager.tsx               ← view manager
├── DesempenhoShared.tsx                ← badges + KpiCard + MetricMiniCard compartilhados
└── views/manager/
    ├── PainelDoGestor.tsx              ← painel gestor
    ├── PictureModePanel.tsx            ← picture mode
    └── GeneralAnalyticsPanel.tsx       ← general analytics (employee + team_leader + manager)
```

### Hooks extraídos

| Hook | Arquivo | Responsabilidade |
|------|---------|-----------------|
| `useEmployeeAnalytics` | `src/hooks/useEmployeeAnalytics.ts` | Cálculos YTD + consistência + tendência do employee |
| `useEmployeeRankData` | `src/hooks/useEmployeeRankData.ts` | Queries async rank/GOAT/streak para employee |

### `AggregatedAnalyticsSection` — manager APENAS
Componente interno de `GeneralAnalyticsPanel`. Usado exclusivamente pelo `viewMode === "manager"`. View `team_leader` usa IIFE inline dedicado com Consistência do time, grid 4 colunas, tabela mês a mês com DeltaTd.

---

## Arquitetura atual — módulo BSA

```
BSAIndex.tsx                            ← layout principal: sidebar flutuante + gate ADMIN + rotas
├── contexts/BSAContext.tsx             ← estado global (viewMode, mês, dia, analistas)
├── components/bsa/
│   ├── BSAPageControls.tsx             ← theme/sync/view-switch + selectors de analyst/teamLeader
│   ├── BSAPageHeader.tsx               ← heading dinâmico por viewMode
│   ├── BSAFilterBar.tsx                ← seletor de mês + botão contextual + seletor de dia (admin)
│   └── BSAKpiCard.tsx                  ← card KPI glass: valueNode, valueBadge, infoContent, etc.
└── pages/bsa/
    ├── RankingBSAPage.tsx (~387 linhas) ← ranking de analistas BSA (dados placeholder)
    └── ResumoHorasPage.tsx (~922 linhas) ← KPIs diários/mensais, gráfico tendência, resumo anual
```

---

## Regras de negócio chave

### Férias e Ramp-up
- `isVacation` / `isRampUp`: detectados via `skip_record && active !== false` e `plan_name.startsWith("[RAMP-UP]")`
- Em mês individual: target excluído dos cálculos de consistência
- Em agregações trimestrais/anuais: achieved entra, target contabiliza junto
- **Ranking:** achieved de férias/ramp-up ENTRA no ranking — modelo de negócio, não bug

### `MonthEntry` interface (`src/hooks/useEmployeeAnalytics.ts`)

```ts
interface MonthEntry {
  monthKey: string;        // "2026-01"
  label: string;           // "Jan"
  mrrAchieved: number;
  mrrTarget: number;
  mrrPct: number;
  nrrAchieved: number;
  nrrTarget: number;
  nrrPct: number;
  commission: number;
  mrrCommission: number;
  nrrCommission: number;
  hasTarget: boolean;
  isVacation: boolean;
  isRampUp: boolean;
  teamType: string | null; // time do vendedor no mês
}
```

### Consistência — mediana composta
`medianComposite = (medianMrr + medianNrr) / 2` — excluindo meses isVacation/isRampUp.
Mediana escolhida sobre média: resistente a meses extremos.

### Tendência
`trendComposite = avg(2ª metade %) - avg(1ª metade %)`
Categorias: Acelerando (≥ +15 pp) · Estável (entre −15 e +15 pp) · Desacelerando (≤ −15 pp).

### Volatilidade
Desvio padrão dos `(mrrPct + nrrPct) / 2` mensais.
Categorias: Baixa (< 20 pp) · Média (20–40 pp) · Alta (> 40 pp).

### Constantes de cor — nomes invertidos (ATENÇÃO)
```ts
const CYAN = "#714B67"   // visualmente roxo/lilás
const PURPLE = "#017E84" // visualmente teal/verde-azulado
```
Nomes históricos mantidos — não renomear sem refatorar todas as referências.

---

## Performance — pendências

| Item | Status | Ação |
|------|--------|------|
| `lucas_mayer.png` (604 KB) | Pendente aprovação | Comprimir → WebP 64×64px ~5KB |
| `rodrigo_marba.png` (684 KB) | Pendente aprovação | Comprimir → WebP 64×64px ~5KB |
| `React.memo` nos componentes compartilhados | ✅ Feito | `RankIcon`, `StatusBadge`, `TeamBadge` |
| `useCallback` nos togglers | ✅ Feito | `RankingPage`, `HistoricoRankingPage` |

---

## Sessão longa

- Sinalizar proativamente: `"Sessão longa — considere nova sessão para próxima demanda"`
- Garantir vault atualizado (step 5) antes de encerrar

---

## Testing

Mínimo obrigatório: TypeScript compile sem erros.
Para funções com lógica complexa: propor unit test em `src/test/` ao final do tier. Não bloquear aprovação — apenas sinalizar ausência.

---

## Referências do vault

```
{instructions}/ai-best-practices.md
{instructions}/{for-code}/coding-conventions.md
{instructions}/{for-code}/project-structure.md
{instructions}/{for-code}/dry-refactoring.md
{instructions}/{for-code}/dead-code-audit.md
{instructions}/{for-code}/separation-of-concerns.md
{instructions}/{for-code}/performance-audit.md
{instructions}/obsidian-documentation.md
```
