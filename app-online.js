function updateSuggestions() {
  const q = normalizeText(els.cityInput.value);
  if (q.length < 2 || els.cityInput.disabled) return hideSuggestions();
  const starts = COMMON_PLACES.filter(p => normalizeText(p).startsWith(q));
  const contains = COMMON_PLACES.filter(p => !normalizeText(p).startsWith(q) && normalizeText(p).includes(q));
  const matches = [...starts,...contains].slice(0,7);
  if (!matches.length) return hideSuggestions();
  els.suggestions.innerHTML='';
  matches.forEach(name => {
    const b=document.createElement('button'); b.type='button'; b.className='suggestion-button'; b.textContent=name;
    b.addEventListener('click', () => { els.cityInput.value=name; hideSuggestions(); els.cityInput.focus(); });
    els.suggestions.appendChild(b);
  });
  els.suggestions.classList.remove('hidden');
}
function hideSuggestions() { els.suggestions?.classList.add('hidden'); }

function normalizePhotoPolicy(value) {
  return ['off','optional','required'].includes(value) ? value : 'optional';
}
function sanitizePlayerPhoto(value) {
  if (typeof value!=='string' || value.length>220000) return null;
  return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null;
}
function stopPlayerPhotoCamera() {
  if (game.playerPhotoStream) {
    try { game.playerPhotoStream.getTracks().forEach(track=>track.stop()); } catch {}
    game.playerPhotoStream=null;
  }
}
function renderJoinWaiting(title='You are in', text='Waiting for the host to start the game…') {
  stopPlayerPhotoCamera();
  els.onlineEyebrow.textContent='Connected';
  els.onlineTitle.textContent=title;
  els.onlinePanel.innerHTML=`<div class="connection-pill connected">${escapeHtml(text)}</div><p class="form-hint">Keep this page open while you wait.</p>`;
}
function showPlayerPhotoPrompt({policy='optional',recipient='the host',onSubmit}) {
  const photoPolicy=normalizePhotoPolicy(policy), required=photoPolicy==='required';
  stopPlayerPhotoCamera();
  els.onlineEyebrow.textContent='Player photo';
  els.onlineTitle.textContent=required?'Photo required to join':'Add a player photo';
  els.onlinePanel.innerHTML=`
    <div style="display:grid;gap:14px">
      <div class="classroom-note"><strong>${required?'A player photo is required for this room.':'A player photo is optional.'}</strong><br>The camera starts only when you press <strong>Start camera</strong>. Your photo is sent directly to ${escapeHtml(recipient)} for this room.</div>
      <div id="playerPhotoStage" style="display:grid;place-items:center;min-height:210px;border:1px solid rgba(255,255,255,.12);border-radius:18px;overflow:hidden;background:rgba(3,12,24,.72)">
        <div id="playerPhotoPlaceholder" style="padding:28px;text-align:center;opacity:.8">Camera is off</div>
        <video id="playerPhotoVideo" playsinline muted style="display:none;width:100%;max-height:340px;object-fit:cover"></video>
        <img id="playerPhotoPreview" alt="Your player photo preview" style="display:none;width:100%;max-height:340px;object-fit:cover" />
      </div>
      <button id="startPlayerCamera" class="primary-button wide" type="button">📷 Start camera</button>
      <button id="takePlayerPhoto" class="primary-button wide hidden" type="button">Take photo</button>
      <button id="usePlayerPhoto" class="primary-button wide hidden" type="button">Use photo & join →</button>
      <button id="retakePlayerPhoto" class="secondary-button wide hidden" type="button">Take another photo</button>
      ${required?'':`<button id="skipPlayerPhoto" class="secondary-button wide" type="button">Continue without photo</button>`}
      <p class="form-hint">The photo is resized on your device before it is sent. Geoline does not add it to the shared route or game state.</p>
    </div>`;

  const video=$('playerPhotoVideo'), preview=$('playerPhotoPreview'), placeholder=$('playerPhotoPlaceholder');
  const startButton=$('startPlayerCamera'), takeButton=$('takePlayerPhoto'), useButton=$('usePlayerPhoto'), retakeButton=$('retakePlayerPhoto');
  let capturedPhoto=null;

  const startCamera=async()=>{
    if(!navigator.mediaDevices?.getUserMedia) return showToast('Camera access is not available in this browser.','error',5000);
    stopPlayerPhotoCamera();
    capturedPhoto=null;preview.style.display='none';video.style.display='block';placeholder.style.display='none';
    useButton.classList.add('hidden');retakeButton.classList.add('hidden');startButton.classList.add('hidden');takeButton.classList.remove('hidden');
    try {
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:640}},audio:false});
      game.playerPhotoStream=stream;video.srcObject=stream;await video.play();
    } catch(err) {
      console.error(err);stopPlayerPhotoCamera();video.style.display='none';placeholder.style.display='block';placeholder.textContent='Camera access was not granted.';startButton.classList.remove('hidden');takeButton.classList.add('hidden');
      showToast(required?'Camera permission is needed to join this room with a photo.':'Camera permission was not granted. You can continue without a photo.','error',5000);
    }
  };

  startButton.addEventListener('click',startCamera);
  takeButton.addEventListener('click',()=>{
    if(!video.videoWidth || !video.videoHeight) return showToast('Camera is still starting. Try again.','error');
    const size=Math.min(video.videoWidth,video.videoHeight), sx=(video.videoWidth-size)/2, sy=(video.videoHeight-size)/2;
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
    const ctx=canvas.getContext('2d');ctx.drawImage(video,sx,sy,size,size,0,0,320,320);
    capturedPhoto=sanitizePlayerPhoto(canvas.toDataURL('image/jpeg',.68));
    if(!capturedPhoto) return showToast('Could not prepare the photo. Try again.','error');
    stopPlayerPhotoCamera();video.srcObject=null;video.style.display='none';preview.src=capturedPhoto;preview.style.display='block';takeButton.classList.add('hidden');useButton.classList.remove('hidden');retakeButton.classList.remove('hidden');
  });
  useButton.addEventListener('click',()=>{ if(capturedPhoto){stopPlayerPhotoCamera();onSubmit(capturedPhoto);} });
  retakeButton.addEventListener('click',startCamera);
  $('skipPlayerPhoto')?.addEventListener('click',()=>{stopPlayerPhotoCamera();onSubmit(null);});
}

