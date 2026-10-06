# MEMORY.md — Project State

*Last updated: 2026-03-18 (Sessão 13 — completa)*

-----

## What this project is

Football Manager no browser — Premier League + Championship com promoção/relegação, squad management, simulação de jogos, transferências, tudo. Experimento de vibe coding entre Dany e Claude Code.

**~13,000 linhas de código. Vanilla JS puro. Zero frameworks.**

-----

## Current state

Sessão 13 completa. Half-Time Substitutions (pitch interativo, max 5 subs), Red Cards, Halftime Tactics Panel (formação + player instructions no intervalo).

-----

## What's done

### Core Engine
- [x] `dataEPL.js` — 44 equipas EPL/Championship com ~900 jogadores hand-crafted, stats por posição, potential, valores realistas. Define `makePlayer`, `pid()`, `LEAGUES`, `TEAM_MAP`, `ALL_TEAMS`, `COUNTRY_CONFIG`, `makeTeamSquad`, `makeNameFor`.
- [x] `engine.js` — simulação minuto a minuto, stats individuais por posição, traits como multiplicadores, staff effects, upset factor 0.88–1.12, stadium capacity dinâmica para gate receipts
- [x] `season.js` — fixtures, tabelas, promoção/relegação, seasons infinitas, career, retirements, regens, cup, Europa, CL, AI bids, loans, contracts, infra timers, sponsor income, marketing ticks, per-player training tick

### Sessão 12 — Player Training + GK Stats + OVR Formula

#### calculateOverall (manager.js)
- `calculateOverall(p)` — fórmula weighted por posição, muta `p.overall` in-place
- GK: `han*0.26 + ref*0.23 + pos*0.22 + div*0.19 + kic*0.10`
- CB: `defending*0.45 + physical*0.28 + pace*0.14 + passing*0.08 + dribbling*0.05`
- LB/RB: `pace*0.28 + defending*0.28 + passing*0.20 + physical*0.15 + dribbling*0.09`
- CDM: `defending*0.35 + physical*0.27 + passing*0.23 + pace*0.08 + dribbling*0.07`
- CM: `passing*0.35 + physical*0.20 + dribbling*0.20 + defending*0.15 + pace*0.10`
- CAM: `passing*0.28 + dribbling*0.28 + shooting*0.24 + pace*0.12 + physical*0.08`
- LW/RW/LM/RM: `pace*0.30 + dribbling*0.28 + shooting*0.22 + passing*0.12 + physical*0.08`
- ST/CF: `shooting*0.36 + pace*0.20 + dribbling*0.18 + physical*0.16 + passing*0.10`
- Chamado em: `makePlayer`, `completePlayerTraining`, `trainYouthPlayer`, natural growth em `startNewSeason`

#### GK Stats (dataEPL.js)
- GKs têm 5 stats próprios gerados em `makePlayer`: `gkDiving, gkHandling, gkReflexes, gkKicking, gkPositioning`
- Multipliers: HAN×1.04, DIV×1.02, REF×1.00, POS×0.98, KIC×0.68
- Squad table ainda mostra os 6 stats genéricos (para consistência da tabela)
- Player modal e Training page mostram os 5 GK stats
- Engine: `playerDefenseContrib` para GK usa `gkHandling*0.28 + gkReflexes*0.25 + gkPositioning*0.25 + gkDiving*0.15 + gkKicking*0.07` (fallback para `p.overall` se GK antigo sem gk stats)

#### Player Training System (manager.js + season.js + ui.js)
- `PLAYER_TRAINING_PROGRAMS` — 23 programas distribuídos por posição:
  - **GK** (3): Shot Stopper, Goalkeeper, Sweeper Keeper
  - **CB** (3): Stopper, Ball-Playing CB, Pace Defender
  - **LB/RB** (2): Attacking FB, Defensive FB
  - **CDM** (3): Anchor, Deep Playmaker, Box-to-Box
  - **CM** (3): Playmaker, Engine, Complete CM
  - **CAM** (3): Free Role, Shadow Striker, Trequartista
  - **LW/RW/LM/RM** (3): Speedster, Inside Forward, Wide Playmaker
  - **ST/CF** (4): Poacher, Advanced Fwd, False 9, Target Man
