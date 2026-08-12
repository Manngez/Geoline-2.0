'use strict';

// State Capitals learning mode for Geoline 2.0.
// Uses a fixed local data set so all 50 capitals are fast, unambiguous and classroom-safe.
const STATE_CAPITALS = [
  ['Montgomery','Alabama','AL',32.3777,-86.3006],
  ['Juneau','Alaska','AK',58.3019,-134.4197],
  ['Phoenix','Arizona','AZ',33.4484,-112.0740],
  ['Little Rock','Arkansas','AR',34.7465,-92.2896],
  ['Sacramento','California','CA',38.5816,-121.4944],
  ['Denver','Colorado','CO',39.7392,-104.9903],
  ['Hartford','Connecticut','CT',41.7658,-72.6734],
  ['Dover','Delaware','DE',39.1582,-75.5244],
  ['Tallahassee','Florida','FL',30.4383,-84.2807],
  ['Atlanta','Georgia','GA',33.7490,-84.3880],
  ['Honolulu','Hawaii','HI',21.3070,-157.8584],
  ['Boise','Idaho','ID',43.6150,-116.2023],
  ['Springfield','Illinois','IL',39.7980,-89.6440],
  ['Indianapolis','Indiana','IN',39.7684,-86.1581],
  ['Des Moines','Iowa','IA',41.5868,-93.6250],
  ['Topeka','Kansas','KS',39.0473,-95.6752],
  ['Frankfort','Kentucky','KY',38.2009,-84.8777],
  ['Baton Rouge','Louisiana','LA',30.4515,-91.1871],
  ['Augusta','Maine','ME',44.3106,-69.7795],
  ['Annapolis','Maryland','MD',38.9784,-76.4922],
  ['Boston','Massachusetts','MA',42.3601,-71.0589],
  ['Lansing','Michigan','MI',42.7325,-84.5555],
  ['Saint Paul','Minnesota','MN',44.9537,-93.0900],
  ['Jackson','Mississippi','MS',32.2988,-90.1848],
  ['Jefferson City','Missouri','MO',38.5767,-92.1735],
  ['Helena','Montana','MT',46.5891,-112.0391],
  ['Lincoln','Nebraska','NE',40.8136,-96.7026],
  ['Carson City','Nevada','NV',39.1638,-119.7674],
  ['Concord','New Hampshire','NH',43.2081,-71.5376],
  ['Trenton','New Jersey','NJ',40.2171,-74.7429],
  ['Santa Fe','New Mexico','NM',35.6870,-105.9378],
  ['Albany','New York','NY',42.6526,-73.7562],
  ['Raleigh','North Carolina','NC',35.7796,-78.6382],
  ['Bismarck','North Dakota','ND',46.8083,-100.7837],
  ['Columbus','Ohio','OH',39.9612,-82.9988],
  ['Oklahoma City','Oklahoma','OK',35.4676,-97.5164],
  ['Salem','Oregon','OR',44.9429,-123.0351],
  ['Harrisburg','Pennsylvania','PA',40.2732,-76.8867],
  ['Providence','Rhode Island','RI',41.8240,-71.4128],
  ['Columbia','South Carolina','SC',34.0007,-81.0348],
  ['Pierre','South Dakota','SD',44.3683,-100.3510],
  ['Nashville','Tennessee','TN',36.1627,-86.7816],
  ['Austin','Texas','TX',30.2672,-97.7431],
  ['Salt Lake City','Utah','UT',40.7608,-111.8910],
  ['Montpelier','Vermont','VT',44.2601,-72.5754],
  ['Richmond','Virginia','VA',37.5407,-77.4360],
  ['Olympia','Washington','WA',47.0379,-122.9007],
  ['Charleston','West Virginia','WV',38.3498,-81.6326],
  ['Madison','Wisconsin','WI',43.0731,-89.4012],
  ['Cheyenne','Wyoming','WY',41.1400,-104.8202]
].map(([name,state,stateCode,lat,lon]) => ({
  name, state, stateCode, lat, lon,
  displayName: `${name} — capital of ${state}`,
  isStateCapital: true
}));

const STATE_CAPITAL_ALIASES = new Map([
  ['st paul','Saint Paul'],
  ['st paul mn','Saint Paul'],
  ['saint paul mn','Saint Paul']
]);

function stateCapitalsModeActive() {
  return game.challengeMode === 'capitals' ||
    (game.mode === 'classroom' && game.classroomSettings?.capitalsOnly === true);
}

