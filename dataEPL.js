// data.js — All teams, players, leagues

const POSITIONS = ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'CAM', 'ST', 'ST'];
const POSITION_LIST = ['GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST', 'CF'];

// Generate a player given a name, position, age, and base quality
function makePlayer(id, name, pos, age, ovr, nation) {
  const q = ovr / 100;
  const variance = () => Math.round((Math.random() - 0.5) * 16);
  const stat = (base) => Math.min(99, Math.max(40, Math.round(base * ovr + variance())));

  let pace, shooting, passing, defending, physical, dribbling;

  let gkDiving, gkHandling, gkReflexes, gkKicking, gkPositioning;

  switch (pos) {
    case 'GK':
      pace = stat(0.50); shooting = stat(0.22); passing = stat(0.58);
      defending = stat(1.05); physical = stat(0.76); dribbling = stat(0.30);
      gkDiving      = stat(1.02);
      gkHandling    = stat(1.04);
      gkReflexes    = stat(1.00);
      gkKicking     = stat(0.68);
      gkPositioning = stat(0.98);
      break;
    case 'CB':
      pace = stat(0.58); shooting = stat(0.32); passing = stat(0.64);
      defending = stat(1.05); physical = stat(0.92); dribbling = stat(0.44);
      break;
    case 'RB': case 'LB':
      pace = stat(0.92); shooting = stat(0.48); passing = stat(0.80);
      defending = stat(0.90); physical = stat(0.76); dribbling = stat(0.74);
      break;
    case 'CDM':
      pace = stat(0.64); shooting = stat(0.52); passing = stat(0.84);
      defending = stat(0.98); physical = stat(0.90); dribbling = stat(0.64);
      break;
    case 'CM':
      pace = stat(0.70); shooting = stat(0.66); passing = stat(0.98);
      defending = stat(0.68); physical = stat(0.76); dribbling = stat(0.80);
      break;
    case 'CAM':
      pace = stat(0.74); shooting = stat(0.84); passing = stat(1.02);
      defending = stat(0.36); physical = stat(0.62); dribbling = stat(1.02);
      break;
    case 'RW': case 'LW':
      pace = stat(1.04); shooting = stat(0.78); passing = stat(0.74);
      defending = stat(0.34); physical = stat(0.64); dribbling = stat(1.04);
      break;
    case 'ST': case 'CF':
      pace = stat(0.84); shooting = stat(1.06); passing = stat(0.60);
      defending = stat(0.30); physical = stat(0.86); dribbling = stat(0.82);
      break;
    default:
      pace = stat(0.72); shooting = stat(0.68); passing = stat(0.72);
      defending = stat(0.68); physical = stat(0.72); dribbling = stat(0.72);
  }

  // Build the player object so calculateOverall can read its stats
  const player = {
    id, name, pos, age, nation: nation || 'ENG',
    pace, shooting, passing, defending, physical, dribbling,
    ...(pos === 'GK' ? { gkDiving, gkHandling, gkReflexes, gkKicking, gkPositioning } : {}),
    overall: ovr, // temporary — will be replaced by calculateOverall below
  };

  // Derive overall from stats (position-weighted). Defined in manager.js but available globally.
  if (typeof calculateOverall === 'function') calculateOverall(player);

  // Potential: how good they can become. Young players have higher ceiling relative to current ovr.
  let potential;
  if (age <= 18) potential = player.overall + Math.floor(Math.random() * 20) + 8;
  else if (age <= 21) potential = player.overall + Math.floor(Math.random() * 14) + 4;
  else if (age <= 24) potential = player.overall + Math.floor(Math.random() * 8) + 1;
  else potential = player.overall + Math.floor(Math.random() * 4);
  potential = Math.min(99, potential);

  return {
    ...player, potential,
    contract: Math.floor(Math.random() * 3) + 1,
    wage: Math.round(Math.pow(Math.max(0, player.overall - 55), 2.2) * 80 + Math.random() * 5000),
    value: Math.round(Math.pow(Math.max(0, player.overall - 55), 3) * 1800 * (age <= 23 ? 1.4 : age <= 26 ? 1.1 : age <= 29 ? 1.0 : age <= 31 ? 0.75 : 0.4)),
    morale: 70 + Math.floor(Math.random() * 20),
    fitness: 85 + Math.floor(Math.random() * 15),
    goals: 0, assists: 0, appearances: 0, cleanSheets: 0
  };
}

let _pid = 1;
function pid() { return _pid++; }

// Generate a full squad for a team
function generateSquad(players) {
  return players.map(p => makePlayer(pid(), p[0], p[1], p[2], p[3], p[4]));
}