- Cada programa: `{ id, name, icon, desc, stats[], duration (weeks), cost }`
- Stats melhoram +2 cada na conclusão → `calculateOverall` recalcula OVR
- `p.trainingProgram = { programId, weeksLeft, totalWeeks }` no player object
- `startPlayerTraining(gameState, playerId, programId)` — valida, debita budget, inicia
- `completePlayerTraining(p, gameState)` — aplica boosts, recalcula OVR, respeita potential cap
- `advanceMatchweek` faz tick por-player: `weeksLeft--`, completa quando chega a 0
- Substituiu o antigo TRAINING_DRILLS / completeTraining / startTeamTraining (removidos)

#### Training Screen (ui.js)
- `🏋️ Training` adicionado ao nav, `case 'training': renderTraining(app)` no showScreen
- `renderTraining(app)` — lista de todos os players (excl. outOnLoan), ordenados por active first
  - Cada row: pos badge, nome, OVR, status (progress bar se a treinar, "Available", "Injured")
- `showPlayerTrainingModal(playerId)` — modal com stats bars + program cards
  - GK: mostra DIV/HAN/REF/KIC/POS; Outfield: PAC/SHO/PAS/DEF/PHY/DRI
  - Se a treinar: mostra progress bar + semanas restantes, sem program list
  - Program cards: disabled se sem budget ou near potential cap (OVR ≥ POT-2)
- `startTrainingConfirm(playerId, programId)` — chama startPlayerTraining, fecha modal

#### Stat multipliers atualizados (dataEPL.js)
- Todos os primários subidos para 1.02–1.06 para stats refletirem melhor o OVR
- ST shooting×1.06, LW/RW pace+drib×1.04, CAM pass+drib×1.02, etc.

### Sessão 13 — Half-Time Substitutions + Red Cards + Tactics Panel

#### simulateMatch split (engine.js)
- Aceita `opts = { minStart, minEnd, initScore, prevEvents }` — default full 1-90 (AI matches intactos)
- Yellow/red cards agora dentro do loop por minuto (não no fim)
- Red: double yellow → red; direct red 0.05%/min; `homeRedMult`/`awayRedMult` penalizam eficácia pelo resto do jogo
- Cross-half yellow tracking: prevEvents seeded nos Maps → 2º amarelo na 2ª parte gera red
- `minEnd >= 90` gate para penalties, free kicks, injuries, clean sheets, attendance

#### manager.js
- `getBestEleven`: filtra `_benchedForMatch` flag
- `getBenchPlayers(teamId, formation, gameState)` — top 7 do banco por OVR

#### Halftime Flow (ui.js)
- Liga: 1st half (1-45) → halftime screen → 2nd half (46-90) → result
- Cup/CL/Europa: full 90 sem halftime interativo
- `renderHalftimeScreen`: score + eventos 1ª parte (scrollable) + pitch interativo + tactics panel + Continue
- Pitch: `renderHalftimePitchHTML` — sub-on player no slot com borda verde + 🔄
- Click num slot → modal "🔄 Sub Off" / "📋 Instructions" / "✕ Cancel Sub"
- `confirmSubHalftime`, `cancelSubHalftime`, `assignInstructionHalftime` (não faz re-render da tela de táticas)
- `updateFormationHalftime` — reset subs ao mudar formação
- `continueSecondHalf`: aplica `_benchedForMatch`, merge stats (possession averaged, resto somado)
- Max 5 subs. Evento `{ type: 'sub', min: 45, playerOff, playerOn }` → 🔄 em match result e replay
- Mobile CSS: `@media 480px` e `@media 360px` breakpoints, `.pp-sub-on` borda verde

### Sessão 11 — Contracts + Recall + Infraestrutura + Patrocínios + Marketing