function capitalForms(capital) {
  return [
    normalizeText(capital.name),
    normalizeText(`${capital.name} ${capital.stateCode}`),
    normalizeText(`${capital.name} ${capital.state}`)
  ];
}

function findStateCapital(query) {
  let q = normalizeText(query);
  const alias = STATE_CAPITAL_ALIASES.get(q);
  if (alias) q = normalizeText(alias);
  return STATE_CAPITALS.filter(capital => capitalForms(capital).includes(q));
}

function isStateCapitalPlace(place) {
  const name = normalizeText(place?.name || '');
  const code = String(place?.stateCode || '').toUpperCase();
  return STATE_CAPITALS.some(capital =>
    normalizeText(capital.name) === name && capital.stateCode === code
  );
}

const geolineCitiesGeocodePlace = geocodePlace;
geocodePlace = async function geocodeCapitalAware(query) {
  if (!stateCapitalsModeActive()) return geolineCitiesGeocodePlace(query);
  return findStateCapital(query).map(capital => ({...capital}));
};

const geolineCitiesSuggestions = updateSuggestions;
updateSuggestions = function updateCapitalAwareSuggestions() {
  if (!stateCapitalsModeActive()) return geolineCitiesSuggestions();
  const q = normalizeText(els.cityInput?.value || '');
  if (q.length < 1 || els.cityInput.disabled) return hideSuggestions();

  const matches = STATE_CAPITALS
    .filter(capital => {
      const haystack = normalizeText(`${capital.name} ${capital.state} ${capital.stateCode}`);
      return haystack.startsWith(q) || haystack.includes(q);
    })
    .slice(0, 8);

  if (!matches.length) return hideSuggestions();
  els.suggestions.innerHTML = '';
  matches.forEach(capital => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion-button';
    button.innerHTML = `<strong>${escapeHtml(capital.name)}, ${escapeHtml(capital.stateCode)}</strong> <small>— ${escapeHtml(capital.state)}</small>`;
    button.addEventListener('click', () => {
      els.cityInput.value = `${capital.name}, ${capital.stateCode}`;
      hideSuggestions();
      els.cityInput.focus();
    });
    els.suggestions.appendChild(button);
  });
  els.suggestions.classList.remove('hidden');
};

const geolineCitiesSubmit = onCitySubmit;
onCitySubmit = async function onCapitalAwareSubmit(event) {
  if (!stateCapitalsModeActive()) return geolineCitiesSubmit(event);

  event.preventDefault();
  const query = els.cityInput.value.trim();
  if (!query || game.finished) return;
  if ((game.mode === 'online' || game.mode === 'classroom') && game.currentIndex !== game.myPlayerIndex) {
    return showToast('Wait for your turn.', 'error');
  }

  els.submitCityButton.disabled = true;
  els.submitCityButton.textContent = 'Checking…';
  try {
    const results = await geocodePlace(query);
    if (!results.length) {
      return showToast(`“${query}” is not one of the 50 U.S. state capitals.`, 'error', 4200);
    }
    submitResolvedPlace(results[0]);
  } finally {
    els.submitCityButton.textContent = 'Play';
    updateGameUI();
  }
};

const geolineCitiesUpdateGameUI = updateGameUI;
updateGameUI = function updateCapitalAwareGameUI() {
  geolineCitiesUpdateGameUI();

  const label = els.cityForm?.querySelector('label[for="cityInput"]');
  const hint = els.cityForm?.querySelector('.form-hint');
  if (!stateCapitalsModeActive()) {
    if (label) label.textContent = 'Enter a U.S. city or town';
    if (hint) hint.textContent = 'Press Play to look up the place. Suggestions are local and do not send requests while you type.';
    return;
  }

  if (label) label.textContent = 'Enter a U.S. state capital';
  if (hint) hint.textContent = 'Only the 50 state capitals are valid. Suggestions stay on this device.';
  if (!els.cityInput.disabled) els.cityInput.placeholder = 'e.g. Austin, TX';
  els.routeCount.textContent = `${game.route.length} ${game.route.length === 1 ? 'capital' : 'capitals'}`;
  if (game.mode !== 'classroom') els.mapBadgeText.textContent = 'State Capitals';
};

const geolineOriginalResetClassroomControls = resetClassroomControls;
resetClassroomControls = function resetClassroomControlsWithCapitals() {
  geolineOriginalResetClassroomControls();
  game.classroomSettings.capitalsOnly = false;
};

