// engine.js — Match simulation and game logic

// ── Per-position contribution using individual stats ──────────────────────────

function playerAttackContrib(p) {
  let base;
  switch (p.pos) {
    case 'ST': case 'CF': base = p.shooting*0.5  + p.pace*0.25     + p.physical*0.25; break;
    case 'LW': case 'RW': base = p.pace*0.4      + p.dribbling*0.35 + p.shooting*0.25; break;
    case 'CAM':            base = p.dribbling*0.35 + p.passing*0.35  + p.shooting*0.3; break;
    case 'CM': case 'RM': case 'LM':
                           base = p.passing*0.5   + p.physical*0.3  + p.dribbling*0.2; break;
    case 'CDM':            base = p.passing*0.35  + p.physical*0.35 + p.shooting*0.3; break;
    case 'RB': case 'LB': base = p.pace*0.4      + p.passing*0.35  + p.physical*0.25; break;
    case 'CB':             base = p.physical*0.5  + p.passing*0.3   + p.pace*0.2; break;
    case 'GK':             base = p.overall * 0.3; break;
    default:               base = p.overall; break;
  }
  const t = p.traits;
  if (t && t.length) {
    if (t.includes('clinical') || t.includes('poacher'))                        base *= 1.12;
    if (t.includes('speedster') && ['LW','RW','ST','CF','LB','RB'].includes(p.pos)) base *= 1.10;
    if (t.includes('playmaker') && ['CAM','CM'].includes(p.pos))                base *= 1.18;
    if (t.includes('btb') && p.pos === 'CM')                                    base *= 1.10;
    if (t.includes('longshot'))                                                  base *= 1.05;
    if (t.includes('consistent'))                                                base *= 1.04;
  }
  return base;
}

function playerDefenseContrib(p) {
  let base;
  switch (p.pos) {
    case 'GK':
      base = p.gkHandling
        ? p.gkHandling*0.28 + p.gkReflexes*0.25 + p.gkPositioning*0.25 + p.gkDiving*0.15 + p.gkKicking*0.07
        : p.overall; // fallback for old saves
      break;
    case 'CB':             base = p.defending*0.55 + p.physical*0.3  + p.pace*0.15; break;
    case 'RB': case 'LB': base = p.defending*0.45 + p.pace*0.3      + p.physical*0.25; break;
    case 'CDM':            base = p.defending*0.5  + p.physical*0.3  + p.passing*0.2; break;
    case 'CM': case 'RM': case 'LM':
                           base = p.defending*0.35 + p.physical*0.4  + p.pace*0.25; break;
    case 'CAM':            base = p.physical*0.5   + p.defending*0.3 + p.pace*0.2; break;
    default:               base = p.physical*0.5   + p.pace*0.3      + p.defending*0.2; break;
  }
  const t = p.traits;
  if (t && t.length) {
    if (t.includes('rock'))                                 base *= 1.15;
    if (t.includes('aerial') && p.pos === 'CB')             base *= 1.10;
    if (t.includes('btb') && p.pos === 'CM')                base *= 1.10;
    if (t.includes('pkstopper') && p.pos === 'GK')          base *= 1.08;
    if (t.includes('consistent'))                           base *= 1.04;
  }
  return base;
}

// ── Team ratings ──────────────────────────────────────────────────────────────