#### Contracts System
- `p.contract` (1-3yr) decrementado em `processRetirements` cada season
- Players com `contract <= 0` libertados para FREE_AGENTS no `startNewSeason` com notificação
- `generateContractDemands(gameState)` em season.js — chamado em `advanceMatchweek`:
  - Morale < 45 + 5 jogos no banco → wage demand
  - Morale < 30 + 8 jogos no banco + OVR ≥ 72 → escalado para transfer request
- `gameState.contractDemands = [{ id, playerId, playerName, playerPos, playerOvr, type, wageIncrease, newWage }]`
- Hub: card `📋 PLAYER DEMANDS` (amber) com Accept/Reject/Sell buttons
- Squad: coluna CTR com badge (verde=3yr+, amarelo=1yr, vermelho=EXP)
- Player modal: barra com contract years + wage + morale + botão Renew (≤2yr)
- `renewContract`, `acceptWageDemand`, `rejectWageDemand`, `sellUnhappyPlayer` em manager.js

#### Recall from Loan
- `sendPlayerOnLoan` guarda `p.loanWeek = currentRound`
- `calculateRecallFee(player, gameState)`: base por OVR tier × remainingRatio, mínimo £5k
- Player modal `outOnLoan` tem botão ↩️ Recall inline

#### Infraestrutura (3 edifícios, 4 tiers)
- `INFRA_DATA` em manager.js — stadium / trainingGround / youthAcademy
- `gameState.infrastructure = { stadium: 0-3, trainingGround: 0-3, youthAcademy: 0-3, building: null }`
- **Training Ground**: `getTrainingOvrBonus` — já não afeta OVR diretamente (training system mudou), mas infra ainda existe

#### Patrocínios (3 slots) + Marketing (1 campanha/season)
- Ver sessão anterior — sem mudanças

#### Screen Club (🏟️ Club no nav)
- 3 tabs: 🏗️ Infrastructure | 💼 Sponsorships | 📣 Marketing

### Sessão 11b — Manual Starting XI + Player Instructions
- `gameState.tactics[teamId].startingXI` — array 11 IDs em ordem de slot
- `gameState.tactics[teamId].playerInstructions` — `{ [playerId]: instructionId }`
- `setManualLineup`, `clearManualLineup`, `setPlayerInstruction` em manager.js
- `getBestEleven(teamId, formation, gameState)` aceita 3º param, usa manual XI se definido
- `PLAYER_INSTRUCTIONS` — 25 instruções em manager.js com `atkMod`/`defMod` aplicados em engine
- Pitch interativo: click → `openPlayerMenu` → context menu com "Change Player" ou "Instructions"
- `openSlotPicker`, `openInstructionPicker` para selecção

### Sessão 10 — Staff Técnico + Player Traits
- **18 traits** em `TRAITS` (manager.js): 3 categorias, efeitos no engine
- **6 roles de staff**: Assistant Manager, Fitness Coach, Physio, Youth Coach, Scout, Set Piece Coach

### Sessões anteriores (2-9) — Core completo
- Match engine minuto a minuto, upset factor, penaltis, FKs
- 5 países, 9 ligas, CL, EL
- Youth academy, loans, transfers, finances, career

-----

## gameState structure (campos relevantes)

```js
gameState = {
  playerTeam, playerLeague, playerCountry,
  season, currentRound{}, budgets{}, morale{}, fixtures{},
  // Staff
  staff: { assistantManager, fitnessCoach, physio, youthCoach, scout, setPieceCoach },
  staffMarket: [...],
  // Contracts & Demands
  contractDemands: [{ id, playerId, playerName, playerPos, playerOvr, type, wageIncrease, newWage }],
  // Infrastructure
  infrastructure: { stadium: 0-3, trainingGround: 0-3, youthAcademy: 0-3, building: { type, completeSeason } | null },
  // Sponsorships
  sponsorships: { main: { name, weeklyIncome, seasonsLeft }, kit: {...}, regional: {...} },
  sponsorOffers: { main: [...], kit: [...], regional: [...] },
  // Marketing
  marketing: { activeCampaign: { ...campaign, weeksLeft, weeksActive }, campaignsThisSeason: 0 },
  // Youth
  youthSquad: [...], youthMarket: [...], youthTrainingTicks: 0,
  // Tactics
  tactics: { [teamId]: { formation, mentality, pressing, tempo, startingXI: [...11 ids] | null, playerInstructions: { [pid]: instrId } } },
  // Transfers
  aiBids: [...], transferWindowOpen: bool,
  // Career
  career: { hallOfFame: {...}, history: [...] },
  managerReputation: 0-100,
  // Player fields relevantes
  // p.trainingProgram = { programId, weeksLeft, totalWeeks } | null
  // p.gkDiving, p.gkHandling, p.gkReflexes, p.gkKicking, p.gkPositioning (só GK novos)
}
```

