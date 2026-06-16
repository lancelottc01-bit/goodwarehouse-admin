const API_URL = 'https://script.google.com/macros/s/AKfycbyNwtKduhUJdytwC_DiuUw8SV4VGv4I1Y_14HMU9uyhnQBtsIUOfrcZWacySPj8gmjwLw/exec';

let admin = JSON.parse(localStorage.getItem('goodwarehouse_admin') || 'null');
let currentOrders = [];
let currentPage = 'orders';

const $ = id => document.getElementById(id);

function money(n) {
  return Number(n || 0).toLocaleString('zh-TW');
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_callback_' + Math.random().toString(36).substring(2);
    const script = document.createElement('script');

    window[callbackName] = data => {
      resolve(data);
      delete window[callbackName];
      document.body.removeChild(script);
    };

    const separator = url.includes('?') ? '&' : '?';
    script.src = url + separator + 'callback=' + callbackName + '&t=' + Date.now();

    script.onerror = () => {
      delete window[callbackName];
      document.body.removeChild(script);
      reject(new Error('JSONP 載入失敗'));
    };

    document.body.appendChild(script);
  });
}

async function adminLogin() {
  const account = $('account').value.trim();
  const password = $('password').value.trim();

  if (!account || !password) {
    alert('請輸入帳號密碼');
    return;
  }

  const data = await jsonp(
    API_URL +
    '?action=adminLogin' +
    '&account=' + encodeURIComponent(account) +
    '&password=' + encodeURIComponent(password)
  );

  if (!data.ok) {
    alert(data.message || '登入失敗');
    return;
  }

  admin = data.admin;
  localStorage.setItem('goodwarehouse_admin', JSON.stringify(admin));
  startAdmin();
}

function startAdmin() {
  $('loginPage').classList.add('hidden');
  $('adminApp').classList.remove('hidden');

  $('adminName').textContent = admin.name;
  $('adminRole').textContent = admin.role === 'owner' ? '老闆' : '員工';

  if (admin.role !== 'owner') {
    $('navDashboard').style.display = 'none';
    showOrders();
  } else {
    showDashboard();
  }
}

function logout() {
  localStorage.removeItem('goodwarehouse_admin');
  location.reload();
}

function setActive(navId) {
  document.querySelectorAll('.sidebar nav button').forEach(btn => btn.classList.remove('active'));
  $(navId)?.classList.add('active');
}

function refreshCurrentPage() {
  if (currentPage === 'dashboard') showDashboard();
  else showOrders();
}

async function showDashboard() {
  if (admin.role !== 'owner') {
    showOrders();
    return;
  }

  currentPage = 'dashboard';
  setActive('navDashboard');

  $('pageTitle').textContent = '總覽儀表板';
  $('pageSubtitle').textContent = '今日與本月營運數字';

  $('dashboardPage').classList.remove('hidden');
  $('ordersPage').classList.add('hidden');

  const data = await jsonp(API_URL + '?action=getAdminDashboard&role=owner');

  if (!data.ok) {
    alert(data.message || '讀取儀表板失敗');
    return;
  }

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

    <div style="height:20px;"></div>

    <div class="panel">
      <div class="panel-head">
        <h2>最新訂單</h2>
        <button onclick="showOrders()">查看全部訂單</button>
      </div>
      <div id="dashboardRecentOrders">載入中...</div>
    </div>
  `;

  await loadRecentOrdersForDashboard();
}

async function loadRecentOrdersForDashboard() {
  const data = await jsonp(
    API_URL + '?action=getAdminOrders&role=' + encodeURIComponent(admin.role)
  );

  if (!data.ok) return;

  const orders = (data.orders || []).slice(0, 5);

  $('dashboardRecentOrders').innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-top">
        <div>
          <div class="order-id">${o.orderId}</div>
          <div class="order-info">
            ${o.customerName}｜${o.orderDate}<br>
            金額：$${money(o.orderAmount)}｜回饋：$${money(o.rewardAmount)}
          </div>
        </div>
        <span class="status ${statusClass(o.status)}">${statusText(o.status)}</span>
      </div>
    </div>
  `).join('');
}

async function showOrders() {
  currentPage = 'orders';
  setActive('navOrders');

  $('pageTitle').textContent = '訂單管理';
  $('pageSubtitle').textContent = '處理訂單、查看明細、備貨、列印貨單';

  $('dashboardPage').classList.add('hidden');
  $('ordersPage').classList.remove('hidden');

  const data = await jsonp(
    API_URL + '?action=getAdminOrders&role=' + encodeURIComponent(admin.role)
  );

  if (!data.ok) {
    alert(data.message || '讀取訂單失敗');
    return;
  }

  currentOrders = data.orders || [];
  renderOrders();
}

