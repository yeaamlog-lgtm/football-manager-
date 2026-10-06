// manager.js — Transfers, tactics, squad management

// Formation display rows (top=attack, bottom=defense) — each string is a slot
const FORMATION_DISPLAY = {
  '4-4-2':   [['ST','ST'], ['LM','CM','CM','RM'], ['LB','CB','CB','RB'], ['GK']],
  '4-3-3':   [['LW','ST','RW'], ['CM','CM','CM'], ['LB','CB','CB','RB'], ['GK']],
  '4-2-3-1': [['ST'], ['CAM','CAM','CAM'], ['CDM','CDM'], ['LB','CB','CB','RB'], ['GK']],
  '3-5-2':   [['ST','ST'], ['CAM'], ['LWB','CM','CM','RWB'], ['CB','CB','CB'], ['GK']],
  '5-3-2':   [['ST','ST'], ['CM','CM','CM'], ['LWB','CB','CB','CB','RWB'], ['GK']],
  '4-5-1':   [['ST'], ['LW','CM','CM','CM','RW'], ['LB','CB','CB','RB'], ['GK']],
  '3-4-3':   [['LW','ST','RW'], ['LWB','CM','CM','RWB'], ['CB','CB','CB'], ['GK']],
};

// Position fallback chains — when a slot can't be filled exactly
const POS_FALLBACKS = {
  'LM':  ['LW','CAM','CM','RM','RW'],
  'RM':  ['RW','CAM','CM','LM','LW'],
  'LW':  ['LM','CAM','CM','RW','RM'],
  'RW':  ['RM','CAM','CM','LW','LM'],
  'LWB': ['LB','RB','CB'],
  'RWB': ['RB','LB','CB'],
  'CDM': ['CM','CB'],
  'CAM': ['CM','LM','RM','RW','LW'],
  'CF':  ['ST','CAM'],
  'ST':  ['CF','CAM','RW','LW'],
  'CM':  ['CAM','CDM','LM','RM'],
  'CB':  ['CDM','LB','RB'],
  'LB':  ['LWB','CB','RB'],
  'RB':  ['RWB','CB','LB'],
  'GK':  [],
};

function getManagerTactics(gameState) {
  return gameState.tactics?.[gameState.playerTeam] || {
    formation: '4-4-2',
    mentality: 'balanced',      // attacking, balanced, defensive
    defensiveLine: 'medium',    // high, medium, low
    pressing: 'medium',         // high, medium, low
    width: 'normal',            // wide, normal, narrow
    passingStyle: 'mixed',      // direct, mixed, short
    tempo: 'normal',            // fast, normal, slow
    captain: null,              // player id
    penaltyTaker: null,
    freeKickTaker: null,
    cornerTaker: null,
  };
}

function setTactics(gameState, tactics) {
  if (!gameState.tactics) gameState.tactics = {};
  gameState.tactics[gameState.playerTeam] = { ...getManagerTactics(gameState), ...tactics };
}

// Get players by position for lineup display
function getSquadByPosition(teamId) {
  const team = getTeam(teamId);
  const grouped = {};
  team.squad.forEach(p => {
    if (!grouped[p.pos]) grouped[p.pos] = [];
    grouped[p.pos].push(p);
  });
  // Sort each position by overall
  Object.keys(grouped).forEach(pos => {
    grouped[pos].sort((a, b) => b.overall - a.overall);
  });
  return grouped;
}

// Get best 11 for a formation
// _benchedForMatch flag is used during halftime sub flow to temporarily exclude players
function getBestEleven(teamId, formation, gameState) {
  const team = getTeam(teamId);
  const squad = [...team.squad].sort((a, b) => b.overall - a.overall);
  const rows = FORMATION_DISPLAY[formation] || FORMATION_DISPLAY['4-4-2'];
  const slots = rows.flat();
  const isAvail = p => !p.injuredWeeks && !p.outOnLoan && !p._benchedForMatch;

  // Use manual lineup if set and valid length
  const manual = gameState?.tactics?.[teamId]?.startingXI;
  if (manual && manual.length === slots.length) {
    const used = new Set();
    return slots.map((slot, i) => {
      const pid = manual[i];
      let p = squad.find(pl => pl.id === pid && isAvail(pl));
      if (p && !used.has(p.id)) { used.add(p.id); return { ...p, slot }; }
      // Player unavailable — auto-fill this slot
      p = squad.find(pl => !used.has(pl.id) && isAvail(pl) && pl.pos === slot);
      if (!p) {
        for (const alt of (POS_FALLBACKS[slot] || [])) {
          p = squad.find(pl => !used.has(pl.id) && isAvail(pl) && pl.pos === alt);
          if (p) break;
        }
      }
      if (!p) p = squad.find(pl => !used.has(pl.id) && isAvail(pl));
      if (!p) p = squad.find(pl => !used.has(pl.id));
      if (p) { used.add(p.id); return { ...p, slot }; }
      return null;
    }).filter(Boolean);
  }

  // Auto-pick
  const used = new Set();
  function pickPlayer(targetPos) {
    let p = squad.find(p => !used.has(p.id) && isAvail(p) && p.pos === targetPos);
    if (!p) {
      for (const alt of (POS_FALLBACKS[targetPos] || [])) {
        p = squad.find(p => !used.has(p.id) && isAvail(p) && p.pos === alt);
        if (p) break;
      }
    }
    if (!p) p = squad.find(p => !used.has(p.id) && isAvail(p));
    if (!p) p = squad.find(p => !used.has(p.id));
    if (p) { used.add(p.id); return { ...p, slot: targetPos }; }
    return null;
  }
  return slots.map(slot => pickPlayer(slot)).filter(Boolean);
}

// Get bench players (squad members not in starting XI, available to sub on)
function getBenchPlayers(teamId, formation, gameState) {
  const team = getTeam(teamId);
  const startingIds = new Set(getBestEleven(teamId, formation, gameState).map(p => p.id));
  return team.squad
    .filter(p => !startingIds.has(p.id) && !p.injuredWeeks && !p.outOnLoan && !p._benchedForMatch)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 7);
}

function setManualLineup(gameState, slotIdx, playerId) {
  const tactics = getManagerTactics(gameState);
  const rows = FORMATION_DISPLAY[tactics.formation] || FORMATION_DISPLAY['4-4-2'];
  const slots = rows.flat();
  // Initialize from current auto XI if no manual lineup yet
  let xi = (tactics.startingXI?.length === slots.length)
    ? [...tactics.startingXI]
    : getBestEleven(gameState.playerTeam, tactics.formation).map(p => p.id);
  // If player is already in another slot, swap
  const existingSlot = xi.indexOf(playerId);
  if (existingSlot !== -1 && existingSlot !== slotIdx) {
    xi[existingSlot] = xi[slotIdx];
  }
  xi[slotIdx] = playerId;
  setTactics(gameState, { startingXI: xi });
}

function clearManualLineup(gameState) {
  setTactics(gameState, { startingXI: null });
}

// ─── PLAYER INSTRUCTIONS ──────────────────────────────────────────────────────
const PLAYER_INSTRUCTIONS = [
  // GK
  { id: 'gk_sweeper',  positions: ['GK'],                    icon: '↑',  name: 'Sweeper Keeper',   desc: 'Comes off line to intercept through balls',          atkMod: 1.05, defMod: 0.90 },
  { id: 'gk_line',     positions: ['GK'],                    icon: '🛑', name: 'Stay on Line',     desc: 'Stays in goal, minimal risk approach',               atkMod: 1.00, defMod: 1.10 },
  // CB
  { id: 'cb_stepup',   positions: ['CB'],                    icon: '↑',  name: 'Step Up & Press',  desc: 'Aggressive high line, presses attackers',            atkMod: 1.06, defMod: 0.88 },
  { id: 'cb_deep',     positions: ['CB'],                    icon: '↓',  name: 'Stay Deep',        desc: 'Covers the space in behind, very safe',             atkMod: 0.90, defMod: 1.14 },
  { id: 'cb_carry',    positions: ['CB'],                    icon: '↗',  name: 'Carry Ball Out',   desc: 'Drives forward with the ball to start attacks',      atkMod: 1.14, defMod: 0.86 },
  // Fullbacks
  { id: 'fb_overlap',  positions: ['LB','RB','LWB','RWB'],   icon: '↑',  name: 'Overlap',          desc: 'Bombs forward to support attack down the flank',     atkMod: 1.20, defMod: 0.80 },
  { id: 'fb_hold',     positions: ['LB','RB','LWB','RWB'],   icon: '●',  name: 'Hold Position',    desc: 'Stays in shape, provides defensive solidity',        atkMod: 1.00, defMod: 1.05 },
  { id: 'fb_tuck',     positions: ['LB','RB','LWB','RWB'],   icon: '↘',  name: 'Tuck Inside',      desc: 'Cuts inside to form an extra midfielder',            atkMod: 1.08, defMod: 1.08 },
  { id: 'fb_inverted', positions: ['LB','RB','LWB','RWB'],   icon: '↙',  name: 'Inverted Run',     desc: 'Runs infield into half-spaces, shooting threat',     atkMod: 1.15, defMod: 0.82 },
  // CDM
  { id: 'cdm_sit',     positions: ['CDM'],                   icon: '↓',  name: 'Sit Deep',         desc: 'Shields the defence at all times, rarely attacks',   atkMod: 0.72, defMod: 1.30 },
  { id: 'cdm_roam',    positions: ['CDM'],                   icon: '↔',  name: 'Roam & Intercept', desc: 'Covers wide areas, wins the ball all over the pitch', atkMod: 1.05, defMod: 1.12 },
  { id: 'cdm_join',    positions: ['CDM'],                   icon: '↑',  name: 'Join the Attack',  desc: 'Gets forward when team attacks, late box arrivals',  atkMod: 1.24, defMod: 0.82 },
  // CM
  { id: 'cm_btb',      positions: ['CM'],                    icon: '↕',  name: 'Box to Box',       desc: 'Covers the whole pitch with high energy',            atkMod: 1.14, defMod: 1.10 },
  { id: 'cm_hold',     positions: ['CM'],                    icon: '●',  name: 'Hold Position',    desc: 'Stays in shape, recycles possession calmly',         atkMod: 0.94, defMod: 1.12 },
  { id: 'cm_advance',  positions: ['CM'],                    icon: '↑',  name: 'Advance Forward',  desc: 'Makes late runs into the box, ghost into space',     atkMod: 1.24, defMod: 0.78 },
  { id: 'cm_deep',     positions: ['CM'],                    icon: '↓',  name: 'Drop Deep',        desc: 'Drops to receive between lines, starts play',        atkMod: 0.90, defMod: 1.18 },
  // CAM
  { id: 'cam_free',    positions: ['CAM'],                   icon: '✦',  name: 'Free Role',        desc: 'Roams freely in the final third, unlocks defences',  atkMod: 1.24, defMod: 0.74 },
  { id: 'cam_support', positions: ['CAM'],                   icon: '↔',  name: 'Support Play',     desc: 'Drops deep to receive, links midfield and attack',   atkMod: 1.06, defMod: 0.92 },
  { id: 'cam_press',   positions: ['CAM'],                   icon: '↑↑', name: 'Press High',       desc: 'Aggressively hunts centre-backs and full-backs',     atkMod: 1.12, defMod: 1.06 },
  // Wingers
  { id: 'w_cut',       positions: ['LW','RW','LM','RM'],     icon: '↘',  name: 'Cut Inside',       desc: 'Comes infield to shoot or play one-twos',            atkMod: 1.18, defMod: 0.86 },
  { id: 'w_wide',      positions: ['LW','RW','LM','RM'],     icon: '↑',  name: 'Stay Wide',        desc: 'Hugs the touchline, stretches play, delivers crosses', atkMod: 1.10, defMod: 0.82 },
  { id: 'w_trackback', positions: ['LW','RW','LM','RM'],     icon: '↓',  name: 'Track Back',       desc: 'Drops back to help full-back defend transitions',    atkMod: 0.82, defMod: 1.24 },
  { id: 'w_underlap',  positions: ['LW','RW','LM','RM'],     icon: '↙',  name: 'Underlap Run',     desc: 'Makes inside runs behind the striker, third-man',    atkMod: 1.14, defMod: 0.88 },
  // Strikers
  { id: 'st_behind',   positions: ['ST','CF'],               icon: '↑',  name: 'Run in Behind',    desc: 'Exploits space in behind the defensive line',        atkMod: 1.18, defMod: 0.90 },
  { id: 'st_holdup',   positions: ['ST','CF'],               icon: '↓',  name: 'Hold Up Play',     desc: 'Links play, holds the ball for runners',             atkMod: 1.06, defMod: 0.94 },
  { id: 'st_roam',     positions: ['ST','CF'],               icon: '↔',  name: 'Roam Wide',        desc: 'Drifts wide to create space in the box for others',  atkMod: 1.10, defMod: 0.90 },
  { id: 'st_press',    positions: ['ST','CF'],               icon: '↑↑', name: 'Press CBs Hard',   desc: 'Hunts the ball high, forces errors in build-up',     atkMod: 1.12, defMod: 0.96 },
  { id: 'st_drop',     positions: ['ST','CF'],               icon: '↙',  name: 'Drop Deep',        desc: 'False 9 — drops into midfield to overload and link', atkMod: 1.14, defMod: 0.88 },
];