const PREMIER_LEAGUE_TEAMS = [
  {
    id: 'mci', name: 'Manchester City', short: 'MCI', color: '#6CABDD', colorAlt: '#FFFFFF',
    prestige: 97, budget: 146205000, stadium: 'Etihad Stadium', capacity: 53400,
    squad: generateSquad([
      ['Ederson', 'GK', 30, 88, 'BRA'], ['Ortega', 'GK', 31, 79, 'GER'],
      ['Walker', 'RB', 33, 82, 'ENG'], ['Lewis', 'RB', 22, 78, 'ENG'],
      ['Ruben Dias', 'CB', 26, 90, 'POR'], ['Akanji', 'CB', 28, 85, 'SUI'],
      ['Gvardiol', 'CB', 22, 84, 'CRO'], ['Ake', 'LB', 29, 83, 'NED'],
      ['Rodri', 'CDM', 27, 93, 'ESP'], ['Kovacic', 'CM', 29, 82, 'CRO'],
      ['De Bruyne', 'CM', 32, 91, 'BEL'], ['Bernardo Silva', 'CAM', 29, 89, 'POR'],
      ['Doku', 'RW', 22, 84, 'BEL'], ['Grealish', 'LW', 28, 83, 'ENG'],
      ['Haaland', 'ST', 23, 94, 'NOR'], ['Alvarez', 'ST', 24, 85, 'ARG'],
      ['Gundogan', 'CM', 33, 83, 'GER'], ['Silva', 'CM', 38, 82, 'BRA'],
      ['Foden', 'CAM', 24, 88, 'ENG'], ['Bobb', 'CAM', 20, 76, 'NOR'],
      ['Savinho', 'RW', 20, 78, 'BRA']
    ])
  },
  {
    id: 'ars', name: 'Arsenal', short: 'ARS', color: '#EF0107', colorAlt: '#FFFFFF',
    prestige: 92, budget: 121680000, stadium: 'Emirates Stadium', capacity: 60704,
    squad: generateSquad([
      ['Raya', 'GK', 28, 85, 'ESP'], ['Neto', 'GK', 34, 76, 'BRA'],
      ['Ben White', 'RB', 26, 84, 'ENG'], ['Timber', 'RB', 22, 82, 'NED'],
      ['Saliba', 'CB', 23, 88, 'FRA'], ['Gabriel', 'CB', 26, 86, 'BRA'],
      ['Zinchenko', 'LB', 27, 81, 'UKR'], ['Kiwior', 'LB', 23, 77, 'POL'],
      ['Partey', 'CDM', 30, 82, 'GHA'], ['Jorginho', 'CDM', 32, 78, 'ITA'],
      ['Odegaard', 'CAM', 25, 90, 'NOR'], ['Havertz', 'CM', 25, 83, 'GER'],
      ['Saka', 'RW', 22, 90, 'ENG'], ['Martinelli', 'LW', 23, 85, 'BRA'],
      ['Jesus', 'ST', 27, 82, 'BRA'], ['Trossard', 'CAM', 29, 82, 'BEL'],
      ['Nketiah', 'ST', 24, 78, 'ENG'], ['Elneny', 'CM', 31, 74, 'EGY'],
      ['Tomiyasu', 'CB', 25, 79, 'JPN'], ['Rice', 'CDM', 25, 88, 'ENG'],
      ['Sterling', 'LW', 29, 80, 'ENG']
    ])
  },
  {
    id: 'liv', name: 'Liverpool', short: 'LIV', color: '#C8102E', colorAlt: '#F6EB61',
    prestige: 94, budget: 131220000, stadium: 'Anfield', capacity: 61000,
    squad: generateSquad([
      ['Alisson', 'GK', 31, 91, 'BRA'], ['Kelleher', 'GK', 25, 77, 'IRL'],
      ['Alexander-Arnold', 'RB', 25, 88, 'ENG'], ['Bradley', 'RB', 20, 76, 'USA'],
      ['Konate', 'CB', 24, 85, 'FRA'], ['Van Dijk', 'CB', 32, 88, 'NED'],
      ['Robertson', 'LB', 29, 85, 'SCO'], ['Tsimikas', 'LB', 27, 78, 'GRE'],
      ['Szoboszlai', 'CM', 23, 84, 'HUN'], ['Mac Allister', 'CM', 25, 85, 'ARG'],
      ['Endo', 'CDM', 31, 80, 'JPN'], ['Gravenberch', 'CM', 22, 82, 'NED'],
      ['Salah', 'RW', 31, 92, 'EGY'], ['Luis Diaz', 'LW', 27, 86, 'COL'],
      ['Nunez', 'ST', 24, 84, 'URU'], ['Jota', 'ST', 27, 83, 'POR'],
      ['Gakpo', 'LW', 24, 82, 'NED'], ['Jones', 'CM', 23, 79, 'ENG'],
      ['Elliott', 'CAM', 20, 78, 'ENG'], ['Gomez', 'CB', 27, 80, 'ENG'],
      ['Chiesa', 'RW', 26, 83, 'ITA']
    ])
  },
  {
    id: 'che', name: 'Chelsea', short: 'CHE', color: '#034694', colorAlt: '#FFFFFF',
    prestige: 88, budget: 103680000, stadium: 'Stamford Bridge', capacity: 40341,
    squad: generateSquad([
      ['Sanchez', 'GK', 32, 82, 'COL'], ['Petrovic', 'GK', 24, 76, 'SRB'],
      ['Reece James', 'RB', 24, 86, 'ENG'], ['Gusto', 'RB', 21, 80, 'FRA'],
      ['Colwill', 'CB', 21, 80, 'ENG'], ['Badiashile', 'CB', 22, 78, 'FRA'],
      ['Chalobah', 'CB', 24, 78, 'ENG'], ['Chilwell', 'LB', 27, 80, 'ENG'],
      ['Caicedo', 'CDM', 22, 86, 'ECU'], ['Fernandez', 'CM', 23, 82, 'ARG'],
      ['Palmer', 'CAM', 22, 88, 'ENG'], ['Gallagher', 'CM', 23, 79, 'ENG'],
      ['Mudryk', 'LW', 23, 80, 'UKR'], ['Sterling', 'RW', 29, 80, 'ENG'],
      ['Jackson', 'ST', 23, 81, 'SEN'], ['Nkunku', 'CAM', 26, 84, 'FRA'],
      ['Madueke', 'RW', 22, 79, 'ENG'], ['Disasi', 'CB', 26, 78, 'FRA'],
      ['Veiga', 'CAM', 25, 81, 'POR'], ['Joao Pedro', 'ST', 22, 80, 'BRA'],
      ['Sancho', 'RW', 24, 81, 'ENG']
    ])
  },
  {
    id: 'mun', name: 'Manchester United', short: 'MUN', color: '#DA020E', colorAlt: '#FFE500',
    prestige: 90, budget: 112500000, stadium: 'Old Trafford', capacity: 74310,
    squad: generateSquad([
      ['Onana', 'GK', 28, 83, 'CMR'], ['Bayindir', 'GK', 26, 74, 'TUR'],
      ['Dalot', 'RB', 25, 80, 'POR'], ['Wan-Bissaka', 'RB', 26, 77, 'ENG'],
      ['Maguire', 'CB', 31, 76, 'ENG'], ['Lindelof', 'CB', 29, 76, 'SWE'],
      ['Martinez', 'CB', 26, 82, 'ARG'], ['Shaw', 'LB', 28, 81, 'ENG'],
      ['Mainoo', 'CM', 19, 81, 'ENG'], ['Casemiro', 'CDM', 32, 80, 'BRA'],
      ['Fernandes', 'CAM', 29, 88, 'POR'], ['Mount', 'CAM', 25, 80, 'ENG'],
      ['Rashford', 'LW', 26, 85, 'ENG'], ['Antony', 'RW', 24, 76, 'BRA'],
      ['Hojlund', 'ST', 21, 82, 'DEN'], ['Zirkzee', 'ST', 23, 81, 'NED'],
      ['Garnacho', 'LW', 19, 80, 'ARG'], ['Amrabat', 'CDM', 27, 78, 'MAR'],
      ['Eriksen', 'CM', 32, 78, 'DEN'], ['Evans', 'CB', 36, 74, 'NIR'],
      ['De Ligt', 'CB', 24, 82, 'NED']
    ])
  },
  {
    id: 'tot', name: 'Tottenham', short: 'TOT', color: '#132257', colorAlt: '#FFFFFF',
    prestige: 86, budget: 95220000, stadium: 'Tottenham Hotspur Stadium', capacity: 62850,
    squad: generateSquad([
      ['Vicario', 'GK', 27, 83, 'ITA'], ['Forster', 'GK', 35, 74, 'ENG'],
      ['Porro', 'RB', 24, 82, 'ESP'], ['Spence', 'RB', 23, 74, 'ENG'],
      ['Romero', 'CB', 26, 86, 'ARG'], ['Van de Ven', 'CB', 22, 84, 'NED'],
      ['Dragusin', 'CB', 22, 78, 'ROU'], ['Udogie', 'LB', 21, 81, 'ITA'],
      ['Bissouma', 'CDM', 27, 80, 'MLI'], ['Sarr', 'CM', 22, 79, 'SEN'],
      ['Maddison', 'CAM', 27, 84, 'ENG'], ['Bentancur', 'CM', 26, 79, 'URU'],
      ['Johnson', 'RW', 23, 80, 'ENG'], ['Werner', 'LW', 28, 78, 'GER'],
      ['Son', 'LW', 31, 87, 'KOR'], ['Richarlison', 'ST', 27, 80, 'BRA'],
      ['Solanke', 'ST', 26, 79, 'ENG'], ['Lo Celso', 'CAM', 28, 78, 'ARG'],
      ['Bergvall', 'CM', 18, 74, 'SWE'], ['Gray', 'RW', 28, 76, 'ENG'],
      ['Kulusevski', 'CAM', 24, 82, 'SWE']
    ])
  },
  {
    id: 'new', name: 'Newcastle United', short: 'NEW', color: '#241F20', colorAlt: '#FFFFFF',
    prestige: 84, budget: 87120000, stadium: "St. James' Park", capacity: 52305,
    squad: generateSquad([
      ['Pope', 'GK', 32, 86, 'ENG'], ['Dubravka', 'GK', 35, 76, 'SVK'],
      ['Trippier', 'RB', 33, 84, 'ENG'], ['Livramento', 'RB', 21, 78, 'ENG'],
      ['Schar', 'CB', 32, 82, 'SUI'], ['Burn', 'CB', 31, 79, 'ENG'],
      ['Botman', 'CB', 23, 80, 'NED'], ['Hall', 'LB', 22, 76, 'ENG'],
      ['Guimaraes', 'CDM', 26, 87, 'BRA'], ['Tonali', 'CM', 23, 84, 'ITA'],
      ['Joelinton', 'CM', 27, 82, 'BRA'], ['Longstaff', 'CM', 26, 76, 'ENG'],
      ['Murphy', 'RW', 29, 77, 'ENG'], ['Almiron', 'CAM', 30, 80, 'PAR'],
      ['Isak', 'ST', 24, 87, 'SWE'], ['Wilson', 'ST', 32, 77, 'ENG'],
      ['Barnes', 'LW', 26, 81, 'ENG'], ['Gordon', 'LW', 23, 82, 'ENG'],
      ['Willock', 'CM', 24, 76, 'ENG'], ['Dummett', 'LB', 32, 72, 'WAL'],
      ['Miley', 'CM', 19, 72, 'ENG']
    ])
  },
  {
    id: 'avl', name: 'Aston Villa', short: 'AVL', color: '#95BFE5', colorAlt: '#670E36',
    prestige: 82, budget: 79380000, stadium: 'Villa Park', capacity: 42785,
    squad: generateSquad([
      ['Martinez', 'GK', 31, 88, 'ARG'], ['Olsen', 'GK', 34, 76, 'SWE'],
      ['Cash', 'RB', 26, 81, 'POL'], ['Konsa', 'CB', 26, 82, 'ENG'],
      ['Torres', 'CB', 24, 80, 'ESP'], ['Mings', 'CB', 30, 77, 'ENG'],
      ['Digne', 'LB', 31, 79, 'FRA'], ['Moreno', 'LB', 32, 78, 'ESP'],
      ['Douglas Luiz', 'CDM', 25, 84, 'BRA'], ['Tielemans', 'CM', 26, 81, 'BEL'],
      ['McGinn', 'CM', 29, 80, 'SCO'], ['Kamara', 'CDM', 23, 78, 'GUI'],
      ['Bailey', 'RW', 26, 81, 'JAM'], ['Diaby', 'LW', 27, 82, 'FRA'],
      ['Watkins', 'ST', 28, 84, 'ENG'], ['Duran', 'ST', 20, 78, 'COL'],
      ['Trezeguet', 'CAM', 29, 76, 'EGY'], ['Ramsey', 'CM', 23, 77, 'ENG'],
      ['Zaniolo', 'CAM', 24, 79, 'ITA'], ['Buendia', 'CAM', 27, 80, 'ARG'],
      ['Rogers', 'LW', 21, 76, 'ENG']
    ])
  },
  {
    id: 'whu', name: 'West Ham', short: 'WHU', color: '#7A263A', colorAlt: '#1BB1E7',
    prestige: 76, budget: 58320000, stadium: 'London Stadium', capacity: 60000,
    squad: generateSquad([
      ['Areola', 'GK', 30, 79, 'FRA'], ['Fabianski', 'GK', 39, 72, 'POL'],
      ['Coufal', 'RB', 31, 76, 'CZE'], ['Wan-Bissaka', 'RB', 26, 77, 'ENG'],
      ['Todibo', 'CB', 24, 79, 'FRA'], ['Zouma', 'CB', 29, 78, 'FRA'],
      ['Mavropanos', 'CB', 26, 76, 'GRE'], ['Emerson', 'LB', 29, 75, 'ITA'],
      ['Ward-Prowse', 'CM', 29, 82, 'ENG'], ['Alvarez', 'CDM', 26, 82, 'MEX'],
      ['Soucek', 'CM', 29, 79, 'CZE'], ['Paqueta', 'CAM', 26, 83, 'BRA'],
      ['Bowen', 'RW', 27, 83, 'ENG'], ['Kudus', 'CAM', 23, 82, 'GHA'],
      ['Antonio', 'ST', 33, 74, 'ENG'], ['Ings', 'ST', 31, 76, 'ENG'],
      ['Fornals', 'CAM', 28, 77, 'ESP'], ['Guilherme', 'RW', 22, 74, 'BRA'],
      ['Ogbonna', 'CB', 36, 71, 'ITA'], ['Johnson', 'LB', 21, 72, 'ENG'],
      ['Rodriguez', 'ST', 22, 75, 'ENG']
    ])
  },
  {
    id: 'bri', name: 'Brighton', short: 'BRI', color: '#0057B8', colorAlt: '#FFFFFF',
    prestige: 78, budget: 64980000, stadium: 'Amex Stadium', capacity: 31800,
    squad: generateSquad([
      ['Flekken', 'GK', 30, 80, 'NED'], ['Steele', 'GK', 31, 74, 'ENG'],
      ['Lamptey', 'RB', 23, 78, 'GHA'], ['Veltman', 'RB', 32, 74, 'NED'],
      ['Dunk', 'CB', 32, 78, 'ENG'], ['van Hecke', 'CB', 24, 76, 'NED'],
      ['Igor', 'CB', 26, 77, 'BRA'], ['Estupinan', 'LB', 25, 80, 'ECU'],
      ['Gross', 'CM', 32, 79, 'GER'], ['Gilmour', 'CM', 22, 78, 'SCO'],
      ['Baleba', 'CDM', 20, 76, 'CMR'], ['Dahoud', 'CM', 28, 76, 'GER'],
      ['March', 'RW', 29, 79, 'ENG'], ['Adingra', 'RW', 22, 78, 'CIV'],
      ['Welbeck', 'ST', 33, 74, 'ENG'], ['Joao Pedro', 'ST', 22, 80, 'BRA'],
      ['Mitoma', 'LW', 26, 82, 'JPN'], ['Enciso', 'CAM', 20, 77, 'PAR'],
      ['Sarmiento', 'LW', 23, 76, 'ECU'], ['Buonanotte', 'CAM', 19, 74, 'ARG'],
      ['Ferguson', 'ST', 20, 78, 'IRL']
    ])
  },
  {
    id: 'wol', name: 'Wolverhampton', short: 'WOL', color: '#FDB913', colorAlt: '#231F20',
    prestige: 72, budget: 46080000, stadium: 'Molineux', capacity: 31700,
    squad: generateSquad([
      ['Sa', 'GK', 31, 80, 'POR'], ['Bentley', 'GK', 30, 72, 'ENG'],
      ['Semedo', 'RB', 30, 79, 'POR'], ['Doherty', 'RB', 32, 75, 'IRL'],
      ['Kilman', 'CB', 26, 79, 'ENG'], ['Toti', 'CB', 23, 75, 'POR'],
      ['Collins', 'CB', 29, 76, 'WAL'], ['Ait-Nouri', 'LB', 23, 79, 'ALG'],
      ['Joao Gomes', 'CDM', 23, 80, 'BRA'], ['Lemina', 'CM', 30, 78, 'GAB'],
      ['Neves', 'CM', 26, 82, 'POR'], ['Doyle', 'CM', 21, 74, 'ENG'],
      ['Pedro Neto', 'RW', 24, 82, 'POR'], ['Hwang', 'RW', 28, 78, 'KOR'],
      ['Cunha', 'ST', 25, 83, 'BRA'], ['Guedes', 'LW', 27, 76, 'POR'],
      ['Matheus Cunha', 'CAM', 24, 80, 'BRA'], ['Sarabia', 'RW', 32, 76, 'ESP'],
      ['Dawson', 'CB', 34, 73, 'ENG'], ['Strand Larsen', 'ST', 24, 77, 'NOR'],
      ['Bueno', 'CB', 24, 74, 'BRA']
    ])
  },
  {
    id: 'eve', name: 'Everton', short: 'EVE', color: '#003399', colorAlt: '#FFFFFF',
    prestige: 70, budget: 40500000, stadium: 'Goodison Park', capacity: 39572,
    squad: generateSquad([
      ['Pickford', 'GK', 29, 83, 'ENG'], ['Virginia', 'GK', 24, 72, 'POR'],
      ['Patterson', 'RB', 22, 74, 'SCO'], ['Holgate', 'CB', 27, 73, 'ENG'],
      ['Tarkowski', 'CB', 31, 79, 'ENG'], ['Mykolenko', 'LB', 24, 75, 'UKR'],
      ['Branthwaite', 'CB', 21, 78, 'ENG'], ['Young', 'RB', 38, 70, 'ENG'],
      ['Gueye', 'CDM', 34, 75, 'SEN'], ['Onana', 'CM', 27, 78, 'CMR'],
      ['Doucoure', 'CM', 30, 77, 'FRA'], ['Garner', 'CM', 22, 74, 'ENG'],
      ['Harrison', 'LW', 27, 76, 'ENG'], ['McNeil', 'RW', 24, 76, 'ENG'],
      ['Calvert-Lewin', 'ST', 26, 78, 'ENG'], ['Beto', 'ST', 25, 75, 'POR'],
      ['Iwobi', 'CAM', 27, 77, 'NGA'], ['Danjuma', 'LW', 27, 76, 'NED'],
      ['Lindstrom', 'CAM', 24, 76, 'DEN'], ['Ndiaye', 'CM', 23, 76, 'SEN'],
      ['Keane', 'CB', 31, 74, 'ENG']
    ])
  },
  {
    id: 'ful', name: 'Fulham', short: 'FUL', color: '#FFFFFF', colorAlt: '#000000',
    prestige: 68, budget: 35280000, stadium: 'Craven Cottage', capacity: 25700,
    squad: generateSquad([
      ['Leno', 'GK', 32, 81, 'GER'], ['Benda', 'GK', 25, 70, 'CZE'],
      ['Tete', 'RB', 23, 76, 'BRA'], ['Castagne', 'RB', 28, 76, 'BEL'],
      ['Diop', 'CB', 27, 77, 'FRA'], ['Ream', 'CB', 36, 73, 'USA'],
      ['Robinson', 'LB', 24, 77, 'ENG'], ['Bryan', 'LB', 29, 72, 'ENG'],
      ['Lukic', 'CDM', 28, 76, 'SRB'], ['Reed', 'CM', 29, 74, 'ENG'],
      ['Cairney', 'CM', 33, 75, 'SCO'], ['Pereira', 'CAM', 31, 79, 'BRA'],
      ['Iwobi', 'RW', 27, 77, 'NGA'], ['De Cordova-Reid', 'LW', 31, 75, 'JAM'],
      ['Jimenez', 'ST', 32, 76, 'MEX'], ['Muniz', 'ST', 22, 77, 'BRA'],
      ['Willian', 'CAM', 35, 73, 'BRA'], ['Onomah', 'CM', 26, 72, 'ENG'],
      ['Vinicius', 'ST', 24, 74, 'BRA'], ['Palhinha', 'CDM', 28, 84, 'POR'],
      ['Andreas', 'CM', 32, 79, 'DEN']
    ])
  },
  {
    id: 'bou', name: 'Bournemouth', short: 'BOU', color: '#DA291C', colorAlt: '#000000',
    prestige: 65, budget: 28125000, stadium: 'Vitality Stadium', capacity: 11307,
    squad: generateSquad([
      ['Neto', 'GK', 34, 76, 'BRA'], ['Travers', 'GK', 24, 72, 'IRL'],
      ['Smith', 'RB', 28, 74, 'ENG'], ['Hill', 'RB', 22, 72, 'ENG'],
      ['Zabarnyi', 'CB', 21, 78, 'UKR'], ['Senesi', 'CB', 26, 76, 'ARG'],
      ['Cook', 'CB', 32, 74, 'ENG'], ['Kerkez', 'LB', 20, 77, 'HUN'],
      ['Cook', 'CDM', 37, 74, 'ENG'], ['Christie', 'CM', 29, 75, 'SCO'],
      ['Lerma', 'CM', 29, 75, 'COL'], ['Billing', 'CM', 27, 74, 'DEN'],
      ['Tavernier', 'RW', 24, 76, 'ENG'], ['Ouattara', 'LW', 22, 77, 'BFA'],
      ['Solanke', 'ST', 26, 79, 'ENG'], ['Enes Unal', 'ST', 27, 76, 'TUR'],
      ['Sinisterra', 'LW', 24, 77, 'COL'], ['Zemura', 'LB', 24, 72, 'ZIM'],
      ['Fredericks', 'RB', 31, 71, 'ENG'], ['Anthony', 'ST', 24, 74, 'JAM'],
      ['Semenyo', 'RW', 24, 77, 'GHA']
    ])
  },
  {
    id: 'cry', name: 'Crystal Palace', short: 'CRY', color: '#1B458F', colorAlt: '#C4122E',
    prestige: 66, budget: 30420000, stadium: 'Selhurst Park', capacity: 25486,
    squad: generateSquad([
      ['Henderson', 'GK', 33, 79, 'ENG'], ['Matthews', 'GK', 27, 70, 'ENG'],
      ['Clyne', 'RB', 33, 71, 'ENG'], ['Ward', 'RB', 34, 71, 'ENG'],
      ['Guehi', 'CB', 23, 82, 'ENG'], ['Andersen', 'CB', 28, 80, 'DEN'],
      ['Mitchell', 'LB', 24, 76, 'ENG'], ['Munoz', 'RB', 25, 75, 'COL'],
      ['Hughes', 'CDM', 23, 76, 'ENG'], ['Wharton', 'CM', 19, 76, 'ENG'],
      ['Doucoure', 'CM', 23, 78, 'FRA'], ['Eze', 'CAM', 25, 83, 'ENG'],
      ['Ayew', 'RW', 33, 72, 'GHA'], ['Mateta', 'ST', 26, 79, 'FRA'],
      ['Olise', 'RW', 22, 84, 'FRA'], ['Schlupp', 'LW', 31, 73, 'GHA'],
      ['Edouard', 'ST', 26, 75, 'FRA'], ['Plange', 'ST', 21, 72, 'ENG'],
      ['Lerma', 'CM', 30, 75, 'COL'], ['Lacroix', 'CB', 24, 76, 'FRA'],
      ['Eze', 'CAM', 25, 83, 'ENG']
    ])
  },
  {
    id: 'bha', name: 'Brentford', short: 'BRE', color: '#D20000', colorAlt: '#FFFFFF',
    prestige: 68, budget: 35280000, stadium: 'Gtech Community Stadium', capacity: 17250,
    squad: generateSquad([
      ['Flekken', 'GK', 30, 79, 'NED'], ['Cox', 'GK', 23, 70, 'ENG'],
      ['Hickey', 'RB', 22, 76, 'SCO'], ['Roerslev', 'RB', 23, 74, 'DEN'],
      ['Collins', 'CB', 26, 78, 'WAL'], ['Pinnock', 'CB', 30, 76, 'ENG'],
      ['Henry', 'LB', 26, 75, 'FRA'], ['Ajer', 'CB', 26, 76, 'NOR'],
      ['Janelt', 'CM', 26, 77, 'GER'], ['Jensen', 'CM', 28, 76, 'DEN'],
      ['Norgaard', 'CDM', 30, 78, 'DEN'], ['Baptiste', 'CM', 21, 73, 'ENG'],
      ['Mbeumo', 'RW', 24, 82, 'CMR'], ['Damsgaard', 'CAM', 23, 78, 'DEN'],
      ['Toney', 'ST', 27, 84, 'ENG'], ['Wissa', 'ST', 27, 78, 'COD'],
      ['Schade', 'LW', 23, 76, 'GER'], ['Lewis-Potter', 'LW', 23, 76, 'ENG'],
      ['Konak', 'RW', 19, 72, 'TUR'], ['Maghoma', 'CM', 22, 72, 'COD'],
      ['Ghoddos', 'CAM', 29, 74, 'SWE']
    ])
  },
  {
    id: 'nfo', name: 'Nottingham Forest', short: 'NFO', color: '#DD0000', colorAlt: '#FFFFFF',
    prestige: 65, budget: 28125000, stadium: 'City Ground', capacity: 30332,
    squad: generateSquad([
      ['Sels', 'GK', 32, 78, 'BEL'], ['Turner', 'GK', 29, 74, 'USA'],
      ['Aina', 'RB', 27, 76, 'NGA'], ['Williams', 'RB', 22, 73, 'WAL'],
      ['Murillo', 'CB', 22, 79, 'COL'], ['Felipe', 'CB', 35, 74, 'BRA'],
      ['Willy Boly', 'CB', 33, 73, 'FRA'], ['Toffolo', 'LB', 28, 74, 'ENG'],
      ['Yates', 'CM', 23, 74, 'ENG'], ['Mangala', 'CDM', 26, 76, 'FRA'],
      ['Dominguez', 'CAM', 24, 76, 'ARG'], ['Neco Williams', 'RB', 22, 73, 'WAL'],
      ['Hudson-Odoi', 'RW', 23, 77, 'ENG'], ['Elanga', 'LW', 22, 77, 'SWE'],
      ['Awoniyi', 'ST', 26, 76, 'NGA'], ['Wood', 'ST', 32, 76, 'NZL'],
      ['Morgan Gibbs-White', 'CAM', 24, 80, 'ENG'], ['Montiel', 'RB', 27, 74, 'ARG'],
      ['Biancone', 'CB', 23, 72, 'FRA'], ['Danilo', 'CDM', 22, 75, 'BRA'],
      ['Omobamidele', 'CB', 22, 73, 'IRL']
    ])
  },
  {
    id: 'bur', name: 'Burnley', short: 'BUR', color: '#6C1D45', colorAlt: '#99D6EA',
    prestige: 58, budget: 14580000, stadium: 'Turf Moor', capacity: 21944,
    squad: generateSquad([
      ['Trafford', 'GK', 21, 74, 'ENG'], ['Muric', 'GK', 25, 72, 'KOS'],
      ['Roberts', 'RB', 24, 72, 'WAL'], ['Lowton', 'RB', 34, 69, 'ENG'],
      ['Beyer', 'CB', 21, 72, 'GER'], ['Esteve', 'CB', 22, 71, 'FRA'],
      ['Taylor', 'LB', 32, 72, 'ENG'], ['Peacock-Farrell', 'GK', 27, 70, 'NIR'],
      ['Brownhill', 'CM', 28, 74, 'ENG'], ['Berge', 'CDM', 26, 77, 'NOR'],
      ['Cork', 'CM', 34, 71, 'ENG'], ['Cullen', 'CM', 27, 73, 'ENG'],
      ['Bruun Larsen', 'RW', 25, 74, 'DEN'], ['Zaroury', 'LW', 24, 74, 'BEL'],
      ['Rodriguez', 'ST', 22, 74, 'ENG'], ['Cornet', 'ST', 27, 74, 'CIV'],
      ['Ndiaye', 'CAM', 23, 74, 'SEN'], ['Al-Dakhil', 'CB', 22, 72, 'BEL'],
      ['Vitinho', 'RW', 26, 73, 'BRA'], ['Gudmundsson', 'RW', 31, 73, 'ISL'],
      ['Assignon', 'RB', 23, 72, 'FRA']
    ])
  },
  {
    id: 'she', name: 'Sheffield United', short: 'SHU', color: '#EE2737', colorAlt: '#000000',
    prestige: 55, budget: 10125000, stadium: 'Bramall Lane', capacity: 32050,
    squad: generateSquad([
      ['Foderingham', 'GK', 33, 72, 'ENG'], ['Davies', 'GK', 27, 69, 'ENG'],
      ['Baldock', 'RB', 31, 72, 'ENG'], ['Ahmedhodzic', 'CB', 24, 74, 'BOS'],
      ['Trusty', 'CB', 26, 72, 'USA'], ['Robinson', 'LB', 29, 71, 'ENG'],
      ['Norwood', 'CDM', 33, 72, 'NIR'], ['Souza', 'CM', 26, 72, 'BRA'],
      ['Fleck', 'CM', 32, 73, 'SCO'], ['Osborn', 'CM', 29, 71, 'ENG'],
      ['McAtee', 'CAM', 21, 73, 'ENG'], ['Berge', 'CM', 26, 76, 'NOR'],
      ['Bogle', 'RW', 23, 72, 'ENG'], ['Brewster', 'ST', 23, 71, 'ENG'],
      ['McBurnie', 'ST', 27, 72, 'SCO'], ['Ndiaye', 'CM', 23, 74, 'SEN'],
      ['Sharp', 'ST', 37, 68, 'ENG'], ['Hamer', 'CM', 26, 71, 'ENG'],
      ['Lowe', 'LB', 30, 70, 'ENG'], ['Doyle', 'CDM', 26, 71, 'ENG'],
      ['Stevens', 'LB', 30, 70, 'IRL']
    ])
  },
  {
    id: 'lui', name: 'Luton Town', short: 'LUT', color: '#F78F1E', colorAlt: '#FFFFFF',
    prestige: 52, budget: 6480000, stadium: 'Kenilworth Road', capacity: 10356,
    squad: generateSquad([
      ['Kaminski', 'GK', 31, 72, 'BEL'], ['Shea', 'GK', 34, 67, 'USA'],
      ['Bree', 'RB', 28, 70, 'ENG'], ['Osho', 'CB', 25, 70, 'ENG'],
      ['Mengi', 'CB', 22, 71, 'ENG'], ['Bell', 'LB', 21, 69, 'ENG'],
      ['Berry', 'CM', 28, 71, 'ENG'], ['Clark', 'CDM', 27, 70, 'ENG'],
      ['Nakamba', 'CDM', 30, 71, 'ZIM'], ['Doughty', 'CM', 25, 69, 'ENG'],
      ['Adebayo', 'ST', 26, 74, 'ENG'], ['Woodrow', 'ST', 29, 71, 'ENG'],
      ['Brown', 'RW', 27, 70, 'ENG'], ['Ogbene', 'LW', 26, 72, 'IRL'],
      ['Barkley', 'CAM', 30, 74, 'ENG'], ['Burke', 'LW', 27, 70, 'SCO'],
      ['Campbell', 'RW', 24, 71, 'ENG'], ['Townsend', 'RW', 33, 70, 'ENG'],
      ['Johnson', 'LB', 24, 70, 'ENG'], ['Doherty', 'RB', 32, 71, 'IRL'],
      ['Morris', 'CM', 23, 70, 'ENG']
    ])
  }
];