function renderOrders() {
  const keyword = $('orderKeyword')?.value.trim().toLowerCase() || '';
  const status = $('statusFilter')?.value || '全部';

  const list = currentOrders.filter(o => {
    const text = `${o.orderId} ${o.customerName} ${o.phone} ${o.address}`.toLowerCase();
    const matchKeyword = !keyword || text.includes(keyword);
    const matchStatus = status === '全部' || String(o.status) === String(status);
    return matchKeyword && matchStatus;
  });

  if (!list.length) {
    $('ordersList').innerHTML = `<div style="padding:30px;text-align:center;color:#667085;">目前沒有符合條件的訂單</div>`;
    return;
  }

  $('ordersList').innerHTML = list.map(o => `
    <div class="order-card">
      <div class="order-top">
        <div>
          <div class="order-id">${o.orderId}</div>
          <div class="order-info">
            下單時間：${o.orderDate}<br>
            客戶：${o.customerName}<br>
            電話：${o.phone}<br>
            地址：${o.address}<br>
            金額：$${money(o.orderAmount)}｜回饋：$${money(o.rewardAmount)}
            ${admin.role === 'owner' ? `<br>毛利：$${money(o.grossProfit)}｜淨毛利：$${money(o.netProfit)}` : ''}
          </div>
        </div>

        <div>
          <div class="amount">$${money(o.orderAmount)}</div>
          <span class="status ${statusClass(o.status)}">${statusText(o.status)}</span>
        </div>
      </div>

      <div class="actions">
        <button onclick="viewItems('${o.orderId}')">查看明細</button>
        <button onclick="openPicking('${o.orderId}')">開始備貨</button>
        <button class="print" onclick="printOrder('${o.orderId}')">列印貨單</button>
        <button class="warn" onclick="changeStatus('${o.orderId}', '備貨中')">備貨中</button>
        <button onclick="changeStatus('${o.orderId}', '配送中')">配送中</button>
        <button onclick="changeStatus('${o.orderId}', '已完成')">已完成</button>
      </div>
    </div>
  `).join('');
}

function statusClass(status) {
  if (status === '備貨中') return 'prepare';
  if (status === '配送中') return 'delivery';
  if (status === '已完成') return 'done';
  if (status === '已備妥') return 'done';
  if (status === '缺貨待補') return 'prepare';
  return 'new';
}

function statusText(status) {
  if (status === 'new') return '新訂單';
  return status || '新訂單';
}