function getPlayerInstructions(pos) {
  return PLAYER_INSTRUCTIONS.filter(i => i.positions.includes(pos));
}

function setPlayerInstruction(gameState, playerId, instructionId) {
  const t = gameState.playerTeam;
  if (!gameState.tactics) gameState.tactics = {};
  if (!gameState.tactics[t]) gameState.tactics[t] = getManagerTactics(gameState);
  if (!gameState.tactics[t].playerInstructions) gameState.tactics[t].playerInstructions = {};
  if (instructionId === null) {
    delete gameState.tactics[t].playerInstructions[playerId];
  } else {
    gameState.tactics[t].playerInstructions[playerId] = instructionId;
  }
}

// Transfer market
function searchTransferMarket(gameState, filters = {}) {
  const results = [];
  const { maxValue, position, minOverall } = filters;

  getAllTeams().forEach(team => {
    if (team.id === gameState.playerTeam) return;
    team.squad.forEach(player => {
      const val = calculateTransferValue(player);
      if (maxValue && val > maxValue) return;
      if (position && player.pos !== position) return;
      if (minOverall && player.overall < minOverall) return;
      results.push({ ...player, teamId: team.id, teamName: team.name, value: val });
    });
  });

  return results.sort((a, b) => b.overall - a.overall).slice(0, 150);
}

function getFreeAgents(filters = {}) {
  const { position, minOverall } = filters;
  return FREE_AGENTS.filter(p => {
    if (position && p.pos !== position) return false;
    if (minOverall && p.overall < minOverall) return false;
    return true;
  }).sort((a, b) => b.overall - a.overall);
}

// ─── YOUTH MANAGEMENT ────────────────────────────────────────────────────────
function signYouthPlayer(gameState, playerId) {
  if (!gameState.youthMarket) return { success: false, message: 'No youth market available.' };
  const idx = gameState.youthMarket.findIndex(p => p.id === playerId);
  if (idx === -1) return { success: false, message: 'Player not found.' };
  const p = gameState.youthMarket[idx];

  const youthSquad = gameState.youthSquad || [];
  if (youthSquad.length >= 15) return { success: false, message: 'Youth squad full (max 15).' };

  const cost = p.youthPrice || 100000;
  if (!canAfford(gameState.playerTeam, cost, gameState)) {
    return { success: false, message: `Need €${(cost/1e6).toFixed(2)}M — not enough budget.` };
  }

  gameState.budgets[gameState.playerTeam] -= cost;
  gameState.youthMarket.splice(idx, 1);
  gameState.youthSquad = youthSquad;
  youthSquad.push(p);
  return { success: true, message: `${p.name} signed to youth academy!` };
}

function promoteYouthPlayer(gameState, playerId) {
  if (!gameState.youthSquad) return { success: false, message: 'No youth squad.' };
  const idx = gameState.youthSquad.findIndex(p => p.id === playerId);
  if (idx === -1) return { success: false, message: 'Player not found.' };
  const p = gameState.youthSquad[idx];

  const team = getTeam(gameState.playerTeam);
  if (!team) return { success: false, message: 'Team not found.' };
  if (team.squad.length >= 24) return { success: false, message: 'Main squad full (max 24).' };

  gameState.youthSquad.splice(idx, 1);
  p.isYouth = false;
  p.fromAcademy = true;
  team.squad.push(p);
  return { success: true, message: `${p.name} promoted to first team!` };
}

function trainYouthPlayer(gameState, playerId) {
  if (!gameState.youthSquad) return { success: false, message: 'No youth squad.' };
  const p = gameState.youthSquad.find(pl => pl.id === playerId);
  if (!p) return { success: false, message: 'Player not found.' };

  // Ticks reset every matchweek; cap boosted by youth coach
  const ticksUsed = gameState.youthTrainingTicks || 0;
  const ticksCap = getYouthTicksCap(gameState);
  if (ticksUsed >= ticksCap) return { success: false, message: `No training sessions left this matchweek (${ticksCap}/${ticksCap} used).` };

  // Cost scales with current OVR
  const cost = Math.round(40000 + (p.overall - 40) * 8000);
  if (!canAfford(gameState.playerTeam, cost, gameState)) {
    return { success: false, message: `Training costs ${formatMoney(cost)} — not enough budget.` };
  }

  // Cap: can't train past (potential - 3)
  if (p.overall >= p.potential - 3) return { success: false, message: `${p.name} is near their ceiling.` };

  gameState.budgets[gameState.playerTeam] -= cost;
  gameState.youthTrainingTicks = ticksUsed + 1;
  // Boost a key stat based on position
  const statBoosts = {
    ST: ['shooting','pace'], CF: ['shooting','dribbling'], LW: ['pace','dribbling'],
    RW: ['pace','dribbling'], CAM: ['dribbling','passing'], CM: ['passing','physical'],
    CDM: ['defending','physical'], LB: ['pace','defending'], RB: ['pace','defending'],
    CB: ['defending','physical'],
    GK: ['gkHandling','gkReflexes','gkDiving','gkPositioning','gkKicking']
  };
  const keys = statBoosts[p.pos] || ['physical','passing'];
  const stat = keys[Math.floor(Math.random() * keys.length)];
  p[stat] = Math.min(99, (p[stat] || 50) + 1);
  // Recalculate OVR from new stats
  calculateOverall(p);
  p.overall = Math.min(p.potential - 2, p.overall);

  const left = ticksCap - gameState.youthTrainingTicks;

  // 5% chance to develop a trait per session
  let traitMsg = '';
  if (!p.traits) p.traits = [];
  if (p.traits.length < 3 && Math.random() < 0.05) {
    const pool = (TRAIT_POOLS[p.pos] || TRAIT_POOLS['CM']).filter(t => !p.traits.includes(t) && !NEGATIVE_TRAITS.includes(t));
    if (pool.length) {
      const newTrait = pool[Math.floor(Math.random() * pool.length)];
      p.traits.push(newTrait);
      traitMsg = ` 🌟 New trait: ${TRAITS[newTrait]?.name || newTrait}!`;
    }
  }

  return { success: true, message: `${p.name} trained! +1 OVR, +1 ${stat}. ${left} session${left!==1?'s':''} left this matchweek.${traitMsg}` };
}

function sendPlayerOnLoan(gameState, playerId) {
  const team = getTeam(gameState.playerTeam);
  if (!team) return { success: false, message: 'Team not found.' };
  const p = team.squad.find(pl => pl.id === playerId);
  if (!p) return { success: false, message: 'Player not found.' };
  if (p.outOnLoan) return { success: false, message: `${p.name} is already out on loan.` };
  if (p.onLoan) return { success: false, message: `${p.name} is a loaned player — can't re-loan.` };
  if (p.injuredWeeks) return { success: false, message: `${p.name} is injured.` };

  p.outOnLoan = true;
  p.loanWeek = gameState.currentRound?.[gameState.playerLeague] ?? 0;
  return { success: true, message: `${p.name} sent on loan. Returns next season with +1 OVR.` };
}

function calculateRecallFee(player, gameState) {
  const leagueId = gameState.playerLeague;
  const totalWeeks = gameState.fixtures?.[leagueId]
    ? Math.round(gameState.fixtures[leagueId].length / (LEAGUES[leagueId].teams.length / 2))
    : 38;
  const currentWeek = gameState.currentRound?.[leagueId] ?? 0;
  const loanWeek = player.loanWeek ?? 0;
  const weeksRemaining = Math.max(0, totalWeeks - currentWeek);
  const loanDuration = Math.max(1, totalWeeks - loanWeek);
  // How much of the loan is still left (0 = done, 1 = just sent)
  const remainingRatio = weeksRemaining / loanDuration;

  // Base fee by OVR tier
  let base;
  const ovr = player.overall;
  if (ovr >= 88)      base = 1_200_000;
  else if (ovr >= 83) base = 700_000;
  else if (ovr >= 78) base = 350_000;
  else if (ovr >= 73) base = 160_000;
  else if (ovr >= 68) base = 70_000;
  else                base = 25_000;

  const fee = Math.round(base * remainingRatio * 1.1 / 5000) * 5000;
  return Math.max(5000, fee);
}

function recallPlayerFromLoan(gameState, playerId) {
  const team = getTeam(gameState.playerTeam);
  if (!team) return { success: false, message: 'Team not found.' };
  const p = team.squad.find(pl => pl.id === playerId);
  if (!p || !p.outOnLoan) return { success: false, message: 'Player not on loan.' };

  const fee = calculateRecallFee(p, gameState);
  if ((gameState.budgets[gameState.playerTeam] || 0) < fee)
    return { success: false, message: `Not enough budget. Recall fee: ${fee}.` };

  gameState.budgets[gameState.playerTeam] -= fee;
  p.outOnLoan = false;
  delete p.loanWeek;
  // No +1 OVR — didn't finish the loan
  return { success: true, fee, message: `${p.name} recalled. Fee paid: £${fee.toLocaleString()}.` };
}

