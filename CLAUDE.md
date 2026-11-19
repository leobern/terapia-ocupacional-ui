# Instruções do repositório — terapia-ocupacional-ui (Conductia)

Este arquivo vale para quem abrir **só este repositório**. O documento completo (processo, Figma,
speckit) está no repositório raiz `TerapiaNutricional`: `CLAUDE.md` e
`docs/artefatos/figma-fonte-da-verdade.md`. Em conflito, vale o da raiz.

## Figma é a fonte da verdade do visual

Página **"Conductia - V1"** do arquivo Figma Conductia (`zhRV09hpYhPYLp9UV8ojYc`, node `4577:9787`).

- Leia os valores no Figma **na hora de implementar** (MCP do Figma: `get_design_context`,
  `get_variable_defs`). Nunca use valores de memória: o Thiago ajusta os componentes lá.
- Reproduza **estrutura e detalhes exatamente** (colunas, ordem, tamanhos, espaçamentos).
  Compare Figma × navegador no mesmo viewport (402×874 e 1920×1080) antes de entregar.
- **Interações seguem a produção; o layout segue o Figma.** Se uma regra de produção impedir
  seguir o desenho, pergunte antes de decidir.
- Tela sem desenho: desenhe direto no Figma com os componentes `v2/*` e implemente, sem pedir
  aprovação (só o Thiago aprova, depois, no Figma). Avise no PR que o desenho é do agente.
- Código diverge do Figma: corrija o código (inclusive `_tokens.scss` e os specs `DS-*`).
- Nós criados no Figma: Clip Content desligado por padrão.

## Design system no código

- **Cores:** sempre `tokens.c(nome)` (`@use 'shared/styles/tokens'`). Nada de hex solto.
  Tokens: `src/app/shared/styles/_tokens.scss` (Light v2 padrão; bloco `data-theme='dark'` = Dark v2).
- **Tipografia:** mixins de `_typography.scss` (um por estilo `v2/*`). Espaços e raios: tokens `$space-*`, `$radius-*`.
- **Tema:** `ThemeService` aplica `data-theme` no `<html>`. Toda tela precisa funcionar em claro e
  escuro; teste os dois.
- **Fundo:** `app-background-mesh`. Home usa `variant="gradient"` (tokens `--color-bg-gradient-1..3`);
  as demais telas seguem com `blobs` até haver desenho novo.
- **Cor nunca é a única forma de transmitir status** (sempre texto junto). Área de toque mínima 44px.
- **Foto do paciente não aparece nas telas** (pode ficar no cadastro).

## Ícones (Phosphor)

- **Regular** por padrão (`<ph-icon>` já assume). **Bold** só em estado **ativo** ou **desabilitado**;
  `app-icon-button` faz isso com `active`, `disabled` e `ariaExpanded`.
- Exceção fixa: o ícone de **Sair** do menu é sempre bold.

## Antes de abrir PR (o CI exige tudo isto)

```powershell
corepack pnpm exec eslint src/app
corepack pnpm exec stylelint "src/**/*.scss"
corepack pnpm exec prettier --check "src/**/*.{scss,html}"
corepack pnpm exec ng test --watch=false --browsers=ChromeHeadless
```

- Cobertura mínima: 99% global e 90% por arquivo. Código novo entra **com teste**.
- Prettier cobre `.scss` e `.html`. Erros de build deixam o `ng serve` antigo no ar sem aviso:
  confira o log antes de concluir que algo funciona.
- Orçamento de SCSS por componente: aviso em 10 kB, erro em 16 kB.
- Comentários e mensagens de commit em português.
