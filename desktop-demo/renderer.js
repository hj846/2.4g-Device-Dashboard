const $ = id => document.getElementById(id);
const icons = {
  LOGITECH: './assets/logitech.png',
  KEYCHRON: './assets/keychron.png',
  STEELSERIES: './assets/steelseries-hires.png',
  RAZER: './assets/razer.png'
};
const filters = ['全部设备', '需要关注', '已断开'];
let snapshot = { scenarioName: '加载中', devices: [] };
let filter = '全部设备';
let currentId = null;

function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2600);
}

function signalLabel(value) { return ['无信号', '很弱', '偏弱', '良好', '强'][value] || '未知'; }
function signalDots(value) {
  return `<span class="dots ${value > 0 && value < 3 ? 'weak' : ''}" aria-label="信号 ${value} 格">${[0, 1, 2, 3].map(index => `<i class="${index < value ? 'on' : ''}"></i>`).join('')}</span>`;
}

function card(device) {
  const battery = device.battery;
  const batteryStyle = battery === null ? 'depleted' : battery < 25 ? 'low' : '';
  const statusStyle = device.status === '已断开' ? 'off' : device.status === '需要关注' ? 'warn' : '';
  const iconStyle = device.brand === 'RAZER' || device.brand === 'steelseries' ? 'soft' : '';
  return `<article class="device" data-id="${device.id}" tabindex="0" role="button" aria-label="查看 ${device.model} 设备详情">
    <div class="card-head"><div class="logo ${iconStyle}"><img src="${iconFor(device.brand)}" alt="${device.brand} 标识"></div>
      <div><div class="brand">${device.brand}</div><div class="device-name">${device.model}</div></div>
      <div class="status ${statusStyle}">${device.status}</div></div>
    <div class="divider"></div>
    <div class="metrics">
      <div><div class="metric-label">电量</div><div class="metric-value"><span class="battery ${batteryStyle}" style="--level:${battery ?? 0}%"><span class="battery-fill"></span></span>${battery === null ? '未知' : `${battery}%`}</div></div>
      <div><div class="metric-label">信号</div><div class="metric-value">${signalDots(device.signal)}<span>${signalLabel(device.signal)}</span></div></div>
      <div><div class="metric-label">连接方式</div><div class="metric-value connection" title="${device.connection}">${device.connection}</div></div>
    </div>
    <div class="card-foot"><span>最近同步 · ${device.updated}</span><span class="open">查看详情 ↗</span></div>
  </article>`;
}

function iconFor(brand) {
  return ({ 'logitech G': icons.LOGITECH, Keychron: icons.KEYCHRON, steelseries: icons.STEELSERIES, RAZER: icons.RAZER })[brand];
}

function render() {
  const devices = snapshot.devices;
  const connected = devices.filter(device => device.status !== '已断开').length;
  const attention = devices.filter(device => device.status === '需要关注').length;
  $('overview').innerHTML = `
    <div class="summary"><div class="summary-label">在线设备</div><div class="summary-line"><span class="summary-value">${connected} / ${devices.length}</span><span class="summary-note">跨品牌统一显示</span></div></div>
    <div class="summary"><div class="summary-label">需要关注</div><div class="summary-line"><span class="summary-value">${attention}</span><span class="summary-note">电量或信号偏低</span></div></div>
    <div class="summary"><div class="summary-label">当前场景</div><div class="summary-line"><span class="summary-value" style="font-size:25px">${snapshot.scenarioName}</span><span class="summary-note">演示模式</span></div></div>`;
  $('filters').innerHTML = filters.map(name => `<button class="filter ${name === filter ? 'active' : ''}" data-filter="${name}">${name}</button>`).join('');
  $('filters').querySelectorAll('button').forEach(button => {
    button.onclick = () => { filter = button.dataset.filter; render(); };
  });
  const shown = devices.filter(device => filter === '全部设备' || device.status === filter);
  $('count').textContent = `${shown.length} 台`;
  $('deviceGrid').innerHTML = shown.length ? shown.map(card).join('') : `<div class="empty"><strong>${devices.length ? '当前筛选下没有设备' : '尚未发现设备'}</strong><p>切换演示场景可预览其他状态</p></div>`;
  $('deviceGrid').querySelectorAll('.device').forEach(element => {
    element.onclick = () => openDetail(element.dataset.id);
    element.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(element.dataset.id); }
    };
  });
}

function openDetail(id) {
  const device = snapshot.devices.find(item => item.id === id);
  if (!device) return;
  currentId = id;
  $('detailBrand').textContent = device.brand;
  $('detailTitle').textContent = device.model;
  $('detailSubtitle').textContent = `${device.kind} · ${device.status}`;
  $('detailGrid').innerHTML = [
    ['电量', device.battery === null ? '未知' : `${device.battery}%`],
    ['信号', signalLabel(device.signal)],
    ['连接', device.connection]
  ].map(([name, value]) => `<div class="detail-cell"><small>${name}</small><strong>${value}</strong></div>`).join('');
  const supportsDpi = device.capabilities.includes('dpi');
  const canWrite = supportsDpi && device.status !== '已断开';
  $('detailSection').innerHTML = supportsDpi ? `
    <h3>DPI 档位</h3><p>${canWrite ? '通过模拟设备适配器写入；关闭程序后恢复初始值。' : '设备已断开，当前无法切换。'}</p>
    <div class="dpi-list">${[800, 1200, 1600, 2400].map(value => `<button data-dpi="${value}" ${canWrite ? '' : 'disabled'} class="${value === device.dpi ? 'active' : ''}">${value} DPI</button>`).join('')}</div>`
    : '<h3>设备设置</h3><p>该型号暂不提供 DPI 调整能力。</p>';
  $('detailSection').querySelectorAll('[data-dpi]').forEach(button => {
    button.onclick = async () => {
      try {
        await window.deviceAPI.setDpi(id, Number(button.dataset.dpi));
        notify(`已切换至 ${button.dataset.dpi} DPI · 模拟设备`);
      } catch (error) { notify(error.message); }
    };
  });
  $('overlay').hidden = false;
  $('closeButton').focus();
}

$('closeButton').onclick = () => { $('overlay').hidden = true; currentId = null; };
$('overlay').onclick = event => { if (event.target === $('overlay')) $('closeButton').click(); };
document.onkeydown = event => { if (event.key === 'Escape') $('closeButton').click(); };
$('scenarioButton').onclick = async () => {
  try {
    filter = '全部设备';
    $('closeButton').click();
    snapshot = await window.deviceAPI.nextScenario();
    render();
  } catch (error) { notify(error.message); }
};
document.querySelectorAll('.icon-button, .brand-pill').forEach(button => {
  if (!button.id) button.onclick = () => notify('此处为界面演示，功能将在后续加入');
});
window.deviceAPI.onChanged(next => {
  snapshot = next;
  render();
  if (currentId) openDetail(currentId);
});
window.deviceAPI.snapshot().then(next => { snapshot = next; render(); }).catch(error => notify(error.message));