function attemptTransfer(gameState, playerId, fromTeamId) {
  const playerTeam = getTeam(gameState.playerTeam);
  let player, fromTeam;

  if (!fromTeamId) {
    // Free agent
    player = FREE_AGENTS.find(p => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found.' };
  } else {
    fromTeam = getTeam(fromTeamId);
    player = fromTeam?.squad.find(p => p.id === playerId);
    if (!player) return { success: false, message: 'Player not found.' };
  }

  const value = fromTeamId ? calculateTransferValue(player) : Math.round(calculateTransferValue(player) * 0.1);

  if (!gameState.transferWindowOpen) {
    return { success: false, message: 'Transfer window is closed.' };
  }

  if (!canAfford(gameState.playerTeam, value, gameState)) {
    return {
      success: false,
      message: `Cannot afford. Need £${formatMoney(value)}, have £${formatMoney(gameState.budgets[gameState.playerTeam])}.`
    };
  }

  if (playerTeam.squad.length >= 25) {
    return { success: false, message: 'Squad is full (max 25 players). Sell someone first.' };
  }

  // FFP: check if wage bill would be too high post-signing
  const weeklyWages = getWeeklyWageCost(playerTeam);
  const newPlayerWage = Math.round(Math.max(0, player.overall - 50) * 60);
  const projectedSeasonWages = (weeklyWages + newPlayerWage) * 50;
  const budget = gameState.budgets[gameState.playerTeam] || 0;
  if (projectedSeasonWages > budget * 1.8) {
    const isHighPrestige = playerTeam.prestige >= 75;
    if (!isHighPrestige) {
      return { success: false, message: `FFP Block: projected wage bill (${formatMoney(projectedSeasonWages)}/season) exceeds financial limits.` };
    }
    // High prestige clubs get a warning but deal goes through
  }

  // AI acceptance check (higher rated teams are harder to buy from — reputation helps)
  if (fromTeamId) {
    const fromPrestige = fromTeam.prestige;
    const playerPrestige = playerTeam.prestige;
    const repBonus = ((gameState.managerReputation || 50) - 50) / 200; // -0.25 to +0.25
    if (fromPrestige > playerPrestige + 15 && Math.random() > (0.3 + repBonus)) {
      return { success: false, message: `${fromTeam.name} rejected the offer. They don't want to sell to a lower-prestige club.` };
    }
  }

  // Execute transfer
  gameState.budgets[gameState.playerTeam] -= value;
  if (fromTeamId) {
    fromTeam.squad = fromTeam.squad.filter(p => p.id !== playerId);
    gameState.budgets[fromTeamId] = (gameState.budgets[fromTeamId] || 0) + value;
  } else {
    FREE_AGENTS.splice(FREE_AGENTS.findIndex(p => p.id === playerId), 1);
  }

  const newPlayer = { ...player };
  playerTeam.squad.push(newPlayer);

  return {
    success: true,
    message: `${player.name} signed for £${formatMoney(value)}!`,
    player: newPlayer,
    spent: value
  };
}

// ─── TRANSFER NEGOTIATION ────────────────────────────────────────────────────

function getAITransferResponse(fromTeam, player, offerAmount, round, gameState) {
  const fairValue = calculateTransferValue(player);
  const myPrestige = getTeam(gameState.playerTeam)?.prestige || 50;
  const prestigeGap = fromTeam.prestige - myPrestige;

  // Not for sale — only truly elite players at the very top clubs (OVR 90+ at prestige 85+)
  if (fromTeam.prestige >= 85 && player.overall >= 90 && round === 1) {
    if (Math.random() < 0.20) return { result: 'not_for_sale' };
  }

  // Their minimum: 85% of fair value
  const minimum = Math.round(fairValue * 0.85);
  // Their asking: fair value + prestige premium (0–30%)
  const premiumMult = 1 + Math.max(0, prestigeGap) / 100;
  const asking = Math.round(fairValue * Math.min(1.30, premiumMult));

  if (offerAmount >= asking) return { result: 'accepted' };
  if (offerAmount < minimum) return { result: 'rejected', reason: 'too_low', minimum };

  // Counter: ask drops 10–20% each round toward minimum
  const dropPct = 0.10 + Math.random() * 0.10;
  const counter = Math.max(minimum, Math.round(asking * (1 - dropPct * round)));
  return { result: 'counter', theirAsk: counter };
}

function executeDeal(gameState, player, fromTeam, amount) {
  const playerTeam = getTeam(gameState.playerTeam);
  gameState.budgets[gameState.playerTeam] -= amount;
  fromTeam.squad = fromTeam.squad.filter(p => p.id !== player.id);
  gameState.budgets[fromTeam.id] = (gameState.budgets[fromTeam.id] || 0) + amount;
  playerTeam.squad.push({ ...player });
  return { success: true, negotiationResult: 'accepted', message: `${player.name} signed for ${formatMoney(amount)}!` };
}

function initiateNegotiation(gameState, playerId, fromTeamId, offerAmount) {
  if (!gameState.transferWindowOpen) return { success: false, message: 'Transfer window is closed.' };
  const playerTeam = getTeam(gameState.playerTeam);
  if (playerTeam.squad.length >= 25) return { success: false, message: 'Squad is full.' };
  if (!canAfford(gameState.playerTeam, offerAmount, gameState)) return { success: false, message: 'Not enough budget.' };

  const fromTeam = getTeam(fromTeamId);
  const player = fromTeam?.squad.find(p => p.id === playerId);
  if (!player) return { success: false, message: 'Player not found.' };

  if ((gameState.negotiations || []).find(n => n.playerId === playerId))
    return { success: false, message: 'Already negotiating for this player.' };

  const response = getAITransferResponse(fromTeam, player, offerAmount, 1, gameState);

  if (response.result === 'not_for_sale') {
    return { success: false, negotiationResult: 'not_for_sale', message: `${fromTeam.name} have rejected your approach — ${player.name} is not for sale.` };
  }
  if (response.result === 'rejected') {
    return { success: false, negotiationResult: 'rejected', message: `Offer rejected. ${fromTeam.name} want significantly more for ${player.name}.` };
  }
  if (response.result === 'accepted') {
    return executeDeal(gameState, player, fromTeam, offerAmount);
  }
  // Counter
  if (!gameState.negotiations) gameState.negotiations = [];
  gameState.negotiations.push({
    id: `neg_${Date.now()}`, playerId, playerName: player.name, playerPos: player.pos,
    playerOvr: player.overall, playerAge: player.age,
    fromTeamId, fromTeamName: fromTeam.name,
    yourLastOffer: offerAmount, theirAsk: response.theirAsk, round: 1,
    status: 'pending_your_response'
  });
  return { success: true, negotiationResult: 'counter', theirAsk: response.theirAsk, message: `${fromTeam.name} want ${formatMoney(response.theirAsk)} for ${player.name}.` };
}

function respondToNegotiation(gameState, negotiationId, newOffer) {
  const neg = (gameState.negotiations || []).find(n => n.id === negotiationId);
  if (!neg) return { success: false, message: 'Negotiation not found.' };
  if (!canAfford(gameState.playerTeam, newOffer, gameState)) return { success: false, message: 'Not enough budget.' };

  const fromTeam = getTeam(neg.fromTeamId);
  const player = fromTeam?.squad.find(p => p.id === neg.playerId);
  if (!player) { abandonNegotiation(gameState, negotiationId); return { success: false, message: 'Player no longer available.' }; }

  const nextRound = neg.round + 1;
  const response = getAITransferResponse(fromTeam, player, newOffer, nextRound, gameState);

  gameState.negotiations = gameState.negotiations.filter(n => n.id !== negotiationId);

  if (response.result === 'accepted') return executeDeal(gameState, player, fromTeam, newOffer);
  if (response.result === 'rejected' || nextRound > 3) {
    return { success: false, negotiationResult: 'collapsed', message: `Talks with ${neg.fromTeamName} have broken down.` };
  }
  gameState.negotiations.push({ ...neg, yourLastOffer: newOffer, theirAsk: response.theirAsk, round: nextRound });
  return { success: true, negotiationResult: 'counter', theirAsk: response.theirAsk, message: `${neg.fromTeamName} come back with ${formatMoney(response.theirAsk)}.` };
}

function abandonNegotiation(gameState, negotiationId) {
  gameState.negotiations = (gameState.negotiations || []).filter(n => n.id !== negotiationId);
}

function sellPlayer(gameState, playerId) {
  const playerTeam = getTeam(gameState.playerTeam);
  const idx = playerTeam.squad.findIndex(p => p.id === playerId);
  if (idx === -1) return { success: false, message: 'Player not in your squad.' };

  const player = playerTeam.squad[idx];
  if (player.pos === 'GK' && playerTeam.squad.filter(p => p.pos === 'GK').length <= 1) {
    return { success: false, message: 'Cannot sell your only goalkeeper.' };
  }
  if (playerTeam.squad.length <= 15) {
    return { success: false, message: 'Squad too small to sell anyone.' };
  }

  const value = calculateTransferValue(player);
  playerTeam.squad.splice(idx, 1);
  gameState.budgets[gameState.playerTeam] += value;

  return {
    success: true,
    message: `${player.name} sold for £${formatMoney(value)}.`,
    earned: value
  };
}

function formatMoney(amount) {
  if (amount >= 1000000) return `£${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `£${(amount / 1000).toFixed(0)}K`;
  return `£${amount}`;
}

// ─── PLAYER TRAITS ────────────────────────────────────────────────────────────
const TRAITS = {
  // Attacking
  clinical:      { name: 'Clinical',     icon: '🎯', color: '#22c55e', desc: 'Big chance conversion +20%' },
  poacher:       { name: 'Poacher',      icon: '👁️',  color: '#22c55e', desc: 'Higher scorer weight in the box' },
  longshot:      { name: 'Long Shot',    icon: '💥', color: '#22c55e', desc: 'Low shots count as medium' },
  speedster:     { name: 'Speedster',    icon: '⚡', color: '#22c55e', desc: 'Pace-based positions get +10% attack' },
  header:        { name: 'Header King', icon: '🦁', color: '#22c55e', desc: 'Higher weight for header goals' },
  // Creative / Midfield
  playmaker:     { name: 'Playmaker',    icon: '🧠', color: '#60a5fa', desc: 'CAM/CM attack contribution +18%' },
  btb:           { name: 'Box-to-Box',   icon: '🔄', color: '#60a5fa', desc: 'Contributes fully to both attack & defense' },
  engine:        { name: 'Engine',       icon: '🔋', color: '#60a5fa', desc: 'Team loses less fitness after matches' },
  // Defensive
  rock:          { name: 'Rock',         icon: '🪨', color: '#38bdf8', desc: 'Defense contribution +15%' },
  pkstopper:     { name: 'PK Stopper',   icon: '🧤', color: '#38bdf8', desc: 'GK: penalty saves 25% → 42%' },
  aerial:        { name: 'Aerial',       icon: '✈️',  color: '#38bdf8', desc: 'CB: defense contribution +10%' },
  // Mental
  clutch:        { name: 'Clutch',       icon: '⭐', color: '#f59e0b', desc: 'Performs above all expectations in big moments' },
  biggame:       { name: 'Big Game',     icon: '🏆', color: '#f59e0b', desc: 'Elevates team in CL/EL matches' },
  consistent:    { name: 'Consistent',   icon: '📈', color: '#f59e0b', desc: 'Contribution +4% — always shows up' },
  form:          { name: 'Form Player',  icon: '🔥', color: '#f59e0b', desc: 'Amplifies win/loss momentum' },
  captain_mat:   { name: 'Leader',       icon: '🪖', color: '#f59e0b', desc: 'As captain: morale boost is stronger' },
  // Negative
  injury_prone:  { name: 'Injury Prone', icon: '🤕', color: '#ef4444', desc: 'Higher injury risk, longer recoveries' },
  hotheaded:     { name: 'Hot-Headed',   icon: '🌡️', color: '#ef4444', desc: '1.5× yellow/red card chance' },
  temperamental: { name: 'Moody',        icon: '😤', color: '#ef4444', desc: 'Unhappy after only 3 games benched' },
};

const NEGATIVE_TRAITS = ['injury_prone', 'hotheaded', 'temperamental'];

const TRAIT_POOLS = {
  GK:  ['rock', 'pkstopper', 'consistent', 'engine'],
  CB:  ['rock', 'aerial', 'consistent', 'header', 'btb'],
  RB:  ['speedster', 'consistent', 'engine', 'rock'],
  LB:  ['speedster', 'consistent', 'engine', 'rock'],
  CDM: ['rock', 'btb', 'consistent', 'engine'],
  CM:  ['playmaker', 'btb', 'engine', 'consistent', 'form', 'longshot'],
  CAM: ['playmaker', 'clinical', 'form', 'consistent', 'longshot', 'biggame'],
  RW:  ['speedster', 'clinical', 'form', 'consistent', 'biggame'],
  LW:  ['speedster', 'clinical', 'form', 'consistent', 'biggame'],
  RM:  ['speedster', 'clinical', 'form', 'consistent'],
  LM:  ['speedster', 'clinical', 'form', 'consistent'],
  ST:  ['clinical', 'poacher', 'header', 'form', 'biggame', 'clutch', 'consistent'],
  CF:  ['clinical', 'poacher', 'header', 'form', 'biggame', 'clutch', 'consistent'],
};

function assignRandomTraits(player) {
  if (player.traits) return; // already assigned, don't overwrite
  const roll = Math.random();
  if (roll < 0.53) { player.traits = []; return; } // 53% no traits
  const pool = TRAIT_POOLS[player.pos] || TRAIT_POOLS['CM'];
  const numTraits = roll < 0.85 ? 1 : roll < 0.97 ? 2 : 3; // 32% one, 12% two, 3% three
  const chosen = [];
  for (let i = 0; i < numTraits; i++) {
    const remaining = pool.filter(t => !chosen.includes(t));
    if (!remaining.length) break;
    chosen.push(remaining[Math.floor(Math.random() * remaining.length)]);
  }
  // Small chance of negative trait (~8% for low OVR players, ~3% otherwise)
  if (Math.random() < (player.overall < 75 ? 0.08 : 0.03)) {
    chosen.push(NEGATIVE_TRAITS[Math.floor(Math.random() * NEGATIVE_TRAITS.length)]);
  }
  // High OVR players always have at least something
  if (player.overall >= 82 && !chosen.length && Math.random() < 0.4) {
    chosen.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  player.traits = chosen;
}

// ─── STAFF ────────────────────────────────────────────────────────────────────
const STAFF_ROLES = [
  { id: 'assistantManager', name: 'Assistant Manager', icon: '🧠',
    effectFn: q => `Win morale +${Math.floor(q/40)+1}, loss morale cushion. Training double-OVR ${(8+q/15).toFixed(0)}% chance.` },
  { id: 'fitnessCoach',    name: 'Fitness Coach',     icon: '💪',
    effectFn: q => `+${Math.floor(q/40)} extra fitness recovery/week. ${Math.floor(q/50)} less fatigue/match.` },
  { id: 'physio',          name: 'Physio',            icon: '🏥',
    effectFn: q => `Injury risk ${(q/17).toFixed(0)}% lower. Injuries ${Math.floor(q/50)} week shorter.` },
  { id: 'youthCoach',      name: 'Youth Coach',       icon: '🌱',
    effectFn: q => `${5 + Math.floor(q/33)} youth training ticks/matchweek (base: 5).` },
  { id: 'scout',           name: 'Scout',             icon: '🔭',
    effectFn: q => q >= 60 ? 'Reveals exact player potential in market & transfers.' : 'Shows approximate potential ranges.' },
  { id: 'setPieceCoach',   name: 'Set Piece Coach',   icon: '🎯',
    effectFn: q => `Penalties: ${(75 + q/27).toFixed(0)}% conversion. Free kicks: ${(15 + q/60).toFixed(0)}% goal rate.` },
];

const STAFF_FIRST = ['Carlos','James','Marcus','Viktor','Stefan','Diego','Mikael','Ahmed','Luca','Patrick','Henry','Rui','Sergio','Andre','David','Alex','Luiz','Youssef','Niko','Owen'];
const STAFF_LAST  = ['Mota','Owen','Schmidt','Rossi','Petrov','Martinez','Jensen','Al-Rashid','Ferrari','Dubois','Oliveira','Santos','Carvalho','Meyer','Williams','Nguyen','Diallo','Khan','Barros','Eriksen'];

function randomStaffName() {
  return STAFF_FIRST[Math.floor(Math.random()*STAFF_FIRST.length)] + ' ' +
         STAFF_LAST[Math.floor(Math.random()*STAFF_LAST.length)];
}

function generateStaffMarket(gameState) {
  const market = [];
  STAFF_ROLES.forEach(role => {
    const count = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const quality  = 40 + Math.floor(Math.random() * 56); // 40-95
      const tier     = quality < 56 ? 0 : quality < 71 ? 1 : quality < 86 ? 2 : 3;
      const wageRanges = [[5000,12000],[13000,22000],[23000,38000],[40000,65000]];
      const hireRanges = [[50000,120000],[130000,220000],[240000,380000],[400000,650000]];
      const [wMin,wMax] = wageRanges[tier];
      const [hMin,hMax] = hireRanges[tier];
      market.push({
        id:       `s_${Math.random().toString(36).slice(2,10)}`,
        role:     role.id,
        name:     randomStaffName(),
        quality,
        wage:     Math.floor(wMin + Math.random() * (wMax - wMin)),
        hireCost: Math.floor(hMin + Math.random() * (hMax - hMin)),
      });
    }
  });
  gameState.staffMarket = market;
}

function hireStaff(gameState, staffId) {
  if (!gameState.staffMarket) return { success: false, message: 'No market available.' };
  const idx = gameState.staffMarket.findIndex(s => s.id === staffId);
  if (idx === -1) return { success: false, message: 'Staff member not found.' };
  const candidate = gameState.staffMarket[idx];
  if (!gameState.staff) gameState.staff = {};
  if (gameState.staff[candidate.role]) return { success: false, message: 'That role is already filled. Fire current staff first.' };
  if (!canAfford(gameState.playerTeam, candidate.hireCost, gameState))
    return { success: false, message: `Need ${formatMoney(candidate.hireCost)} hire fee — not enough budget.` };
  gameState.budgets[gameState.playerTeam] -= candidate.hireCost;
  gameState.staffMarket.splice(idx, 1);
  gameState.staff[candidate.role] = { ...candidate };
  const role = STAFF_ROLES.find(r => r.id === candidate.role);
  return { success: true, message: `${candidate.name} hired as ${role?.name}!` };
}

function fireStaff(gameState, roleId) {
  if (!gameState.staff?.[roleId]) return { success: false, message: 'No staff in that role.' };
  const name = gameState.staff[roleId].name;
  delete gameState.staff[roleId];
  return { success: true, message: `${name} has been released.` };
}

function getStaffQuality(gameState, roleId) {
  return gameState.staff?.[roleId]?.quality || 0;
}

function getYouthTicksCap(gameState) {
  const q = getStaffQuality(gameState, 'youthCoach');
  return 5 + Math.floor(q / 33); // base 5, up to 8 with elite coach
}

// Determine what potential to show based on scout quality
function getScoutedPotential(potential, gameState) {
  const q = getStaffQuality(gameState, 'scout');
  if (q === 0) return '??';
  if (q < 60) {
    const low  = Math.max(55, potential - 7);
    const high = Math.min(99, potential + 7);
    return `${low}-${high}`;
  }
  return String(potential);
}

// ─── OVERALL FORMULA (position-weighted from individual stats) ────────────────
function calculateOverall(p) {
  let score;
  if (p.pos === 'GK') {
    const div = p.gkDiving      || p.defending;
    const han = p.gkHandling    || p.defending;
    const ref = p.gkReflexes    || p.defending;
    const kic = p.gkKicking     || p.pace;
    const pos = p.gkPositioning || p.defending;
    score = han*0.26 + ref*0.23 + pos*0.22 + div*0.19 + kic*0.10;
  } else if (p.pos === 'CB') {
    score = p.defending*0.45 + p.physical*0.28 + p.pace*0.14 + p.passing*0.08 + p.dribbling*0.05;
  } else if (p.pos === 'LB' || p.pos === 'RB') {
    score = p.pace*0.28 + p.defending*0.28 + p.passing*0.20 + p.physical*0.15 + p.dribbling*0.09;
  } else if (p.pos === 'CDM') {
    score = p.defending*0.35 + p.physical*0.27 + p.passing*0.23 + p.pace*0.08 + p.dribbling*0.07;
  } else if (p.pos === 'CM') {
    score = p.passing*0.35 + p.physical*0.20 + p.dribbling*0.20 + p.defending*0.15 + p.pace*0.10;
  } else if (p.pos === 'CAM') {
    score = p.passing*0.28 + p.dribbling*0.28 + p.shooting*0.24 + p.pace*0.12 + p.physical*0.08;
  } else if (['LW','RW','LM','RM'].includes(p.pos)) {
    score = p.pace*0.30 + p.dribbling*0.28 + p.shooting*0.22 + p.passing*0.12 + p.physical*0.08;
  } else if (p.pos === 'ST' || p.pos === 'CF') {
    score = p.shooting*0.36 + p.pace*0.20 + p.dribbling*0.18 + p.physical*0.16 + p.passing*0.10;
  } else {
    score = (p.pace + p.shooting + p.passing + p.defending + p.physical + p.dribbling) / 6;
  }
  p.overall = Math.min(99, Math.max(40, Math.round(score)));
}

// ─── PLAYER TRAINING ─────────────────────────────────────────────────────────
const PLAYER_TRAINING_PROGRAMS = {
  GK: [
    { id:'gk_shot_stopper', name:'Shot Stopper',   icon:'🧤', desc:'Reflexes and diving saves',           stats:['gkReflexes','gkDiving'],               duration:5, cost:320000 },
    { id:'gk_traditional',  name:'Goalkeeper',     icon:'🥅', desc:'Complete keeper fundamentals',        stats:['gkHandling','gkPositioning','gkReflexes'], duration:6, cost:380000 },
    { id:'sweeper_keeper',  name:'Sweeper Keeper', icon:'🏃', desc:'Distribution and sweeping',           stats:['gkKicking','gkDiving','gkPositioning'], duration:6, cost:400000 },
  ],
  CB: [
    { id:'cb_stopper',   name:'Stopper',        icon:'🛡️', desc:'Aggressive defending and duels',    stats:['defending','physical'],          duration:5, cost:300000 },
    { id:'cb_ball_play', name:'Ball-Playing CB', icon:'🎯', desc:'Build-up and distribution',        stats:['passing','defending'],           duration:6, cost:340000 },
    { id:'cb_pace_def',  name:'Pace Defender',  icon:'⚡', desc:'Speed and recovery defending',      stats:['pace','defending'],              duration:5, cost:310000 },
  ],
  'LB,RB': [
    { id:'fb_overlap', name:'Attacking FB',  icon:'↑',  desc:'Overlapping runs and crossing',    stats:['pace','passing'],    duration:5, cost:300000 },
    { id:'fb_solid',   name:'Defensive FB',  icon:'🔒', desc:'Solid defending and positioning',  stats:['defending','physical'], duration:5, cost:290000 },
  ],
  CDM: [
    { id:'cdm_anchor',  name:'Anchor',        icon:'⚓', desc:'Sit deep, win every duel',         stats:['defending','physical'],           duration:5, cost:310000 },
    { id:'cdm_regista', name:'Deep Playmaker', icon:'📋', desc:'Dictate play from deep',           stats:['passing','dribbling'],            duration:6, cost:360000 },
    { id:'cdm_box2box', name:'Box-to-Box',    icon:'🔄', desc:'Dynamic all-round midfielder',     stats:['physical','defending','passing'],  duration:7, cost:400000 },
  ],
  CM: [
    { id:'cm_playmaker', name:'Playmaker',   icon:'🎼', desc:'Creativity and vision',            stats:['passing','dribbling'],            duration:6, cost:360000 },
    { id:'cm_engine',    name:'Engine',      icon:'⚙️', desc:'Stamina and work rate',            stats:['physical','passing'],             duration:5, cost:320000 },
    { id:'cm_complete',  name:'Complete CM', icon:'⭐', desc:'Well-rounded midfield game',       stats:['passing','physical','dribbling'],  duration:7, cost:420000 },
  ],
  CAM: [
    { id:'cam_free',    name:'Free Role',     icon:'✦',  desc:'Creative freedom in the final third', stats:['dribbling','passing'],           duration:6, cost:380000 },
    { id:'cam_shadow',  name:'Shadow Striker',icon:'👤', desc:'Late runs and finishing',              stats:['shooting','dribbling'],          duration:5, cost:350000 },
    { id:'cam_classic', name:'Trequartista',  icon:'🎭', desc:'Link play and vision',                 stats:['passing','shooting','dribbling'], duration:7, cost:430000 },
  ],
  'LW,RW,LM,RM': [
    { id:'w_speedster', name:'Speedster',      icon:'💨', desc:'Pace and direct running',          stats:['pace','dribbling'],           duration:5, cost:320000 },
    { id:'w_inside',    name:'Inside Forward', icon:'↗️', desc:'Cut inside and shoot',             stats:['shooting','dribbling'],       duration:5, cost:340000 },
    { id:'w_provider',  name:'Wide Playmaker', icon:'📐', desc:'Crossing and chance creation',     stats:['passing','dribbling','pace'], duration:6, cost:380000 },
  ],
  'ST,CF': [
    { id:'st_poacher',  name:'Poacher',      icon:'🎯', desc:'Penalty box finishing',           stats:['shooting','physical'],          duration:5, cost:350000 },
    { id:'st_advanced', name:'Advanced Fwd', icon:'⚡', desc:'Dynamic all-round attacker',      stats:['shooting','pace','dribbling'],  duration:6, cost:420000 },
    { id:'st_false9',   name:'False 9',      icon:'🔄', desc:'Deep link-up and creativity',     stats:['passing','dribbling','shooting'],duration:7, cost:450000 },
    { id:'st_target',   name:'Target Man',   icon:'💪', desc:'Hold-up play and aerial threat',  stats:['physical','shooting'],          duration:5, cost:330000 },
  ],
};

function getTrainingPrograms(pos) {
  for (const key of Object.keys(PLAYER_TRAINING_PROGRAMS)) {
    if (key.split(',').includes(pos)) return PLAYER_TRAINING_PROGRAMS[key];
  }
  return PLAYER_TRAINING_PROGRAMS['CM'];
}

function startPlayerTraining(gameState, playerId, programId) {
  const team = getTeam(gameState.playerTeam);
  const p = team?.squad.find(pl => pl.id === playerId);
  if (!p) return { success: false, message: 'Player not found.' };
  if (p.injuredWeeks) return { success: false, message: `${p.name} is injured.` };
  if (p.outOnLoan) return { success: false, message: `${p.name} is out on loan.` };
  if (p.trainingProgram) return { success: false, message: `${p.name} is already in a training program.` };

  const programs = getTrainingPrograms(p.pos);
  const prog = programs.find(pr => pr.id === programId);
  if (!prog) return { success: false, message: 'Program not found.' };
  if (!canAfford(gameState.playerTeam, prog.cost, gameState))
    return { success: false, message: `Not enough budget — need ${formatMoney(prog.cost)}.` };

  gameState.budgets[gameState.playerTeam] -= prog.cost;
  p.trainingProgram = { programId, weeksLeft: prog.duration, totalWeeks: prog.duration };
  return { success: true, message: `${p.name} started ${prog.name} training (${prog.duration} weeks).` };
}

function completePlayerTraining(p, gameState) {
  const programs = getTrainingPrograms(p.pos);
  const prog = programs.find(pr => pr.id === p.trainingProgram.programId);
  p.trainingProgram = null;
  if (!prog) return;
  const cap = (p.potential || 99) - 1;
  const prevOvr = p.overall;

  // Backward compat: old-save GKs may lack gk stats — initialize from overall before training
  if (p.pos === 'GK') {
    const base = p.overall;
    if (p.gkDiving      === undefined) p.gkDiving      = Math.round(base * 0.95);
    if (p.gkHandling    === undefined) p.gkHandling    = Math.round(base * 1.00);
    if (p.gkReflexes    === undefined) p.gkReflexes    = Math.round(base * 0.98);
    if (p.gkKicking     === undefined) p.gkKicking     = Math.round(base * 0.75);
    if (p.gkPositioning === undefined) p.gkPositioning = Math.round(base * 0.95);
  }

  // Snapshot formula BEFORE stats change (may differ from p.overall on legacy saves)
  calculateOverall(p);
  const calcBefore = p.overall;
  p.overall = prevOvr; // restore real OVR

  prog.stats.forEach(stat => {
    p[stat] = Math.min(99, (p[stat] || 50) + 2);
  });

  // Compute formula AFTER — apply only the positive delta to the real OVR
  calculateOverall(p);
  const delta = Math.max(0, p.overall - calcBefore);
  p.overall = Math.min(cap, prevOvr + delta);
}

function executeLoan(gameState, playerId, fromTeamId) {
  const playerTeam = getTeam(gameState.playerTeam);
  const fromTeam = getTeam(fromTeamId);
  const player = fromTeam?.squad.find(p => p.id === playerId);

  if (!player) return { success: false, message: 'Player not found.' };
  if (!gameState.transferWindowOpen) return { success: false, message: 'Transfer window is closed.' };
  if (playerTeam.squad.length >= 25) return { success: false, message: 'Squad is full (max 25).' };

  const loanFee = Math.round(calculateTransferValue(player) * 0.15);
  if (!canAfford(gameState.playerTeam, loanFee, gameState)) {
    return { success: false, message: `Cannot afford loan fee. Need ${formatMoney(loanFee)}.` };
  }

  // Age check: loans are typically for young players
  if (player.age > 27) return { success: false, message: `${player.name} is too old for a loan deal.` };

  // Prestige check: teams won't loan their best players to rivals
  if (fromTeam.prestige < getTeam(gameState.playerTeam).prestige - 20) {
    return { success: false, message: `${fromTeam.name} won't loan to a much higher prestige club.` };
  }

  gameState.budgets[gameState.playerTeam] -= loanFee;
  fromTeam.squad = fromTeam.squad.filter(p => p.id !== playerId);

  const loanedPlayer = { ...player, onLoan: true, loanFromTeamId: fromTeamId, loanFromTeamName: fromTeam.name };
  playerTeam.squad.push(loanedPlayer);

  return {
    success: true,
    message: `${player.name} loaned for ${formatMoney(loanFee)}! Returns at season end.`,
    player: loanedPlayer,
    spent: loanFee
  };
}