function getTeamAttack(team, gameState) {
  const tactics = gameState?.tactics?.[team.id] || {};
  const squad = (team.id === gameState?.playerTeam)
    ? getBestEleven(team.id, tactics.formation || '4-4-2', gameState)
    : [...team.squad].filter(p => !p.injuredWeeks).sort((a, b) => b.overall - a.overall).slice(0, 11);

  const instructions = tactics.playerInstructions || {};
  const atkScore = squad.reduce((s, p) => {
    const w = ['ST','CF','RW','LW','CAM'].includes(p.pos) ? 1.3 :
              ['CM','RM','LM'].includes(p.pos) ? 1.0 : 0.6;
    const contrib = playerAttackContrib(p);
    const instr = PLAYER_INSTRUCTIONS?.find(i => i.id === instructions[p.id]);
    const instrMod = instr ? instr.atkMod : 1.0;
    return s + (contrib * 0.8 + p.overall * 0.2) * w * instrMod;
  }, 0) / 11;

  let mod = 1.0;
  if (tactics.mentality === 'attacking')  mod *= 1.15;
  if (tactics.mentality === 'defensive')  mod *= 0.87;
  if (tactics.pressing === 'high')        mod *= 1.06;
  if (tactics.pressing === 'low')         mod *= 0.96;
  if (tactics.tempo === 'fast')           mod *= 1.05;
  if (tactics.tempo === 'slow')           mod *= 0.96;
  if (tactics.width === 'wide') {
    const wingers = team.squad.filter(p => ['RW','LW','RM','LM'].includes(p.pos));
    if (wingers.length > 0 && wingers[0].overall >= 76) mod *= 1.06;
  }
  if (tactics.passingStyle === 'direct')  mod *= 1.04;
  if (tactics.passingStyle === 'short')   mod *= 0.97;

  const captain = tactics.captain ? team.squad.find(p => p.id === tactics.captain) : null;
  if (captain && (captain.morale || 70) > 75) mod *= 1.03;

  const morale = gameState?.morale?.[team.id] || 70;
  const moraleBonus = (morale - 50) / 200;
  const fitnessBonus = (gameState?.fitness?.[team.id] || 85) / 100 * 0.08;

  return atkScore * mod * (1 + moraleBonus + fitnessBonus);
}

function getTeamDefense(team, gameState) {
  const tactics = gameState?.tactics?.[team.id] || {};
  const squad = (team.id === gameState?.playerTeam)
    ? getBestEleven(team.id, tactics.formation || '4-4-2', gameState)
    : [...team.squad].filter(p => !p.injuredWeeks).sort((a, b) => b.overall - a.overall).slice(0, 11);

  const defInstructions = gameState?.tactics?.[team.id]?.playerInstructions || {};
  const defScore = squad.reduce((s, p) => {
    const w = ['GK','CB'].includes(p.pos) ? 1.4 :
              ['RB','LB','CDM'].includes(p.pos) ? 1.1 :
              ['CM','RM','LM'].includes(p.pos) ? 0.8 : 0.5;
    const contrib = playerDefenseContrib(p);
    const instr = PLAYER_INSTRUCTIONS?.find(i => i.id === defInstructions[p.id]);
    const instrMod = instr ? instr.defMod : 1.0;
    return s + (contrib * 0.8 + p.overall * 0.2) * w * instrMod;
  }, 0) / 11;

  let mod = 1.0;
  if (tactics.mentality === 'defensive')  mod *= 1.15;
  if (tactics.mentality === 'attacking')  mod *= 0.87;
  if (tactics.defensiveLine === 'high')   mod *= 1.08;
  if (tactics.defensiveLine === 'low')    mod *= 0.94;
  if (tactics.pressing === 'high')        mod *= 1.04;
  if (tactics.pressing === 'low')         mod *= 0.96;
  if (tactics.width === 'narrow')         mod *= 1.04;

  const morale = gameState?.morale?.[team.id] || 70;
  const moraleBonus = (morale - 50) / 200;
  const fitnessBonus = (gameState?.fitness?.[team.id] || 85) / 100 * 0.08;

  return defScore * mod * (1 + moraleBonus + fitnessBonus);
}

