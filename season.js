// season.js — Season progression, fixtures, promotion/relegation, career, regens

// ─── REGEN NAME POOL ─────────────────────────────────────────────────────────
const REGEN_FIRST = [
  'Liam','Noah','James','Oliver','Benjamin','Elijah','Lucas','Mason','Logan','Ethan',
  'Aiden','Jackson','Sebastian','Jack','Owen','Ryan','Nathan','Dylan','Caleb','Isaac',
  'Mateo','Santiago','Alejandro','Diego','Carlos','Miguel','Jose','Angel','Luis','Ivan',
  'Kofi','Kwame','Amara','Kobe','Tariq','Malik','Jamal','Darius','Marcus','Tyrone',
  'Luca','Marco','Alessandro','Federico','Matteo','Lorenzo','Giovanni','Andrea','Davide','Simone',
  'Hugo','Antoine','Lucas','Romain','Maxime','Theo','Clement','Baptiste','Florian','Quentin',
  'Leon','Niklas','Moritz','Felix','Julian','Lukas','Jonas','Finn','Tim','Max',
  'Kai','Enzo','Noa','Yusuf','Ibrahim','Omar','Hamza','Bilal','Mehdi','Amine',
  'Tomas','Pavel','Michal','Jakub','Marek','Martin','Petr','Jan','David','Filip',
  'Sven','Erik','Bjorn','Lars','Henrik','Mikael','Johan','Andreas','Patrik','Oscar'
];
const REGEN_LAST = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor',
  'Anderson','Thomas','Jackson','White','Harris','Martin','Thompson','Moore','Allen','Clark',
  'Silva','Santos','Costa','Oliveira','Ferreira','Rodrigues','Sousa','Pereira','Carvalho','Gomes',
  'Diallo','Traore','Coulibaly','Kone','Toure','Camara','Diop','Balde','Ndiaye','Sy',
  'Rossi','Ferrari','Russo','Romano','Colombo','Ricci','Marino','Greco','Bruno','Conti',
  'Muller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann',
  'Dupont','Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy',
  'Al-Hassan','El-Amin','Bouazza','Nasri','Benali','Zidane','Meziane','Cherif','Hamdani','Rahmani',
  'Kovac','Novak','Horvat','Babic','Petrovic','Jovanovic','Nikolic','Markovic','Ilic','Bogdanovic',
  'Eriksen','Andersen','Jensen','Nielsen','Hansen','Pedersen','Christensen','Sorensen','Larsen','Poulsen'
];

const REGEN_NATIONS = ['ENG','ENG','ENG','ENG','FRA','GER','ESP','BRA','ARG','POR','NED','BEL','ITA','SCO','WAL','IRL','SEN','GHA','NGA','COL'];

function regenName() {
  return REGEN_FIRST[Math.floor(Math.random()*REGEN_FIRST.length)] + ' ' +
         REGEN_LAST[Math.floor(Math.random()*REGEN_LAST.length)];
}

function regenNation() {
  return REGEN_NATIONS[Math.floor(Math.random()*REGEN_NATIONS.length)];
}

// ─── LEAGUE TEAMS HELPER ─────────────────────────────────────────────────────
// Always read from gameState.leagueTeams to survive save/load
function getLeagueTeams(leagueId, gameState) {
  return gameState.leagueTeams?.[leagueId] || LEAGUES[leagueId]?.teams || [];
}

// Returns all league IDs that should be simulated this season
function getActiveLeagues(gameState) {
  const country = gameState.playerCountry || LEAGUES[gameState.playerLeague]?.country || 'england';
  const cc = COUNTRY_CONFIG[country];
  const active = new Set();
  active.add(cc.div1);
  if (cc.div2) active.add(cc.div2);
  // All other div1s (for Europa League qualification at end of season)
  Object.values(COUNTRY_CONFIG).forEach(cfg => active.add(cfg.div1));
  return [...active].filter(lid => LEAGUES[lid]);
}

// ─── INIT SEASON ─────────────────────────────────────────────────────────────
function initSeason(gameState) {
  // _nextPid MUST be initialized before generateYouthMarket (players need valid ids)
  if (!gameState._nextPid) {
    let maxId = 0;
    getAllTeams().forEach(t => t.squad.forEach(p => { if (p.id > maxId) maxId = p.id; }));
    gameState._nextPid = maxId + 1;
  }

  // Init youth system on first load / old saves
  if (!gameState.youthSquad) gameState.youthSquad = [];
  if (!gameState.youthMarket || !gameState.youthMarket[0]?.youthPrice) generateYouthMarket(gameState);

  // Init staff system
  if (!gameState.staff) gameState.staff = {};
  if (!gameState.staffMarket || !gameState.staffMarket.length) generateStaffMarket(gameState);

  // Init contract demands
  if (!gameState.contractDemands) gameState.contractDemands = [];

  // Init infrastructure, sponsorships, marketing
  if (!gameState.infrastructure) gameState.infrastructure = { stadium: 0, trainingGround: 0, youthAcademy: 0, building: null };
  if (!gameState.sponsorships) gameState.sponsorships = { main: null, kit: null, regional: null };
  if (!gameState.marketing) gameState.marketing = { activeCampaign: null, campaignsThisSeason: 0 };
  if (!gameState.sponsorOffers) generateSponsorOffers(gameState);

  // One-time trait migration: assign traits to any player that doesn't have them yet
  getAllTeams().forEach(t => t.squad.forEach(p => { if (!p.traits) assignRandomTraits(p); }));
  if (gameState.youthSquad) gameState.youthSquad.forEach(p => { if (!p.traits) assignRandomTraits(p); });

  // Seed leagueTeams for all known leagues (handles both fresh start and old saves)
  if (!gameState.leagueTeams) gameState.leagueTeams = {};
  Object.keys(LEAGUES).forEach(lid => {
    if (!gameState.leagueTeams[lid]) gameState.leagueTeams[lid] = [...LEAGUES[lid].teams];
  });

  gameState.season = gameState.season || 1;

  const activeLeagues = getActiveLeagues(gameState);
  gameState.currentRound = {};
  gameState.results = {};
  gameState.fixtures = {};

  activeLeagues.forEach(lid => {
    gameState.currentRound[lid] = 0;
    gameState.results[lid] = [];
    gameState.fixtures[lid] = generateFixtures(getLeagueTeams(lid, gameState));
  });

  // Reset morale & fitness for all active teams
  gameState.morale = {};
  gameState.fitness = {};
  activeLeagues.forEach(lid => {
    getLeagueTeams(lid, gameState).forEach(id => {
      gameState.morale[id] = 70;
      gameState.fitness[id] = 90;
    });
  });

  if (!gameState.budgets) {
    gameState.budgets = {};
    getAllTeams().forEach(t => gameState.budgets[t.id] = t.budget);
  }

  // Career init
  if (!gameState.career) {
    gameState.career = {
      history: [],
      hallOfFame: {
        leagueTitles: 0, promotions: 0, relegations: 0,
        topScorerAwards: 0, managerOfSeasonAwards: 0,
        domesticCupWins: 0, europaWins: 0, clWins: 0,
        bestFinish: null, totalWins: 0, totalGames: 0
      }
    };
  }
  // Backward compat: faCupWins → domesticCupWins
  const hof = gameState.career.hallOfFame;
  if (hof.faCupWins && !hof.domesticCupWins) hof.domesticCupWins = hof.faCupWins;

  gameState.transferWindowOpen = true;
  initDomesticCup(gameState);
}

// ─── SIMULATE MATCHWEEK ───────────────────────────────────────────────────────
function simulateMatchweek(leagueId, gameState) {
  const round = gameState.currentRound[leagueId];
  const fixtures = gameState.fixtures[leagueId].filter(f => f.round === round && !f.played);
  const weekResults = [];

  for (const fixture of fixtures) {
    if (fixture.home === gameState.playerTeam || fixture.away === gameState.playerTeam) continue;

    const result = simulateMatch(fixture.home, fixture.away, gameState);
    fixture.played = true;
    fixture.result = result;
    gameState.results[leagueId].push(result);
    weekResults.push(result);
    if (leagueId === gameState.playerLeague) computeMatchRatings(fixture.home, fixture.away, result, gameState);

    if (result.homeGoals > result.awayGoals) {
      updateMorale(fixture.home, 'win', gameState);
      updateMorale(fixture.away, 'loss', gameState);
    } else if (result.homeGoals === result.awayGoals) {
      updateMorale(fixture.home, 'draw', gameState);
      updateMorale(fixture.away, 'draw', gameState);
    } else {
      updateMorale(fixture.home, 'loss', gameState);
      updateMorale(fixture.away, 'win', gameState);
    }

    applyMatchFatigue(fixture.home, gameState);
    applyMatchFatigue(fixture.away, gameState);
  }

  recoverFitness(gameState);
  return weekResults;
}

// ─── SIMULATE PLAYER MATCH ───────────────────────────────────────────────────
function simulatePlayerMatch(gameState, playerTactics) {
  const playerTeam = gameState.playerTeam;
  const leagueId = gameState.playerLeague;
  const round = gameState.currentRound[leagueId];

  const fixture = gameState.fixtures[leagueId].find(
    f => f.round === round && !f.played &&
    (f.home === playerTeam || f.away === playerTeam)
  );
  if (!fixture) return null;

  if (playerTactics) {
    if (!gameState.tactics) gameState.tactics = {};
    gameState.tactics[playerTeam] = playerTactics;
  }

  const result = simulateMatch(fixture.home, fixture.away, gameState);
  fixture.played = true;
  fixture.result = result;
  gameState.results[leagueId].push(result);

  const isHome = fixture.home === playerTeam;
  const playerGoals = isHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isHome ? result.awayGoals : result.homeGoals;
  const matchResult = playerGoals > oppGoals ? 'win' : playerGoals === oppGoals ? 'draw' : 'loss';

  updateMorale(playerTeam, matchResult, gameState);
  applyMatchFatigue(playerTeam, gameState);
  applyMatchFatigue(isHome ? fixture.away : fixture.home, gameState);

  return { fixture, result, isHome, matchResult };
}