const CHAMPIONSHIP_TEAMS = [
  {
    id: 'lee', name: 'Leeds United', short: 'LEE', color: '#FFCD00', colorAlt: '#1D428A',
    prestige: 72, budget: 46080000, stadium: 'Elland Road', capacity: 37890,
    squad: generateSquad([
      ['Meslier', 'GK', 24, 78, 'FRA'], ['Darlow', 'GK', 33, 70, 'ENG'],
      ['Ayling', 'RB', 32, 74, 'ENG'], ['Bogle', 'RB', 23, 73, 'ENG'],
      ['Koch', 'CB', 27, 78, 'GER'], ['Cooper', 'CB', 28, 76, 'ENG'],
      ['Struijk', 'LB', 25, 75, 'NED'], ['Firpo', 'LB', 27, 74, 'DOM'],
      ['Adams', 'CDM', 27, 78, 'SCO'], ['Roca', 'CM', 27, 76, 'ESP'],
      ['Ampadu', 'CM', 23, 75, 'WAL'], ['Aaronson', 'CAM', 23, 76, 'USA'],
      ['James', 'RW', 26, 78, 'WAL'], ['Harrison', 'LW', 27, 76, 'ENG'],
      ['Bamford', 'ST', 30, 76, 'ENG'], ['Gelhardt', 'ST', 21, 73, 'ENG'],
      ['Summerville', 'LW', 22, 76, 'NED'], ['Klich', 'CM', 33, 73, 'POL'],
      ['Sinisterra', 'LW', 24, 77, 'COL'], ['Gyabi', 'CM', 19, 72, 'ENG'],
      ['Byram', 'RB', 29, 72, 'ENG']
    ])
  },
  {
    id: 'lei', name: 'Leicester City', short: 'LEI', color: '#003090', colorAlt: '#FDBE11',
    prestige: 74, budget: 52020000, stadium: 'King Power Stadium', capacity: 32261,
    squad: generateSquad([
      ['Ward', 'GK', 36, 74, 'ENG'], ['Hermansen', 'GK', 23, 74, 'DEN'],
      ['Castagne', 'RB', 28, 75, 'BEL'], ['Justin', 'RB', 26, 75, 'ENG'],
      ['Faes', 'CB', 25, 76, 'BEL'], ['Vestergaard', 'CB', 31, 75, 'DEN'],
      ['Thomas', 'LB', 24, 74, 'GHA'], ['Kristiansen', 'LB', 21, 72, 'DEN'],
      ['Ndidi', 'CDM', 27, 79, 'NGA'], ['Soumare', 'CM', 24, 74, 'FRA'],
      ['Dewsbury-Hall', 'CM', 24, 76, 'ENG'], ['Winks', 'CM', 27, 74, 'ENG'],
      ['Daka', 'ST', 25, 77, 'ZAM'], ['Iheanacho', 'ST', 27, 74, 'NGA'],
      ['Vardy', 'ST', 37, 72, 'ENG'], ['Perez', 'CAM', 27, 73, 'ESP'],
      ['Fatawu', 'RW', 20, 75, 'GHA'], ['El Khannous', 'CM', 20, 74, 'MAR'],
      ['Buonanotte', 'LW', 19, 72, 'ARG'], ['Coady', 'CB', 31, 74, 'ENG'],
      ['Pennington', 'CB', 29, 71, 'ENG']
    ])
  },
  {
    id: 'sou', name: 'Southampton', short: 'SOU', color: '#D71920', colorAlt: '#130C0E',
    prestige: 65, budget: 28125000, stadium: "St Mary's Stadium", capacity: 32384,
    squad: generateSquad([
      ['McCarthy', 'GK', 34, 74, 'IRL'], ['Bazunu', 'GK', 22, 74, 'IRL'],
      ['Walker-Peters', 'RB', 26, 75, 'ENG'], ['Valery', 'RB', 25, 70, 'FRA'],
      ['Bednarek', 'CB', 27, 76, 'POL'], ['Bella-Kotchap', 'CB', 22, 74, 'GER'],
      ['Perraud', 'LB', 24, 72, 'FRA'], ['Manning', 'LB', 24, 71, 'IRL'],
      ['Ward-Prowse', 'CM', 29, 82, 'ENG'], ['Lavia', 'CDM', 19, 78, 'BEL'],
      ['Mara', 'CM', 25, 71, 'GUI'], ['Djenepo', 'LW', 25, 73, 'MLI'],
      ['Elyounoussi', 'RW', 29, 73, 'NOR'], ['Adams', 'ST', 27, 76, 'SCO'],
      ['Che Adams', 'ST', 27, 76, 'SCO'], ['Aribo', 'CAM', 27, 73, 'NGA'],
      ['Armstrong', 'CM', 26, 73, 'SCO'], ['Stephens', 'CDM', 30, 71, 'ENG'],
      ['Lyanco', 'CB', 26, 71, 'BRA'], ['Ainsworth', 'RW', 23, 70, 'ENG'],
      ['Ramsdale', 'GK', 25, 78, 'ENG']
    ])
  },
  {
    id: 'ips', name: 'Ipswich Town', short: 'IPS', color: '#0044A9', colorAlt: '#FFFFFF',
    prestige: 60, budget: 18000000, stadium: 'Portman Road', capacity: 29543,
    squad: generateSquad([
      ['Walton', 'GK', 28, 73, 'ENG'], ['Hladky', 'GK', 32, 69, 'CZE'],
      ['Donacien', 'RB', 28, 70, 'AIA'], ['Clarke', 'CB', 22, 73, 'ENG'],
      ['Woolfenden', 'CB', 25, 72, 'ENG'], ['Davis', 'LB', 26, 71, 'ENG'],
      ['Morsy', 'CDM', 32, 73, 'EGY'], ['Chaplin', 'CM', 27, 72, 'ENG'],
      ['Burns', 'CM', 23, 71, 'ENG'], ['Hutchinson', 'CM', 22, 72, 'ENG'],
      ['Luongo', 'CM', 30, 71, 'AUS'], ['Broadhead', 'CAM', 25, 72, 'WAL'],
      ['Townsend', 'RW', 33, 71, 'ENG'], ['Szmodics', 'CAM', 27, 74, 'ENG'],
      ['Chaplin', 'ST', 26, 72, 'ENG'], ['Taylor', 'ST', 25, 71, 'ENG'],
      ['Harness', 'LW', 28, 70, 'ENG'], ['Aluko', 'RW', 35, 67, 'ENG'],
      ['El Mizouni', 'CM', 23, 69, 'TUN'], ['Woolfenden', 'CB', 25, 72, 'ENG'],
      ['Campbell', 'ST', 22, 72, 'ENG']
    ])
  },
  {
    id: 'mid', name: 'Middlesbrough', short: 'MID', color: '#D71920', colorAlt: '#FFFFFF',
    prestige: 58, budget: 14580000, stadium: 'Riverside Stadium', capacity: 34742,
    squad: generateSquad([
      ['Flint', 'GK', 34, 70, 'ENG'], ['Roberts', 'GK', 26, 69, 'ENG'],
      ['Smith', 'RB', 27, 70, 'ENG'], ['McNair', 'CB', 28, 72, 'NIR'],
      ['Dael Fry', 'CB', 26, 73, 'ENG'], ['Lenihan', 'CB', 31, 72, 'IRL'],
      ['Giles', 'LB', 22, 71, 'ENG'], ['Taylor', 'LB', 28, 70, 'ENG'],
      ['Howson', 'CM', 35, 70, 'ENG'], ['Hackney', 'CM', 23, 71, 'ENG'],
      ['Jones', 'CDM', 27, 71, 'ENG'], ['Crooks', 'CM', 29, 70, 'ENG'],
      ['Forss', 'ST', 24, 71, 'FIN'], ['Akpom', 'ST', 27, 73, 'ENG'],
      ['Latte Lath', 'ST', 25, 73, 'CIV'], ['Silvera', 'RW', 23, 70, 'BRA'],
      ['Tavernier', 'RW', 24, 72, 'ENG'], ['Payero', 'CM', 25, 71, 'ARG'],
      ['Bola', 'LB', 26, 70, 'ENG'], ['McGree', 'CM', 25, 70, 'AUS'],
      ['Cooper', 'CB', 33, 70, 'ENG']
    ])
  },
  {
    id: 'wba', name: 'West Brom', short: 'WBA', color: '#122F67', colorAlt: '#FFFFFF',
    prestige: 60, budget: 18000000, stadium: 'The Hawthorns', capacity: 26688,
    squad: generateSquad([
      ['Palmer', 'GK', 37, 72, 'ENG'], ['Button', 'GK', 35, 68, 'ENG'],
      ['Furlong', 'RB', 31, 72, 'IRL'], ['Townsend', 'RB', 24, 70, 'ENG'],
      ['Kipre', 'CB', 27, 71, 'CIV'], ['O Shea', 'CB', 25, 72, 'IRL'],
      ['Hegazi', 'CB', 32, 71, 'EGY'], ['Reach', 'LB', 31, 71, 'ENG'],
      ['Molumby', 'CDM', 24, 70, 'IRL'], ['Gardner', 'CM', 36, 69, 'ENG'],
      ['Phillips', 'CM', 30, 73, 'ENG'], ['Swift', 'CAM', 28, 74, 'ENG'],
      ['Grant', 'ST', 30, 72, 'SCO'], ['Diangana', 'LW', 24, 73, 'ENG'],
      ['Thomas-Asante', 'ST', 25, 72, 'GHA'], ['Mowatt', 'CM', 28, 71, 'ENG'],
      ['Pereira', 'RW', 27, 73, 'BRA'], ['Zohore', 'ST', 29, 70, 'DEN'],
      ['Yokuslu', 'CDM', 29, 72, 'TUR'], ['Okay', 'CB', 24, 70, 'TUR'],
      ['Wallace', 'LB', 30, 70, 'ENG']
    ])
  },
  {
    id: 'swa', name: 'Swansea City', short: 'SWA', color: '#FFFFFF', colorAlt: '#121321',
    prestige: 55, budget: 10125000, stadium: 'Swansea.com Stadium', capacity: 20520,
    squad: generateSquad([
      ['Fisher', 'GK', 25, 69, 'ENG'], ['Benda', 'GK', 25, 70, 'CZE'],
      ['Naughton', 'RB', 35, 69, 'ENG'], ['Cabango', 'CB', 23, 72, 'WAL'],
      ['Rodon', 'CB', 26, 75, 'WAL'], ['Manning', 'LB', 24, 71, 'IRL'],
      ['Walsh', 'CDM', 26, 74, 'ENG'], ['Fulton', 'CM', 27, 70, 'SCO'],
      ['Grimes', 'CM', 27, 72, 'ENG'], ['Downes', 'CM', 24, 71, 'ENG'],
      ['Piroe', 'ST', 24, 74, 'NED'], ['Obafemi', 'ST', 23, 72, 'IRL'],
      ['Paterson', 'CAM', 29, 71, 'SCO'], ['Cullen', 'CM', 24, 71, 'ENG'],
      ['Latibeaudiere', 'CB', 23, 70, 'JAM'], ['Williams', 'RW', 22, 70, 'ENG'],
      ['Cooper', 'CB', 31, 71, 'ENG'], ['Burns', 'RW', 25, 70, 'ENG'],
      ['Whittaker', 'LW', 25, 70, 'ENG'], ['Sharpe', 'RW', 22, 69, 'ENG'],
      ['Gyokeres', 'ST', 25, 78, 'SWE']
    ])
  },
  {
    id: 'snd', name: 'Sunderland', short: 'SUN', color: '#EB172B', colorAlt: '#FFFFFF',
    prestige: 57, budget: 13005000, stadium: 'Stadium of Light', capacity: 49000,
    squad: generateSquad([
      ['Patterson', 'GK', 27, 71, 'ENG'], ['Bass', 'GK', 28, 68, 'ENG'],
      ['Hume', 'RB', 21, 70, 'NIR'], ['Wright', 'CB', 22, 72, 'ENG'],
      ['Ballard', 'CB', 24, 72, 'NIR'], ['Cirkin', 'LB', 21, 71, 'ENG'],
      ['Neil', 'CDM', 35, 68, 'ENG'], ['Ekwah', 'CM', 21, 72, 'FRA'],
      ['Evans', 'CM', 25, 70, 'ENG'], ['Roberts', 'CM', 28, 70, 'ENG'],
      ['Clarke', 'CAM', 23, 74, 'ENG'], ['Stewart', 'CAM', 23, 73, 'ENG'],
      ['Embleton', 'CAM', 24, 71, 'ENG'], ['Amad', 'RW', 21, 74, 'CIV'],
      ['Rigg', 'CM', 19, 71, 'ENG'], ['Greenwood', 'ST', 24, 72, 'ENG'],
      ['Burstow', 'ST', 20, 70, 'ENG'], ['Ba', 'LW', 24, 70, 'SEN'],
      ['Browne', 'CM', 30, 70, 'IRL'], ['Dunne', 'CB', 24, 70, 'IRL'],
      ['O Nien', 'CM', 31, 70, 'ENG']
    ])
  },
  {
    id: 'nor', name: 'Norwich City', short: 'NOR', color: '#00A650', colorAlt: '#FFF200',
    prestige: 60, budget: 18000000, stadium: 'Carrow Road', capacity: 27359,
    squad: generateSquad([
      ['Krul', 'GK', 35, 73, 'NED'], ['Gunn', 'GK', 28, 72, 'ENG'],
      ['Aarons', 'RB', 24, 76, 'ENG'], ['Williams', 'RB', 23, 70, 'ENG'],
      ['Gibson', 'CB', 28, 73, 'ENG'], ['Hanley', 'CB', 32, 73, 'SCO'],
      ['Giannoulis', 'LB', 27, 71, 'GRE'], ['Byram', 'LB', 29, 70, 'ENG'],
      ['Sargent', 'CM', 23, 73, 'USA'], ['McLean', 'CM', 28, 71, 'SCO'],
      ['Springett', 'CM', 20, 70, 'ENG'], ['Sara', 'CAM', 21, 72, 'POR'],
      ['Idah', 'ST', 23, 74, 'IRL'], ['Pukki', 'ST', 33, 73, 'FIN'],
      ['Rashica', 'RW', 27, 72, 'KOS'], ['Lund', 'LW', 23, 71, 'DEN'],
      ['Placheta', 'RW', 26, 70, 'CZE'], ['Dowell', 'CAM', 26, 70, 'ENG'],
      ['Borja Sainz', 'RW', 22, 74, 'ESP'], ['Nunez', 'LW', 24, 70, 'URU'],
      ['Kieran Dowell', 'CAM', 26, 71, 'ENG']
    ])
  },
  {
    id: 'qpr', name: 'QPR', short: 'QPR', color: '#1D5BA4', colorAlt: '#FFFFFF',
    prestige: 52, budget: 6480000, stadium: 'Loftus Road', capacity: 18360,
    squad: generateSquad([
      ['Dieng', 'GK', 27, 71, 'SEN'], ['Archer', 'GK', 28, 68, 'ENG'],
      ['Kakay', 'RB', 25, 69, 'GUI'], ['Bonne', 'CB', 27, 69, 'ZIM'],
      ['Dickie', 'CB', 26, 71, 'ENG'], ['McAvoy', 'LB', 22, 68, 'ENG'],
      ['Field', 'CDM', 27, 69, 'ENG'], ['Chair', 'CM', 25, 71, 'MAR'],
      ['Dozzell', 'CM', 23, 71, 'ENG'], ['Willock', 'CM', 27, 70, 'ENG'],
      ['Armstrong', 'CAM', 21, 69, 'ENG'], ['Thomas', 'RW', 22, 69, 'ENG'],
      ['Dykes', 'ST', 28, 72, 'SCO'], ['Adomah', 'RW', 35, 65, 'GHA'],
      ['Gubbins', 'ST', 21, 68, 'ENG'], ['Barbet', 'CB', 31, 70, 'FRA'],
      ['Johansen', 'CM', 31, 70, 'NOR'], ['Smyth', 'LW', 26, 68, 'NIR'],
      ['Kelman', 'ST', 21, 68, 'ENG'], ['Dreher', 'GK', 25, 65, 'ENG'],
      ['Roberts', 'CAM', 27, 70, 'ENG']
    ])
  },
  {
    id: 'car', name: 'Cardiff City', short: 'CAR', color: '#0070B5', colorAlt: '#FFFFFF',
    prestige: 54, budget: 8820000, stadium: 'Cardiff City Stadium', capacity: 33316,
    squad: generateSquad([
      ['Phillips', 'GK', 31, 70, 'ENG'], ['Smithies', 'GK', 33, 68, 'ENG'],
      ['Ng', 'RB', 26, 69, 'HKG'], ['Nelson', 'CB', 24, 70, 'ENG'],
      ['Flint', 'CB', 32, 71, 'ENG'], ['Bagan', 'LB', 23, 68, 'SCO'],
      ['Ralls', 'CDM', 30, 70, 'ENG'], ['Rinomhota', 'CM', 26, 70, 'ZIM'],
      ['Pack', 'CM', 31, 70, 'ENG'], ['Vaulks', 'CM', 30, 70, 'SCO'],
      ['Colwill', 'CM', 21, 72, 'ENG'], ['Harris', 'RW', 28, 70, 'ENG'],
      ['Hugill', 'ST', 31, 70, 'ENG'], ['Collins', 'ST', 30, 71, 'WAL'],
      ['Doyle', 'RW', 20, 70, 'ENG'], ['Bacuna', 'CM', 31, 70, 'CUW'],
      ['Drameh', 'RB', 22, 70, 'ENG'], ['Sawyers', 'CM', 32, 69, 'ENG'],
      ['Ikpeazu', 'ST', 27, 68, 'NGA'], ['Bowen', 'LW', 23, 69, 'ENG'],
      ['Ojo', 'RW', 25, 69, 'ENG']
    ])
  },
  {
    id: 'bla', name: 'Blackburn Rovers', short: 'BLA', color: '#009EE0', colorAlt: '#FFFFFF',
    prestige: 55, budget: 10125000, stadium: 'Ewood Park', capacity: 31367,
    squad: generateSquad([
      ['Kaminski', 'GK', 31, 71, 'BEL'], ['Pears', 'GK', 26, 68, 'ENG'],
      ['Brittain', 'RB', 25, 69, 'ENG'], ['Wharton', 'CB', 21, 70, 'ENG'],
      ['Hyam', 'CB', 28, 71, 'ENG'], ['Pickering', 'LB', 26, 69, 'ENG'],
      ['Rankin-Costello', 'CM', 24, 70, 'ENG'], ['Travis', 'CDM', 24, 72, 'ENG'],
      ['Dolan', 'CM', 23, 70, 'ENG'], ['Buckley', 'CM', 23, 69, 'ENG'],
      ['Gallagher', 'CAM', 22, 70, 'ENG'], ['Brereton Diaz', 'RW', 24, 73, 'CHI'],
      ['Poveda', 'LW', 23, 71, 'COL'], ['Rothwell', 'CM', 27, 70, 'ENG'],
      ['Hedges', 'CAM', 29, 69, 'SCO'], ['Kasumu', 'CM', 22, 69, 'ENG'],
      ['Szmodics', 'CAM', 27, 72, 'ENG'], ['Ayala', 'CB', 33, 70, 'ESP'],
      ['Maehle', 'RB', 27, 73, 'DEN'], ['Dale', 'LW', 21, 69, 'ENG'],
      ['Markanday', 'RW', 22, 68, 'ENG']
    ])
  },
  {
    id: 'pre', name: 'Preston North End', short: 'PRE', color: '#FFFFFF', colorAlt: '#000000',
    prestige: 52, budget: 6480000, stadium: 'Deepdale', capacity: 23408,
    squad: generateSquad([
      ['Woodman', 'GK', 27, 71, 'ENG'], ['Cornell', 'GK', 32, 67, 'WAL'],
      ['Storey', 'RB', 27, 69, 'ENG'], ['Lindsay', 'CB', 29, 70, 'SCO'],
      ['Bauer', 'CB', 30, 70, 'SUI'], ['Hughes', 'LB', 27, 69, 'WAL'],
      ['McCann', 'CDM', 27, 70, 'NIR'], ['Whiteman', 'CM', 26, 70, 'ENG'],
      ['Johnson', 'CM', 25, 69, 'ENG'], ['Ledson', 'CM', 27, 69, 'ENG'],
      ['Brady', 'CAM', 31, 72, 'IRL'], ['Browne', 'CAM', 27, 70, 'IRL'],
      ['Maguire', 'RW', 30, 71, 'ENG'], ['Cunningham', 'LW', 25, 69, 'ENG'],
      ['Archer', 'ST', 23, 72, 'ENG'], ['Riis', 'ST', 25, 69, 'DEN'],
      ['Parrott', 'ST', 22, 71, 'IRL'], ['Potts', 'RB', 29, 69, 'ENG'],
      ['Evans', 'CB', 27, 69, 'WAL'], ['Pistola', 'LW', 22, 68, 'ENG'],
      ['Olosunde', 'RB', 25, 68, 'USA']
    ])
  },
  {
    id: 'sht', name: 'Sheffield Wednesday', short: 'SHW', color: '#003082', colorAlt: '#FFFFFF',
    prestige: 56, budget: 11520000, stadium: 'Hillsborough', capacity: 39812,
    squad: generateSquad([
      ['Wildsmith', 'GK', 29, 70, 'ENG'], ['Stockdale', 'GK', 39, 65, 'ENG'],
      ['Palmer', 'RB', 33, 68, 'ENG'], ['Iorfa', 'CB', 27, 70, 'ENG'],
      ['Ihiekwe', 'CB', 30, 70, 'ENG'], ['Lees', 'CB', 32, 70, 'ENG'],
      ['Johnson', 'LB', 30, 69, 'ENG'], ['Vaulks', 'CM', 30, 70, 'SCO'],
      ['Windass', 'CM', 34, 69, 'ENG'], ['Bannan', 'CAM', 32, 73, 'SCO'],
      ['Dele Alli', 'CAM', 28, 73, 'ENG'], ['Paterson', 'CM', 29, 70, 'SCO'],
      ['Adeniran', 'CM', 24, 69, 'ENG'], ['Berahino', 'ST', 30, 68, 'BDI'],
      ['Windass', 'ST', 30, 70, 'ENG'], ['Kamberi', 'ST', 29, 69, 'ALB'],
      ['Barry', 'LW', 24, 70, 'ENG'], ['Chalobah', 'CM', 23, 69, 'ENG'],
      ['Dielna', 'CB', 35, 67, 'FRA'], ['Smith', 'RB', 25, 68, 'ENG'],
      ['Mendez-Laing', 'RW', 31, 68, 'ENG']
    ])
  },
  {
    id: 'mil', name: 'Millwall', short: 'MIL', color: '#001D5E', colorAlt: '#FFFFFF',
    prestige: 50, budget: 4500000, stadium: 'The Den', capacity: 20146,
    squad: generateSquad([
      ['Long', 'GK', 33, 70, 'IRL'], ['King', 'GK', 29, 67, 'ENG'],
      ['McNamara', 'RB', 21, 69, 'ENG'], ['Ballard', 'CB', 24, 71, 'NIR'],
      ['Cooper', 'CB', 28, 71, 'ENG'], ['Leonard', 'LB', 22, 68, 'ENG'],
      ['Mitchell', 'CDM', 27, 70, 'ENG'], ['Shackleton', 'CM', 25, 69, 'ENG'],
      ['Saville', 'CM', 30, 70, 'NIR'], ['Wallace', 'CM', 25, 69, 'ENG'],
      ['Bradshaw', 'CAM', 27, 70, 'ENG'], ['Malone', 'LB', 27, 69, 'ENG'],
      ['Afobe', 'ST', 30, 69, 'ENG'], ['Bodvarsson', 'ST', 30, 68, 'ISL'],
      ['Bennett', 'RW', 27, 69, 'ENG'], ['Smith', 'LW', 29, 68, 'ENG'],
      ['Woods', 'CAM', 30, 68, 'ENG'], ['Flemming', 'CM', 23, 69, 'CAN'],
      ['Rowles', 'CB', 25, 68, 'AUS'], ['Hackett-Fairchild', 'ST', 23, 68, 'ENG'],
      ['Honeyman', 'CM', 29, 69, 'ENG']
    ])
  },
  {
    id: 'hud', name: 'Huddersfield Town', short: 'HUD', color: '#0E63AD', colorAlt: '#FFFFFF',
    prestige: 48, budget: 2880000, stadium: 'John Smith Stadium', capacity: 24169,
    squad: generateSquad([
      ['Nicholls', 'GK', 31, 68, 'ENG'], ['Chapman', 'GK', 24, 64, 'ENG'],
      ['Turton', 'RB', 29, 67, 'ENG'], ['Lees', 'CB', 32, 69, 'ENG'],
      ['Pearson', 'CB', 34, 68, 'ENG'], ['Toffolo', 'LB', 28, 72, 'ENG'],
      ['Hogg', 'CDM', 31, 68, 'ENG'], ['Russell', 'CM', 28, 68, 'SCO'],
      ['Kasim', 'CM', 26, 66, 'ENG'], ['Wiles', 'CM', 24, 67, 'ENG'],
      ['Thomas', 'CAM', 21, 68, 'WAL'], ['Sorba Thomas', 'RW', 23, 69, 'WAL'],
      ['Ward', 'LW', 27, 67, 'ENG'], ['Rhodes', 'ST', 33, 68, 'ENG'],
      ['Gelhardt', 'ST', 21, 71, 'ENG'], ['Holmes', 'RW', 27, 67, 'ENG'],
      ['Anjorin', 'CM', 22, 69, 'ENG'], ['Helik', 'CB', 27, 67, 'POL'],
      ['High', 'CM', 25, 66, 'ENG'], ['Edmonds-Green', 'CB', 24, 67, 'ENG'],
      ['Sinani', 'CAM', 27, 67, 'KOS']
    ])
  },
  {
    id: 'cov', name: 'Coventry City', short: 'COV', color: '#59CBE8', colorAlt: '#FFFFFF',
    prestige: 55, budget: 10125000, stadium: 'CBS Arena', capacity: 32609,
    squad: generateSquad([
      ['Wilson', 'GK', 36, 69, 'ENG'], ['Moore', 'GK', 27, 67, 'ENG'],
      ['Tavares', 'RB', 22, 70, 'POR'], ['Hyam', 'CB', 28, 71, 'ENG'],
      ['McFadzean', 'CB', 35, 68, 'SCO'], ['Bidwell', 'LB', 31, 69, 'ENG'],
      ['Sheaf', 'CDM', 24, 70, 'ENG'], ['Palmer', 'CM', 19, 73, 'ENG'],
      ['Eccles', 'CM', 26, 68, 'ENG'], ['Hamer', 'CM', 26, 70, 'ENG'],
      ['Allen', 'CM', 34, 70, 'WAL'], ['Godden', 'ST', 29, 70, 'ENG'],
      ['Gyokeres', 'ST', 25, 78, 'SWE'], ['Waghorn', 'ST', 33, 68, 'ENG'],
      ['Dabo', 'RW', 29, 68, 'FRA'], ['Simms', 'ST', 22, 70, 'ENG'],
      ['Temple', 'LW', 21, 68, 'ENG'], ['Bapaga', 'LW', 19, 67, 'ENG'],
      ['Maatsen', 'LB', 21, 74, 'NED'], ['Dowell', 'CAM', 26, 70, 'ENG'],
      ['Ostigard', 'CB', 23, 71, 'NOR']
    ])
  },
  {
    id: 'sto', name: 'Stoke City', short: 'STO', color: '#E03A3E', colorAlt: '#FFFFFF',
    prestige: 57, budget: 13005000, stadium: 'bet365 Stadium', capacity: 30089,
    squad: generateSquad([
      ['Bonham', 'GK', 29, 69, 'ENG'], ['Davies', 'GK', 34, 67, 'ENG'],
      ['Wilmot', 'RB', 22, 68, 'ENG'], ['Jagielka', 'CB', 41, 65, 'ENG'],
      ['Chester', 'CB', 34, 69, 'ENG'], ['Tymon', 'LB', 25, 69, 'ENG'],
      ['Thompson', 'CDM', 24, 68, 'ENG'], ['Smallbone', 'CM', 23, 70, 'IRL'],
      ['Baker', 'CM', 28, 69, 'ENG'], ['Chalobah', 'CM', 23, 70, 'ENG'],
      ['Powell', 'CAM', 24, 71, 'ENG'], ['Vrancic', 'CM', 34, 70, 'BOS'],
      ['Delap', 'ST', 20, 73, 'ENG'], ['Brown', 'ST', 22, 70, 'ENG'],
      ['Balogun', 'ST', 25, 71, 'ENG'], ['Doughty', 'LW', 25, 69, 'ENG'],
      ['Lowe', 'LW', 23, 69, 'ENG'], ['Campbell', 'RW', 29, 69, 'IRL'],
      ['Kilkenny', 'CM', 22, 68, 'AUS'], ['Ostigard', 'CB', 23, 71, 'NOR'],
      ['Mantalos', 'CAM', 30, 68, 'GRE']
    ])
  },
  {
    id: 'wat', name: 'Watford', short: 'WAT', color: '#FBEE23', colorAlt: '#ED2127',
    prestige: 58, budget: 14580000, stadium: 'Vicarage Road', capacity: 22200,
    squad: generateSquad([
      ['Bachmann', 'GK', 29, 71, 'AUT'], ['Foster', 'GK', 40, 66, 'ENG'],
      ['Femenia', 'RB', 31, 72, 'ESP'], ['Kabasele', 'CB', 32, 72, 'BEL'],
      ['Cathcart', 'CB', 34, 71, 'NIR'], ['Masina', 'LB', 30, 70, 'MAR'],
      ['Etebo', 'CDM', 28, 71, 'NGA'], ['Chalobah', 'CM', 23, 71, 'ENG'],
      ['Cleverley', 'CM', 33, 69, 'ENG'], ['Sierralta', 'CB', 25, 69, 'CHI'],
      ['Joao Pedro', 'ST', 22, 73, 'BRA'], ['Dennis', 'ST', 24, 72, 'NGA'],
      ['Sarr', 'LW', 25, 74, 'SEN'], ['Kalu', 'RW', 27, 70, 'NGA'],
      ['Success', 'ST', 27, 69, 'NGA'], ['Gray', 'RW', 28, 72, 'ENG'],
      ['Sissoko', 'CM', 34, 71, 'FRA'], ['Hughes', 'CM', 28, 69, 'WAL'],
      ['Gosling', 'CM', 34, 67, 'ENG'], ['Louza', 'CM', 24, 71, 'MAR'],
      ['Hoedt', 'CB', 30, 70, 'NED']
    ])
  },
  {
    id: 'bri2', name: 'Bristol City', short: 'BSC', color: '#E3001B', colorAlt: '#FFFFFF',
    prestige: 50, budget: 4500000, stadium: 'Ashton Gate', capacity: 27000,
    squad: generateSquad([
      ['Bentley', 'GK', 30, 69, 'ENG'], ['O Leary', 'GK', 24, 65, 'ENG'],
      ['Dasilva', 'RB', 25, 70, 'ENG'], ['Atkinson', 'CB', 25, 70, 'ENG'],
      ['Tanner', 'CB', 23, 69, 'ENG'], ['Manning', 'LB', 24, 70, 'IRL'],
      ['Scott', 'CDM', 27, 70, 'ENG'], ['Nagy', 'CM', 27, 69, 'HUN'],
      ['Bakinson', 'CM', 24, 68, 'ENG'], ['Bell', 'CM', 22, 68, 'ENG'],
      ['Weimann', 'CAM', 31, 71, 'AUT'], ['Martin', 'CM', 34, 68, 'ENG'],
      ['James', 'ST', 26, 70, 'ENG'], ['Diedhiou', 'ST', 30, 70, 'SEN'],
      ['Semenyo', 'RW', 24, 72, 'GHA'], ['Paterson', 'CAM', 29, 70, 'SCO'],
      ['Vyner', 'RB', 25, 69, 'ENG'], ['Towler', 'CB', 22, 68, 'ENG'],
      ['Wells', 'ST', 33, 68, 'ENG'], ['Kalas', 'CB', 31, 70, 'CZE'],
      ['Massengo', 'CM', 22, 70, 'FRA']
    ])
  },
  {
    id: 'rot', name: 'Rotherham United', short: 'ROT', color: '#FF0000', colorAlt: '#FFFFFF',
    prestige: 45, budget: 1125000, stadium: 'AESSEAL New York Stadium', capacity: 12022,
    squad: generateSquad([
      ['Johansson', 'GK', 27, 67, 'SWE'], ['Vickers', 'GK', 28, 65, 'ENG'],
      ['Huffer', 'RB', 25, 65, 'ENG'], ['Ihiekwe', 'CB', 30, 67, 'ENG'],
      ['Wood', 'CB', 27, 67, 'ENG'], ['Peltier', 'LB', 35, 65, 'ENG'],
      ['Wiles', 'CDM', 24, 67, 'ENG'], ['Twell', 'CM', 28, 65, 'ENG'],
      ['Ogbene', 'RW', 26, 70, 'IRL'], ['Barlaser', 'CM', 26, 67, 'ENG'],
      ['Bramall', 'LB', 27, 66, 'ENG'], ['Kayode', 'ST', 27, 67, 'ENG'],
      ['Grigg', 'ST', 32, 66, 'NIR'], ['Ferguson', 'ST', 28, 66, 'ENG'],
      ['Lofthouse', 'RW', 24, 65, 'ENG'], ['Lindsay', 'CM', 23, 65, 'ENG'],
      ['Miller', 'CM', 21, 65, 'ENG'], ['Humphreys', 'CB', 21, 66, 'ENG'],
      ['Rathbone', 'CM', 25, 66, 'ENG'], ['Wing', 'RW', 30, 64, 'ENG'],
      ['Smith', 'ST', 32, 65, 'ENG']
    ])
  }
];

