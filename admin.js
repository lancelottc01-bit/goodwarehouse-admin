const API_URL = 'https://script.google.com/macros/s/AKfycbwtFAFOEYaZDBcJy-wM9ecy-gMY3nb9ZUljskdkNN3osyKu-R6H27Tp9D4yuxlsLiYjOg/exec';

let admin = JSON.parse(localStorage.getItem('goodwarehouse_admin') || 'null');
let currentOrders = [];
let currentPage = 'orders';

const $ = id => document.getElementById(id);
const money = n => Number(n || 0).toLocaleString('zh-TW');

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_callback_' + Math.random().toString(36).substring(2);
    const script = document.createElement('script');

    window[callbackName] = data => {
      resolve(data);
      delete window[callbackName];
      document.body.removeChild(script);
    };

    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName + '&t=' + Date.now();
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function adminLogin() {
  const account = $('account').value.trim();
  const password = $('password').value.trim();

  if (!account || !password) return alert('請輸入帳號密碼');

  const data = await jsonp(
    `${API_URL}?action=adminLogin&account=${encodeURIComponent(account)}&password=${encodeURIComponent(password)}`
  );

  if (!data.ok) return alert(data.message || '登入失敗');

  admin = data.admin;
  localStorage.setItem('goodwarehouse_admin', JSON.stringify(admin));
  startAdmin();
}

function startAdmin() {
  $('loginPage').classList.add('hidden');
  $('adminApp').classList.remove('hidden');
  $('adminName').textContent = admin.name;
  $('adminRole').textContent = admin.role === 'owner' ? '老闆' : '員工';

  if (admin.role !== 'owner') $('navDashboard').style.display = 'none';
  showOrders();
}

function logout() {
  localStorage.removeItem('goodwarehouse_admin');
  location.reload();
}

function refreshCurrentPage() {
  showOrders();
}

async function showDashboard() {
  if (admin.role !== 'owner') return showOrders();

  currentPage = 'dashboard';
  $('pageTitle').textContent = '總覽儀表板';
  $('pageSubtitle').textContent = '今日與本月營運數字';
  $('dashboardPage').classList.remove('hidden');
  $('ordersPage').classList.add('hidden');

  const data = await jsonp(`${API_URL}?action=getAdminDashboard&role=owner`);
  if (!data.ok) return alert(data.message || '讀取失敗');

  const d = data.dashboard;

  $('dashboardPage').innerHTML = `
    <div class="grid-4">
      <div class="kpi-card blue"><div class="label">今日營業額</div><div class="value">$${money(d.todayAmount)}</div></div>
      <div class="kpi-card orange"><div class="label">今日回饋</div><div class="value">$${money(d.todayReward)}</div></div>
      <div class="kpi-card green"><div class="label">今日毛利</div><div class="value">$${money(d.todayGrossProfit)}</div></div>
      <div class="kpi-card purple"><div class="label">今日淨毛利</div><div class="value">$${money(d.todayNetProfit)}</div></div>
      <div class="kpi-card blue"><div class="label">本月營業額</div><div class="value">$${money(d.monthAmount)}</div></div>
      <div class="kpi-card orange"><div class="label">本月回饋</div><div class="value">$${money(d.monthReward)}</div></div>
      <div class="kpi-card green"><div class="label">本月毛利</div><div class="value">$${money(d.monthGrossProfit)}</div></div>
      <div class="kpi-card purple"><div class="label">本月淨毛利</div><div class="value">$${money(d.monthNetProfit)}</div></div>
    </div>
  `;
}

async function showOrders() {
  currentPage = 'orders';
  $('pageTitle').textContent = '訂單管理';
  $('pageSubtitle').textContent = '新訂單 → 備貨中 → 待配送 → 已完成';

  $('dashboardPage').classList.add('hidden');
  $('ordersPage').classList.remove('hidden');

  const data = await jsonp(`${API_URL}?action=getAdminOrders&role=${encodeURIComponent(admin.role)}`);
  if (!data.ok) return alert(data.message || '讀取訂單失敗');

  currentOrders = data.orders || [];
  renderOrders();
}