// ─── ADVANCE MATCHWEEK ───────────────────────────────────────────────────────
function advanceMatchweek(gameState) {
  const activeLeagues = getActiveLeagues(gameState);

  // Deduct weekly wages for all active teams
  activeLeagues.forEach(lid => {
    getLeagueTeams(lid, gameState).forEach(id => {
      const team = getTeam(id);
      if (!team) return;
      if (gameState.budgets[id] !== undefined) gameState.budgets[id] -= getWeeklyWageCost(team);
    });
  });

  // Deduct staff wages for player's team
  if (gameState.staff && gameState.playerTeam) {
    const staffWages = Object.values(gameState.staff).reduce((sum, s) => sum + (s.wage || 0), 0);
    if (staffWages > 0) gameState.budgets[gameState.playerTeam] = (gameState.budgets[gameState.playerTeam] || 0) - staffWages;
  }

  activeLeagues.forEach(lid => simulateMatchweek(lid, gameState));

  activeLeagues.forEach(lid => {
    const fixtures = gameState.fixtures[lid] || [];
    if (!fixtures.length) return;
    const maxRound = Math.max(...fixtures.map(f => f.round));
    if ((gameState.currentRound[lid] || 0) < maxRound) gameState.currentRound[lid]++;
  });

  const week = gameState.currentRound[gameState.playerLeague];
  gameState.transferWindowOpen = (week <= 3) || (week >= 19 && week <= 22);

  // ─── NEWS GENERATION ────────────────────────────────────────────────────────
  if (gameState.playerTeam && gameState.playerLeague) {
    const _nw = week; // news week
    const _myTeam = getTeam(gameState.playerTeam);
    const _myTeamName = _myTeam?.name || '';
    const _leagueName = LEAGUES[gameState.playerLeague]?.name || '';

    // Injury returns — check BEFORE decrementInjuries fires
    if (_myTeam) {
      _myTeam.squad.forEach(p => {
        if (p.injuredWeeks === 1) {
          pushNews({ type: 'injury_return', icon: '💪', headline: `${p.name} is back fit`, detail: `${p.pos} returns to full training`, week: _nw }, gameState);
        }
      });
    }

    // New injuries from just-simulated AI matches (only playerTeam players)
    if (gameState.newInjuries?.length) {
      gameState.newInjuries.forEach(inj => {
        pushNews({ type: 'injury', icon: '🏥', headline: `${inj.name} picks up an injury`, detail: `${inj.pos} · out for ${inj.weeks} week${inj.weeks !== 1 ? 's' : ''}`, week: _nw }, gameState);
      });
    }

    // Table position changes
    const _table = getLeagueTable(gameState.playerLeague, gameState);
    const _currPos = _table.findIndex(r => r.id === gameState.playerTeam) + 1;
    const _prevPos = gameState._prevLeaguePos || _currPos;
    const _relZone = _table.length - (LEAGUES[gameState.playerLeague]?.relegationSpots || 3);
    if (_prevPos !== 1 && _currPos === 1) {
      pushNews({ type: 'table_top', icon: '🥇', headline: `${_myTeamName} go top of the table!`, detail: `Leading the ${_leagueName}`, week: _nw }, gameState);
    } else if (_prevPos > 4 && _currPos <= 4) {
      pushNews({ type: 'european_zone', icon: '🌍', headline: `European football in sight`, detail: `${_myTeamName} move into the top 4`, week: _nw }, gameState);
    } else if (_prevPos > 0 && _prevPos <= _relZone && _currPos > _relZone) {
      pushNews({ type: 'safe', icon: '😮‍💨', headline: `${_myTeamName} escape the drop zone`, detail: `Moving to safety`, week: _nw }, gameState);
    } else if (_prevPos > _relZone && _currPos > 0 && _currPos <= _relZone) {
      pushNews({ type: 'relegation_zone', icon: '🔴', headline: `${_myTeamName} drop into the relegation zone`, detail: `Danger zone in the ${_leagueName}`, week: _nw }, gameState);
    }
    gameState._prevLeaguePos = _currPos;

    // Win/loss streaks
    const _allResults = (gameState.results[gameState.playerLeague] || [])
      .filter(r => r.homeTeam === gameState.playerTeam || r.awayTeam === gameState.playerTeam);
    const _getOut = r => {
      const h = r.homeTeam === gameState.playerTeam;
      const mg = h ? r.homeGoals : r.awayGoals, og = h ? r.awayGoals : r.homeGoals;
      return mg > og ? 'W' : mg === og ? 'D' : 'L';
    };
    const _last3 = _allResults.slice(-3).map(_getOut);
    const _last5 = _allResults.slice(-5).map(_getOut);
    if (_last3.length === 3 && _last3.every(o => o === 'W'))
      pushNews({ type: 'win_streak', icon: '🔥', headline: `${_myTeamName} on a 3-game winning run!`, week: _nw }, gameState);
    if (_last3.length === 3 && _last3.every(o => o === 'L'))
      pushNews({ type: 'losing_streak', icon: '⚠️', headline: `Three straight losses for ${_myTeamName}`, detail: `Form is a concern`, week: _nw }, gameState);
    if (_last5.length === 5 && !_last5.includes('L') && _last5.includes('D'))
      pushNews({ type: 'unbeaten_run', icon: '🛡️', headline: `${_myTeamName} five games unbeaten`, week: _nw }, gameState);

    // Rival stumbles — only when player is in top 5 themselves
    if (_currPos > 0 && _currPos <= 5) {
      _table.slice(0, 4).filter(r => r.id !== gameState.playerTeam).forEach(rival => {
        const _rr = (gameState.results[gameState.playerLeague] || [])
          .filter(r => r.homeTeam === rival.id || r.awayTeam === rival.id).slice(-1);
        if (_rr.length) {
          const r = _rr[0];
          const lost = r.homeTeam === rival.id ? r.homeGoals < r.awayGoals : r.awayGoals < r.homeGoals;
          if (lost) pushNews({ type: 'rival_stumble', icon: '😏', headline: `${getTeam(rival.id)?.name} drop points`, detail: `Title race tightens`, week: _nw }, gameState);
        }
      });
    }

    // POTM / TOTM every 4 matchweeks
    if (_nw > 0 && _nw % 4 === 0) {
      const _from = _nw - 3;
      const _potm = getPlayerOfMonth(gameState.playerLeague, _from, _nw, gameState);
      const _totm = getTeamOfMonth(gameState.playerLeague, _from, _nw, gameState);
      if (_potm) {
        gameState.lastPOTM = _potm;
        pushNews({ type: 'potm', icon: '🏅', headline: `${_potm.player.name} wins Player of the Month`, detail: `Avg rating ${_potm.avg} · ${_potm.player.goals}g ${_potm.player.assists}a`, week: _nw }, gameState);
      }
      if (_totm) {
        gameState.lastTOTM = _totm;
        const _names = [
          ...(_totm.GK ? [_totm.GK.p.name] : []),
          ...(_totm.DEF || []).slice(0, 2).map(x => x.p.name),
          ...(_totm.ATT || []).slice(0, 1).map(x => x.p.name),
        ].join(', ');
        pushNews({ type: 'totm', icon: '🌟', headline: `Team of the Month announced`, detail: _names, week: _nw }, gameState);
      }
    }
    // Colorful news: rumors, manager quotes, pundit opinions, rival drama
    generateColorfulNews(gameState);
  }
  // ─── END NEWS ────────────────────────────────────────────────────────────────

  // Decrement injury timers
  decrementInjuries(gameState);

  // Domestic cup trigger check
  const cup = gameState.faCup;
  if (cup && !cup.playerEliminated && cup.currentRound < 4 && !cup.rounds[cup.currentRound]?.completed) {
    const triggerWeek = cup.triggerWeeks[cup.currentRound];
    if (week >= triggerWeek && !cup.playerMatchPending) {
      triggerFaCupRound(gameState);
    }
  }

  const allPlayed = gameState.fixtures[gameState.playerLeague].every(f => f.played);
  if (allPlayed) endSeason(gameState);

  // Reset youth training ticks each matchweek
  gameState.youthTrainingTicks = 0;

  // Tick per-player training programs
  const trainingSquad = getTeam(gameState.playerTeam)?.squad || [];
  trainingSquad.forEach(p => {
    if (!p.trainingProgram) return;
    p.trainingProgram.weeksLeft--;
    if (p.trainingProgram.weeksLeft <= 0) {
      completePlayerTraining(p, gameState);
      gameState.notification = `🏋️ ${p.name} completed their training program! OVR now ${p.overall}.`;
    }
  });

  generateAIBids(gameState);
  generateContractDemands(gameState);

  // Pay sponsor income
  if (gameState.sponsorships && gameState.playerTeam) {
    let sponsorIncome = 0;
    Object.values(gameState.sponsorships).forEach(s => { if (s) sponsorIncome += s.weeklyIncome; });
    if (sponsorIncome > 0) gameState.budgets[gameState.playerTeam] = (gameState.budgets[gameState.playerTeam] || 0) + sponsorIncome;
  }
  // Marketing campaign tick
  if (gameState.marketing?.activeCampaign) {
    const c = gameState.marketing.activeCampaign;
    if (c.effect.type === 'income' || c.effect.type === 'rep_and_income') {
      const bonus = c.effect.value || c.effect.incomeBonus || 0;
      gameState.budgets[gameState.playerTeam] = (gameState.budgets[gameState.playerTeam] || 0) + bonus;
    }
    c.weeksLeft--;
    if (c.weeksLeft <= 0) {
      gameState.marketing.activeCampaign = null;
      if (!gameState.notification) gameState.notification = '📣 Marketing campaign has ended.';
    }
  }
}