function buildPlayerInputs(names=['Player 1','Player 2']) {
  els.playerInputs.innerHTML='';
  names.forEach((name,i) => addPlayerInput(name,i));
  updatePlayerTools();
}
function addPlayerInput(name='', index=null) {
  const count=els.playerInputs.children.length;
  if (count>=4) return;
  const i=index ?? count;
  const row=document.createElement('div'); row.className='player-input-row';
  row.innerHTML=`<span class="player-number">${i+1}</span><input maxlength="24" value="${escapeHtml(name || `Player ${i+1}`)}" aria-label="Player ${i+1} name"><button class="remove-player" type="button" aria-label="Remove player">×</button>`;
  row.querySelector('.remove-player').addEventListener('click', () => { if (els.playerInputs.children.length>2) { row.remove(); renumberPlayers(); updatePlayerTools(); } });
  els.playerInputs.appendChild(row);
}
function renumberPlayers() { [...els.playerInputs.children].forEach((row,i)=>{row.querySelector('.player-number').textContent=i+1; row.querySelector('input').setAttribute('aria-label',`Player ${i+1} name`);}); }
function updatePlayerTools() { const n=els.playerInputs.children.length; els.playerCountHint.textContent=`${n} of 4 players`; els.addPlayerButton.disabled=n>=4; }
function getLocalPlayers() { return [...els.playerInputs.querySelectorAll('input')].map((input,i)=>({name:input.value.trim() || `Player ${i+1}`})); }