function getTeamMidfield(team, gameState) {
  const tactics = gameState?.tactics?.[team.id] || {};
  const squad = [...team.squad].filter(p => !p.injuredWeeks).sort((a, b) => b.overall - a.overall).slice(0, 11);

  const midScore = squad.reduce((s, p) => {
    const w = ['CDM','CM','CAM'].includes(p.pos) ? 1.4 :
              ['RM','LM'].includes(p.pos) ? 1.2 :
              ['RB','LB'].includes(p.pos) ? 0.7 :
              ['CB','GK'].includes(p.pos) ? 0.4 : 0.8;
    const contrib = p.passing * 0.5 + p.physical * 0.25 + p.dribbling * 0.25;
    return s + contrib * w;
  }, 0) / 11;

  let mod = 1.0;
  if (tactics.passingStyle === 'short') mod *= 1.06;
  if (tactics.tempo === 'fast')         mod *= 1.04;
  mod *= (1 + ((gameState?.morale?.[team.id] || 70) - 50) / 300);

  return midScore * mod;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Goal type ─────────────────────────────────────────────────────────────────

function getGoalType(chanceType) {
  const r = Math.random();
  if (chanceType === 'low') {
    if (r < 0.72) return 'long_shot';
    if (r < 0.87) return 'header';
    return 'volley';
  }
  if (chanceType === 'medium') {
    if (r < 0.38) return 'finish';
    if (r < 0.62) return 'header';
    if (r < 0.78) return 'volley';
    return 'tap_in';
  }
  // big chance
  if (r < 0.42) return 'tap_in';
  if (r < 0.68) return 'one_on_one';
  if (r < 0.84) return 'header';
  return 'finish';
}

// ── Chance type (low / medium / big) ─────────────────────────────────────────

function getChanceType(shotQ, tactics, midDominance) {
  let pBig = 0.18;

  if (tactics.mentality === 'attacking')   pBig += 0.07;
  if (tactics.mentality === 'defensive')   pBig -= 0.06;
  if (tactics.passingStyle === 'direct')   pBig -= 0.05; // more speculative long shots
  if (tactics.passingStyle === 'short')    pBig += 0.04; // build-up creates better chances
  if (tactics.pressing === 'high')         pBig += 0.03; // press wins the ball in dangerous areas
  if (midDominance > 0.55)                 pBig += 0.05; // dominating midfield = better positions
  pBig += (shotQ - 0.5) * 0.12;           // stronger attacker vs weaker defense = more big chances
  pBig = Math.max(0.08, Math.min(0.42, pBig));

  const pMedium = Math.min(0.50, 0.38 + (0.20 - pBig) * 0.3);

  const roll = Math.random();
  if (roll < pBig)            return 'big';
  if (roll < pBig + pMedium)  return 'medium';
  return 'low';
}

function getXGForType(type, shotQ) {
  switch (type) {
    case 'big':    return 0.28 + shotQ * 0.22; // 0.28 – 0.50
    case 'medium': return 0.09 + shotQ * 0.13; // 0.09 – 0.22
    case 'low':    return 0.03 + shotQ * 0.05; // 0.03 – 0.08
  }
}

// Weighted random pick from pool using a stat getter
function pickWeighted(pool, statFn) {
  const weights = pool.map(p => Math.max(1, statFn(p)));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}

// ── Main match simulation (minute-by-minute) ──────────────────────────────────
// opts: { minStart=1, minEnd=90, initScore={home,away}, prevEvents=[] }
// When splitting into halves: call with minEnd=45 for 1st half, then minEnd=90+initScore for 2nd half.
// AI matches (no opts) run full 90 unchanged.

function simulateMatch(homeTeamId, awayTeamId, gameState, opts = {}) {
  const { minStart = 1, minEnd = 90, initScore = { home: 0, away: 0 }, prevEvents = [] } = opts;

  const home = getTeam(homeTeamId);
  const away = getTeam(awayTeamId);

  // Base ratings (home advantage baked in)
  const homeAtkBase = getTeamAttack(home, gameState) * 1.1;
  const homeDefBase = getTeamDefense(home, gameState) * 1.08;
  const homeMidBase = getTeamMidfield(home, gameState) * 1.05;
  const awayAtkBase = getTeamAttack(away, gameState);
  const awayDefBase = getTeamDefense(away, gameState);
  const awayMidBase = getTeamMidfield(away, gameState);

  // Upset/variance factor per team per match (0.88–1.12)
  const homeVar = 0.88 + Math.random() * 0.24;
  const awayVar = 0.88 + Math.random() * 0.24;
  const homeAtk = homeAtkBase * homeVar;
  const homeDef = homeDefBase * homeVar;
  const homeMid = homeMidBase * homeVar;
  const awayAtk = awayAtkBase * awayVar;
  const awayDef = awayDefBase * awayVar;
  const awayMid = awayMidBase * awayVar;

  // Possession probability based on midfield
  const homePossChance = homeMid / (homeMid + awayMid);

  // Chance creation rate per possession minute
  const homeTactics = gameState?.tactics?.[homeTeamId] || {};
  const awayTactics = gameState?.tactics?.[awayTeamId] || {};
  let homeChanceRate = 0.14;
  let awayChanceRate = 0.14;

  if (homeTactics.mentality === 'attacking')  homeChanceRate *= 1.12;
  if (homeTactics.mentality === 'defensive')  homeChanceRate *= 0.88;
  if (homeTactics.tempo === 'fast')         { homeChanceRate *= 1.08; awayChanceRate *= 1.04; }
  if (homeTactics.tempo === 'slow')           homeChanceRate *= 0.90;
  if (homeTactics.passingStyle === 'direct')  homeChanceRate *= 1.06;

  if (awayTactics.mentality === 'attacking')  awayChanceRate *= 1.12;
  if (awayTactics.mentality === 'defensive')  awayChanceRate *= 0.88;
  if (awayTactics.tempo === 'fast')           awayChanceRate *= 1.08;
  if (awayTactics.passingStyle === 'direct')  awayChanceRate *= 1.06;

  // Player pools for goal events
  const FWD_POS   = ['ST','CF','CAM','LW','RW'];
  const ASSIST_POS = ['CAM','CM','LW','RW','RM','LM','CDM'];

  const homeFwdAll = home.squad.filter(p => FWD_POS.includes(p.pos) && !p.injuredWeeks).sort((a, b) => b.shooting - a.shooting);
  const homeFwd    = homeFwdAll.length ? homeFwdAll : [...home.squad].filter(p => !p.injuredWeeks).sort((a, b) => b.shooting - a.shooting);
  const homeAssAll = home.squad.filter(p => ASSIST_POS.includes(p.pos) && !p.injuredWeeks).sort((a, b) => b.passing - a.passing);
  const homeAss    = homeAssAll.length ? homeAssAll : homeFwd;

  const awayFwdAll = away.squad.filter(p => FWD_POS.includes(p.pos) && !p.injuredWeeks).sort((a, b) => b.shooting - a.shooting);
  const awayFwd    = awayFwdAll.length ? awayFwdAll : [...away.squad].filter(p => !p.injuredWeeks).sort((a, b) => b.shooting - a.shooting);
  const awayAssAll = away.squad.filter(p => ASSIST_POS.includes(p.pos) && !p.injuredWeeks).sort((a, b) => b.passing - a.passing);
  const awayAss    = awayAssAll.length ? awayAssAll : awayFwd;

  // Match state — start from initScore for split-half support
  let homeGoals = initScore.home, awayGoals = initScore.away;
  let homeShots = 0, awayShots = 0;
  let homeXG = 0, awayXG = 0;
  let homePoss = 0, awayPoss = 0;
  let homeBigChances = 0, awayBigChances = 0;
  let homeMomentum = 0, awayMomentum = 0;
  const events = [];

  // Yellow card tracking (player name → count). Seeded from prevEvents for cross-half 2nd yellow detection.
  const homeYellows = new Map();
  const awayYellows = new Map();
  const homeReds = new Set();
  const awayReds = new Set();
  for (const ev of prevEvents) {
    if (ev.type === 'yellow') {
      const map = ev.team === 'home' ? homeYellows : awayYellows;
      map.set(ev.player, (map.get(ev.player) || 0) + 1);
    }
    if (ev.type === 'red') {
      (ev.team === 'home' ? homeReds : awayReds).add(ev.player);
    }
  }

  // Red card attack/defense multipliers (decrease when a player is sent off)
  let homeRedMult = 1.0;
  let awayRedMult = 1.0;

  // Pre-compute mid dominance
  const homeMidDom = homeMid / (homeMid + awayMid);
  const awayMidDom = 1 - homeMidDom;

  // ── minute loop ──
  for (let min = minStart; min <= minEnd; min++) {
    // Effective rates with red card penalties applied per minute
    const effHomeChance = homeChanceRate * homeRedMult;
    const effAwayChance = awayChanceRate * awayRedMult;
    const effHomeAtk = homeAtk * homeRedMult;
    const effHomeDef = homeDef * homeRedMult;
    const effAwayAtk = awayAtk * awayRedMult;
    const effAwayDef = awayDef * awayRedMult;

    if (Math.random() < homePossChance) {
      // Home possession
      homePoss++;
      const atkBoost = homeMomentum > 0 ? 1.1 : 1.0;
      if (homeMomentum > 0) homeMomentum--;

      if (Math.random() < effHomeChance) {
        homeShots++;
        const shotQ = (effHomeAtk * atkBoost) / (effHomeAtk * atkBoost + effAwayDef);
        const chanceType = getChanceType(shotQ, homeTactics, homeMidDom);
        const xg = getXGForType(chanceType, shotQ);
        homeXG += xg;
        if (chanceType === 'big') homeBigChances++;

        if (Math.random() < xg) {
          homeGoals++;
          homeMomentum = 5;
          const scorer   = pickWeighted(homeFwd, p => p.shooting);
          const assPool  = homeAss.filter(p => p !== scorer);
          const assister = pickWeighted(assPool.length ? assPool : homeAss, p => p.passing);
          scorer.goals++;
          assister.assists++;
          scorer.appearances = (scorer.appearances || 0) + 1;
          events.push({ type: 'goal', min, team: 'home', player: scorer.name, assist: assister.name, chanceType, goalType: getGoalType(chanceType) });
        }
      }
    } else {
      // Away possession
      awayPoss++;
      const atkBoost = awayMomentum > 0 ? 1.1 : 1.0;
      if (awayMomentum > 0) awayMomentum--;

      if (Math.random() < effAwayChance) {
        awayShots++;
        const shotQ = (effAwayAtk * atkBoost) / (effAwayAtk * atkBoost + effHomeDef);
        const chanceType = getChanceType(shotQ, awayTactics, awayMidDom);
        const xg = getXGForType(chanceType, shotQ);
        awayXG += xg;
        if (chanceType === 'big') awayBigChances++;

        if (Math.random() < xg) {
          awayGoals++;
          awayMomentum = 5;
          const scorer   = pickWeighted(awayFwd, p => p.shooting);
          const assPool  = awayAss.filter(p => p !== scorer);
          const assister = pickWeighted(assPool.length ? assPool : awayAss, p => p.passing);
          scorer.goals++;
          assister.assists++;
          scorer.appearances = (scorer.appearances || 0) + 1;
          events.push({ type: 'goal', min, team: 'away', player: scorer.name, assist: assister.name, chanceType, goalType: getGoalType(chanceType) });
        }
      }
    }

    // ── Cards (per minute, both teams, independent of possession) ──
    // ~0.7% per min per team = ~0.63 yellows/team/90min; double yellow → red
    [[home, 'home', homeYellows, homeReds], [away, 'away', awayYellows, awayReds]].forEach(([team, side, yellows, reds]) => {
      if (Math.random() < 0.007) {
        const eligible = team.squad.filter(p => !p.injuredWeeks && !reds.has(p.name));
        if (!eligible.length) return;
        const p = eligible[Math.floor(Math.random() * eligible.length)];
        const prev = yellows.get(p.name) || 0;
        if (prev >= 1) {
          // Second yellow → red card
          events.push({ type: 'red', min, team: side, player: p.name });
          reds.add(p.name);
          if (side === 'home') homeRedMult = Math.max(0.78, homeRedMult - 0.1);
          else                 awayRedMult = Math.max(0.78, awayRedMult - 0.1);
        } else {
          yellows.set(p.name, prev + 1);
          events.push({ type: 'yellow', min, team: side, player: p.name });
        }
      }
      // Direct red (rare — violent foul, etc.)
      if (Math.random() < 0.0005) {
        const eligible = team.squad.filter(p => !p.injuredWeeks && !reds.has(p.name));
        if (!eligible.length) return;
        const p = eligible[Math.floor(Math.random() * eligible.length)];
        events.push({ type: 'red', min, team: side, player: p.name });
        reds.add(p.name);
        if (side === 'home') homeRedMult = Math.max(0.78, homeRedMult - 0.1);
        else                 awayRedMult = Math.max(0.78, awayRedMult - 0.1);
      }
    });
  }

  // ── Penalties, free kicks, injuries, clean sheets, attendance ──
  // Only computed once per full match (minEnd >= 90) to avoid doubling up
  let attendance = 0;
  if (minEnd >= 90) {
    const spCoachQ = gameState?.staff?.setPieceCoach?.quality || 0;
    const homeGK = home.squad.find(p => p.pos === 'GK' && !p.injuredWeeks);
    const awayGK = away.squad.find(p => p.pos === 'GK' && !p.injuredWeeks);
    [['home', 0.22, homeFwd, home.id, awayGK], ['away', 0.18, awayFwd, away.id, homeGK]].forEach(([side, prob, pool, teamId, oppGK]) => {
      if (Math.random() < prob) {
        const min = Math.floor(Math.random() * 85) + 3;
        const scorer = pickWeighted(pool, p => p.shooting);
        let conv = teamId === gameState?.playerTeam ? Math.min(0.92, 0.75 + spCoachQ / 400) : 0.75;
        if (oppGK?.traits?.includes('pkstopper')) conv = Math.min(conv, 0.58);
        if (Math.random() < conv) {
          if (side === 'home') { homeGoals++; homeShots++; homeXG += 0.75; homeBigChances++; }
          else                 { awayGoals++; awayShots++; awayXG += 0.75; awayBigChances++; }
          scorer.goals++;
          scorer.appearances = (scorer.appearances || 0) + 1;
          events.push({ type: 'goal', min, team: side, player: scorer.name, assist: null, goalType: 'penalty', chanceType: 'big' });
        } else {
          events.push({ type: 'penalty_miss', min, team: side, player: scorer.name });
        }
      }
    });

    [['home', 0.14, home.squad, home.id], ['away', 0.11, away.squad, away.id]].forEach(([side, prob, squad, teamId]) => {
      if (Math.random() < prob) {
        const min = Math.floor(Math.random() * 85) + 3;
        const fkPool = squad.filter(p => !p.injuredWeeks && ['CM','CAM','LW','RW','ST','CDM'].includes(p.pos));
        const taker = fkPool.length ? pickWeighted(fkPool, p => Math.round((p.passing + p.shooting) / 2)) : squad[0];
        const spCoachQ = gameState?.staff?.setPieceCoach?.quality || 0;
        const fkRate = teamId === gameState?.playerTeam ? Math.min(0.35, 0.15 + spCoachQ / 500) : 0.15;
        if (taker && Math.random() < fkRate) {
          if (side === 'home') { homeGoals++; homeShots++; homeXG += 0.15; }
          else                 { awayGoals++; awayShots++; awayXG += 0.15; }
          taker.goals++;
          taker.appearances = (taker.appearances || 0) + 1;
          events.push({ type: 'goal', min, team: side, player: taker.name, assist: null, goalType: 'free_kick', chanceType: 'medium' });
        }
      }
    });

    // Clean sheets (based on full match goals, counting initScore)
    const finalHomeGoals = homeGoals;
    const finalAwayGoals = awayGoals;
    if (finalHomeGoals === 0) { const gk = away.squad.find(p => p.pos === 'GK'); if (gk) gk.cleanSheets = (gk.cleanSheets || 0) + 1; }
    if (finalAwayGoals === 0) { const gk = home.squad.find(p => p.pos === 'GK'); if (gk) gk.cleanSheets = (gk.cleanSheets || 0) + 1; }

    // Injuries
    const newlyInjured = generateMatchInjuries(home, away, gameState);
    if (gameState?.playerTeam && newlyInjured.length) {
      const playerInj = newlyInjured.filter(p => p.teamId === gameState.playerTeam);
      if (playerInj.length) {
        if (!gameState.newInjuries) gameState.newInjuries = [];
        gameState.newInjuries.push(...playerInj);
      }
    }

    const isPlayerHome = homeTeamId === gameState?.playerTeam;
    const effectiveCapacity = isPlayerHome ? getStadiumCapacity(gameState) : (home.capacity || 30000);
    const mktCampaign = gameState?.marketing?.activeCampaign;
    const attBoost = (isPlayerHome && mktCampaign?.effect?.type === 'attendance') ? mktCampaign.effect.value : 0;
    attendance = Math.floor(effectiveCapacity * (0.7 + Math.random() * 0.3) * (1 + attBoost));
    if (gameState?.budgets) {
      gameState.budgets[homeTeamId] = (gameState.budgets[homeTeamId] || 0) + Math.round(attendance * 2);
    }
  }

  events.sort((a, b) => a.min - b.min);

  const totalPoss = homePoss + awayPoss || (minEnd - minStart + 1);

  return {
    homeTeam: homeTeamId,
    awayTeam: awayTeamId,
    homeGoals,
    awayGoals,
    events: [...prevEvents, ...events],
    attendance,
    possession:  { home: Math.round(homePoss / totalPoss * 100), away: Math.round(awayPoss / totalPoss * 100) },
    xG:          { home: +homeXG.toFixed(1), away: +awayXG.toFixed(1) },
    shots:       { home: homeShots, away: awayShots },
    bigChances:  { home: homeBigChances, away: awayBigChances }
  };
}

// ── League table ──────────────────────────────────────────────────────────────

function calculateTable(teamIds, results) {
  const table = {};
  teamIds.forEach(id => {
    table[id] = { id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  });

  for (const r of results) {
    if (!table[r.homeTeam] || !table[r.awayTeam]) continue;
    const h = table[r.homeTeam];
    const a = table[r.awayTeam];

    h.played++; a.played++;
    h.gf += r.homeGoals; h.ga += r.awayGoals;
    a.gf += r.awayGoals; a.ga += r.homeGoals;
    h.gd = h.gf - h.ga; a.gd = a.gf - a.ga;

    if (r.homeGoals > r.awayGoals) {
      h.won++; h.points += 3; a.lost++;
    } else if (r.homeGoals === r.awayGoals) {
      h.drawn++; h.points++; a.drawn++; a.points++;
    } else {
      a.won++; a.points += 3; h.lost++;
    }
  }

  return Object.values(table).sort((a, b) =>
    b.points - a.points || b.gd - a.gd || b.gf - a.gf
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function generateFixtures(teamIds) {
  const fixtures = [];
  const n = teamIds.length;
  const teams = [...teamIds];

  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      fixtures.push({ home: teams[i], away: teams[n - 1 - i], round, played: false });
    }
    teams.splice(1, 0, teams.pop());
  }

  const returnFixtures = fixtures.map(f => ({
    home: f.away, away: f.home, round: f.round + (n - 1), played: false
  }));

  return [...fixtures, ...returnFixtures].sort((a, b) => a.round - b.round);
}

// ── Player / team utilities ───────────────────────────────────────────────────

function calculateTransferValue(player) {
  const ageMult = player.age <= 20 ? 1.7 : player.age <= 23 ? 1.4 : player.age <= 26 ? 1.1 :
                  player.age <= 29 ? 1.0 : player.age <= 31 ? 0.75 : player.age <= 33 ? 0.5 : 0.25;
  const base = Math.max(0, player.overall - 55);
  return Math.round(Math.pow(base, 3) * 1800 * ageMult);
}

function canAfford(teamId, amount, gameState) {
  return (gameState.budgets[teamId] || 0) >= amount;
}

function getFormStreak(teamId, gameState) {
  const leagueId = ['premier', 'championship'].find(lid =>
    (gameState.leagueTeams?.[lid] || []).includes(teamId)
  ) || gameState.playerLeague;
  const all = (gameState.results?.[leagueId] || [])
    .filter(r => r.homeTeam === teamId || r.awayTeam === teamId)
    .slice(-3);
  return all.reduce((s, r) => {
    const won  = (r.homeTeam === teamId && r.homeGoals > r.awayGoals) ||
                 (r.awayTeam === teamId && r.awayGoals > r.homeGoals);
    const lost = (r.homeTeam === teamId && r.homeGoals < r.awayGoals) ||
                 (r.awayTeam === teamId && r.awayGoals < r.homeGoals);
    return s + (won ? 1 : lost ? -1 : 0);
  }, 0);
}

function updateMorale(teamId, result, gameState) {
  const assistQ = teamId === gameState?.playerTeam ? (gameState?.staff?.assistantManager?.quality || 0) : 0;
  const winBonus      = Math.floor(assistQ / 40);  // 0-2 extra morale on wins
  const lossReduction = Math.floor(assistQ / 60);  // 0-1 less morale loss on defeats
  let change = result === 'win' ? 5 + winBonus : result === 'draw' ? 1 : -4 + lossReduction;
  const streak = getFormStreak(teamId, gameState);
  if (result === 'win'  && streak >= 2)  change += 2;
  if (result === 'loss' && streak <= -2) change -= 2;
  const current = gameState.morale[teamId] || 70;
  gameState.morale[teamId] = Math.max(20, Math.min(100, current + change));
}

function recoverFitness(gameState) {
  const fitnessCoachQ = gameState?.staff?.fitnessCoach?.quality || 0;
  const extra = Math.floor(fitnessCoachQ / 40); // 0-2 extra per week for player's team
  for (const teamId in gameState.fitness) {
    const bonus = teamId === gameState?.playerTeam ? extra : 0;
    gameState.fitness[teamId] = Math.min(100, (gameState.fitness[teamId] || 85) + 3 + bonus);
  }
}

function applyMatchFatigue(teamId, gameState) {
  const fitnessCoachQ = teamId === gameState?.playerTeam ? (gameState?.staff?.fitnessCoach?.quality || 0) : 0;
  const fatigueSave = Math.floor(fitnessCoachQ / 50); // 0-1 less fatigue with good coach
  gameState.fitness[teamId] = Math.max(50, (gameState.fitness[teamId] || 85) - 8 + fatigueSave);
  // Engine trait players reduce team fatigue slightly
  if (teamId === gameState?.playerTeam) {
    const team = getTeam(teamId);
    const engineCount = team?.squad.filter(p => p.traits?.includes('engine') && !p.injuredWeeks && !p.outOnLoan).length || 0;
    if (engineCount > 0) gameState.fitness[teamId] = Math.min(100, gameState.fitness[teamId] + Math.min(engineCount, 2));
  }
}

function generateMatchInjuries(home, away, gameState) {
  const newlyInjured = [];
  const physioQ = gameState?.staff?.physio?.quality || 0;
  const baseRisk = Math.max(0.05, 0.12 - physioQ / 1700); // 12% → ~5% with elite physio
  const durationReduction = Math.floor(physioQ / 50);      // 0-1 week shorter with good physio

  [home, away].forEach(team => {
    // Only player's team benefits from physio
    const risk = team.id === gameState?.playerTeam ? baseRisk : 0.12;
    if (Math.random() < risk) {
      const eligible = team.squad.filter(p => !p.injuredWeeks);
      if (!eligible.length) return;
      // injury_prone players 40% more likely to be the victim
      const prone = eligible.filter(p => p.traits?.includes('injury_prone'));
      const victim = prone.length && Math.random() < 0.4
        ? prone[Math.floor(Math.random() * prone.length)]
        : eligible[Math.floor(Math.random() * eligible.length)];
      let duration = Math.floor(Math.random() * 3) + 1;
      if (victim.traits?.includes('injury_prone')) duration += 1; // +1 week for prone players
      if (team.id === gameState?.playerTeam) duration = Math.max(1, duration - durationReduction);
      victim.injuredWeeks = duration;
      newlyInjured.push({ name: victim.name, pos: victim.pos, weeks: victim.injuredWeeks, teamId: team.id });
    }
  });
  return newlyInjured;
}

function decrementInjuries(gameState) {
  getAllTeams().forEach(team => {
    team.squad.forEach(p => { if (p.injuredWeeks > 0) p.injuredWeeks--; });
  });
}

function getWeeklyWageCost(team) {
  return team.squad.reduce((sum, p) => sum + Math.round(Math.max(0, p.overall - 50) * 60), 0);
}