// Track which players got game time after a player match
function updatePlayerGameTime(teamId, startingEleven, gameState) {
  const team = getTeam(teamId);
  if (!team) return;
  const playingIds = new Set(startingEleven.map(p => p.id));

  team.squad.forEach(p => {
    if (p.morale === undefined) p.morale = 70; // init individual morale for old saves
    if (playingIds.has(p.id)) {
      p.matchesWithoutPlay = 0;
      p.morale = Math.min(95, p.morale + 2); // happy playing
    } else {
      p.matchesWithoutPlay = (p.matchesWithoutPlay || 0) + 1;
      // Morale drops faster for key players who expect to start
      const drop = p.overall >= 74 ? 4 : p.overall >= 65 ? 2 : 1;
      p.morale = Math.max(10, p.morale - drop);
      // Notify when a key player first hits unhappy threshold
      if (p.overall >= 74 && p.matchesWithoutPlay === 5) {
        if (!gameState.unhappyNotifications) gameState.unhappyNotifications = [];
        gameState.unhappyNotifications.push({ name: p.name, pos: p.pos, ovr: p.overall });
      }
    }
  });
}

// ─── CONTRACT SYSTEM ──────────────────────────────────────────────────────────
function getContractRenewalOffer(player) {
  const currentWage = player.wage || Math.round(Math.max(0, player.overall - 50) * 60);
  // Wage increase is small — scales gently with OVR
  const wageIncrease = Math.round(Math.max(0, player.overall - 50) * 4);
  // Signing bonus = 4 weeks of their current wage (tiny)
  const signingBonus = currentWage * 4;
  const newWage = currentWage + wageIncrease;
  // Unhappy players sign shorter contracts and demand more
  const unhappy = (player.morale || 70) < 45;
  const contractYears = unhappy ? 2 : 3;
  const unhappyExtra = unhappy ? Math.round(wageIncrease * 1.5) : 0;
  return { wageIncrease: wageIncrease + unhappyExtra, newWage: newWage + unhappyExtra, signingBonus, contractYears };
}