function destroyOnline() {
  stopPlayerPhotoCamera();
  if (game.classroomTimerId) clearInterval(game.classroomTimerId);
  (game.classConnections || []).forEach(item => { try { (item.conn || item).close(); } catch {} });
  try { game.conn?.close(); } catch {}
  try { game.peer?.destroy(); } catch {}
  game.peer=null;game.conn=null;game.connected=false;game.onlineRole=null;game.myPlayerIndex=null;game.roomCode=null;game.classConnections=[];game.classroomPaused=false;game.classroomPendingMove=null;game.classroomRoundEnded=null;game.classroomTimerRemaining=0;game.classroomTimerId=null;
  game.playerPhotoPolicy='optional';game.remotePlayerPhoto=null;game.photoJoinStarted=false;
  $('teacherControls')?.remove();
}
function sendMessage(payload) { if (game.conn?.open) { try { game.conn.send(payload); } catch {} } }
function publicState() { return {players:game.players,currentIndex:game.currentIndex,route:game.route,finished:game.finished,classroomPaused:game.classroomPaused,resultPayload}; }
function sendSync() { sendMessage({type:'sync', state:publicState()}); }
function consumeState(s) {
  game.players=s.players||game.players; game.currentIndex=s.currentIndex||0; game.route=s.route||[]; game.finished=!!s.finished; game.classroomPaused=!!s.classroomPaused;
  if (s.classroomSettings) game.classroomSettings={...game.classroomSettings,...s.classroomSettings};
  if (s.classroomScores) game.classroomScores=s.classroomScores;
  game.classroomRoundEnded=s.classroomRoundEnded||null; game.classroomTimerRemaining=Number(s.classroomTimerRemaining)||0; resultPayload=s.resultPayload||null;
  renderMapState(); updateGameUI(); if (game.route.length) fitRoute();
  if (game.classroomRoundEnded && typeof showClassroomRoundSummary==='function') showClassroomRoundSummary(game.classroomRoundEnded);
  else if (game.finished && resultPayload) showResult(); else els.resultModal.classList.add('hidden');
}
function sendGuestHello(photo=null) {
  sendMessage({type:'hello',name:game.players[1]?.name||'Guest',photo:sanitizePlayerPhoto(photo)});
  renderJoinWaiting('Joined room',`Connected as ${game.players[1]?.name||'Guest'} — waiting for the host`);
}
function wireConnection(conn, role) {
  game.conn=conn;
  conn.on('open',()=>{
    game.connected=true;updateGameUI();
    if(role==='guest') sendMessage({type:'photoPolicyRequest'});
    else sendMessage({type:'photoPolicy',policy:normalizePhotoPolicy(game.playerPhotoPolicy)});
  });
  conn.on('close',()=>{ game.connected=false; stopPlayerPhotoCamera(); updateGameUI(); if ($('gameScreen').classList.contains('active')) showToast('Online connection closed.','error',5000); });
  conn.on('error',()=>{ game.connected=false; stopPlayerPhotoCamera(); updateGameUI(); showToast('Online connection error.','error'); });
  conn.on('data', data => handlePeerData(data,role));
}
function handlePeerData(data, role) {
  if (!data || typeof data!=='object') return;
  if (role==='host') {
    if (data.type==='photoPolicyRequest') {
      sendMessage({type:'photoPolicy',policy:normalizePhotoPolicy(game.playerPhotoPolicy)});
    } else if (data.type==='hello') {
      const photo=sanitizePlayerPhoto(data.photo);
      if(normalizePhotoPolicy(game.playerPhotoPolicy)==='required' && !photo) return sendMessage({type:'photoRequired'});
      game.remotePlayerPhoto=photo;
      game.players[1]={name:String(data.name||'Guest').slice(0,24)}; game.connected=true;
      renderHostWaiting(true); sendMessage({type:'welcome',playerIndex:1,state:publicState()});
    } else if (data.type==='moveRequest') {
      if (data.playerIndex!==1) return;
      const result=applyMove(data.place,1);
      if (!result.ok) sendMessage({type:'moveRejected',reason:result.reason});
    } else if (data.type==='resetRequest') {
      resetGameState(true); sendMessage({type:'reset',state:publicState()});
    }
  } else {
    if (data.type==='photoPolicy') {
      if(game.photoJoinStarted)return;
      game.photoJoinStarted=true;game.playerPhotoPolicy=normalizePhotoPolicy(data.policy);
      if(game.playerPhotoPolicy==='off') sendGuestHello(null);
      else showPlayerPhotoPrompt({policy:game.playerPhotoPolicy,recipient:'the host',onSubmit:sendGuestHello});
    } else if(data.type==='photoRequired') {
      game.photoJoinStarted=true;game.playerPhotoPolicy='required';showToast('This room requires a player photo to join.','error',5000);
      showPlayerPhotoPrompt({policy:'required',recipient:'the host',onSubmit:sendGuestHello});
    } else if (data.type==='welcome') { game.myPlayerIndex=data.playerIndex; if(data.state) consumeState(data.state); }
    else if (data.type==='start') { consumeState(data.state); showScreen('game'); initMap(); updateGameUI(); }
    else if (data.type==='sync') consumeState(data.state);
    else if (data.type==='moveRejected') { showToast(data.reason||'Move rejected by host.','error'); updateGameUI(); }
    else if (data.type==='reset') { consumeState(data.state); els.resultModal.classList.add('hidden'); }
  }
}