async function viewItems(orderId) {
  const data = await jsonp(
    API_URL +
    '?action=getAdminOrderItems' +
    '&orderId=' + encodeURIComponent(orderId) +
    '&role=' + encodeURIComponent(admin.role)
  );

  if (!data.ok) {
    alert(data.message || '讀取明細失敗');
    return;
  }

  const rows = data.items.map(i => `
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
  `).join('');

  $('modalTitle').textContent = `訂單明細：${orderId}`;
  $('modalBody').innerHTML = `
    <table class="detail-table">
      <thead>
        <tr>
          <th>商品</th>
          <th>單價</th>
          <th>數量</th>
          <th>小計</th>
          <th>回饋</th>
          ${admin.role === 'owner' ? `
            <th>成本</th>
            <th>毛利</th>
            <th>淨毛利</th>
          ` : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  $('modal').classList.remove('hidden');
}

async function openPicking(orderId) {
  const order = currentOrders.find(o => o.orderId === orderId);

  const data = await jsonp(
    API_URL +
    '?action=getPickingItems' +
    '&orderId=' + encodeURIComponent(orderId)
  );

  if (!data.ok) {
    alert(data.message || '讀取備貨資料失敗');
    return;
  }

  const items = data.items || [];

  const rows = items.map((i, index) => `
    <div class="picking-item" style="border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div>
          <strong style="font-size:16px;">${i.productName}</strong>
          <div style="color:#667085;margin-top:4px;">
            需求數量：${i.qty}　供應源：${i.supplier || '未設定'}
          </div>
        </div>
        <label style="font-weight:900;">
          <input type="checkbox" id="picked_${index}" ${i.isPicked ? 'checked' : ''}>
          已備貨
        </label>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <div>
          <label style="font-size:13px;color:#667085;">已備數量</label>
          <input id="pickedQty_${index}" type="number" value="${i.pickedQty || 0}" min="0" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:10px;">
        </div>

        <div>
          <label style="font-size:13px;color:#667085;">目前缺貨</label>
          <div style="padding:10px;">
            <label>
              <input type="checkbox" id="out_${index}" ${i.isOutOfStock ? 'checked' : ''}>
              標記缺貨
            </label>
          </div>
        </div>
      </div>

      <div style="margin-top:10px;">
        <label style="font-size:13px;color:#667085;">備註</label>
        <input id="note_${index}" value="${i.note || ''}" placeholder="例如：目前缺貨、明天到、已找順成補貨" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:10px;">
      </div>

      <input type="hidden" id="productId_${index}" value="${i.productId}">
      <input type="hidden" id="qty_${index}" value="${i.qty}">
    </div>
  `).join('');

  $('modalTitle').textContent = `備貨作業：${orderId}`;

  $('modalBody').innerHTML = `
    <div style="margin-bottom:14px;color:#344054;line-height:1.7;">
      客戶：${order?.customerName || ''}<br>
      電話：${order?.phone || ''}<br>
      地址：${order?.address || ''}
    </div>

    <div style="margin-bottom:14px;">
      <label style="font-weight:900;">負責備貨員</label>
      <input id="pickingPicker" value="${admin.name}" style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:12px;margin-top:6px;">
    </div>

    <div id="pickingItemsWrap">
      ${rows || '<div style="color:#667085;">目前沒有備貨項目</div>'}
    </div>

    <div style="display:flex;gap:10px;margin-top:18px;">
      <button onclick="savePicking('${orderId}', ${items.length})" style="flex:1;background:#0b5cff;color:white;border:0;border-radius:12px;padding:12px;font-weight:900;">儲存備貨進度</button>
      <button onclick="closeModal()" style="background:#e5e7eb;border:0;border-radius:12px;padding:12px;font-weight:900;">關閉</button>
    </div>
  `;

  $('modal').classList.remove('hidden');
}

async function savePicking(orderId, count) {
  const picker = $('pickingPicker').value.trim() || admin.name;

  const items = [];

  for (let i = 0; i < count; i++) {
    const productId = $(`productId_${i}`).value;
    const qty = Number($(`qty_${i}`).value || 0);
    const pickedQty = Number($(`pickedQty_${i}`).value || 0);
    const isPicked = $(`picked_${i}`).checked;
    const isOutOfStock = $(`out_${i}`).checked;
    const note = $(`note_${i}`).value || '';

    items.push({
      productId,
      qty,
      pickedQty,
      isPicked,
      isOutOfStock,
      note
    });
  }

  const payload = {
    orderId,
    picker,
    items
  };

  const data = await jsonp(
    API_URL +
    '?action=savePickingItems' +
    '&payload=' +
    encodeURIComponent(JSON.stringify(payload))
  );

  if (!data.ok) {
    alert(data.message || '儲存失敗');
    return;
  }

  alert('備貨進度已儲存');
  closeModal();
  showOrders();
}

function closeModal() {
  $('modal').classList.add('hidden');
}

async function changeStatus(orderId, status) {
  const data = await jsonp(
    API_URL +
    '?action=updateOrderStatus' +
    '&orderId=' + encodeURIComponent(orderId) +
    '&status=' + encodeURIComponent(status)
  );

  if (!data.ok) {
    alert(data.message || '更新失敗');
    return;
  }

  showOrders();
}

async function printOrder(orderId) {
  const order = currentOrders.find(o => o.orderId === orderId);

  const data = await jsonp(
    API_URL +
    '?action=getAdminOrderItems' +
    '&orderId=' + encodeURIComponent(orderId) +
    '&role=staff'
  );

  if (!data.ok) {
    alert(data.message || '讀取明細失敗');
    return;
  }

  const printDiv = document.createElement('div');
  printDiv.className = 'print-area';

  printDiv.innerHTML = `
    <h2>好貨倉 出貨單</h2>
    <p>
      訂單編號：${order.orderId}<br>
      下單時間：${order.orderDate}<br>
      客戶：${order.customerName}<br>
      電話：${order.phone}<br>
      地址：${order.address}
    </p>

    <table border="1" cellspacing="0" cellpadding="8" width="100%">
      <thead>
        <tr>
          <th>品名</th>
          <th>單價</th>
          <th>數量</th>
          <th>小計</th>
        </tr>
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

    <p>
      □ 已撿貨　□ 已核對　□ 已配送
    </p>
  `;

  document.body.appendChild(printDiv);
  window.print();

  setTimeout(() => {
    printDiv.remove();
  }, 500);
}

window.onload = function () {
  if (admin) {
    startAdmin();
  }
};