function renewContract(gameState, playerId) {
  const team = getTeam(gameState.playerTeam);
  const player = team?.squad.find(p => p.id === playerId);
  if (!player) return { success: false, message: 'Player not found.' };
  const offer = getContractRenewalOffer(player);
  if (!canAfford(gameState.playerTeam, offer.signingBonus, gameState))
    return { success: false, message: `Can't afford signing bonus (${formatMoney(offer.signingBonus)}).` };
  gameState.budgets[gameState.playerTeam] -= offer.signingBonus;
  player.wage  = offer.newWage;
  player.contract = offer.contractYears;
  player.morale   = Math.min(95, (player.morale || 70) + 15);
  player.benchFrustration = 0;
  // Remove any pending demand for this player
  if (gameState.contractDemands)
    gameState.contractDemands = gameState.contractDemands.filter(d => d.playerId !== playerId);
  return { success: true, message: `${player.name} renewed for ${offer.contractYears} years at ${formatMoney(offer.newWage)}/wk.` };
}

function acceptWageDemand(gameState, demandId) {
  if (!gameState.contractDemands) return { success: false, message: 'No demands pending.' };
  const demand = gameState.contractDemands.find(d => d.id === demandId);
  if (!demand) return { success: false, message: 'Demand not found.' };
  const team = getTeam(gameState.playerTeam);
  const player = team?.squad.find(p => p.id === demand.playerId);
  if (!player) {
    gameState.contractDemands = gameState.contractDemands.filter(d => d.id !== demandId);
    return { success: false, message: 'Player not found.' };
  }
  player.wage = (player.wage || Math.round(Math.max(0, player.overall - 50) * 60)) + demand.wageIncrease;
  player.contract = 3; // new contract on acceptance
  player.morale = Math.min(90, (player.morale || 70) + 25);
  player.matchesWithoutPlay = 0;
  player.benchFrustration = 0;
  gameState.contractDemands = gameState.contractDemands.filter(d => d.id !== demandId);
  return { success: true, message: `${player.name} happy with +${formatMoney(demand.wageIncrease)}/wk raise.` };
}