// Build lookup maps
const ALL_TEAMS = [...PREMIER_LEAGUE_TEAMS, ...CHAMPIONSHIP_TEAMS];
const TEAM_MAP = {};
ALL_TEAMS.forEach(t => TEAM_MAP[t.id] = t);

const LEAGUES = {
  premier: {
    id: 'premier', name: 'Premier League', country: 'england', tier: 1,
    teams: PREMIER_LEAGUE_TEAMS.map(t => t.id),
    promotionSpots: 0, relegationSpots: 3, promotionPlayoff: 0
  },
  championship: {
    id: 'championship', name: 'EFL Championship', country: 'england', tier: 2,
    teams: CHAMPIONSHIP_TEAMS.map(t => t.id),
    promotionSpots: 2, relegationSpots: 3, promotionPlayoff: 4
  }
};

// ─── COUNTRY CONFIG ────────────────────────────────────────────────────────────
const COUNTRY_CONFIG = {
  england:  { div1: 'premier',       div2: 'championship', cup: 'FA Cup',           flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', euroLeague: true },
  spain:    { div1: 'la_liga',       div2: 'la_liga2',     cup: 'Copa del Rey',     flag: '🇪🇸', euroLeague: true },
  italy:    { div1: 'serie_a',       div2: 'serie_b',      cup: 'Coppa Italia',     flag: '🇮🇹', euroLeague: true },
  germany:  { div1: 'bundesliga',    div2: 'bundesliga2',  cup: 'DFB-Pokal',        flag: '🇩🇪', euroLeague: true },
  portugal: { div1: 'liga_portugal', div2: null,           cup: 'Taça de Portugal', flag: '🇵🇹', euroLeague: true  },
};

// ─── INTERNATIONAL NAME POOLS ─────────────────────────────────────────────────
const NAMES_ESP = {
  first: ['Carlos','Javier','Miguel','Alejandro','Diego','Sergio','Raúl','Fernando','Pedro','Marcos','Álvaro','David','Íñigo','Iker','Andrés','Borja','Mikel','Unai','Jon','Adri','Pablo','Rodrigo','Víctor','Lucas','Eric','Marc'],
  last: ['García','Martínez','López','González','Rodríguez','Sánchez','Pérez','Hernández','Torres','Flores','Silva','Díaz','Castro','Moreno','Jiménez','Ruiz','Alonso','Ortega','Navarro','Molina','Delgado','Ramos','Suárez','Iglesias','Romero']
};
const NAMES_ITA = {
  first: ['Marco','Andrea','Luca','Francesco','Alessandro','Matteo','Lorenzo','Davide','Simone','Federico','Riccardo','Antonio','Stefano','Alberto','Nicola','Roberto','Gianluca','Giorgio','Fabio','Manuel','Daniele','Emanuele','Claudio','Luigi','Vincenzo'],
  last: ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Greco','Marino','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Moretti','Barbieri','Fontana','Santoro','Marini','Caruso']
};
const NAMES_GER = {
  first: ['Maximilian','Lukas','Jonas','Felix','Leon','Moritz','Tim','Julian','Noah','Luca','Finn','Paul','Niklas','Stefan','Benjamin','Tobias','Philipp','Sebastian','Thomas','Daniel','Florian','Markus','Christian','Alexander','Fabian'],
  last: ['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann','Braun','Zimmermann','Hartmann','Krause','Wolf','Richter','Klein','Neumann','Schwarz','Lange','Kaiser','Fuchs','Koch','Lehmann','Haas']
};
const NAMES_POR = {
  first: ['João','Pedro','Ricardo','Rui','Bruno','Tiago','Luís','Nuno','André','Miguel','Gonçalo','Diogo','Rafael','Bernardo','Renato','Fábio','Hugo','Jorge','Paulo','Hélder','Sérgio','Cristiano','Domingos','Rafa','Vitinha'],
  last: ['Silva','Santos','Costa','Pereira','Ferreira','Rodrigues','Sousa','Carvalho','Gomes','Lopes','Marques','Mendes','Alves','Monteiro','Correia','Pinto','Neves','Cunha','Vieira','Fernandes','Teixeira','Rocha','Dias','Figueiredo','Simões']
};
const NAMES_ENG = {
  first: ['James','Harry','Jack','Oliver','George','Charlie','Thomas','Jacob','Oscar','William','Archie','Joshua','Freddie','Alfie','Henry','Ethan','Alexander','Daniel','Samuel','Mason','Lucas','Logan','Ryan','Nathan','Aaron'],
  last: ['Smith','Jones','Brown','Taylor','Wilson','Johnson','Davies','Evans','Walker','Thompson','White','Hall','Harris','Lewis','Robinson','Martin','Jackson','Clarke','Moore','Wright','Wood','Hughes','Green','Adams','Roberts']
};

function makeNameFor(country) {
  const pools = { spain: NAMES_ESP, italy: NAMES_ITA, germany: NAMES_GER, portugal: NAMES_POR, england: NAMES_ENG };
  const pool = pools[country] || NAMES_ENG;
  return pool.first[Math.floor(Math.random() * pool.first.length)] + ' ' +
         pool.last[Math.floor(Math.random() * pool.last.length)];
}

// ─── PROCEDURAL SQUAD GENERATOR ───────────────────────────────────────────────
// Used by international league data files (not EPL which has hand-crafted players)
const SQUAD_TEMPLATE = ['GK','GK','CB','CB','CB','RB','LB','CDM','CM','CM','CAM','LW','RW','ST','ST','CB','RB','CM','LW','ST','GK'];
const NATION_BY_COUNTRY = { england: 'ENG', spain: 'ESP', italy: 'ITA', germany: 'GER', portugal: 'POR' };

function makeTeamSquad(prestige, country) {
  const avgOvr = Math.max(56, Math.min(90, Math.round(prestige * 0.5 + 38)));
  const nation = NATION_BY_COUNTRY[country] || 'ENG';
  // Mix ~70% domestic + 30% international players
  const intlNations = ['BRA','ARG','FRA','ENG','ESP','ITA','GER','POR','NED','BEL','SEN','GHA','NGA','CRO','SUI'];
  return SQUAD_TEMPLATE.map(pos => {
    const age = Math.floor(Math.random() * 14) + 19;
    const spread = Math.round((Math.random() - 0.5) * 18);
    const ovr = Math.max(56, Math.min(99, avgOvr + spread));
    const playerNation = Math.random() < 0.68 ? nation : intlNations[Math.floor(Math.random() * intlNations.length)];
    const name = Math.random() < 0.68 ? makeNameFor(country) : (NAMES_ENG.first[Math.floor(Math.random()*NAMES_ENG.first.length)] + ' ' + NAMES_ENG.last[Math.floor(Math.random()*NAMES_ENG.last.length)]);
    return makePlayer(pid(), name, pos, age, ovr, playerNation);
  });
}

// Free agent pool for transfers
const FREE_AGENTS = generateSquad([
  // ── Goalkeepers ──
  ['Joe Hart', 'GK', 38, 66, 'ENG'],
  ['Ben Foster', 'GK', 41, 65, 'ENG'],
  ['Brad Guzan', 'GK', 40, 66, 'USA'],
  ['Darren Randolph', 'GK', 37, 67, 'IRL'],
  ['Lee Grant', 'GK', 40, 62, 'ENG'],
  ['Adam Bogdan', 'GK', 36, 60, 'HUN'],
  ['Petr Cech', 'GK', 42, 72, 'CZE'],
  ['Tim Howard', 'GK', 45, 67, 'USA'],
  ['Robert Green', 'GK', 44, 63, 'ENG'],
  ['Paul Robinson', 'GK', 45, 64, 'ENG'],
  // ── Centre Backs ──
  ['James Collins', 'CB', 37, 63, 'WAL'],
  ['Phil Jagielka', 'CB', 42, 65, 'ENG'],
  ['Michael Dawson', 'CB', 41, 63, 'ENG'],
  ['John Terry', 'CB', 43, 67, 'ENG'],
  ['Matthew Upson', 'CB', 44, 62, 'ENG'],
  ['Ryan Shawcross', 'CB', 37, 66, 'ENG'],
  ['Gary Cahill', 'CB', 39, 71, 'ENG'],
  ['Joleon Lescott', 'CB', 42, 66, 'ENG'],
  ['Sylvain Distin', 'CB', 47, 64, 'FRA'],
  ['Richard Dunne', 'CB', 46, 64, 'IRL'],
  ['Bruno Alves', 'CB', 43, 68, 'POR'],
  ['Nicolas Otamendi', 'CB', 37, 72, 'ARG'],
  ['Luca Caldirola', 'CB', 33, 65, 'ITA'],
  ['Wes Brown', 'CB', 46, 62, 'ENG'],
  ['Brede Hangeland', 'CB', 43, 65, 'NOR'],
  ['Younes Kaboul', 'CB', 39, 67, 'FRA'],
  // ── Right Backs ──
  ['Nathaniel Clyne', 'RB', 33, 67, 'ENG'],
  ['Daryl Janmaat', 'RB', 35, 67, 'NED'],
  ['Glen Johnson', 'RB', 41, 63, 'ENG'],
  ['Rafael da Silva', 'RB', 34, 68, 'BRA'],
  ['Carl Jenkinson', 'RB', 33, 63, 'ENG'],
  ['Pablo Zabaleta', 'RB', 43, 68, 'ARG'],
  ['Bacary Sagna', 'RB', 42, 67, 'FRA'],
  ['Micah Richards', 'RB', 37, 65, 'ENG'],
  ['Phil Bardsley', 'RB', 39, 63, 'SCO'],
  // ── Left Backs ──
  ['Robbie Brady', 'LB', 32, 67, 'IRL'],
  ['Leighton Baines', 'LB', 41, 66, 'ENG'],
  ['Stephen Ward', 'LB', 39, 63, 'IRL'],
  ['Luke Shaw', 'LB', 30, 72, 'ENG'],
  ['Enda Stevens', 'LB', 35, 65, 'IRL'],
  ['Patrice Evra', 'LB', 44, 67, 'FRA'],
  ['Ashley Cole', 'LB', 44, 66, 'ENG'],
  ['Gael Clichy', 'LB', 40, 67, 'FRA'],
  ['Kieran Gibbs', 'LB', 35, 66, 'ENG'],
  ['Martin Olsson', 'LB', 37, 65, 'SWE'],
  // ── Defensive Midfielders ──
  ['Claudio Yacob', 'CDM', 36, 63, 'ARG'],
  ['Liam Bridcutt', 'CDM', 35, 63, 'SCO'],
  ['Scott Arfield', 'CDM', 37, 65, 'CAN'],
  ['Cheikhou Kouyate', 'CDM', 35, 68, 'SEN'],
  ['Victor Wanyama', 'CDM', 33, 68, 'NGA'],
  ['Mohamed Elneny', 'CDM', 33, 69, 'EGY'],
  ['Nigel de Jong', 'CDM', 40, 67, 'NED'],
  ['Michael Carrick', 'CDM', 44, 69, 'ENG'],
  ['Lassana Diarra', 'CDM', 40, 66, 'FRA'],
  ['Gareth Barry', 'CDM', 44, 67, 'ENG'],
  // ── Central Midfielders ──
  ['Tom Cleverley', 'CM', 35, 66, 'ENG'],
  ['Jack Wilshere', 'CM', 33, 65, 'ENG'],
  ['Craig Bryson', 'CM', 37, 63, 'SCO'],
  ['Steven Nzonzi', 'CM', 37, 68, 'FRA'],
  ['Lucas Leiva', 'CM', 38, 67, 'BRA'],
  ['Charlie Adam', 'CM', 39, 67, 'SCO'],
  ['Lee Cattermole', 'CM', 38, 64, 'ENG'],
  ['Kevin Nolan', 'CM', 44, 63, 'ENG'],
  ['Stephane Sessegnon', 'CM', 40, 62, 'SEN'],
  ['Nuri Sahin', 'CM', 36, 68, 'TUR'],
  // ── Attacking Midfielders ──
  ['Nacer Chadli', 'CAM', 36, 68, 'BEL'],
  ['Adnan Januzaj', 'CAM', 30, 68, 'BEL'],
  ['Andros Townsend', 'CAM', 34, 68, 'ENG'],
  ['Tom Ince', 'CAM', 34, 65, 'ENG'],
  ['Hatem Ben Arfa', 'CAM', 38, 70, 'FRA'],
  ['Josh McEachran', 'CAM', 33, 63, 'ENG'],
  ['Antonio Cassano', 'CAM', 43, 70, 'ITA'],
  ['Diego Forlan', 'CAM', 46, 65, 'URU'],
  ['Emre Mor', 'CAM', 28, 65, 'TUR'],
  // ── Right Wingers ──
  ['Yannick Bolasie', 'RW', 35, 65, 'COD'],
  ['Florent Malouda', 'RW', 44, 60, 'FRA'],
  ['Theo Walcott', 'RW', 36, 67, 'ENG'],
  ['Aaron Lennon', 'RW', 37, 65, 'ENG'],
  ['Nani', 'RW', 38, 70, 'POR'],
  ['Shaun Wright-Phillips', 'RW', 43, 65, 'ENG'],
  ['Stevan Jovetic', 'RW', 35, 70, 'SRB'],
  ['Juan Cuadrado', 'RW', 37, 73, 'COL'],
  ['David Bentley', 'RW', 40, 63, 'ENG'],
  // ── Left Wingers ──
  ['Scott Sinclair', 'LW', 35, 64, 'ENG'],
  ['Nicolas Anelka', 'LW', 46, 65, 'FRA'],
  ['Peter Odemwingie', 'LW', 43, 65, 'NGA'],
  ['Nathan Dyer', 'LW', 38, 63, 'ENG'],
  ['Adam Johnson', 'LW', 37, 66, 'ENG'],
  ['Chris Brunt', 'LW', 39, 63, 'ENG'],
  ['Marvin Sordell', 'LW', 34, 62, 'ENG'],
  ['Stewart Downing', 'LW', 39, 66, 'ENG'],
  ['Stephen Ireland', 'LW', 38, 63, 'IRL'],
  // ── Strikers ──
  ['Andy Carroll', 'ST', 36, 63, 'ENG'],
  ['Daryl Murphy', 'ST', 38, 61, 'IRL'],
  ['Victor Anichebe', 'ST', 35, 60, 'NGA'],
  ['Leon Best', 'ST', 37, 60, 'IRL'],
  ['Marcus Bent', 'ST', 44, 58, 'ENG'],
  ['Fraizer Campbell', 'ST', 37, 61, 'ENG'],
  ['Kevin Doyle', 'ST', 41, 62, 'IRL'],
  ['Carlton Cole', 'ST', 41, 62, 'ENG'],
  ['Bobby Zamora', 'ST', 44, 61, 'ENG'],
  ['Jay Rodriguez', 'ST', 35, 68, 'ENG'],
  ['Simon Cox', 'ST', 38, 62, 'ENG'],
  ['Shane Long', 'ST', 38, 65, 'IRL'],
  ['Robbie Keane', 'ST', 45, 68, 'IRL'],
  ['Emile Heskey', 'ST', 47, 63, 'ENG'],
  ['Demba Ba', 'ST', 39, 69, 'SEN'],
  ['Daniel Sturridge', 'ST', 31, 72, 'ENG'],
  ['Peter Crouch', 'ST', 45, 64, 'ENG'],
  ['Kevin Davies', 'ST', 48, 62, 'ENG'],
  ['Nicky Maynard', 'ST', 37, 62, 'ENG'],
  ['Gyorgy Sandor', 'ST', 33, 63, 'HUN'],
  ['Nikica Jelavic', 'ST', 40, 67, 'CRO']
]);

const NATIONALITIES = {
  ENG: 'English', FRA: 'French', GER: 'German', ESP: 'Spanish', ITA: 'Italian',
  BRA: 'Brazilian', ARG: 'Argentine', POR: 'Portuguese', NED: 'Dutch', BEL: 'Belgian',
  SCO: 'Scottish', WAL: 'Welsh', IRL: 'Irish', NOR: 'Norwegian', SWE: 'Swedish',
  DEN: 'Danish', CRO: 'Croatian', SUI: 'Swiss', GHA: 'Ghanaian', NGA: 'Nigerian',
  SEN: 'Senegalese', COL: 'Colombian', URU: 'Uruguayan', CHI: 'Chilean', ECU: 'Ecuadorean',
  MEX: 'Mexican', USA: 'American', KOR: 'South Korean', JPN: 'Japanese', MAR: 'Moroccan',
  EGY: 'Egyptian', CIV: 'Ivorian', CMR: 'Cameroonian', AUT: 'Austrian', GRE: 'Greek',
  CZE: 'Czech', SRB: 'Serbian', TUR: 'Turkish', UKR: 'Ukrainian', POL: 'Polish',
  HUN: 'Hungarian', FIN: 'Finnish', ISL: 'Icelandic', ZAM: 'Zambian', ZIM: 'Zimbabwean',
  ALG: 'Algerian', MLI: 'Malian', GUI: 'Guinean', GAB: 'Gabonese', COD: 'Congolese',
  CAN: 'Canadian', AUS: 'Australian', NZL: 'New Zealander', JAM: 'Jamaican', BFA: 'Burkinabe',
  NIR: 'Northern Irish', PAR: 'Paraguayan', KOS: 'Kosovar', SRB: 'Serbian', BOS: 'Bosnian',
  BDI: 'Burundian', ALB: 'Albanian', CHI: 'Chilean', SKO: 'Scottish', SEN: 'Senegalese'
};

function getTeam(id) { return TEAM_MAP[id]; }
function getAllTeams() { return ALL_TEAMS; }
function getPLTeams() { return PREMIER_LEAGUE_TEAMS; }
function getChampionshipTeams() { return CHAMPIONSHIP_TEAMS; }
function getLeague(id) { return LEAGUES[id]; }