-----

## Script load order

```
dataEPL → dataLaLiga → dataSerieA → dataBundesliga → dataLigaPortugal → engine → season → manager → ui → script
```

`calculateOverall` definido em manager.js — chamado em dataEPL.js em runtime (global scope, ok).
`PLAYER_TRAINING_PROGRAMS`, `PLAYER_INSTRUCTIONS`, `TRAITS`, `STAFF_ROLES`, `INFRA_DATA`, `SPONSOR_POOL`, `MARKETING_CAMPAIGNS` definidos em manager.js — acessíveis globalmente.

-----

## Key decisions

- `calculateOverall(p)` é a fonte de verdade para OVR — qualquer mudança de stats deve chamar isto
- GK: 5 stats próprios apenas em saves novos/regens. Old saves fazem fallback para generic stats — sem crash
- `p.trainingProgram` undefined em old saves → sem tick, sem crash
- Training Ground infra ainda existe mas o seu bonus (getTrainingOvrBonus) já não tem efeito direto — pode ser removido ou reconvertido futuramente
- `getStadiumCapacity(gameState)` usado em engine.js — retorna `team.capacity + infraBonus`
- Marketing `attBoost` aplicado em engine.js como multiplicador de capacity
- Sponsor pool baseado em rep: <57 → tier1, <72 → tier1+2, ≥72 → tier2+3
- Construction timer em seasons, não semanas
- `formatMoney` definido em ui.js mas acessível em manager.js (global scope)

-----

## Known issues / tech debt

- Training Ground infra bonus (getTrainingOvrBonus) não tem efeito agora que team training foi removido — infra ainda existe no UI mas o bónus não é aplicado. Pode ser reconvertido para bónus no player training (ex: +1 stat extra por completion)
- Old GK saves sem gk stats mostram stats genéricos no modal — correto, mas idealmente no futuro migrar ao carregar save
- Europa League: se player não qualifica, botão não aparece (correto por design)
- Replays só para jogos de liga (correto)

-----

## Next session ideas

1. Reconverter Training Ground infra para dar bónus no player training (ex: +1 stat extra na conclusão de programas)
2. Transfer negotiation — contra-oferta, múltiplas rondas
3. Pre-season friendlies — 2-3 jogos antes da season
4. News feed — ticker no hub: "X signed by Y", "Z injured"
5. Moody/temperamental trait — benching threshold 3 jogos, efeito no morale
6. Clutch/biggame trait — efeito em cup matches

-----

## Project structure

```
test2/
├── index.html                  (23 linhas)
├── style.css                   (1740 linhas)
├── MEMORY.md
├── js/
│   ├── script.js               (5 linhas — entry point)
│   ├── dataEPL.js              (1023 linhas — EPL/Championship + globals + makePlayer)
│   ├── dataLaLiga.js           (831 linhas)
│   ├── dataSerieA.js           (815 linhas)
│   ├── dataBundesliga.js       (737 linhas)
│   ├── dataLigaPortugal.js     (491 linhas)
│   ├── engine.js               (590 linhas — simulação, stats individuais, GK stats)
│   ├── season.js               (1866 linhas — progressão, contratos, infra, sponsors, per-player training tick)
│   ├── manager.js              (1154 linhas — táticas, transfers, traits, staff, calculateOverall, PLAYER_TRAINING_PROGRAMS)
│   └── ui.js                   (4321 linhas — todos os ecrãs, training screen, GK modal)
```
