// 설치 화면 동작. preload 가 연 window.installer 기능만 쓴다.
const api = window.installer;
const $ = (id) => document.getElementById(id);
const ORDER = ['check', 'account', 'settings', 'installing', 'done'];

function show(step) {
  document.querySelectorAll('.step').forEach((section) => {
    section.hidden = section.dataset.step !== step;
  });
  const index = Math.min(ORDER.indexOf(step), 3);
  $('progress-bar').style.width = `${((index + 1) / 4) * 100}%`;
  const firstInput = document.querySelector(`[data-step="${step}"] input`);
  if (firstInput) firstInput.focus();
}

async function checkDocker() {
  const card = $('docker-card');
  card.className = 'card';
  card.textContent = '확인하는 중…';
  const result = await api.check();
  const { docker } = result;
  $('docker-install').hidden = docker.state === 'ready';
  $('docker-recheck').hidden = docker.state === 'ready';
  $('to-account').disabled = docker.state !== 'ready';
  if (docker.state === 'ready') {
    card.className = 'card ok';
    card.textContent = `Docker ${docker.version} 가 켜져 있어요.`;
  } else if (docker.state === 'not-installed') {
    card.className = 'card warn';
    card.textContent =
      'Docker 가 없어요. 설치 안내를 열어 Docker 를 설치하고 켠 뒤 "다시 확인"을 눌러 주세요.';
  } else {
    card.className = 'card warn';
    card.textContent =
      'Docker 가 설치돼 있지만 꺼져 있어요. Docker 를 켠 뒤 "다시 확인"을 눌러 주세요.';
  }
  if (!$('port').value) $('port').value = result.defaults.port;
  if (!$('data-dir').value) $('data-dir').value = result.defaults.dataDir;
}

$('docker-install').addEventListener('click', () => api.openDockerInstall());
$('docker-recheck').addEventListener('click', checkDocker);
$('to-account').addEventListener('click', () => show('account'));
document.querySelectorAll('[data-back]').forEach((button) => {
  button.addEventListener('click', () => show(button.dataset.back));
});

$('to-settings').addEventListener('click', () => {
  const email = $('admin-email').value.trim();
  const password = $('admin-password').value;
  const problems = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    problems.push('이메일 형식을 확인해 주세요.');
  if (password.length < 12) problems.push('비밀번호는 12자 이상이어야 해요.');
  if (password !== $('admin-password-confirm').value)
    problems.push('비밀번호 확인이 달라요.');
  $('account-error').textContent = problems.join('\n');
  if (problems.length === 0) show('settings');
});

$('choose-dir').addEventListener('click', async () => {
  const chosen = await api.chooseDir();
  if (chosen) $('data-dir').value = chosen;
});

api.onProgress(({ step, state }) => {
  const item = document.querySelector(`[data-item="${step}"]`);
  if (item) item.className = state;
});

$('install').addEventListener('click', async () => {
  $('settings-error').textContent = '';
  $('install-error').textContent = '';
  $('install-retry').hidden = true;
  document.querySelectorAll('[data-item]').forEach((item) => {
    item.className = '';
  });
  $('installing-title').textContent = '설치하고 있어요';
  show('installing');
  const result = await api.install({
    adminEmail: $('admin-email').value.trim(),
    adminPassword: $('admin-password').value,
    port: Number($('port').value),
    dataDir: $('data-dir').value.trim(),
    startAtLogin: $('start-at-login').checked,
    anthropicApiKey: $('anthropic-key').value,
    openaiApiKey: $('openai-key').value,
  });
  if (result.ok) {
    $('done-url').textContent = result.url;
    show('done');
    return;
  }
  $('installing-title').textContent = '설치를 마치지 못했어요';
  $('install-error').textContent = result.error;
  $('install-retry').hidden = false;
});

$('install-retry').addEventListener('click', () => show('settings'));
$('finish').addEventListener('click', () => api.finish());

void checkDocker();