function rejectWageDemand(gameState, demandId) {
  if (!gameState.contractDemands) return { success: false };
  const demand = gameState.contractDemands.find(d => d.id === demandId);
  if (!demand) return { success: false };
  const team = getTeam(gameState.playerTeam);
  const player = team?.squad.find(p => p.id === demand.playerId);
  if (player) {
    player.morale = Math.max(10, (player.morale || 70) - 20);
    // Escalate: next check will generate a transfer request
  }
  gameState.contractDemands = gameState.contractDemands.filter(d => d.id !== demandId);
  return { success: true };
}

function sellUnhappyPlayer(gameState, playerId) {
  // Quick sell at market value — same as sellPlayer but removes demand
  const result = sellPlayer(gameState, playerId);
  if (result.success && gameState.contractDemands)
    gameState.contractDemands = gameState.contractDemands.filter(d => d.playerId !== playerId);
  return result;
}

function getLoanablePlayers(gameState) {
  const results = [];
  getAllTeams().forEach(team => {
    if (team.id === gameState.playerTeam) return;
    team.squad.forEach(p => {
      if (p.age <= 24 && p.overall >= 60 && p.overall <= 87) {
        results.push({ ...p, teamId: team.id, teamName: team.name, loanFee: Math.round(p.wage * 26) });
      }
    });
  });
  return results.sort((a, b) => b.overall - a.overall).slice(0, 60);
}

function getPlayerStats(teamId) {
  const team = getTeam(teamId);
  return [...team.squad].sort((a, b) => b.goals - a.goals || b.assists - a.assists);
}

function getTopScorers(leagueId, gameState, count = 10) {
  const teams = LEAGUES[leagueId].teams;
  const scorers = [];
  teams.forEach(tid => {
    const team = getTeam(tid);
    team.squad.forEach(p => {
      if (p.goals > 0) scorers.push({ ...p, teamName: team.name });
    });
  });
  return scorers.sort((a, b) => b.goals - a.goals).slice(0, count);
}

// ─── INFRASTRUCTURE ──────────────────────────────────────────────────────────
const INFRA_DATA = {
  stadium: {
    name: 'Stadium', icon: '🏟️',
    desc: 'Bigger capacity = more gate receipts each home match.',
    tiers: [
      { label: 'Current Ground',    capacityBonus: 0,     cost: 0,          time: 0 },
      { label: 'Expanded Stand',    capacityBonus: 8000,  cost: 6_000_000,  time: 1 },
      { label: 'New East Stand',    capacityBonus: 20000, cost: 18_000_000, time: 2 },
      { label: 'Modern Stadium',    capacityBonus: 40000, cost: 45_000_000, time: 2 },
    ]
  },
  trainingGround: {
    name: 'Training Ground', icon: '⚽',
    desc: 'Better facilities = extra OVR gained from team training drills.',
    tiers: [
      { label: 'Basic Pitches',     ovrBonus: 0, cost: 0,          time: 0 },
      { label: 'Upgraded Pitches',  ovrBonus: 1, cost: 3_000_000,  time: 1 },
      { label: 'Pro Facility',      ovrBonus: 2, cost: 9_000_000,  time: 1 },
      { label: 'Elite Complex',     ovrBonus: 3, cost: 22_000_000, time: 2 },
    ]
  },
  youthAcademy: {
    name: 'Youth Academy', icon: '🌱',
    desc: 'Better youth setup = higher OVR and potential on prospects.',
    tiers: [
      { label: 'Local Scouts',      ovrBonus: 0, potBonus: 0, cost: 0,          time: 0 },
      { label: 'Regional Academy',  ovrBonus: 2, potBonus: 3, cost: 2_500_000,  time: 1 },
      { label: 'National Academy',  ovrBonus: 4, potBonus: 5, cost: 7_000_000,  time: 1 },
      { label: 'Elite Academy',     ovrBonus: 6, potBonus: 8, cost: 16_000_000, time: 2 },
    ]
  }
};

function getStadiumCapacity(gameState) {
  const team = getTeam(gameState.playerTeam);
  if (!team) return 30000;
  const baseCapacity = team.capacity || 30000;
  const tier = gameState.infrastructure?.stadium || 0;
  const bonus = INFRA_DATA.stadium.tiers[tier]?.capacityBonus || 0;
  return baseCapacity + bonus;
}

function getTrainingOvrBonus(gameState) {
  const tier = gameState.infrastructure?.trainingGround || 0;
  return INFRA_DATA.trainingGround.tiers[tier]?.ovrBonus || 0;
}

function getYouthInfraBonus(gameState) {
  const tier = gameState.infrastructure?.youthAcademy || 0;
  const t = INFRA_DATA.youthAcademy.tiers[tier];
  return { ovrBonus: t?.ovrBonus || 0, potBonus: t?.potBonus || 0 };
}

function upgradeInfrastructure(gameState, type) {
  if (!INFRA_DATA[type]) return { success: false, message: 'Unknown building.' };
  const infra = gameState.infrastructure;
  if (infra.building) return { success: false, message: `Already constructing ${INFRA_DATA[infra.building.type].name}. Wait for it to complete.` };
  const current = infra[type] || 0;
  if (current >= 3) return { success: false, message: 'Already at max level.' };
  const nextTier = INFRA_DATA[type].tiers[current + 1];
  if ((gameState.budgets[gameState.playerTeam] || 0) < nextTier.cost)
    return { success: false, message: `Not enough budget. Need ${formatMoney(nextTier.cost)}.` };
  gameState.budgets[gameState.playerTeam] -= nextTier.cost;
  infra.building = { type, completeSeason: gameState.season + nextTier.time };
  return { success: true, message: `${INFRA_DATA[type].name} upgrade started. Completes in ${nextTier.time} season${nextTier.time > 1 ? 's' : ''}.` };
}

// ─── SPONSORS ────────────────────────────────────────────────────────────────
const SPONSOR_POOL = {
  main: {
    tier1: [
      { name: 'Bet365', weekly: 85000 }, { name: 'Parimatch', weekly: 65000 },
      { name: 'LeoVegas', weekly: 70000 }, { name: '888sport', weekly: 75000 },
      { name: 'Betway', weekly: 88000 }, { name: 'William Hill', weekly: 92000 },
      { name: 'Paddy Power', weekly: 98000 }, { name: 'Coral', weekly: 72000 },
      { name: 'Ladbrokes', weekly: 80000 }, { name: 'BetVictor', weekly: 62000 },
      { name: 'BoyleSports', weekly: 55000 }, { name: 'Casumo', weekly: 60000 },
      { name: 'Unibet', weekly: 68000 }, { name: 'Betfair', weekly: 90000 },
      { name: 'Sky Bet', weekly: 95000 }, { name: 'SportPesa', weekly: 58000 },
      { name: 'Mansion', weekly: 52000 }, { name: 'Dafabet', weekly: 63000 },
      { name: 'Fun88', weekly: 57000 }, { name: 'Spreadex', weekly: 48000 },
    ],
    tier2: [
      { name: 'AIA', weekly: 185000 }, { name: 'Cazoo', weekly: 165000 },
      { name: 'Cinch', weekly: 155000 }, { name: 'Nexen Tire', weekly: 200000 },
      { name: 'Standard Chartered', weekly: 250000 }, { name: 'KONAMI', weekly: 175000 },
      { name: 'TAG Heuer', weekly: 195000 }, { name: 'Haier', weekly: 160000 },
      { name: 'Marathonbet', weekly: 145000 }, { name: 'Yokohama', weekly: 180000 },
      { name: 'EA Sports', weekly: 220000 }, { name: 'Hublot', weekly: 170000 },
      { name: 'Visit Malaysia', weekly: 140000 }, { name: 'MSC Cruises', weekly: 150000 },
      { name: 'Socios.com', weekly: 130000 }, { name: 'Tezos', weekly: 135000 },
    ],
    tier3: [
      { name: 'Emirates', weekly: 480000 }, { name: 'Etihad', weekly: 440000 },
      { name: 'Qatar Airways', weekly: 520000 }, { name: 'Crypto.com', weekly: 390000 },
      { name: 'Mastercard', weekly: 420000 }, { name: 'Heineken', weekly: 360000 },
      { name: 'Chevrolet', weekly: 500000 }, { name: 'Aon', weekly: 380000 },
      { name: 'DHL', weekly: 350000 }, { name: 'Rakuten', weekly: 430000 },
      { name: 'Allianz', weekly: 470000 }, { name: 'Bein Sports', weekly: 410000 },
      { name: 'Fly Emirates', weekly: 490000 }, { name: 'Visit Dubai', weekly: 460000 },
    ],
  },
  kit: {
    tier1: [
      { name: 'Umbro', weekly: 28000 }, { name: 'Castore', weekly: 32000 },
      { name: 'Hummel', weekly: 22000 }, { name: 'Macron', weekly: 20000 },
      { name: 'Kappa', weekly: 18000 }, { name: 'Errea', weekly: 16000 },
      { name: 'Joma', weekly: 15000 }, { name: 'Sondico', weekly: 12000 },
      { name: "O'Neills", weekly: 14000 }, { name: 'Score Draw', weekly: 11000 },
      { name: 'Admiral', weekly: 13000 }, { name: 'Avec', weekly: 10000 },
    ],
    tier2: [
      { name: 'Puma', weekly: 82000 }, { name: 'New Balance', weekly: 72000 },
      { name: 'Under Armour', weekly: 78000 }, { name: 'Le Coq Sportif', weekly: 62000 },
      { name: 'Lotto', weekly: 58000 }, { name: 'Mizuno', weekly: 68000 },
      { name: 'Fila', weekly: 52000 }, { name: 'Jako', weekly: 48000 },
    ],
    tier3: [
      { name: 'Nike', weekly: 165000 }, { name: 'Adidas', weekly: 175000 },
    ],
  },
  regional: {
    tier1: [
      { name: 'City Motors', weekly: 12000 }, { name: 'Regional Bank', weekly: 15000 },
      { name: 'Premier Foods', weekly: 10000 }, { name: 'Metro Tyres', weekly: 9000 },
      { name: 'Sunbelt Energy', weekly: 11000 }, { name: 'Cornerstone Insurance', weekly: 13000 },
      { name: 'Delta Construction', weekly: 8500 }, { name: 'Falcon Logistics', weekly: 9500 },
      { name: 'Atlas Property', weekly: 10500 }, { name: 'Summit Dental', weekly: 7500 },
      { name: 'Greenleaf Hotels', weekly: 11500 }, { name: 'Horizon Telecoms', weekly: 12500 },
      { name: 'Oakridge Builders', weekly: 8000 }, { name: 'Cardinal Finance', weekly: 14000 },
      { name: 'Trident Security', weekly: 9000 }, { name: 'Pacific Recruitment', weekly: 7000 },
      { name: 'Cobalt Media', weekly: 8000 }, { name: 'Meridian Law', weekly: 10000 },
    ],
    tier2: [
      { name: 'Specsavers', weekly: 42000 }, { name: 'Iceland Foods', weekly: 38000 },
      { name: 'Carabao Energy', weekly: 55000 }, { name: 'FxPro', weekly: 48000 },
      { name: 'Entain', weekly: 52000 }, { name: 'Utilita Energy', weekly: 40000 },
      { name: 'eToro', weekly: 58000 }, { name: 'Visit Thailand', weekly: 45000 },
      { name: 'Cazoo Auto', weekly: 50000 }, { name: 'Staysure Travel', weekly: 36000 },
    ],
    tier3: [
      { name: 'Amazon', weekly: 95000 }, { name: 'Vodafone', weekly: 88000 },
      { name: 'Barclays', weekly: 105000 }, { name: 'HSBC', weekly: 100000 },
      { name: 'Samsung', weekly: 98000 }, { name: 'Hyundai', weekly: 92000 },
      { name: 'Booking.com', weekly: 85000 }, { name: 'Pepsi', weekly: 90000 },
    ],
  }
};

