const API_URL = 'https://script.google.com/macros/s/AKfycbyumvGPXfRyuIKLEmLoVUooFD4QynwK2GGd8T0edZB3H01Ym_tar3cu4E_5FhUg-CoPzQ/exec';

let admin = JSON.parse(localStorage.getItem('goodwarehouse_admin') || 'null');
let currentOrders = [];

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

    const separator = url.includes('?') ? '&' : '?';
    script.src = url + separator + 'callback=' + callbackName + '&t=' + Date.now();
    script.onerror = reject;

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
    `${API_URL}?action=adminLogin&account=${encodeURIComponent(account)}&password=${encodeURIComponent(password)}`
  );

  if (!data.ok) {
    alert(data.message || '登入失敗');
    return;
  }

  admin = data.admin;
  localStorage.setItem('goodwarehouse_admin', JSON.stringify(admin));
  startAdmin();
}

function logout() {
  localStorage.removeItem('goodwarehouse_admin');
  location.reload();
}

function startAdmin() {
  $('loginPage').classList.add('hidden');
  $('adminApp').classList.remove('hidden');
  $('adminName').textContent = `${admin.name}（${admin.role === 'owner' ? '老闆' : '員工'}）`;

  if (admin.role !== 'owner') {
    $('dashboardBtn').style.display = 'none';
  }

  showOrders();
}

async function showOrders() {
  $('pageTitle').textContent = '訂單管理';
  $('dashboard').classList.add('hidden');
  $('orders').classList.remove('hidden');

  const data = await jsonp(
    `${API_URL}?action=getAdminOrders&role=${encodeURIComponent(admin.role)}`
  );

  if (!data.ok) {
    alert(data.message || '讀取訂單失敗');
    return;
  }

  currentOrders = data.orders || [];
  renderOrders();
}

function renderOrders() {
  $('orders').innerHTML = currentOrders.map(o => `
    <div class="order">
      <div class="order-head">
        <div>
          <div class="order-title">${o.orderId}</div>
          <div class="order-info">
            時間：${o.orderDate}<br>
            客戶：${o.customerName}<br>
            電話：${o.phone}<br>
            地址：${o.address}<br>
            金額：${money(o.orderAmount)}｜回饋：${money(o.rewardAmount)}<br>
            狀態：${o.status}
            ${admin.role === 'owner' ? `<br>毛利：${money(o.grossProfit)}｜淨毛利：${money(o.netProfit)}` : ''}
          </div>
        </div>
      </div>

      <div class="actions">
        <button onclick="viewItems('${o.orderId}')">查看明細</button>
        <button onclick="printOrder('${o.orderId}')">列印貨單</button>
        <button onclick="changeStatus('${o.orderId}', '備貨中')">備貨中</button>
        <button onclick="changeStatus('${o.orderId}', '配送中')">配送中</button>
        <button onclick="changeStatus('${o.orderId}', '已完成')">已完成</button>
      </div>
    </div>
  `).join('');
}

async function viewItems(orderId) {
  const data = await jsonp(
    `${API_URL}?action=getAdminOrderItems&orderId=${encodeURIComponent(orderId)}&role=${encodeURIComponent(admin.role)}`
  );

  if (!data.ok) {
    alert(data.message || '讀取明細失敗');
    return;
  }

  let text = `訂單明細：${orderId}\n\n`;

  data.items.forEach(i => {
    text +=
      `${i.productName}\n` +
      `單價：${money(i.salePrice)}｜數量：${i.qty}｜小計：${money(i.subtotal)}\n` +
      `回饋：${money(i.rewardAmount)}\n`;

    if (admin.role === 'owner') {
      text += `成本：${money(i.costPrice)}｜毛利：${money(i.grossProfit)}｜淨毛利：${money(i.netProfit)}\n`;
    }

    text += '\n';
  });

  alert(text);
}

async function changeStatus(orderId, status) {
  const data = await jsonp(
    `${API_URL}?action=updateOrderStatus&orderId=${encodeURIComponent(orderId)}&status=${encodeURIComponent(status)}`
  );

  if (!data.ok) {
    alert(data.message || '更新失敗');
    return;
  }

  alert('狀態已更新');
  showOrders();
}

async function showDashboard() {
  if (admin.role !== 'owner') {
    alert('權限不足');
    return;
  }

  $('pageTitle').textContent = '老闆儀表板';
  $('orders').classList.add('hidden');
  $('dashboard').classList.remove('hidden');

  const data = await jsonp(
    `${API_URL}?action=getAdminDashboard&role=owner`
  );

  if (!data.ok) {
    alert(data.message || '讀取失敗');
    return;
  }

  const d = data.dashboard;

  $('dashboard').innerHTML = `
    <div class="cards">
      <div class="card"><small>今日營業額</small><strong>${money(d.todayAmount)}</strong></div>
      <div class="card"><small>今日回饋</small><strong>${money(d.todayReward)}</strong></div>
      <div class="card"><small>今日毛利</small><strong>${money(d.todayGrossProfit)}</strong></div>
      <div class="card"><small>今日淨毛利</small><strong>${money(d.todayNetProfit)}</strong></div>
      <div class="card"><small>本月營業額</small><strong>${money(d.monthAmount)}</strong></div>
      <div class="card"><small>本月回饋</small><strong>${money(d.monthReward)}</strong></div>
      <div class="card"><small>本月毛利</small><strong>${money(d.monthGrossProfit)}</strong></div>
      <div class="card"><small>本月淨毛利</small><strong>${money(d.monthNetProfit)}</strong></div>
    </div>
  `;
}

async function printOrder(orderId) {
  const order = currentOrders.find(o => o.orderId === orderId);

  const data = await jsonp(
    `${API_URL}?action=getAdminOrderItems&orderId=${encodeURIComponent(orderId)}&role=staff`
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

    <h3>訂單金額：${money(order.orderAmount)}</h3>
    <p>
      □ 已撿貨　□ 已核對　□ 已配送
    </p>
  `;

  document.body.appendChild(printDiv);
  window.print();
  setTimeout(() => printDiv.remove(), 500);
}

if (admin) {
  startAdmin();
}