// ─── AI TRANSFER BIDS ────────────────────────────────────────────────────────
function generateAIBids(gameState) {
  if (!gameState.aiBids) gameState.aiBids = [];
  if (gameState.aiBids.length >= 3) return; // max 3 pending bids at once
  if (!gameState.transferWindowOpen) return; // only during window
  if (Math.random() > 0.22) return; // ~22% chance per matchweek

  const playerSquad = getTeam(gameState.playerTeam)?.squad || [];
  const eligible = playerSquad.filter(p => p.overall >= 74 && !p.injuredWeeks && !p.onLoan);
  if (!eligible.length) return;

  const target = eligible[Math.floor(Math.random() * eligible.length)];
  if (gameState.aiBids.find(b => b.playerId === target.id)) return; // no duplicate bids

  const value = calculateTransferValue(target);
  const bidAmount = Math.round(value * (1.05 + Math.random() * 0.4)); // 5-45% above value

  const myPrestige = getTeam(gameState.playerTeam)?.prestige || 50;
  const bidders = getAllTeams().filter(t =>
    t.id !== gameState.playerTeam &&
    t.prestige >= myPrestige - 15 &&
    (gameState.budgets?.[t.id] || 0) >= bidAmount
  );
  if (!bidders.length) return;

  const bidder = bidders[Math.floor(Math.random() * bidders.length)];
  gameState.aiBids.push({
    id: `bid_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    playerId: target.id,
    playerName: target.name,
    playerPos: target.pos,
    playerOvr: target.overall,
    biddingTeamId: bidder.id,
    biddingTeamName: bidder.name,
    amount: bidAmount,
  });
}

// ─── END SEASON ──────────────────────────────────────────────────────────────
function endSeason(gameState) {
  if (gameState.seasonEnded) return;
  gameState.seasonEnded = true;

  const country = gameState.playerCountry || LEAGUES[gameState.playerLeague]?.country || 'england';
  const cc = COUNTRY_CONFIG[country];
  const div1Id = cc.div1;
  const div2Id = cc.div2;

  const div1Teams = getLeagueTeams(div1Id, gameState);
  const div1Table = calculateTable(div1Teams, gameState.results[div1Id] || []);

  let div2Table = null;
  if (div2Id) {
    const div2Teams = getLeagueTeams(div2Id, gameState);
    div2Table = calculateTable(div2Teams, gameState.results[div2Id] || []);
  }

  const div1Config = LEAGUES[div1Id];
  const div2Config = div2Id ? LEAGUES[div2Id] : null;

  // Promotion / Relegation
  // No relegation when there's no second division (e.g. Liga Portugal)
  const relegated = div2Id
    ? div1Table.slice(div1Teams.length - (div1Config?.relegationSpots || 3)).map(r => r.id)
    : [];
  let promoted = [], playoffWinner = null, div2Relegated = [], div2PlayoffTeams = [];

  if (div2Table && div2Config) {
    const div2TeamsList = getLeagueTeams(div2Id, gameState);
    const spots = div2Config.promotionSpots || 2;
    promoted = div2Table.slice(0, spots).map(r => r.id);
    div2PlayoffTeams = div2Table.slice(spots, spots + 4).map(r => r.id);
    playoffWinner = div2PlayoffTeams[Math.floor(Math.random() * div2PlayoffTeams.length)] || null;
    const relSpots = div2Config.relegationSpots || 3;
    div2Relegated = div2Table.slice(div2TeamsList.length - relSpots).map(r => r.id);
  }

  // Generic tier-3 teams to fill vacated div2 slots
  const genericFill = generateTierThreeTeams(gameState, div2Id || div1Id, country);

  // Update league compositions
  const promotedAll = [...promoted, ...(playoffWinner ? [playoffWinner] : [])];
  const newDiv1 = [
    ...getLeagueTeams(div1Id, gameState).filter(id => !relegated.includes(id)),
    ...promotedAll
  ].slice(0, div1Teams.length);
  gameState.leagueTeams[div1Id] = newDiv1;

  if (div2Id) {
    const currentDiv2 = getLeagueTeams(div2Id, gameState);
    const newDiv2 = [
      ...currentDiv2.filter(id => !promotedAll.includes(id) && !div2Relegated.includes(id)),
      ...relegated,
      ...genericFill
    ].slice(0, currentDiv2.length);
    gameState.leagueTeams[div2Id] = newDiv2;
  }

  // Player league update
  const isPlayerInDiv1 = div1Table.some(r => r.id === gameState.playerTeam);
  const playerActiveTable = isPlayerInDiv1 ? div1Table : (div2Table || div1Table);
  const playerTableRow = playerActiveTable.find(r => r.id === gameState.playerTeam) || {};
  const playerPosition = playerActiveTable.findIndex(r => r.id === gameState.playerTeam) + 1;

  let playerResult = 'normal';
  if (relegated.includes(gameState.playerTeam) && div2Id) {
    gameState.playerLeague = div2Id;
    gameState.notification = `⬇️ ${getTeam(gameState.playerTeam).name} have been RELEGATED to ${LEAGUES[div2Id]?.name || 'Division 2'}.`;
    playerResult = 'relegated';
  } else if (relegated.includes(gameState.playerTeam) && !div2Id) {
    // No div2 (Liga Portugal) — player survives but gets warning
    gameState.notification = `⚠️ ${getTeam(gameState.playerTeam).name} narrowly survived — no relegation league exists.`;
    playerResult = 'survived';
  } else if (promotedAll.includes(gameState.playerTeam)) {
    gameState.playerLeague = div1Id;
    gameState.notification = `⬆️ ${getTeam(gameState.playerTeam).name} have been PROMOTED to ${LEAGUES[div1Id]?.name || 'First Division'}!`;
    playerResult = 'promoted';
  } else if (div1Table[0]?.id === gameState.playerTeam) {
    playerResult = 'title';
    gameState.notification = `🏆 ${getTeam(gameState.playerTeam).name} are LEAGUE CHAMPIONS!`;
  }

  // Season awards
  const leagueWinner = div1Table[0];
  const leagueWinnerTeam = getTeam(leagueWinner?.id);
  const topScorerLeague = getSeasonTopScorer(gameState.playerLeague, gameState);
  const managerOfSeason = { teamId: div1Table[0]?.id, teamName: leagueWinnerTeam?.name, wins: div1Table[0]?.won };
  const myTopScorer = getMyTopScorer(gameState);

  // Hall of Fame updates
  const hof = gameState.career.hallOfFame;
  hof.totalWins = (hof.totalWins || 0) + (playerTableRow.won || 0);
  hof.totalGames = (hof.totalGames || 0) + (playerTableRow.played || 0);

  if (playerResult === 'title') hof.leagueTitles++;
  if (playerResult === 'promoted') hof.promotions++;
  if (playerResult === 'relegated') hof.relegations++;
  if (topScorerLeague && myTopScorer && topScorerLeague.name === myTopScorer.name) hof.topScorerAwards = (hof.topScorerAwards||0) + 1;
  if (managerOfSeason?.teamId === gameState.playerTeam) hof.managerOfSeasonAwards = (hof.managerOfSeasonAwards||0) + 1;
  if (!hof.bestFinish || playerPosition < hof.bestFinish.position) {
    hof.bestFinish = { position: playerPosition, season: gameState.season, league: gameState.playerLeague };
  }

  // Record career history
  gameState.career.history.push({
    season: gameState.season,
    league: gameState.playerLeague,
    leagueName: LEAGUES[gameState.playerLeague]?.name || gameState.playerLeague,
    position: playerPosition,
    points: playerTableRow.points || 0,
    won: playerTableRow.won || 0,
    drawn: playerTableRow.drawn || 0,
    lost: playerTableRow.lost || 0,
    gf: playerTableRow.gf || 0,
    ga: playerTableRow.ga || 0,
    result: playerResult,
    leagueWinner: { teamId: leagueWinner?.id, teamName: leagueWinnerTeam?.name || leagueWinner?.id || '—' },
    topScorerLeague, myTopScorer, managerOfSeason,
    europeanResult: getEuropeanSeasonResult(gameState)
  });

  // Season awards: POTS + TOTS
  try {
    const _pots = getPlayerOfSeason(gameState.playerLeague, gameState);
    const _tots = getTeamOfSeason(gameState.playerLeague, gameState);
    if (_pots) {
      gameState.lastPOTS = _pots;
      pushNews({ type: 'pots', icon: '🏆', headline: `${_pots.player.name} is Player of the Season`, detail: `Avg rating ${_pots.avg} · ${_pots.player.goals}g ${_pots.player.assists}a`, week: gameState.currentRound[gameState.playerLeague] || 38 }, gameState);
    }
    if (_tots) {
      gameState.lastTOTS = _tots;
      const _totNames = [
        ...(_tots.GK ? [_tots.GK.p.name] : []),
        ...(_tots.DEF || []).slice(0, 3).map(x => x.p.name),
        ...(_tots.ATT || []).slice(0, 2).map(x => x.p.name),
      ].join(', ');
      pushNews({ type: 'tots', icon: '⭐', headline: `Team of the Season revealed`, detail: _totNames, week: gameState.currentRound[gameState.playerLeague] || 38 }, gameState);
    }
  } catch(e) { console.error('POTS/TOTS error:', e); }

  // Age players + retirements + regens
  processRetirements(gameState);

  gameState.promotionRelegation = { plRelegated: relegated, champPromoted: promoted, playoffWinner, champRelegated: div2Relegated, champPlayoff: div2PlayoffTeams };

  // Manager reputation update
  let repChange = 0;
  if (playerResult === 'title') repChange += 15;
  else if (playerResult === 'promoted') repChange += 10;
  else if (playerResult === 'relegated') repChange -= 15;
  else if (playerPosition <= 4 && isPlayerInDiv1) repChange += 3;
  else if (playerPosition <= 4 && !isPlayerInDiv1) repChange += 2;
  else if (playerPosition > (div1Teams.length - 3) && isPlayerInDiv1) repChange -= 3;
  if (gameState.faCup?.winner === gameState.playerTeam) repChange += 8;
  if (gameState.europaLeague?.winner === gameState.playerTeam) repChange += 12;
  if ((playerTableRow.won || 0) > (playerTableRow.played || 1) * 0.55) repChange += 2;
  gameState.managerReputation = Math.max(0, Math.min(100, (gameState.managerReputation || 50) + repChange));

  // Season-end trait earning for player's squad
  checkTraitEarning(gameState);

  // endOfSeasonData must be set BEFORE Europa init (crash safety)
  const faCupWinnerId = gameState.faCup?.winner;
  gameState.endOfSeasonData = {
    plTable: div1Table, champTable: div2Table || [],
    plRelegated: relegated, champPromoted: promoted,
    playoffWinner, champPlayoff: div2PlayoffTeams, champRelegated: div2Relegated,
    leagueWinner: { teamId: leagueWinner?.id, teamName: leagueWinnerTeam?.name || leagueWinner?.id || '—' },
    faCupWinner: faCupWinnerId ? getTeam(faCupWinnerId)?.name || faCupWinnerId : null,
    topScorerLeague, managerOfSeason, myTopScorer, playerResult,
    div1Name: LEAGUES[div1Id]?.name || 'First Division',
    div2Name: div2Id ? (LEAGUES[div2Id]?.name || 'Second Division') : null,
    country
  };

  // Init Europa League (after endOfSeasonData for crash safety)
  try {
    gameState.europaLeague = null;
    gameState.championsLeague = null;
    const allDiv1Tables = {};
    Object.values(COUNTRY_CONFIG).forEach(cfg => {
      if (LEAGUES[cfg.div1]) {
        allDiv1Tables[cfg.div1] = calculateTable(
          getLeagueTeams(cfg.div1, gameState),
          gameState.results[cfg.div1] || []
        );
      }
    });
    initChampionsLeague(allDiv1Tables, gameState);
    initEuropaLeague(allDiv1Tables, gameState);   // must init EL before CL sim runs
    if (gameState.championsLeague) simulateCLGroupRound(gameState);
    // For non-CL players: CL auto-simulates fully → setupCLKnockout → triggerELWithDropdowns → EL groups start
    // For CL players: CL sim stops at round 0 (player match pending), EL stays in waiting_cl_dropdowns
  } catch(e) {
    console.error('CL/EL init failed:', e);
    gameState.europaLeague = null;
    gameState.championsLeague = null;
  }
}

// ─── RETIREMENT + REGENS ─────────────────────────────────────────────────────
function processRetirements(gameState) {
  const retiredPlayers = [];

  getAllTeams().forEach(team => {
    const toRetire = [];

    team.squad.forEach(p => {
      p.age++;

      // Ensure existing players have a potential if they don't (save compat)
      if (!p.potential) p.potential = p.overall + Math.floor(Math.random() * 5);

      if (p.age <= 24) {
        // Young players grow towards their potential
        const gap = p.potential - p.overall;
        if (gap > 0) {
          // Grow individual stats — OVR recalculated from them
          const statKeys = p.pos === 'GK'
            ? ['gkHandling','gkReflexes','gkDiving','gkPositioning','gkKicking','pace','physical']
            : ['pace','shooting','passing','defending','physical','dribbling'];
          statKeys.forEach(k => {
            if (p[k] !== undefined && Math.random() < 0.5) p[k] = Math.min(99, p[k] + Math.floor(Math.random() * 3) + 1);
          });
          calculateOverall(p);
          p.overall = Math.min(p.potential, p.overall);
        }
      } else if (p.age <= 29) {
        // Prime: small random fluctuation, rarely grows
        if (Math.random() < 0.2 && p.overall < p.potential) {
          const statKeys = p.pos === 'GK'
            ? ['gkHandling','gkReflexes','gkPositioning']
            : ['pace','shooting','passing','defending','physical','dribbling'];
          const k = statKeys[Math.floor(Math.random() * statKeys.length)];
          if (p[k] !== undefined) p[k] = Math.min(99, p[k] + 1);
          calculateOverall(p);
          p.overall = Math.min(p.potential, p.overall);
        }
      } else if (p.age > 30) {
        // Decline after 30 — decay stats then recalc
        const decay = Math.floor((p.age - 30) * 0.8);
        const drop = Math.floor(Math.random() * decay * 0.5);
        if (drop > 0) {
          const statKeys = p.pos === 'GK'
            ? ['gkHandling','gkReflexes','gkDiving','gkPositioning']
            : ['pace','shooting','passing','defending','physical','dribbling'];
          const k = statKeys[Math.floor(Math.random() * statKeys.length)];
          if (p[k] !== undefined) p[k] = Math.max(40, p[k] - drop);
          if (p.age > 32 && Math.random() < 0.5) p.pace = Math.max(40, p.pace - 1);
          calculateOverall(p);
          p.overall = Math.max(55, p.overall);
        }
      }

      // Retirement age threshold
      const retireAge = p.pos === 'GK' ? 39 : p.pos === 'CB' || p.pos === 'CDM' ? 36 : 35;
      const shouldRetire = p.age >= retireAge && Math.random() < 0.6;
      const forcedRetire = p.age >= retireAge + 3;

      if (shouldRetire || forcedRetire) {
        toRetire.push(p);
        retiredPlayers.push({ name: p.name, pos: p.pos, teamName: team.name });
      }
    });

    // Remove retired players
    team.squad = team.squad.filter(p => !toRetire.find(r => r.id === p.id));

    // Generate regens to fill squad back to minimum 18
    while (team.squad.length < 18) {
      const pos = toRetire.length > 0
        ? toRetire.shift().pos
        : POSITION_LIST[Math.floor(Math.random() * POSITION_LIST.length)];

      const regenOvr = Math.round(team.prestige * 0.55 + 40 + Math.random() * 15);
      const regen = makePlayer(
        gameState._nextPid++,
        regenName(),
        pos,
        Math.floor(Math.random() * 3) + 16, // 16-18
        Math.min(75, regenOvr),
        regenNation()
      );
      assignRandomTraits(regen);
      team.squad.push(regen);
    }
  });

  gameState.lastRetired = retiredPlayers;

  // Decrement contracts for player's squad
  if (gameState.playerTeam) {
    const playerTeam = getTeam(gameState.playerTeam);
    if (playerTeam) {
      playerTeam.squad.forEach(p => {
        if (p.contract > 0) p.contract--;
      });
    }
  }

  // Age youth squad players and grow them towards potential
  if (gameState.youthSquad) {
    gameState.youthSquad.forEach(p => {
      p.age++;
      const gap = (p.potential || 75) - p.overall;
      if (gap > 0) {
        const statKeys = p.pos === 'GK'
          ? ['gkHandling','gkReflexes','gkDiving','gkPositioning','gkKicking','pace','physical']
          : ['pace','shooting','passing','defending','physical','dribbling'];
        statKeys.forEach(k => {
          if (p[k] !== undefined && Math.random() < 0.4) p[k] = Math.min(99, p[k] + 1);
        });
        calculateOverall(p);
        p.overall = Math.min(p.potential, p.overall);
      }
    });
  }
}

// ─── TIER-3 TEAM POOLS (replacement teams for relegated div2 spots) ───────────
const TIER3_POOLS = {
  england: [
    { id: 'shf', name: 'Sheffield FC',      short: 'SHF', color: '#FF6B35', colorAlt: '#fff', prestige: 42, budget: 1500000, stadium: 'Bramall Lane',       capacity: 10000 },
    { id: 'exr', name: 'Exeter City',       short: 'EXE', color: '#D62828', colorAlt: '#fff', prestige: 40, budget: 1200000, stadium: 'St James Park',       capacity: 8800  },
    { id: 'pom', name: 'Portsmouth',        short: 'POM', color: '#001489', colorAlt: '#fff', prestige: 44, budget: 1800000, stadium: 'Fratton Park',        capacity: 20688 },
    { id: 'wrx', name: 'Wrexham',           short: 'WRX', color: '#E30613', colorAlt: '#fff', prestige: 38, budget: 1000000, stadium: 'Racecourse Ground',   capacity: 10771 },
    { id: 'sto2',name: 'Stockport County',  short: 'STK', color: '#001F5B', colorAlt: '#fff', prestige: 39, budget: 1100000, stadium: 'Edgeley Park',        capacity: 10852 },
    { id: 'ber', name: 'Barnsley',          short: 'BAR', color: '#D71920', colorAlt: '#fff', prestige: 43, budget: 1600000, stadium: 'Oakwell',             capacity: 23009 },
    { id: 'cha2',name: 'Charlton Athletic', short: 'CHA', color: '#D4011D', colorAlt: '#fff', prestige: 46, budget: 2000000, stadium: 'The Valley',          capacity: 27111 },
    { id: 'oxf', name: 'Oxford United',     short: 'OXF', color: '#FFD700', colorAlt: '#003087', prestige: 41, budget: 1300000, stadium: 'Kassam Stadium', capacity: 12500 },
  ],
  spain: [
    { id: 'sp3a', name: 'UD Logrones',      short: 'LOG', color: '#CC0000', colorAlt: '#fff', prestige: 37, budget: 800000,  stadium: 'Las Gaunas',          capacity: 6200 },
    { id: 'sp3b', name: 'SD Ponferradina',  short: 'PON', color: '#003DA5', colorAlt: '#fff', prestige: 36, budget: 700000,  stadium: 'El Toralin',          capacity: 6800 },
    { id: 'sp3c', name: 'CF Intercity',     short: 'ITC', color: '#CC0000', colorAlt: '#fff', prestige: 34, budget: 600000,  stadium: 'Estadio Intercity',   capacity: 5000 },
    { id: 'sp3d', name: 'SD Ejea',          short: 'EJE', color: '#CC0000', colorAlt: '#fff', prestige: 33, budget: 500000,  stadium: 'Ciudad de Ejea',      capacity: 3000 },
  ],
  italy: [
    { id: 'it3a', name: 'Catania',          short: 'CAT', color: '#CC0000', colorAlt: '#0000FF', prestige: 42, budget: 1200000, stadium: 'Angelo Massimino', capacity: 23420 },
    { id: 'it3b', name: 'Avellino',         short: 'AVE', color: '#003DA5', colorAlt: '#fff',    prestige: 38, budget: 900000,  stadium: 'Partenio',          capacity: 25632 },
    { id: 'it3c', name: 'Messina',          short: 'MES', color: '#FFCC00', colorAlt: '#CC0000', prestige: 35, budget: 700000,  stadium: 'Franco Scoglio',    capacity: 22000 },
    { id: 'it3d', name: 'Taranto',          short: 'TAR', color: '#CC0000', colorAlt: '#fff',    prestige: 33, budget: 600000,  stadium: 'Erasmo Iacovone',   capacity: 20000 },
  ],
  germany: [
    { id: 'de3a', name: '1860 Munchen',     short: 'TSV', color: '#003DA5', colorAlt: '#fff', prestige: 50, budget: 2000000, stadium: 'Grunwalder Str.',      capacity: 15000 },
    { id: 'de3b', name: 'Dynamo Dresden',   short: 'DYN', color: '#FFCC00', colorAlt: '#000', prestige: 47, budget: 1500000, stadium: 'Rudolf-Harbig-Stadion',capacity: 32066 },
    { id: 'de3c', name: 'Energie Cottbus',  short: 'ECO', color: '#CC0000', colorAlt: '#fff', prestige: 40, budget: 900000,  stadium: 'Stadion der Freundschaft',capacity: 22528 },
    { id: 'de3d', name: 'Hallescher FC',    short: 'HFC', color: '#CC0000', colorAlt: '#fff', prestige: 37, budget: 700000,  stadium: 'Erdgas Sportpark',     capacity: 15000 },
  ],
  portugal: [
    { id: 'pt3a', name: 'GD Fafe',          short: 'FAF', color: '#CC0000', colorAlt: '#fff', prestige: 36, budget: 400000,  stadium: 'Estadio 22 de Junho',  capacity: 5000 },
    { id: 'pt3b', name: 'SC Covilha',       short: 'COV', color: '#CC0000', colorAlt: '#fff', prestige: 34, budget: 350000,  stadium: 'Estadio Jose Pinto',   capacity: 3600 },
    { id: 'pt3c', name: 'UD Oliveirense',   short: 'OLI', color: '#003DA5', colorAlt: '#fff', prestige: 33, budget: 300000,  stadium: 'Municipal Carlos Osorio', capacity: 5000 },
    { id: 'pt3d', name: 'Leixoes SC',       short: 'LEI', color: '#CC0000', colorAlt: '#fff', prestige: 38, budget: 450000,  stadium: 'Estadio do Mar',        capacity: 8000 },
  ],
};

function generateTierThreeTeams(gameState, targetLeagueId, country) {
  const pool = TIER3_POOLS[country] || TIER3_POOLS.england;
  const allInUse = new Set(Object.values(gameState.leagueTeams || {}).flat());
  const available = pool.filter(t => !allInUse.has(t.id));

  const picked = [];
  while (picked.length < 3 && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    const team = available.splice(idx, 1)[0];
    picked.push(team.id);

    if (!TEAM_MAP[team.id]) {
      team.squad = SQUAD_TEMPLATE.map(pos => {
        const ovr = Math.round(team.prestige * 0.55 + 38 + Math.random() * 10);
        return makePlayer(gameState._nextPid++, makeNameFor(country), pos,
          Math.floor(Math.random() * 8) + 18, Math.min(68, ovr), NATION_BY_COUNTRY[country] || 'ENG');
      });
      ALL_TEAMS.push(team);
      TEAM_MAP[team.id] = team;
      gameState.budgets[team.id] = team.budget;
      if (!gameState.extraTeams) gameState.extraTeams = {};
      const { squad, ...meta } = team;
      gameState.extraTeams[team.id] = meta;
    }
  }

  while (picked.length < 3) picked.push(picked[0] || pool[0]?.id || 'exr');
  return picked;
}

// Keep old name as alias
function generateLeague1Teams(gameState) {
  return generateTierThreeTeams(gameState, 'championship', 'england');
}

// ─── SIMULATE TO LAST MATCHWEEK ──────────────────────────────────────────────
function simulateToLastMatchweek(gameState) {
  const leagueId = gameState.playerLeague;
  const tactics = getManagerTactics ? getManagerTactics(gameState) : {};

  // Get all unplayed player fixtures, sorted by round
  const unplayed = gameState.fixtures[leagueId]
    .filter(f => (f.home === gameState.playerTeam || f.away === gameState.playerTeam) && !f.played)
    .sort((a, b) => a.round - b.round);

  if (unplayed.length <= 1) return 0; // already at last game or no games left

  const toSimulate = unplayed.slice(0, -1); // all except last
  let simulated = 0;

  for (let i = 0; i < toSimulate.length; i++) {
    if (gameState.seasonEnded) break;

    // Simulate player's league game for current round
    const matchData = simulatePlayerMatch(gameState, tactics);
    if (!matchData) break; // no fixture found — safety guard

    simulated++;

    // Apply morale from result
    updateMorale(gameState.playerTeam, matchData.matchResult, gameState);

    // Advance week: AI games + round increment + wages + FA Cup trigger + injuries
    advanceMatchweek(gameState);

    // If FA Cup was triggered and player has a pending match, auto-simulate it
    if (gameState.faCup?.playerMatchPending && !gameState.faCup?.playerEliminated) {
      const cupData = simulateFaCupPlayerMatch(gameState, tactics);
      if (cupData) resolveFaCupRound(cupData.matchResult === 'win', gameState);
    }

    if (gameState.seasonEnded) break;
  }

  return simulated;
}

// ─── YOUTH SYSTEM ────────────────────────────────────────────────────────────
function generateYouthMarket(gameState) {
  const positions = ['ST','CM','CB','GK','LW','RW','RB','LB','CDM','CAM'];
  const count = 30 + Math.floor(Math.random() * 20); // 30-49 prospects per season
  const market = [];

  for (let i = 0; i < count; i++) {
    // Age: 14=5%, 15=20%, 16=45%, 17=30%
    const rAge = Math.random();
    const age = rAge < 0.05 ? 14 : rAge < 0.25 ? 15 : rAge < 0.70 ? 16 : 17;
    const pos = positions[Math.floor(Math.random() * positions.length)];

    // OVR: age-appropriate base, then rare-low / normal / rare-high
    const ageBase = { 14: 44, 15: 49, 16: 54, 17: 58 }[age];
    const rOvr = Math.random();
    let ovr;
    if (rOvr < 0.12) ovr = ageBase - 4 + Math.floor(Math.random() * 3);      // rare low: -4 to -2
    else if (rOvr < 0.80) ovr = ageBase + Math.floor(Math.random() * 7);      // normal: +0 to +6 → 58-64 range for 16yo
    else ovr = ageBase + 7 + Math.floor(Math.random() * 4);                   // rare high: +7 to +10 → 65-67 for 16yo
    ovr = Math.max(40, Math.min(70, ovr));

    // Potential distribution: 60% normal (62-79), 25% good (80-86), 10% high (87-90), 5% exceptional (91-93)
    const rPot = Math.random();
    let potential;
    if (rPot < 0.60) potential = 62 + Math.floor(Math.random() * 18);   // 62-79
    else if (rPot < 0.85) potential = 80 + Math.floor(Math.random() * 7); // 80-86
    else if (rPot < 0.95) potential = 87 + Math.floor(Math.random() * 4); // 87-90
    else potential = 91 + Math.floor(Math.random() * 3);                   // 91-93

    // Apply youth academy infrastructure bonus
    const yBonuses = getYouthInfraBonus(gameState);
    ovr = Math.min(72, ovr + yBonuses.ovrBonus);
    potential = Math.min(95, potential + yBonuses.potBonus);

    const p = makePlayer(gameState._nextPid++, regenName(), pos, age, ovr, regenNation());
    p.potential = potential;
    p.isYouth = true;
    p.youthPrice = Math.round((Math.max(0, potential - 60) * 60000) + 80000);
    assignRandomTraits(p);
    market.push(p);
  }

  gameState.youthMarket = market;
}

function graduateYouthPlayers(gameState) {
  // Move youth squad players who turned 18 to free agents
  if (!gameState.youthSquad) { gameState.youthSquad = []; return; }
  const graduated = [];
  gameState.youthSquad = gameState.youthSquad.filter(p => {
    if (p.age >= 18) { graduated.push(p); return false; }
    return true;
  });
  graduated.forEach(p => {
    p.isYouth = false;
    p.fromAcademy = true;
    FREE_AGENTS.push(p);
  });
  if (graduated.length) {
    const names = graduated.map(p => p.name).join(', ');
    gameState.notification = (gameState.notification ? gameState.notification + ' | ' : '') +
      `🎓 ${names} graduated from academy — now free agent${graduated.length > 1 ? 's' : ''}`;
  }
}

function cleanupFreeAgents() {
  // First remove anyone 45+
  for (let i = FREE_AGENTS.length - 1; i >= 0; i--) {
    if (FREE_AGENTS[i].age >= 45) FREE_AGENTS.splice(i, 1);
  }
  // Age everyone up
  FREE_AGENTS.forEach(p => p.age++);
  // If still over 90, trim oldest first, then random
  while (FREE_AGENTS.length > 90) {
    const sorted = [...FREE_AGENTS].sort((a, b) => b.age - a.age);
    const target = sorted[Math.floor(Math.random() * Math.min(10, sorted.length))];
    const idx = FREE_AGENTS.indexOf(target);
    if (idx !== -1) FREE_AGENTS.splice(idx, 1);
  }
}

// ─── TRAIT EARNING ────────────────────────────────────────────────────────────
function checkTraitEarning(gameState) {
  const team = getTeam(gameState.playerTeam);
  if (!team) return;
  const tactics = gameState.tactics?.[gameState.playerTeam] || {};
  team.squad.forEach(p => {
    if (!p.traits) p.traits = [];
    if (p.traits.length >= 3) return;
    // 8+ goals → clinical or poacher
    if ((p.goals || 0) >= 8 && Math.random() < 0.25) {
      const t = ['ST','CF','CAM'].includes(p.pos) ? 'clinical' : 'poacher';
      if (!p.traits.includes(t)) { p.traits.push(t); return; }
    }
    // 5+ clean sheets (GK) → pkstopper
    if (p.pos === 'GK' && (p.cleanSheets || 0) >= 5 && Math.random() < 0.20) {
      if (!p.traits.includes('pkstopper')) { p.traits.push('pkstopper'); return; }
    }
    // Captain all season + manager rep 65+ → Leader trait
    if (tactics.captain === p.id && (gameState.managerReputation || 50) >= 65 && Math.random() < 0.15) {
      if (!p.traits.includes('captain_mat')) p.traits.push('captain_mat');
    }
    p.traits = p.traits.slice(0, 3);
  });
}

// ─── LOAN RETURNS ────────────────────────────────────────────────────────────
function returnLoanedPlayers(gameState) {
  const playerTeam = getTeam(gameState.playerTeam);
  if (!playerTeam) return;

  const loaned = playerTeam.squad.filter(p => p.onLoan);
  const returned = [];

  loaned.forEach(p => {
    const fromTeam = getTeam(p.loanFromTeamId);
    if (fromTeam && fromTeam.squad.length < 25) {
      const { onLoan, loanFromTeamId, loanFromTeamName, ...base } = p;
      fromTeam.squad.push(base);
    }
    returned.push(p.name);
  });

  playerTeam.squad = playerTeam.squad.filter(p => !p.onLoan);

  // Return own players sent out on loan — give +1 OVR
  const returnedOut = [];
  playerTeam.squad.forEach(p => {
    if (!p.outOnLoan) return;
    p.outOnLoan = false;
    p.overall = Math.min((p.potential || 99) - 1, p.overall + 1);
    returnedOut.push(p.name);
  });

  const msgs = [];
  if (returned.length) msgs.push(`↩️ ${returned.join(', ')} ${returned.length === 1 ? 'has' : 'have'} returned from loan.`);
  if (returnedOut.length) msgs.push(`🔄 ${returnedOut.join(', ')} returned from loan (+1 OVR).`);
  if (msgs.length) gameState.notification = msgs.join(' ');
}

// ─── CONTRACT DEMANDS ────────────────────────────────────────────────────────
function generateContractDemands(gameState) {
  if (!gameState.playerTeam) return;
  if (!gameState.contractDemands) gameState.contractDemands = [];
  const playerTeam = getTeam(gameState.playerTeam);
  if (!playerTeam) return;

  playerTeam.squad.forEach(p => {
    if (p.injuredWeeks || p.outOnLoan || p.onLoan) return;
    if (p.overall < 65) return;
    const morale = p.morale ?? 70;
    const noPlay = p.matchesWithoutPlay || 0;

    // Accumulate bench frustration when unhappy + not playing (carries across seasons)
    if (morale < 50 && noPlay >= 3) {
      p.benchFrustration = (p.benchFrustration || 0) + 1;
    }

    // Demands ONLY fire in the last year of contract
    if ((p.contract || 3) > 1) return;
    // Already has a pending demand
    if (gameState.contractDemands.find(d => d.playerId === p.id)) return;
    // Must be actually unhappy or have built up frustration
    const frustration = p.benchFrustration || 0;
    if (morale >= 55 && frustration < 4) return;

    const offer = getContractRenewalOffer(p);
    // Scale demand by how long they've been suffering: 0-7 = base, 8-19 = +40%, 20+ = +80%
    const frustMult = frustration >= 20 ? 1.8 : frustration >= 8 ? 1.4 : 1.0;
    const scaledIncrease = Math.round(offer.wageIncrease * frustMult);
    const currentWage = p.wage || Math.round(Math.max(0, p.overall - 50) * 60);
    const scaledWage = currentWage + scaledIncrease;

    // High frustration stars (waited 20+ matchweeks) want out entirely
    // Transfer request: only elite players (87+) OR someone who's been waiting forever (30+ matchweeks unhappy)
    const demandType = (frustration >= 20 && (p.overall >= 87 || frustration >= 30)) ? 'transfer' : 'wage';

    gameState.contractDemands.push({
      id: `demand-${p.id}-${Date.now()}`,
      playerId: p.id,
      playerName: p.name,
      playerPos: p.pos,
      playerOvr: p.overall,
      type: demandType,
      wageIncrease: scaledIncrease,
      newWage: scaledWage
    });
  });
}

function startNewSeason(gameState) {
  // Return loaned players before starting new season
  returnLoanedPlayers(gameState);

  gameState.season++;
  gameState.seasonEnded = false;
  gameState.notification = gameState.notification || null; // preserve loan return notif
  gameState.endOfSeasonData = null;
  gameState.promotionRelegation = null;
  gameState.lastRetired = null;
  // europaLeague and championsLeague are intentionally preserved — they were
  // initialized at end of previous season and run throughout this season
  gameState.aiBids = []; // clear pending bids
  gameState.negotiations = []; // clear pending negotiations

  // Reset player stats and match ratings for new season
  getAllTeams().forEach(team => {
    team.squad.forEach(p => {
      p.goals = 0; p.assists = 0; p.appearances = 0; p.cleanSheets = 0;
      p.matchRatings = [];
    });
  });
  // New season divider in news feed
  pushNews({ type: 'season_start', icon: '🗓️', headline: `Season ${gameState.season} begins`, detail: `A new chapter starts`, week: 0 }, gameState);
  gameState._prevLeaguePos = null;
  gameState.lastPOTM = null;
  gameState.lastTOTM = null;

  // Youth system: graduate 18-year-olds → free agents, generate new market, cleanup FA pool
  graduateYouthPlayers(gameState);
  generateYouthMarket(gameState);
  cleanupFreeAgents();

  // Refresh staff market each new season
  generateStaffMarket(gameState);

  // Check infrastructure construction completion
  if (gameState.infrastructure?.building) {
    const b = gameState.infrastructure.building;
    if (gameState.season >= b.completeSeason) {
      gameState.infrastructure[b.type]++;
      gameState.infrastructure.building = null;
      const infraName = INFRA_DATA[b.type]?.name || b.type;
      const newLabel = INFRA_DATA[b.type]?.tiers[gameState.infrastructure[b.type]]?.label || '';
      gameState.notification = `🏗️ ${infraName} upgrade complete! Now: ${newLabel}`;
    }
  }
  // Decrement sponsor contract seasons, clear expired
  if (gameState.sponsorships) {
    ['main', 'kit', 'regional'].forEach(slot => {
      const s = gameState.sponsorships[slot];
      if (!s) return;
      s.seasonsLeft--;
      if (s.seasonsLeft <= 0) gameState.sponsorships[slot] = null;
    });
  }
  // Generate new sponsor offers for empty/expired slots
  generateSponsorOffers(gameState);
  // Reset marketing campaigns counter for new season
  if (gameState.marketing) gameState.marketing.campaignsThisSeason = 0;

  // Release expired contracts
  if (gameState.playerTeam) {
    const playerTeam = getTeam(gameState.playerTeam);
    if (playerTeam) {
      const expired = playerTeam.squad.filter(p => p.contract <= 0);
      if (expired.length) {
        expired.forEach(p => {
          playerTeam.squad = playerTeam.squad.filter(q => q.id !== p.id);
          FREE_AGENTS.push(p);
        });
        gameState.notification = `📋 ${expired.length} player${expired.length > 1 ? 's' : ''} left on expired contracts: ${expired.map(p => p.name).join(', ')}`;
      }
      // Clear demands for released players
      if (gameState.contractDemands) {
        const releasedIds = new Set(expired.map(p => p.id));
        gameState.contractDemands = gameState.contractDemands.filter(d => !releasedIds.has(d.playerId));
      }
    }
  }

  initSeason(gameState);
}

// ─── SEASON AWARDS HELPERS ───────────────────────────────────────────────────
function getSeasonTopScorer(leagueId, gameState) {
  const teams = getLeagueTeams(leagueId, gameState);
  let best = null;
  teams.forEach(tid => {
    const team = getTeam(tid);
    if (!team) return;
    team.squad.forEach(p => {
      if (!best || p.goals > best.goals) {
        best = { name: p.name, goals: p.goals, teamName: team.name, teamId: tid };
      }
    });
  });
  return best;
}

function getMyTopScorer(gameState) {
  const team = getTeam(gameState.playerTeam);
  if (!team) return null;
  const sorted = [...team.squad].sort((a, b) => b.goals - a.goals);
  const top = sorted[0];
  return top ? { name: top.name, goals: top.goals } : null;
}

function getManagerOfSeason(leagueId, plTable, champTable, gameState) {
  // plTable is now the player's active league table (div1 or div2)
  const table = plTable || champTable;
  if (!table || !table.length) return null;
  const top = table[0];
  return { teamId: top.id, teamName: getTeam(top.id)?.name, wins: top.won };
}

function getEuropeanSeasonResult(gameState) {
  const cl = gameState.championsLeague;
  const el = gameState.europaLeague;
  const pt = gameState.playerTeam;

  // Helper: resolve EL result for a team that reached EL (directly or as CL dropout)
  function resolveEL() {
    if (!el) return null;
    const inGroups = el.teams?.includes(pt);
    const inPlayoff = el.playoffPairs?.some(([h, a]) => h === pt || a === pt);
    if (inGroups) {
      if (el.winner === pt) return 'EL Winner';
      const fin = el.knockout?.final;
      if (fin && (fin[0] === pt || fin[1] === pt)) return 'Runner-up EL';
      const sf = el.knockout?.sf;
      if (sf && sf.some(([h, a]) => h === pt || a === pt)) return 'Semi-Final EL';
      return 'Group Phase EL';
    }
    if (inPlayoff) return 'EL Playoff';
    return null;
  }

  // Champions League
  if (cl && cl.playerGroup !== undefined) {
    if (cl.winner === pt) return 'CL Winner';
    const fin = cl.knockout?.final;
    if (fin && (fin[0] === pt || fin[1] === pt)) return 'Runner-up CL';
    const sf = cl.knockout?.sf;
    if (sf && sf.some(([h, a]) => h === pt || a === pt)) return 'Semi-Final CL';
    const qf = cl.knockout?.qf;
    if (qf && qf.some(([h, a]) => h === pt || a === pt)) return 'Quarter-Final CL';
    // Eliminated in CL group — check if dropped into EL (3rd place → EL playoff)
    return resolveEL() || 'Group Phase CL';
  }

  // Europa League (directly qualified)
  return resolveEL() || 'Did not qualify';
}

// ─── STANDARD HELPERS ────────────────────────────────────────────────────────
function getPlayerFixture(gameState) {
  const leagueId = gameState.playerLeague;
  const round = gameState.currentRound[leagueId];
  return gameState.fixtures[leagueId].find(
    f => f.round === round && (f.home === gameState.playerTeam || f.away === gameState.playerTeam)
  );
}

function getLeagueTable(leagueId, gameState) {
  return calculateTable(getLeagueTeams(leagueId, gameState), gameState.results[leagueId]);
}

function getRecentResults(teamId, gameState, count = 5) {
  const leagueId = Object.keys(gameState.results || {}).find(lid =>
    getLeagueTeams(lid, gameState).includes(teamId)
  ) || gameState.playerLeague;
  return (gameState.results[leagueId] || [])
    .filter(r => r.homeTeam === teamId || r.awayTeam === teamId)
    .slice(-count);
}

function getTeamPosition(teamId, gameState) {
  const leagueId = Object.keys(LEAGUES).find(lid =>
    (gameState.leagueTeams?.[lid] || LEAGUES[lid]?.teams || []).includes(teamId)
  );
  if (!leagueId) return null;
  const table = getLeagueTable(leagueId, gameState);
  return table.findIndex(r => r.id === teamId) + 1;
}

// ─── DOMESTIC CUP (generic for all leagues) ───────────────────────────────────
function initDomesticCup(gameState) {
  const country = gameState.playerCountry || LEAGUES[gameState.playerLeague]?.country || 'england';
  const cc = COUNTRY_CONFIG[country];
  const div1Id = cc.div1;
  const div2Id = cc.div2;

  const div1Sorted = [...(gameState.leagueTeams[div1Id] || [])]
    .map(id => getTeam(id)).filter(Boolean)
    .sort((a, b) => b.prestige - a.prestige).slice(0, 12).map(t => t.id);

  let div2Sorted = [];
  if (div2Id && gameState.leagueTeams[div2Id]) {
    div2Sorted = [...gameState.leagueTeams[div2Id]]
      .map(id => getTeam(id)).filter(Boolean)
      .sort((a, b) => b.prestige - a.prestige).slice(0, 4).map(t => t.id);
  }

  let teams = [...new Set([...div1Sorted, ...div2Sorted])];
  // Pad to 16 with more div1 teams if needed
  if (teams.length < 16) {
    for (const id of div1Sorted) {
      if (!teams.includes(id)) teams.push(id);
      if (teams.length >= 16) break;
    }
  }
  teams = teams.slice(0, 16);
  if (!teams.includes(gameState.playerTeam)) teams[15] = gameState.playerTeam;

  for (let i = teams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [teams[i], teams[j]] = [teams[j], teams[i]];
  }

  const r1Pairs = [];
  for (let i = 0; i < teams.length; i += 2) r1Pairs.push([teams[i], teams[i + 1]]);

  gameState.faCup = {
    name: cc.cup,
    teams,
    rounds: [
      { name: 'Round of 16', pairs: r1Pairs, results: [], completed: false },
      { name: 'Quarter-Finals', pairs: [], results: [], completed: false },
      { name: 'Semi-Finals', pairs: [], results: [], completed: false },
      { name: 'Final', pairs: [], results: [], completed: false },
    ],
    currentRound: 0,
    triggerWeeks: (() => {
      const total = ((gameState.leagueTeams[div1Id]?.length || 20) - 1) * 2;
      return [0.21, 0.42, 0.63, 0.84].map(p => Math.round(total * p));
    })(),
    playerEliminated: false,
    playerMatchPending: false,
    winner: null,
  };
}

// Backward compat alias
function initFaCup(gameState) { return initDomesticCup(gameState); }

function triggerFaCupRound(gameState) {
  const cup = gameState.faCup;
  if (!cup || cup.playerEliminated) return;
  const round = cup.rounds[cup.currentRound];
  if (!round || round.completed) return;

  for (const pair of round.pairs) {
    const [teamA, teamB] = pair;
    const isPlayerMatch = teamA === gameState.playerTeam || teamB === gameState.playerTeam;
    if (isPlayerMatch) { cup.playerMatchPending = true; continue; }

    const result = simulateMatch(teamA, teamB, gameState);
    // No draws in cup — extra time coin flip
    let winner;
    if (result.homeGoals > result.awayGoals) winner = teamA;
    else if (result.awayGoals > result.homeGoals) winner = teamB;
    else winner = Math.random() < 0.5 ? teamA : teamB;
    round.results.push({ teamA, teamB, result, winner });
  }
}

function simulateFaCupPlayerMatch(gameState, playerTactics) {
  const cup = gameState.faCup;
  if (!cup || !cup.playerMatchPending) return null;
  const round = cup.rounds[cup.currentRound];
  const pair = round.pairs.find(p => p[0] === gameState.playerTeam || p[1] === gameState.playerTeam);
  if (!pair) return null;

  const [homeId, awayId] = pair;
  const isHome = homeId === gameState.playerTeam;

  if (playerTactics) {
    if (!gameState.tactics) gameState.tactics = {};
    gameState.tactics[gameState.playerTeam] = playerTactics;
  }

  const result = simulateMatch(homeId, awayId, gameState);
  applyMatchFatigue(homeId, gameState);
  applyMatchFatigue(awayId, gameState);

  let hg = result.homeGoals, ag = result.awayGoals;
  let extraTime = false;
  if (hg === ag) { extraTime = true; if (Math.random() < 0.5) hg++; else ag++; }

  const playerGoals = isHome ? hg : ag;
  const oppGoals = isHome ? ag : hg;
  const matchResult = playerGoals > oppGoals ? 'win' : 'loss';

  const displayResult = { ...result, homeGoals: hg, awayGoals: ag };
  return {
    fixture: { home: homeId, away: awayId },
    result: displayResult, isHome, matchResult,
    isFaCup: true, extraTime, roundName: round.name
  };
}

function resolveFaCupRound(playerWon, gameState) {
  const cup = gameState.faCup;
  const round = cup.rounds[cup.currentRound];
  const pair = round.pairs.find(p => p[0] === gameState.playerTeam || p[1] === gameState.playerTeam);

  if (pair) {
    const opponent = pair[0] === gameState.playerTeam ? pair[1] : pair[0];
    round.results.push({ teamA: pair[0], teamB: pair[1], winner: playerWon ? gameState.playerTeam : opponent, playerMatch: true });
  }

  round.completed = true;
  cup.playerMatchPending = false;

  if (!playerWon) { cup.playerEliminated = true; return; }

  cup.currentRound++;
  if (cup.currentRound >= 4) { cup.winner = gameState.playerTeam; return; }

  // Build next round pairs from winners
  const prevRound = cup.rounds[cup.currentRound - 1];
  const winners = prevRound.results.map(r => r.winner);
  const nextPairs = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (winners[i] && winners[i + 1]) nextPairs.push([winners[i], winners[i + 1]]);
  }
  cup.rounds[cup.currentRound].pairs = nextPairs;
}

// ─── EUROPA LEAGUE ───────────────────────────────────────────────────────────
function generateGroupFixtures(teams) {
  // Round-robin schedule. For odd n, add a null bye-slot so every team
  // plays each opponent exactly once per direction (home + away).
  let t = [...teams];
  if (t.length % 2 !== 0) t.push(null); // null = bye slot
  const n = t.length;
  const rounds = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const home = t[i], away = t[n - 1 - i];
      if (home !== null && away !== null) pairs.push([home, away]);
    }
    rounds.push(pairs);
    // Rotate all positions except index 0
    const last = t.pop();
    t.splice(1, 0, last);
  }

  const returnRounds = rounds.map(r => r.map(([a, b]) => [b, a]));
  return [...rounds, ...returnRounds];
}

function initEuropaLeague(allDiv1Tables, gameState) {
  const country = gameState.playerCountry || LEAGUES[gameState.playerLeague]?.country || 'england';
  const cc = COUNTRY_CONFIG[country];

  // Positions 5-6 from each euroLeague div1 = 10 base teams
  const euroLeagueDivs = Object.values(COUNTRY_CONFIG).filter(c => c.euroLeague).map(c => c.div1);
  const elBaseTeams = [];
  euroLeagueDivs.forEach(lid => {
    const table = allDiv1Tables[lid] || [];
    table.slice(4, 6).forEach(r => { if (r?.id) elBaseTeams.push(r.id); });
  });

  const playerTable = allDiv1Tables[cc.div1] || [];
  const playerPos = playerTable.findIndex(r => r.id === gameState.playerTeam);
  const directEL = cc.euroLeague && playerPos >= 4 && playerPos < 6;
  const inCL     = cc.euroLeague && playerPos >= 0 && playerPos < 4;

  if (!directEL && !inCL) return; // not qualified for anything

  if (!elBaseTeams.includes(gameState.playerTeam) && directEL) {
    elBaseTeams[elBaseTeams.length - 1] = gameState.playerTeam;
  }

  gameState.europaLeague = {
    baseTeams: [...elBaseTeams],
    phase: 'waiting_cl_dropdowns',
    playoffPairs: null,
    playoffResults: [],
    teams: null, groups: null, groupFixtures: null,
    groupResults: { 0: [], 1: [] },
    knockout: { sf: null, final: null },
    knockoutResults: {},
    groupRound: 0,
    playerGroup: -1,
    playerEliminated: inCL && !directEL, // CL teams start as not-in-EL
    playerMatchPending: false,
    winner: null,
  };
}

function getEuropaGroupTable(groupIndex, gameState) {
  const el = gameState.europaLeague;
  const teams = el.groups[groupIndex];
  const results = (el.groupResults[groupIndex] || []).map(r => ({
    homeTeam: r.home, awayTeam: r.away,
    homeGoals: r.result.homeGoals, awayGoals: r.result.awayGoals
  }));
  return calculateTable(teams, results);
}

function simulateEuropaGroupRound(gameState) {
  const el = gameState.europaLeague;
  if (el.phase !== 'group') return;

  for (let g = 0; g < 2; g++) {
    const fixtures = el.groupFixtures[g][el.groupRound];
    for (const [homeId, awayId] of fixtures) {
      if (homeId === gameState.playerTeam || awayId === gameState.playerTeam) {
        el.playerMatchPending = true;
        continue;
      }
      const result = simulateMatch(homeId, awayId, gameState);
      el.groupResults[g].push({ home: homeId, away: awayId, result });
    }
  }
}

function simulateEuropaPlayerMatch(gameState, tactics) {
  const el = gameState.europaLeague;
  const g = el.playerGroup;
  const fixtures = el.groupFixtures[g][el.groupRound];
  const pf = fixtures.find(([h, a]) => h === gameState.playerTeam || a === gameState.playerTeam);
  if (!pf) return null;

  const [homeId, awayId] = pf;
  const isHome = homeId === gameState.playerTeam;

  if (tactics) {
    if (!gameState.tactics) gameState.tactics = {};
    gameState.tactics[gameState.playerTeam] = tactics;
  }

  const result = simulateMatch(homeId, awayId, gameState);
  el.groupResults[g].push({ home: homeId, away: awayId, result });
  applyMatchFatigue(homeId, gameState);
  applyMatchFatigue(awayId, gameState);

  const playerGoals = isHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isHome ? result.awayGoals : result.homeGoals;
  const matchResult = playerGoals > oppGoals ? 'win' : playerGoals === oppGoals ? 'draw' : 'loss';

  el.playerMatchPending = false;
  el.groupRound++;

  if (el.groupRound >= 10) {
    el.phase = 'group_complete';
    setupEuropaKnockout(gameState);
  } else {
    // Simulate AI games for next group round now
    simulateEuropaGroupRound(gameState);
  }

  const oppTeamId = isHome ? awayId : homeId;
  return {
    fixture: { home: homeId, away: awayId }, result, isHome, matchResult,
    isEuropa: true, phase: 'Group Stage',
    oppName: getTeam(oppTeamId)?.name
  };
}

function setupEuropaKnockout(gameState) {
  const el = gameState.europaLeague;
  const tableA = getEuropaGroupTable(0, gameState);
  const tableB = getEuropaGroupTable(1, gameState);

  // SF: 1A vs 2B, 1B vs 2A (2 matches)
  el.knockout.sf = [
    [tableA[0].id, tableB[1].id],
    [tableB[0].id, tableA[1].id],
  ];
  el.phase = 'knockout_sf';

  const allKnockout = el.knockout.sf.flat();
  el.playerEliminated = !allKnockout.includes(gameState.playerTeam);

  if (!el.playerEliminated) simulateEuropaKnockoutAI(gameState);
}

function simulateEuropaKnockoutAI(gameState) {
  const el = gameState.europaLeague;
  const pairs = el.phase === 'knockout_sf' ? el.knockout.sf : [el.knockout.final];
  if (!pairs) return;

  for (const [h, a] of pairs) {
    if (h === gameState.playerTeam || a === gameState.playerTeam) {
      el.playerMatchPending = true;
      continue;
    }
    const result = simulateMatch(h, a, gameState);
    let winner = result.homeGoals > result.awayGoals ? h :
                 result.awayGoals > result.homeGoals ? a :
                 Math.random() < 0.5 ? h : a;
    if (!el.knockoutResults[el.phase]) el.knockoutResults[el.phase] = [];
    el.knockoutResults[el.phase].push({ home: h, away: a, winner });
  }
}

function simulateEuropaKnockoutPlayerMatch(gameState, tactics) {
  const el = gameState.europaLeague;
  const pairs = el.phase === 'knockout_sf' ? el.knockout.sf : [el.knockout.final];
  const pair = pairs?.find(([h, a]) => h === gameState.playerTeam || a === gameState.playerTeam);
  if (!pair) return null;

  const [homeId, awayId] = pair;
  const isHome = homeId === gameState.playerTeam;

  if (tactics) {
    if (!gameState.tactics) gameState.tactics = {};
    gameState.tactics[gameState.playerTeam] = tactics;
  }

  const result = simulateMatch(homeId, awayId, gameState);
  let hg = result.homeGoals, ag = result.awayGoals;
  let extraTime = false;
  if (hg === ag) { extraTime = true; if (Math.random() < 0.5) hg++; else ag++; }

  const playerGoals = isHome ? hg : ag;
  const oppGoals = isHome ? ag : hg;
  const playerWon = playerGoals > oppGoals;

  const displayResult = { ...result, homeGoals: hg, awayGoals: ag };

  el.playerMatchPending = false;
  if (!el.knockoutResults[el.phase]) el.knockoutResults[el.phase] = [];
  const opponent = isHome ? awayId : homeId;
  el.knockoutResults[el.phase].push({
    home: homeId, away: awayId, winner: playerWon ? gameState.playerTeam : opponent, playerMatch: true
  });

  if (!playerWon) {
    el.playerEliminated = true;
  } else if (el.phase === 'knockout_sf') {
    const qfWinners = (el.knockoutResults.knockout_sf || []).map(r => r.winner);
    if (qfWinners.length >= 2) {
      el.knockout.final = [qfWinners[0], qfWinners[1]];
      el.phase = 'final';
      simulateEuropaKnockoutAI(gameState);
    }
  } else if (el.phase === 'final') {
    el.winner = gameState.playerTeam;
    el.phase = 'complete';
  }

  const phaseName = el.phase === 'knockout_sf' ? 'Semi-Final' : 'Final';
  return {
    fixture: { home: homeId, away: awayId }, result: displayResult, isHome, matchResult: playerWon ? 'win' : 'loss',
    isEuropa: true, extraTime, phase: phaseName
  };
}

// ─── CHAMPIONS LEAGUE ──────────────────────────────────────────────────────────────────
function initChampionsLeague(allDiv1Tables, gameState) {
  const country = gameState.playerCountry || LEAGUES[gameState.playerLeague]?.country || 'england';
  const cc = COUNTRY_CONFIG[country];

  // Top 4 from each euroLeague div1 = 20 teams
  const clTeams = [];
  Object.values(COUNTRY_CONFIG).forEach(cfg => {
    if (!cfg.euroLeague) return;
    const table = allDiv1Tables[cfg.div1] || [];
    table.slice(0, 4).forEach(r => { if (r?.id) clTeams.push(r.id); });
  });

  if (clTeams.length < 8) return; // safety

  // Ensure player is included if they qualified (top 4 in div1)
  const playerTable = allDiv1Tables[cc.div1] || [];
  const playerPos = playerTable.findIndex(r => r.id === gameState.playerTeam);
  const inCL = cc.euroLeague && playerPos >= 0 && playerPos < 4;
  if (inCL && !clTeams.includes(gameState.playerTeam)) {
    clTeams[clTeams.length - 1] = gameState.playerTeam;
  }

  // Shuffle
  for (let i = clTeams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clTeams[i], clTeams[j]] = [clTeams[j], clTeams[i]];
  }

  // 4 groups of 5
  const groups = [
    clTeams.slice(0, 5),
    clTeams.slice(5, 10),
    clTeams.slice(10, 15),
    clTeams.slice(15, 20),
  ];

  const groupFixtures = {};
  groups.forEach((g, i) => { groupFixtures[i] = generateGroupFixtures(g); });

  let playerGroup = -1;
  if (inCL) {
    playerGroup = groups.findIndex(g => g.includes(gameState.playerTeam));
  }

  gameState.championsLeague = {
    teams: [...clTeams],
    groups,
    groupFixtures,
    groupResults: { 0: [], 1: [], 2: [], 3: [] },
    groupRound: 0,
    phase: 'group',
    knockout: { qf: null, sf: null, final: null },
    knockoutResults: {},
    playerGroup,
    playerEliminated: !inCL,
    playerMatchPending: false,
    winner: null,
  };
}

function getCLGroupTable(groupIndex, gameState) {
  const cl = gameState.championsLeague;
  const teams = cl.groups[groupIndex];
  const results = (cl.groupResults[groupIndex] || []).map(r => ({
    homeTeam: r.home, awayTeam: r.away,
    homeGoals: r.result.homeGoals, awayGoals: r.result.awayGoals
  }));
  return calculateTable(teams, results);
}

function simulateCLGroupRound(gameState) {
  const cl = gameState.championsLeague;
  if (!cl || cl.phase !== 'group') return;

  for (let g = 0; g < 4; g++) {
    const fixtures = cl.groupFixtures[g][cl.groupRound];
    if (!fixtures) continue;
    for (const [homeId, awayId] of fixtures) {
      if (homeId === gameState.playerTeam || awayId === gameState.playerTeam) {
        cl.playerMatchPending = true;
        continue;
      }
      const result = simulateMatch(homeId, awayId, gameState);
      cl.groupResults[g].push({ home: homeId, away: awayId, result });
    }
  }

  // Player had a bye this round — auto-advance to the next round
  if (!cl.playerMatchPending) {
    cl.groupRound++;
    if (cl.groupRound >= 10) {
      cl.phase = 'group_complete';
      setupCLKnockout(gameState);
    } else {
      simulateCLGroupRound(gameState);
    }
  }
}

function simulateCLPlayerMatch(gameState, tactics) {
  const cl = gameState.championsLeague;
  if (!cl || cl.phase !== 'group') return null;

  const g = cl.playerGroup;
  const fixtures = cl.groupFixtures[g][cl.groupRound];
  const pf = fixtures?.find(([h, a]) => h === gameState.playerTeam || a === gameState.playerTeam);
  if (!pf) return null;

  const [homeId, awayId] = pf;
  const isHome = homeId === gameState.playerTeam;

  if (tactics) {
    if (!gameState.tactics) gameState.tactics = {};
    gameState.tactics[gameState.playerTeam] = tactics;
  }

  const result = simulateMatch(homeId, awayId, gameState);
  cl.groupResults[g].push({ home: homeId, away: awayId, result });
  applyMatchFatigue(homeId, gameState);
  applyMatchFatigue(awayId, gameState);

  const playerGoals = isHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isHome ? result.awayGoals : result.homeGoals;
  const matchResult = playerGoals > oppGoals ? 'win' : playerGoals === oppGoals ? 'draw' : 'loss';

  cl.playerMatchPending = false;
  cl.groupRound++;

  if (cl.groupRound >= 10) {
    cl.phase = 'group_complete';
    setupCLKnockout(gameState);
  } else {
    simulateCLGroupRound(gameState);
  }

  const oppTeamId = isHome ? awayId : homeId;
  return {
    fixture: { home: homeId, away: awayId }, result, isHome, matchResult,
    isCL: true, phase: 'Group Stage',
    oppName: getTeam(oppTeamId)?.name
  };
}

function setupCLKnockout(gameState) {
  const cl = gameState.championsLeague;
  const tables = [0, 1, 2, 3].map(g => getCLGroupTable(g, gameState));

  // QF: 1A vs 2B, 1B vs 2A, 1C vs 2D, 1D vs 2C
  cl.knockout.qf = [
    [tables[0][0].id, tables[1][1].id],
    [tables[1][0].id, tables[0][1].id],
    [tables[2][0].id, tables[3][1].id],
    [tables[3][0].id, tables[2][1].id],
  ];
  cl.phase = 'knockout_qf';

  // 3rd place from each group → EL playoff
  const clDropdowns = tables.map(t => t[2]?.id).filter(Boolean);
  triggerELWithDropdowns(gameState, clDropdowns);

  const qfTeams = cl.knockout.qf.flat();
  cl.playerEliminated = !qfTeams.includes(gameState.playerTeam);
  if (!cl.playerEliminated) simulateCLKnockoutAI(gameState);
}

function simulateCLKnockoutAI(gameState) {
  const cl = gameState.championsLeague;
  let pairs;
  if (cl.phase === 'knockout_qf') pairs = cl.knockout.qf;
  else if (cl.phase === 'knockout_sf') pairs = cl.knockout.sf;
  else if (cl.phase === 'final') pairs = [cl.knockout.final];
  if (!pairs) return;

  for (const [h, a] of pairs) {
    if (h === gameState.playerTeam || a === gameState.playerTeam) {
      cl.playerMatchPending = true;
      continue;
    }
    const result = simulateMatch(h, a, gameState);
    const winner = result.homeGoals > result.awayGoals ? h :
                   result.awayGoals > result.homeGoals ? a :
                   Math.random() < 0.5 ? h : a;
    if (!cl.knockoutResults[cl.phase]) cl.knockoutResults[cl.phase] = [];
    cl.knockoutResults[cl.phase].push({ home: h, away: a, winner });
  }
}

function simulateCLKnockoutPlayerMatch(gameState, tactics) {
  const cl = gameState.championsLeague;
  let pairs;
  if (cl.phase === 'knockout_qf') pairs = cl.knockout.qf;
  else if (cl.phase === 'knockout_sf') pairs = cl.knockout.sf;
  else if (cl.phase === 'final') pairs = [cl.knockout.final];

  const pair = pairs?.find(([h, a]) => h === gameState.playerTeam || a === gameState.playerTeam);
  if (!pair) return null;

  const [homeId, awayId] = pair;
  const isHome = homeId === gameState.playerTeam;

  if (tactics) {
    if (!gameState.tactics) gameState.tactics = {};
    gameState.tactics[gameState.playerTeam] = tactics;
  }

  const result = simulateMatch(homeId, awayId, gameState);
  let hg = result.homeGoals, ag = result.awayGoals;
  let extraTime = false;
  if (hg === ag) { extraTime = true; if (Math.random() < 0.5) hg++; else ag++; }

  const playerGoals = isHome ? hg : ag;
  const oppGoals = isHome ? ag : hg;
  const playerWon = playerGoals > oppGoals;
  const displayResult = { ...result, homeGoals: hg, awayGoals: ag };

  cl.playerMatchPending = false;
  if (!cl.knockoutResults[cl.phase]) cl.knockoutResults[cl.phase] = [];
  const opponent = isHome ? awayId : homeId;
  cl.knockoutResults[cl.phase].push({
    home: homeId, away: awayId, winner: playerWon ? gameState.playerTeam : opponent, playerMatch: true
  });

  const prevPhase = cl.phase;

  if (!playerWon) {
    cl.playerEliminated = true;
  } else if (cl.phase === 'knockout_qf') {
    const qfWinners = (cl.knockoutResults.knockout_qf || []).map(r => r.winner);
    if (qfWinners.length >= 4) {
      cl.knockout.sf = [[qfWinners[0], qfWinners[1]], [qfWinners[2], qfWinners[3]]];
      cl.phase = 'knockout_sf';
      simulateCLKnockoutAI(gameState);
    }
  } else if (cl.phase === 'knockout_sf') {
    const sfWinners = (cl.knockoutResults.knockout_sf || []).map(r => r.winner);
    if (sfWinners.length >= 2) {
      cl.knockout.final = [sfWinners[0], sfWinners[1]];
      cl.phase = 'final';
      simulateCLKnockoutAI(gameState);
    }
  } else if (cl.phase === 'final') {
    cl.winner = gameState.playerTeam;
    cl.phase = 'complete';
  }

  const phaseName = prevPhase === 'knockout_qf' ? 'Quarter-Final'
                  : prevPhase === 'knockout_sf' ? 'Semi-Final'
                  : 'Final';
  return {
    fixture: { home: homeId, away: awayId }, result: displayResult, isHome,
    matchResult: playerWon ? 'win' : 'loss',
    isCL: true, extraTime, phase: phaseName
  };
}

// ─── EL PLAYOFF (CL 3rd-place dropdowns) ──────────────────────────────────────────────────
function triggerELWithDropdowns(gameState, clDropdowns) {
  const el = gameState.europaLeague;
  if (!el) return;

  // Shuffle the 4 CL dropdowns into 2 pairs
  const shuffled = [...clDropdowns];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  el.playoffPairs = [
    [shuffled[0] || shuffled[1], shuffled[1] || shuffled[0]],
    [shuffled[2] || shuffled[3], shuffled[3] || shuffled[2]],
  ];
  el.phase = 'el_playoff';

  const playerInPlayoff = el.playoffPairs.some(([h, a]) => h === gameState.playerTeam || a === gameState.playerTeam);
  if (playerInPlayoff) {
    el.playerEliminated = false; // they dropped from CL into playoff
    el.playerMatchPending = true;
  } else {
    simulateELPlayoffAI(gameState);
  }
}

function simulateELPlayoffAI(gameState) {
  const el = gameState.europaLeague;
  if (!el || el.phase !== 'el_playoff') return;

  const winners = [];
  for (const [h, a] of (el.playoffPairs || [])) {
    if (h === gameState.playerTeam || a === gameState.playerTeam) continue;
    const result = simulateMatch(h, a, gameState);
    const winner = result.homeGoals > result.awayGoals ? h :
                   result.awayGoals > result.homeGoals ? a :
                   Math.random() < 0.5 ? h : a;
    el.playoffResults.push({ home: h, away: a, winner });
    winners.push(winner);
  }

  if (winners.length === 2) startELGroupStage(gameState, winners);
}

function simulateELPlayoffPlayerMatch(gameState, tactics) {
  const el = gameState.europaLeague;
  if (!el || el.phase !== 'el_playoff') return null;

  const pair = el.playoffPairs?.find(([h, a]) => h === gameState.playerTeam || a === gameState.playerTeam);
  if (!pair) return null;

  const [homeId, awayId] = pair;
  const isHome = homeId === gameState.playerTeam;

  if (tactics) {
    if (!gameState.tactics) gameState.tactics = {};
    gameState.tactics[gameState.playerTeam] = tactics;
  }

  const result = simulateMatch(homeId, awayId, gameState);
  let hg = result.homeGoals, ag = result.awayGoals;
  let extraTime = false;
  if (hg === ag) { extraTime = true; if (Math.random() < 0.5) hg++; else ag++; }

  const playerGoals = isHome ? hg : ag;
  const oppGoals = isHome ? ag : hg;
  const playerWon = playerGoals > oppGoals;
  const opponent = isHome ? awayId : homeId;
  const displayResult = { ...result, homeGoals: hg, awayGoals: ag };

  el.playerMatchPending = false;
  el.playoffResults.push({ home: homeId, away: awayId, winner: playerWon ? gameState.playerTeam : opponent, playerMatch: true });

  // Simulate the other pair if not yet done
  const otherPair = el.playoffPairs.find(p => p !== pair);
  let otherWinner = null;
  const otherDone = el.playoffResults.find(r => r.home === otherPair?.[0] && r.away === otherPair?.[1]);
  if (!otherDone && otherPair) {
    const [oh, oa] = otherPair;
    const r2 = simulateMatch(oh, oa, gameState);
    otherWinner = r2.homeGoals > r2.awayGoals ? oh : r2.awayGoals > r2.homeGoals ? oa : Math.random() < 0.5 ? oh : oa;
    el.playoffResults.push({ home: oh, away: oa, winner: otherWinner });
  } else if (otherDone) {
    otherWinner = otherDone.winner;
  }

  if (!playerWon) {
    el.playerEliminated = true;
    if (otherWinner) startELGroupStage(gameState, [opponent, otherWinner]);
  } else {
    if (otherWinner) startELGroupStage(gameState, [gameState.playerTeam, otherWinner]);
  }

  return {
    fixture: { home: homeId, away: awayId }, result: displayResult, isHome,
    matchResult: playerWon ? 'win' : 'loss',
    isEuropa: true, extraTime, phase: 'EL Playoff'
  };
}

function startELGroupStage(gameState, playoffWinners) {
  const el = gameState.europaLeague;
  if (!el) return;

  // 10 base + 2 playoff winners = 12 teams, 2 groups of 6
  const allTeams = [...new Set([...el.baseTeams, ...playoffWinners.slice(0, 2)])].slice(0, 12);

  // Shuffle
  for (let i = allTeams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allTeams[i], allTeams[j]] = [allTeams[j], allTeams[i]];
  }

  const groupA = allTeams.slice(0, 6);
  const groupB = allTeams.slice(6, 12);

  el.teams = allTeams;
  el.groups = [groupA, groupB];
  el.groupFixtures = {
    0: generateGroupFixtures(groupA),
    1: generateGroupFixtures(groupB),
  };
  el.groupResults = { 0: [], 1: [] };
  el.groupRound = 0;
  el.phase = 'group';

  if (groupA.includes(gameState.playerTeam)) el.playerGroup = 0;
  else if (groupB.includes(gameState.playerTeam)) el.playerGroup = 1;
  else { el.playerEliminated = true; el.playerGroup = -1; return; }

  el.playerEliminated = false;
  simulateEuropaGroupRound(gameState);
}