function _getSponsorTierPool(slot, rep) {
  const pool = SPONSOR_POOL[slot];
  if (rep >= 72) return [...pool.tier2, ...pool.tier3];
  if (rep >= 57) return [...pool.tier1, ...pool.tier2];
  return pool.tier1;
}

function generateSponsorOffers(gameState) {
  const rep = gameState.managerReputation || 50;
  const offers = { main: [], kit: [], regional: [] };
  ['main', 'kit', 'regional'].forEach(slot => {
    const pool = _getSponsorTierPool(slot, rep).sort(() => Math.random() - 0.5);
    offers[slot] = pool.slice(0, 3).map(s => ({
      id: `spo-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      slot,
      name: s.name,
      weeklyIncome: Math.round(s.weekly * (0.85 + Math.random() * 0.30) / 1000) * 1000,
      duration: 2 + Math.floor(Math.random() * 2),
    }));
  });
  gameState.sponsorOffers = offers;
}

function signSponsor(gameState, offerId, slot) {
  const offers = gameState.sponsorOffers?.[slot] || [];
  const offer = offers.find(o => o.id === offerId);
  if (!offer) return { success: false, message: 'Offer not found.' };
  if (!gameState.sponsorships) gameState.sponsorships = {};
  gameState.sponsorships[slot] = { ...offer, seasonsLeft: offer.duration };
  // Clear offers for this slot
  if (gameState.sponsorOffers) gameState.sponsorOffers[slot] = [];
  return { success: true, message: `Signed ${offer.name} as ${slot} sponsor for ${offer.duration} seasons at ${formatMoney(offer.weeklyIncome)}/wk.` };
}

// ─── MARKETING ───────────────────────────────────────────────────────────────
const MARKETING_CAMPAIGNS = [
  {
    id: 'fan_engagement',
    name: 'Fan Engagement Drive',
    icon: '📣',
    desc: 'Community events and matchday promotions boost attendance for 10 home games.',
    effect: { type: 'attendance', value: 0.25 },  // +25% capacity
    weeksActive: 10,
    costTier: [350_000, 450_000, 600_000],  // cost by rep tier
  },
  {
    id: 'social_media',
    name: 'Social Media Blitz',
    icon: '📱',
    desc: 'Digital campaign raises your profile. +6 rep immediately + £20k/wk sponsor bonus for 8 weeks.',
    effect: { type: 'rep_and_income', repBonus: 6, incomeBonus: 20000 },
    weeksActive: 8,
    costTier: [500_000, 650_000, 850_000],
  },
  {
    id: 'commercial_push',
    name: 'Commercial Push',
    icon: '💼',
    desc: 'Aggressive commercial activity adds bonus weekly income for 12 weeks.',
    effect: { type: 'income', value: 40000 },  // +£40k/wk
    weeksActive: 12,
    costTier: [700_000, 900_000, 1_200_000],
  },
];

function getCampaignCost(campaignId, gameState) {
  const c = MARKETING_CAMPAIGNS.find(m => m.id === campaignId);
  if (!c) return 0;
  const rep = gameState.managerReputation || 50;
  const tierIdx = rep >= 72 ? 2 : rep >= 57 ? 1 : 0;
  return c.costTier[tierIdx];
}

function launchMarketing(gameState, campaignId) {
  if (!MARKETING_CAMPAIGNS.find(m => m.id === campaignId))
    return { success: false, message: 'Campaign not found.' };
  if (!gameState.marketing) gameState.marketing = { activeCampaign: null, campaignsThisSeason: 0 };
  if (gameState.marketing.activeCampaign)
    return { success: false, message: 'A campaign is already running.' };
  if (gameState.marketing.campaignsThisSeason >= 1)
    return { success: false, message: 'Only 1 campaign per season.' };
  const cost = getCampaignCost(campaignId, gameState);
  if ((gameState.budgets[gameState.playerTeam] || 0) < cost)
    return { success: false, message: `Not enough budget. Need ${formatMoney(cost)}.` };
  const campaign = MARKETING_CAMPAIGNS.find(m => m.id === campaignId);
  gameState.budgets[gameState.playerTeam] -= cost;
  gameState.marketing.activeCampaign = { ...campaign, weeksLeft: campaign.weeksActive };
  gameState.marketing.campaignsThisSeason++;
  // Apply instant rep bonus
  if (campaign.effect.type === 'rep_and_income') {
    gameState.managerReputation = Math.min(100, (gameState.managerReputation || 50) + campaign.effect.repBonus);
  }
  return { success: true, message: `${campaign.name} launched! ${campaign.desc}` };
}

// ─── NEWS FEED ────────────────────────────────────────────────────────────────

function pushNews(item, gameState) {
  gameState.newsFeed = gameState.newsFeed || [];
  // These types are always unique (milestones, awards, injuries) — never deduplicated
  const alwaysUnique = ['potm','totm','pots','tots','goal_milestone','assist_milestone','hat_trick','injury','injury_return','transfer_in','transfer_out','contract_signed'];
  if (!alwaysUnique.includes(item.type)) {
    const recent = gameState.newsFeed.slice(0, 2);
    if (recent.some(n => n.type === item.type)) return;
  }
  gameState.newsFeed.unshift(item);
  if (gameState.newsFeed.length > 50) gameState.newsFeed.length = 50;
}

function computeMatchRatings(homeId, awayId, result, gameState) {
  const homeFormation = gameState.tactics?.[homeId]?.formation || '4-4-2';
  const awayFormation = gameState.tactics?.[awayId]?.formation || '4-4-2';
  const homePlayed = getBestEleven(homeId, homeFormation, gameState);
  const awayPlayed = getBestEleven(awayId, awayFormation, gameState);

  const goalMap = {}, assistMap = {}, yellowMap = {}, redMap = {};
  for (const ev of (result.events || [])) {
    if (ev.type === 'goal') {
      goalMap[ev.player] = (goalMap[ev.player] || 0) + 1;
      if (ev.assist) assistMap[ev.assist] = (assistMap[ev.assist] || 0) + 1;
    }
    if (ev.type === 'yellow') yellowMap[ev.player] = true;
    if (ev.type === 'red') redMap[ev.player] = true;
  }

  const homeWon = result.homeGoals > result.awayGoals;
  const awayWon = result.awayGoals > result.homeGoals;
  const DEF_POS = ['GK','CB','LB','RB','LWB','RWB'];
  const week = gameState.currentRound?.[gameState.playerLeague] || 1;

  const ratePlayer = (p, isHome) => {
    let r = 6.5;
    r += (goalMap[p.name] || 0) * 1.0;
    r += (assistMap[p.name] || 0) * 0.5;
    if (redMap[p.name]) r -= 1.5;
    else if (yellowMap[p.name]) r -= 0.4;
    if (isHome ? homeWon : awayWon) r += 0.3;
    else if (isHome ? awayWon : homeWon) r -= 0.2;
    const conceded = isHome ? result.awayGoals > 0 : result.homeGoals > 0;
    if (!conceded && DEF_POS.includes(p.pos)) r += 0.5;
    return Math.round(Math.max(4.0, Math.min(9.5, r)) * 10) / 10;
  };

  for (const p of homePlayed) {
    p.matchRatings = p.matchRatings || [];
    p.matchRatings.push({ rating: ratePlayer(p, true), week });
  }
  for (const p of awayPlayed) {
    p.matchRatings = p.matchRatings || [];
    p.matchRatings.push({ rating: ratePlayer(p, false), week });
  }
  // Sub-on players get base rating 6.5
  for (const ev of (result.events || [])) {
    if (ev.type !== 'sub') continue;
    const allSq = [...(getTeam(homeId)?.squad || []), ...(getTeam(awayId)?.squad || [])];
    const sub = allSq.find(p => p.name === ev.playerOn);
    if (sub && !sub.matchRatings?.find(r => r.week === week)) {
      sub.matchRatings = sub.matchRatings || [];
      sub.matchRatings.push({ rating: 6.5, week });
    }
  }
}

function _getLeagueAllPlayers(leagueId, gameState) {
  return getLeagueTeams(leagueId, gameState).flatMap(tid => {
    const t = getTeam(tid);
    return t ? t.squad.map(p => ({ p, teamName: t.name, teamId: tid })) : [];
  });
}

function getPlayerOfMonth(leagueId, fromWeek, toWeek, gameState) {
  let best = null, bestAvg = 0;
  for (const { p } of _getLeagueAllPlayers(leagueId, gameState)) {
    const ratings = (p.matchRatings || []).filter(r => r.week >= fromWeek && r.week <= toWeek);
    if (ratings.length < 2) continue;
    const avg = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
    if (avg > bestAvg) { bestAvg = avg; best = p; }
  }
  return best ? { player: best, avg: Math.round(bestAvg * 10) / 10 } : null;
}

function getTeamOfMonth(leagueId, fromWeek, toWeek, gameState) {
  const GK_P = ['GK'], DEF_P = ['CB','LB','RB','LWB','RWB'], MID_P = ['CM','CDM','CAM','LM','RM'], ATT_P = ['ST','CF','LW','RW'];
  const avgInPeriod = p => {
    const r = (p.matchRatings || []).filter(r => r.week >= fromWeek && r.week <= toWeek);
    if (r.length < 2) return 0;
    return r.reduce((s, x) => s + x.rating, 0) / r.length;
  };
  const all = _getLeagueAllPlayers(leagueId, gameState);
  const pickBest = (positions, count) =>
    all.filter(({ p }) => positions.includes(p.pos))
       .map(({ p, teamName, teamId }) => ({ p, teamName, teamId, avg: avgInPeriod(p) }))
       .filter(x => x.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, count);

  const GK = pickBest(GK_P, 1)[0] || null;
  const DEF = pickBest(DEF_P, 4);
  const MID = pickBest(MID_P, 3);
  const ATT = pickBest(ATT_P, 3);
  if (!GK && !DEF.length && !ATT.length) return null;
  return { GK, DEF, MID, ATT };
}

// ─── COLORFUL NEWS (rumors, quotes, drama) ───────────────────────────────────

function generateColorfulNews(gameState) {
  if (!gameState.playerTeam || !gameState.playerLeague) return;
  const week = gameState.currentRound[gameState.playerLeague] || 1;
  const leagueTeams = getLeagueTeams(gameState.playerLeague, gameState);
  const myTeam = getTeam(gameState.playerTeam);
  const myTeamName = myTeam?.name || '';
  const table = getLeagueTable(gameState.playerLeague, gameState);
  const currPos = table.findIndex(r => r.id === gameState.playerTeam) + 1;
  const leagueName = LEAGUES[gameState.playerLeague]?.name || 'the league';
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // ── Transfer Rumors (~38% chance) ────────────────────────────────────────
  if (Math.random() < 0.38) {
    const otherIds = leagueTeams.filter(tid => tid !== gameState.playerTeam);
    const targetTeam = getTeam(pick(otherIds));
    if (targetTeam) {
      const notables = targetTeam.squad.filter(p => p.overall >= 73 && !p.injuredWeeks && !p.outOnLoan);
      if (notables.length) {
        const target = pick(notables);
        const intId = Math.random() < 0.35 ? gameState.playerTeam : pick(otherIds.filter(id => id !== targetTeam.id));
        const intName = getTeam(intId)?.name || 'A top club';
        const fee = formatMoney(Math.round(calculateTransferValue(target) * (1.0 + Math.random() * 0.5)));
        const alt = getTeam(pick(otherIds.filter(id => id !== intId && id !== targetTeam.id)))?.name || 'another club';
        const headlines = [
          `${intName} monitoring ${target.name} ahead of transfer window`,
          `${target.name} attracting interest — ${intName} ready to make move`,
          `Sources: ${intName} preparing ${fee} bid for ${targetTeam.name}'s ${target.name}`,
          `${target.name} told he can leave ${targetTeam.name} — ${intName} lead the race`,
          `Agent of ${target.name} spotted in talks with ${intName} chiefs`,
          `${intName} eye ambitious swoop for ${targetTeam.name} star ${target.name}`,
          `${target.name} wants a new challenge — ${intName} offering escape route`,
          `${intName} and ${alt} both chasing ${target.name} — bidding war looms`,
          `${targetTeam.name} reject opening offer from ${intName} for ${target.name}`,
          `${target.name}: "I love this club" — but ${intName} don't give up`,
        ];
        pushNews({ type: 'transfer_rumor', icon: '🔍', headline: pick(headlines), detail: `${target.pos} · OVR ${target.overall} · ${targetTeam.name}`, week }, gameState);
      }
    }
  }

  // ── Your own player linked away (~20% chance) ─────────────────────────────
  if (Math.random() < 0.20 && myTeam) {
    const stars = myTeam.squad.filter(p => p.overall >= 74 && !p.injuredWeeks && !p.outOnLoan);
    if (stars.length) {
      const star = pick(stars);
      const suitor = getTeam(pick(leagueTeams.filter(id => id !== gameState.playerTeam)))?.name || 'a rival';
      const headlines = [
        `${star.name} linked with shock move away from ${myTeamName}`,
        `${suitor} ready to test ${myTeamName}'s resolve with big bid for ${star.name}`,
        `${star.name} contract talks stalling — ${suitor} circling`,
        `Report: ${star.name} flattered by interest but committed to ${myTeamName} — for now`,
        `${myTeamName} adamant ${star.name} not for sale as ${suitor} prepare approach`,
        `Sources close to ${star.name} refuse to rule out a summer departure`,
        `${star.name} drops hint on future: "I want to play at the highest level"`,
      ];
      pushNews({ type: 'transfer_rumor', icon: '🔍', headline: pick(headlines), detail: `${star.pos} · OVR ${star.overall} · your squad`, week }, gameState);
    }
  }

  // ── Manager Quotes (~45% chance) ─────────────────────────────────────────
  if (Math.random() < 0.45) {
    const recent = (gameState.results[gameState.playerLeague] || [])
      .filter(r => r.homeTeam === gameState.playerTeam || r.awayTeam === gameState.playerTeam)
      .slice(-1);
    let quotes = [];
    if (recent.length) {
      const r = recent[0];
      const isH = r.homeTeam === gameState.playerTeam;
      const mg = isH ? r.homeGoals : r.awayGoals;
      const og = isH ? r.awayGoals : r.homeGoals;
      const opp = getTeam(isH ? r.awayTeam : r.homeTeam)?.name || 'opponents';
      if (mg > og) {
        quotes = [
          `${myTeamName} boss: "We deserved every point today. No question."`,
          `"This squad has something special — I see it every day." — ${myTeamName} manager`,
          `Manager: "I said we'd bounce back and we did. Keep doubting us."`,
          `"${opp} are a good side. But tonight we were simply better." — ${myTeamName} boss`,
          `${myTeamName} manager: "The belief in that dressing room right now is incredible"`,
          `"People wrote us off. I showed the lads those headlines." — ${myTeamName} boss`,
          `Manager: "That's the ${myTeamName} I know. That's who we are."`,
          `${myTeamName} boss dedicates win to fans: "They're the reason we fight"`,
        ];
      } else if (mg < og) {
        quotes = [
          `${myTeamName} manager fumes: "That referee decision was an absolute joke"`,
          `"I back my players 100%. The result doesn't tell the full story." — ${myTeamName} boss`,
          `${myTeamName} boss refuses to panic: "We've been through tougher moments"`,
          `"We'll watch that back, it'll hurt — but we'll come out stronger." — manager`,
          `"${opp} got lucky. We had the better chances and we all know it." — ${myTeamName} boss`,
          `Manager points to officiating: "Three decisions. Three wrong calls. Not football."`,
          `"One bad result doesn't define us. Ask me again in five games." — ${myTeamName} manager`,
          `${myTeamName} boss in defiant mood: "This squad will not crumble. Watch."`,
        ];
      } else {
        quotes = [
          `${myTeamName} manager: "A point today — I'll take that. We move."`,
          `"We should've won it. We know that. No excuses." — ${myTeamName} boss`,
          `${myTeamName} boss: "Draws won't get us where we want to be."`,
          `"We had the game in our hands. Just couldn't finish." — manager`,
          `Manager philosophical: "Football. Sometimes you deserve more."`,
        ];
      }
    } else {
      quotes = [
        `${myTeamName} boss: "We're building something here. The pieces are coming together."`,
        `"Every session in training this week has been exceptional." — ${myTeamName} manager`,
        `${myTeamName} manager: "We're not looking at the table yet. Just the next game."`,
        `"This squad can surprise people this season — I genuinely believe that." — boss`,
        `${myTeamName} manager: "I've never worked with a more committed group of players"`,
      ];
    }
    if (quotes.length) pushNews({ type: 'manager_quote', icon: '🎙️', headline: pick(quotes), week }, gameState);
  }

  // ── Rival Manager Drama (~22% chance) ────────────────────────────────────
  if (Math.random() < 0.22) {
    const rivalRows = table.filter(r => r.id !== gameState.playerTeam);
    if (rivalRows.length) {
      const rival = getTeam(pick(rivalRows).id);
      const rivalName = rival?.name || 'Rival club';
      const drama = [
        `${rivalName} manager in heated exchange with fourth official after final whistle`,
        `${rivalName} boss: "We were absolutely robbed tonight. This cannot continue."`,
        `Shock at ${rivalName} — star player reportedly submits transfer request`,
        `${rivalName} manager hits back at critics: "Keep talking. We'll keep winning."`,
        `Reports: ${rivalName} dressing room divided after run of poor results`,
        `${rivalName} set to overhaul squad — three senior players could leave`,
        `${rivalName} boss under pressure as board meet to discuss manager's future`,
        `"${rivalName} are in freefall — something has to change" — insider`,
        `${rivalName} captain posts cryptic message amid contract standoff`,
        `${rivalName} manager denies bust-up with players: "What happens in there stays there"`,
        `${rivalName} star skips training amid transfer speculation`,
        `${rivalName} to hold emergency board meeting after dismal run of form`,
      ];
      pushNews({ type: 'rival_drama', icon: '🔥', headline: pick(drama), detail: rivalName, week }, gameState);
    }
  }

  // ── Pundit Opinions (~28% chance) ────────────────────────────────────────
  if (Math.random() < 0.28) {
    const pundits = ['Gary Neville','Jamie Carragher','Roy Keane','Alan Shearer','Micah Richards','Thierry Henry','Ian Wright','Rio Ferdinand','Steven Gerrard','Frank Lampard'];
    const pundit = pick(pundits);
    const star = myTeam?.squad.filter(p => p.overall >= 72).sort((a, b) => b.overall - a.overall)[0];
    const topTeamName = table[0]?.id !== gameState.playerTeam ? getTeam(table[0]?.id)?.name : getTeam(table[1]?.id)?.name;
    let quotes = [];
    if (currPos <= 3) {
      quotes = [
        `${pundit}: "${myTeamName} are genuine title contenders. I'm calling it now."`,
        `"Don't sleep on ${myTeamName} — they are the real deal this season." — ${pundit}`,
        ...(star ? [`${pundit} backs ${star.name} for Player of the Year: "Nobody touches him right now"`] : []),
        `${pundit}: "I said ${myTeamName} would challenge. Nobody believed me."`,
        `"${myTeamName} have the best defensive record in ${leagueName} — that's a title team." — ${pundit}`,
      ];
    } else if (currPos <= 7) {
      quotes = [
        `${pundit}: "${myTeamName} have the squad to push for a top-four finish"`,
        `"${myTeamName} are inconsistent — but when they're on it, they're frightening." — ${pundit}`,
        ...(star ? [`"${star.name} is the best ${star.pos} in ${leagueName} right now." — ${pundit}`] : []),
        `${pundit}: "I'd love to see ${myTeamName} in a cup final. That fan base deserves it."`,
        `"${myTeamName} remind me of a team I played in — organised, hungry, dangerous." — ${pundit}`,
      ];
    } else if (currPos > table.length - 4) {
      quotes = [
        `${pundit}: "${myTeamName} need a win this weekend. The pressure is building."`,
        `"I can't defend that run of results from ${myTeamName}. Something must change." — ${pundit}`,
        `${pundit}: "${myTeamName} looked like a team without a plan out there"`,
        `"${myTeamName} look low on confidence. That dressing room needs a spark." — ${pundit}`,
      ];
    } else {
      quotes = [
        ...(topTeamName ? [`${pundit}: "${topTeamName} look unstoppable — but who's stopping them?"`] : []),
        ...(star ? [`"${star.name} is quietly having a brilliant season. Not enough talk about him." — ${pundit}`] : []),
        `${pundit}: "The ${leagueName} title race is wide open — anyone can win it"`,
        `"I've been impressed by ${myTeamName} at their best this season." — ${pundit}`,
        `${pundit}: "Whoever wins the ${leagueName} this year has genuinely earned it"`,
      ];
    }
    if (quotes.length) pushNews({ type: 'pundit_opinion', icon: '📺', headline: pick(quotes), week }, gameState);
  }
}
function getPlayerOfSeason(leagueId, gameState) {
  let best = null, bestAvg = 0;
  for (const { p } of _getLeagueAllPlayers(leagueId, gameState)) {
    const ratings = p.matchRatings || [];
    if (ratings.length < 10) continue; // min 10 apps for season award
    const avg = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
    if (avg > bestAvg) { bestAvg = avg; best = p; }
  }
  return best ? { player: best, avg: Math.round(bestAvg * 10) / 10 } : null;
}

function getTeamOfSeason(leagueId, gameState) {
  const GK_P = ['GK'], DEF_P = ['CB','LB','RB','LWB','RWB'], MID_P = ['CM','CDM','CAM','LM','RM'], ATT_P = ['ST','CF','LW','RW'];
  const seasonAvg = p => {
    const r = p.matchRatings || [];
    if (r.length < 8) return 0;
    return r.reduce((s, x) => s + x.rating, 0) / r.length;
  };
  const all = _getLeagueAllPlayers(leagueId, gameState);
  const pickBest = (positions, count) =>
    all.filter(({ p }) => positions.includes(p.pos))
       .map(({ p, teamName, teamId }) => ({ p, teamName, teamId, avg: seasonAvg(p) }))
       .filter(x => x.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, count);

  const GK = pickBest(GK_P, 1)[0] || null;
  const DEF = pickBest(DEF_P, 4);
  const MID = pickBest(MID_P, 3);
  const ATT = pickBest(ATT_P, 3);
  if (!GK && !DEF.length && !ATT.length) return null;
  return { GK, DEF, MID, ATT };
}