function renderHostForm() {
  els.onlineEyebrow.textContent='Host online'; els.onlineTitle.textContent='Create a room';
  els.onlinePanel.innerHTML=`<div class="online-field"><label for="hostName">Your name</label><input id="hostName" maxlength="24" value="Player 1" /></div><div class="online-field"><label for="playerPhotoPolicy">Player photo when joining</label><select id="playerPhotoPolicy"><option value="off">Off</option><option value="optional" selected>Optional</option><option value="required">Required to join</option></select></div><button id="createRoomButton" class="primary-button wide" type="button">Create room →</button><p class="form-hint">If photos are enabled, the joining player is clearly asked before the camera starts. Photos are sent peer-to-peer for the current room.</p>`;
  $('createRoomButton').addEventListener('click', createOnlineRoom);
}
function renderHostWaiting(connected=false) {
  const policy=normalizePhotoPolicy(game.playerPhotoPolicy),photo=sanitizePlayerPhoto(game.remotePlayerPhoto);
  const photoCard=photo?`<div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:16px"><img src="${photo}" alt="${escapeHtml(game.players[1]?.name||'Opponent')} player photo" style="width:72px;height:72px;object-fit:cover;border-radius:16px"><div><small style="opacity:.7">Player photo</small><strong style="display:block">${escapeHtml(game.players[1]?.name||'Opponent')}</strong></div></div>`:(connected&&policy!=='off'?`<div class="classroom-note">${escapeHtml(game.players[1]?.name||'Opponent')} joined without a photo.</div>`:'');
  els.onlinePanel.innerHTML=`<div class="room-code-display"><div><div class="eyebrow">Room code</div><strong>${escapeHtml(game.roomCode||'------')}</strong></div><button id="copyRoomButton" class="secondary-button" type="button">Copy code</button></div><div class="connection-pill ${connected?'connected':''}">${connected ? `${escapeHtml(game.players[1]?.name||'Opponent')} connected` : 'Waiting for opponent…'}</div>${photoCard}<div class="classroom-note">Player photo: <strong>${policy==='off'?'Off':policy==='required'?'Required':'Optional'}</strong></div><button id="startOnlineButton" class="primary-button wide" type="button" ${connected?'':'disabled'}>Start game →</button><p class="form-hint">The room exists only while this page stays open. No Geoline account is required.</p>`;
  $('copyRoomButton').addEventListener('click', async()=>{ try { await navigator.clipboard.writeText(game.roomCode); $('copyRoomButton').textContent='Copied!'; } catch { showToast(`Room code: ${game.roomCode}`); } });
  $('startOnlineButton').addEventListener('click',()=>{ startGame('online',game.players); game.onlineRole='host'; game.myPlayerIndex=0; game.connected=true; sendMessage({type:'start',state:publicState()}); });
}
function createOnlineRoom() {
  if (!window.Peer) return showToast('Online library failed to load. Check your connection.','error');
  const photoPolicy=normalizePhotoPolicy($('playerPhotoPolicy')?.value);
  destroyOnline();
  const hostName=String($('hostName')?.value||'Player 1').trim().slice(0,24) || 'Player 1';
  game.mode='online'; game.onlineRole='host'; game.myPlayerIndex=0; game.players=[{name:hostName},{name:'Opponent'}]; game.roomCode=randomCode();game.playerPhotoPolicy=photoPolicy;game.remotePlayerPhoto=null;
  renderHostWaiting(false);
  const peer=new Peer(ROOM_PREFIX+game.roomCode.toLowerCase()); game.peer=peer;
  peer.on('open',()=>{});
  peer.on('connection',conn=>{ if(game.conn?.open){conn.close();return;} wireConnection(conn,'host'); });
  peer.on('error',err=>{ console.error(err); showToast(err.type==='unavailable-id'?'Room code collision. Go back and create a new room.':'Could not create online room.','error',5000); });
}
function renderJoinForm() {
  els.onlineEyebrow.textContent='Join online'; els.onlineTitle.textContent='Enter a room code';
  els.onlinePanel.innerHTML=`<div class="online-field"><label for="joinName">Your name</label><input id="joinName" maxlength="24" value="Player 2" /></div><div class="online-field"><label for="roomCodeInput">Six-character room code</label><input id="roomCodeInput" inputmode="text" maxlength="6" autocomplete="off" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:.16em;font-weight:900" /></div><button id="joinRoomButton" class="primary-button wide" type="button">Join room →</button><div id="joinConnectionStatus" class="connection-pill hidden">Connecting…</div><p class="form-hint">After connecting, you will be told whether the host has player photos turned off, optional or required. The camera never starts automatically.</p>`;
  $('joinRoomButton').addEventListener('click', joinOnlineRoom);
}
function joinOnlineRoom() {
  const code=String($('roomCodeInput').value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==6) return showToast('Enter the six-character room code.','error');
  if(!window.Peer) return showToast('Online library failed to load.','error');
  const guestName=String($('joinName').value||'Player 2').trim().slice(0,24)||'Player 2';
  destroyOnline(); game.mode='online'; game.onlineRole='guest';game.myPlayerIndex=1;game.roomCode=code;game.photoJoinStarted=false;
  game.players=[{name:'Host'},{name:guestName}];
  $('joinRoomButton').disabled=true; $('joinConnectionStatus').classList.remove('hidden');
  const peer=new Peer();game.peer=peer;
  peer.on('open',()=>{ const conn=peer.connect(ROOM_PREFIX+code.toLowerCase(),{reliable:true}); wireConnection(conn,'guest'); });
  peer.on('error',err=>{ console.error(err); $('joinRoomButton') && ($('joinRoomButton').disabled=false); $('joinConnectionStatus') && ($('joinConnectionStatus').textContent='Could not connect'); showToast('Could not join that room. Check the code and try again.','error',5000); });
}