const geolineOriginalValidateClassroomPlace = validateClassroomPlace;
validateClassroomPlace = function validateClassroomCapital(place) {
  const originalError = geolineOriginalValidateClassroomPlace(place);
  if (originalError) return originalError;
  if (game.classroomSettings?.capitalsOnly && !isStateCapitalPlace(place)) {
    return 'Only U.S. state capitals are allowed in this classroom.';
  }
  return null;
};

renderClassroomHostForm = function renderCapitalClassroomHostForm() {
  els.onlineEyebrow.textContent = 'Classroom mode';
  els.onlineTitle.textContent = 'Teacher setup';
  els.onlinePanel.innerHTML = `
    <div class="online-field">
      <label for="classGameVariant">Geography set</label>
      <select id="classGameVariant">
        <option value="cities">U.S. Cities & Towns</option>
        <option value="capitals">State Capitals — all 50</option>
      </select>
    </div>
    <button id="createClassButton" class="primary-button wide" type="button">Create classroom →</button>
    <div class="classroom-note">Choose State Capitals to make only the 50 state capitals playable. Up to eight teams can join.</div>`;
  $('createClassButton').addEventListener('click', createClassroomRoom);
};

const geolineOriginalCreateClassroomRoom = createClassroomRoom;
createClassroomRoom = function createCapitalAwareClassroomRoom() {
  const capitalsOnly = $('classGameVariant')?.value === 'capitals';
  geolineOriginalCreateClassroomRoom();
  game.classroomSettings.capitalsOnly = capitalsOnly;
  if ($('onlineScreen')?.classList.contains('active')) renderClassroomLobby();
};

const geolineOriginalRenderClassroomLobby = renderClassroomLobby;
renderClassroomLobby = function renderCapitalAwareClassroomLobby() {
  geolineOriginalRenderClassroomLobby();
  if (!game.classroomSettings?.capitalsOnly) return;
  els.onlineTitle.textContent = 'State Capitals classroom';
  const note = document.createElement('div');
  note.className = 'classroom-note';
  note.innerHTML = '<strong>State Capitals:</strong> only the 50 U.S. state capitals are valid answers.';
  els.onlinePanel.insertBefore(note, $('startClassButton'));
};

const geolineOriginalRefreshTeacherControls = refreshTeacherControls;
refreshTeacherControls = function refreshCapitalTeacherControls() {
  geolineOriginalRefreshTeacherControls();
  if (game.onlineRole !== 'teacher' || !game.classroomSettings?.capitalsOnly) return;
  const small = $('teacherControls')?.querySelector('.teacher-controls-head small');
  if (small) small.textContent = `${game.roomCode || ''} · State Capitals`;
};

function restorePlayerSetupCopy() {
  const screen = $('playersScreen');
  const eyebrow = screen?.querySelector('.eyebrow');
  const heading = screen?.querySelector('h2');
  if (eyebrow) eyebrow.textContent = 'Pass & Play';
  if (heading) heading.textContent = 'Who is playing?';
  if (els.startLocalButton) els.startLocalButton.textContent = 'Start game →';
}

function installStateCapitalsModeCard() {
  const grid = document.querySelector('#setupScreen .mode-grid');
  if (!grid || document.getElementById('stateCapitalsModeCard')) return;

  const card = document.createElement('button');
  card.id = 'stateCapitalsModeCard';
  card.className = 'mode-card featured';
  card.type = 'button';
  card.innerHTML = `
    <span class="mode-icon">🏛️</span>
    <span class="mode-copy"><strong>State Capitals</strong><small>Connect only the 50 state capitals</small></span>
    <span class="mode-arrow">→</span>`;

  const classroomCard = grid.querySelector('.classroom-card');
  grid.insertBefore(card, classroomCard || null);

  card.addEventListener('click', () => {
    game.challengeMode = 'capitals';
    buildPlayerInputs();
    const screen = $('playersScreen');
    const eyebrow = screen?.querySelector('.eyebrow');
    const heading = screen?.querySelector('h2');
    if (eyebrow) eyebrow.textContent = 'State Capitals';
    if (heading) heading.textContent = 'Who is playing?';
    els.startLocalButton.textContent = 'Start State Capitals →';
    showScreen('players');
  });
}

document.addEventListener('click', event => {
  const modeButton = event.target.closest?.('[data-mode]');
  if (!modeButton) return;
  game.challengeMode = 'cities';
  if (modeButton.dataset.mode === 'local') restorePlayerSetupCopy();
}, true);

document.addEventListener('DOMContentLoaded', () => {
  game.challengeMode = game.challengeMode || 'cities';
  installStateCapitalsModeCard();
});