function renderOrders() {
  const keyword = $('orderKeyword')?.value.trim().toLowerCase() || '';

  const filtered = currentOrders.filter(o => {
    const text = `${o.orderId} ${o.customerName} ${o.phone} ${o.address}`.toLowerCase();
    return !keyword || text.includes(keyword);
  });

  const groups = [
    { title: '新訂單', statuses: ['new'], color: '#dbeafe' },
    { title: '備貨中', statuses: ['備貨中', '缺貨待補'], color: '#fef3c7' },
    { title: '待配送', statuses: ['待配送'], color: '#ede9fe' },
    { title: '已完成', statuses: ['已完成'], color: '#dcfce7' }
  ];

  $('ordersList').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;align-items:start;">
      ${groups.map(g => {
        const list = filtered.filter(o => g.statuses.includes(o.status || 'new'));

        return `
          <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:18px;padding:14px;min-height:500px;">
            <h3 style="margin:0 0 12px;padding:10px;border-radius:12px;background:${g.color};">
              ${g.title}（${list.length}）
            </h3>
            ${list.map(orderCard).join('') || `<div style="color:#667085;text-align:center;padding:30px 0;">目前沒有訂單</div>`}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function orderCard(o) {
  return `
    <div class="order-card" style="margin-bottom:12px;">
      <div class="order-id">${o.orderId}</div>
      <div class="order-info">
        ${o.orderDate}<br>
        客戶：${o.customerName}<br>
        電話：${o.phone}<br>
        金額：$${money(o.orderAmount)}｜回饋：$${money(o.rewardAmount)}<br>
        ${o.picker ? `備貨員：${o.picker}<br>` : ''}
        ${o.pickingNote ? `備註：${o.pickingNote}<br>` : ''}
        ${admin.role === 'owner' ? `毛利：$${money(o.grossProfit)}｜淨毛利：$${money(o.netProfit)}<br>` : ''}
      </div>

      <div class="actions">
        <button onclick="viewItems('${o.orderId}')">明細</button>
        ${o.status === 'new' ? `<button onclick="startPicking('${o.orderId}')">開始備貨</button>` : ''}
        ${['備貨中','缺貨待補'].includes(o.status) ? `<button onclick="openPicking('${o.orderId}')">繼續備貨</button>` : ''}
        ${o.status === '待配送' ? `<button class="print" onclick="printOrder('${o.orderId}')">列印貨單</button><button onclick="changeStatus('${o.orderId}', '已完成')">已完成</button>` : ''}
        ${o.status === '已完成' ? `<button onclick="printOrder('${o.orderId}')">補印</button>` : ''}
      </div>
    </div>
  `;
}

async function startPicking(orderId) {
  await changeStatus(orderId, '備貨中', false);
  await showOrders();
  openPicking(orderId);
}

async function viewItems(orderId) {
  const data = await jsonp(
    `${API_URL}?action=getAdminOrderItems&orderId=${encodeURIComponent(orderId)}&role=${encodeURIComponent(admin.role)}`
  );

  if (!data.ok) return alert(data.message || '讀取明細失敗');

  $('modalTitle').textContent = `訂單明細：${orderId}`;
  $('modalBody').innerHTML = `
    <table class="detail-table">
      <thead>
        <tr>
          <th>商品</th><th>單價</th><th>數量</th><th>小計</th><th>回饋</th>
          ${admin.role === 'owner' ? '<th>成本</th><th>毛利</th><th>淨毛利</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${data.items.map(i => `
          <tr>
            <td>${i.productName}</td>
            <td>$${money(i.salePrice)}</td>
            <td>${i.qty}</td>
            <td>$${money(i.subtotal)}</td>
            <td>$${money(i.rewardAmount)}</td>
            ${admin.role === 'owner' ? `
              <td>$${money(i.costPrice)}</td>
              <td>$${money(i.grossProfit)}</td>
              <td>$${money(i.netProfit)}</td>
            ` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  $('modal').classList.remove('hidden');
}

async function openPicking(orderId) {
  const order = currentOrders.find(o => o.orderId === orderId);

  const data = await jsonp(`${API_URL}?action=getPickingItems&orderId=${encodeURIComponent(orderId)}`);
  if (!data.ok) return alert(data.message || '讀取備貨資料失敗');

  const items = data.items || [];

  $('modalTitle').textContent = `備貨作業：${orderId}`;
  $('modalBody').innerHTML = `
    <div style="line-height:1.8;color:#344054;margin-bottom:14px;">
      客戶：${order?.customerName || ''}<br>
      電話：${order?.phone || ''}<br>
      地址：${order?.address || ''}
    </div>

    <label style="font-weight:900;">負責備貨員</label>
    <input id="pickingPicker" value="${order?.picker || admin.name}" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:12px;margin:6px 0 14px;">

    <div>
      ${items.map((i, index) => `
        <div style="border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin-bottom:12px;">
          <strong>${i.productName}</strong>
          <div style="color:#667085;margin-top:4px;">
            數量：${i.qty}　供應商：${i.supplier || '未設定'}
          </div>

          <div style="display:flex;gap:16px;margin-top:12px;align-items:center;">
            <label style="font-weight:900;color:#15803d;">
              <input type="checkbox" id="picked_${index}" ${i.isPicked ? 'checked' : ''} onchange="togglePicked(${index})">
              已備妥
            </label>

            <label style="font-weight:900;color:#b91c1c;">
              <input type="checkbox" id="out_${index}" ${i.isOutOfStock ? 'checked' : ''} onchange="toggleOut(${index})">
              無法備到
            </label>

            <input id="pickedQty_${index}" type="hidden" value="${i.pickedQty || 0}">
            <input id="productId_${index}" type="hidden" value="${i.productId}">
            <input id="qty_${index}" type="hidden" value="${i.qty}">
          </div>
        </div>
      `).join('')}
    </div>

    <label style="font-weight:900;">備貨單備註</label>
    <textarea id="pickingNote" placeholder="例如：吸色片暫缺，待下批到貨補出。" style="width:100%;height:90px;padding:12px;border:1px solid #d1d5db;border-radius:12px;margin-top:6px;">${order?.pickingNote || ''}</textarea>

    <div style="display:flex;gap:10px;margin-top:18px;">
      <button onclick="savePicking('${orderId}', ${items.length})" style="flex:1;background:#0b5cff;color:white;border:0;border-radius:12px;padding:12px;font-weight:900;">儲存備貨進度</button>
      <button onclick="closeModal()" style="background:#e5e7eb;border:0;border-radius:12px;padding:12px;font-weight:900;">關閉</button>
    </div>
  `;

  $('modal').classList.remove('hidden');
}

function togglePicked(index) {
  if ($(`picked_${index}`).checked) {
    $(`out_${index}`).checked = false;
    $(`pickedQty_${index}`).value = $(`qty_${index}`).value;
  } else {
    $(`pickedQty_${index}`).value = 0;
  }
}

function toggleOut(index) {
  if ($(`out_${index}`).checked) {
    $(`picked_${index}`).checked = false;
    $(`pickedQty_${index}`).value = 0;
  }
}

async function savePicking(orderId, count) {
  const items = [];

  for (let i = 0; i < count; i++) {
    items.push({
      productId: $(`productId_${i}`).value,
      pickedQty: Number($(`pickedQty_${i}`).value || 0),
      isPicked: $(`picked_${i}`).checked,
      isOutOfStock: $(`out_${i}`).checked
    });
  }

  const payload = {
    orderId,
    picker: $('pickingPicker').value.trim() || admin.name,
    pickingNote: $('pickingNote').value.trim(),
    items
  };

  const data = await jsonp(
    `${API_URL}?action=savePickingItems&payload=${encodeURIComponent(JSON.stringify(payload))}`
  );

  if (!data.ok) return alert(data.message || '儲存失敗');

  alert('備貨進度已儲存');
  closeModal();
  showOrders();
}

async function changeStatus(orderId, status, reload = true) {
  const data = await jsonp(
    `${API_URL}?action=updateOrderStatus&orderId=${encodeURIComponent(orderId)}&status=${encodeURIComponent(status)}`
  );

  if (!data.ok) return alert(data.message || '更新失敗');
  if (reload) showOrders();
}

async function printOrder(orderId) {
  const order = currentOrders.find(o => o.orderId === orderId);
  const data = await jsonp(`${API_URL}?action=getAdminOrderItems&orderId=${encodeURIComponent(orderId)}&role=staff`);

  if (!data.ok) return alert(data.message || '讀取明細失敗');

  const printDiv = document.createElement('div');
  printDiv.className = 'print-area';
  printDiv.innerHTML = `
    <h2>好貨倉 出貨單</h2>
    <p>
      訂單編號：${order.orderId}<br>
      下單時間：${order.orderDate}<br>
      客戶：${order.customerName}<br>
      電話：${order.phone}<br>
      地址：${order.address}<br>
      備貨員：${order.picker || ''}<br>
      備貨備註：${order.pickingNote || ''}
    </p>

    <table border="1" cellspacing="0" cellpadding="8" width="100%">
      <thead>
        <tr><th>品名</th><th>單價</th><th>數量</th><th>小計</th></tr>
      </thead>
      <tbody>
        ${data.items.map(i => `
          <tr>
            <td>${i.productName}</td>
            <td>${money(i.salePrice)}</td>
            <td>${i.qty}</td>
            <td>${money(i.subtotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h3>訂單金額：$${money(order.orderAmount)}</h3>
    <p>□ 已撿貨　□ 已核對　□ 已配送</p>
  `;

  document.body.appendChild(printDiv);
  window.print();
  setTimeout(() => printDiv.remove(), 500);
}

function closeModal() {
  $('modal').classList.add('hidden');
}

window.onload = function () {
  if (admin) startAdmin();
};