function openOnline(mode) {
  showScreen('online');
  if(mode==='host') renderHostForm();
  else if(mode==='classroom-host') renderClassroomHostForm();
  else if(mode==='classroom-join') renderClassroomJoinForm();
  else renderJoinForm();
}

function bindEvents() {
  document.querySelectorAll('[data-screen]').forEach(btn=>btn.addEventListener('click',()=>showScreen(btn.dataset.screen)));
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    const mode=btn.dataset.mode;
    if(mode==='local'){ buildPlayerInputs(); showScreen('players'); }
    else if(mode==='solo'){ game.onlineRole=null;game.myPlayerIndex=0;startGame('solo',[{name:'Explorer'}]); }
    else openOnline(mode);
  }));
  els.addPlayerButton.addEventListener('click',()=>{ addPlayerInput();renumberPlayers();updatePlayerTools(); });
  els.startLocalButton.addEventListener('click',()=>{ destroyOnline(); startGame('local',getLocalPlayers()); });
  els.cityForm.addEventListener('submit',onCitySubmit);
  els.cityInput.addEventListener('input',updateSuggestions);
  els.cityInput.addEventListener('keydown',e=>{ if(e.key==='Escape')hideSuggestions(); });
  document.addEventListener('click',e=>{ if(!els.cityForm.contains(e.target)) hideSuggestions(); });
  els.fitRouteButton.addEventListener('click',fitRoute);
  els.quitGameButton.addEventListener('click',()=>{ destroyOnline(); resetGameState(false); showScreen('setup'); });
  els.cancelPlaceModal.addEventListener('click',closePlaceChooser);
  els.placeModal.addEventListener('click',e=>{if(e.target===els.placeModal)closePlaceChooser();});
  els.playAgainButton.addEventListener('click',()=>{
    if(game.mode==='online' && game.onlineRole==='guest'){ sendMessage({type:'resetRequest'}); els.resultModal.classList.add('hidden'); return; }
    if(game.mode==='classroom' && game.onlineRole==='team'){ showToast('Waiting for the teacher to start a new round.'); return; }
    if(game.mode==='classroom' && game.onlineRole==='teacher'){ startNewClassroomRound(); return; }
    resetGameState(true);
    if(game.mode==='online' && game.onlineRole==='host') sendMessage({type:'reset',state:publicState()});
    if(game.mode==='classroom' && game.onlineRole==='teacher') broadcastClassroom({type:'classReset',state:classroomState()});
  });
  els.resultHomeButton.addEventListener('click',()=>{ els.resultModal.classList.add('hidden'); destroyOnline(); resetGameState(false); showScreen('home'); });
  els.soundToggle.addEventListener('click',()=>{ game.sound=!game.sound; localStorage.setItem('geoline:sound',game.sound?'on':'off');updateSoundButton();tone('move'); });
  window.addEventListener('resize',()=>{ if(map) setTimeout(()=>map.invalidateSize(),80); });
}

function init() {
  ['soundToggle','playerInputs','addPlayerButton','playerCountHint','startLocalButton','onlineEyebrow','onlineTitle','onlinePanel','cityForm','cityInput','submitCityButton','suggestions','routeCount','routeList','currentPlayerName','turnDot','onlineStatus','fitRouteButton','quitGameButton','mapBadgeText','toast','placeModal','placeChoices','cancelPlaceModal','resultModal','resultIcon','resultTitle','resultText','resultRoute','playAgainButton','resultHomeButton'].forEach(id=>els[id]=$(id));
  updateSoundButton(); bindEvents(); buildPlayerInputs();
}

document.addEventListener('DOMContentLoaded',init);
