const API_BASE = '/api/v1';

function token() { return localStorage.getItem('jwt_token'); }
function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])); }
function timeAgo(value) {
  if (!value) return '';
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

function showAuthPrompt() {
  document.querySelector('#content-area').innerHTML = `
    <div class="auth-prompt">
      <h2>需要登录</h2>
      <p>请登录后查看消息通知。</p>
      <a class="btn-login" href="/"><i class="ph ph-sign-in"></i>返回首页登录</a>
    </div>`;
}

function notifIcon(type) {
  return ({ comment:'ph-chat-circle', reply:'ph-chat-centered-dots', like:'ph-heart', follow:'ph-user-plus', favorite:'ph-bookmark' })[type] || 'ph-bell';
}

function notifText(item) {
  const from = escapeHTML((item.from_user || {}).username || '用户');
  const title = escapeHTML((item.article || {}).title || '文章');
  switch (item.type) {
    case 'comment': return `<strong>${from}</strong> 评论了 <em>${title}</em>`;
    case 'reply': return `<strong>${from}</strong> 回复了你的评论`;
    case 'like': return `<strong>${from}</strong> 赞了 <em>${title}</em>`;
    case 'follow': return `<strong>${from}</strong> 关注了你`;
    case 'favorite': return `<strong>${from}</strong> 收藏了 <em>${title}</em>`;
    default: return escapeHTML(item.content || '新消息');
  }
}

async function api(path, opts = {}) {
  const url = new URL(API_BASE + path, location.origin);
  Object.entries(opts.params || {}).forEach(([key, value]) => { if (value !== '' && value !== null && value !== undefined) url.searchParams.set(key, value); });
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401) { showAuthPrompt(); return null; }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code !== 0) throw new Error(body.message || `请求失败：${res.status}`);
  return body.data;
}

async function loadNotifications() {
  const area = document.querySelector('#content-area');
  area.innerHTML = '<div class="status-line visible">正在加载...</div>';
  try {
    const data = await api('/user/notifications', { params: { page: 1, page_size: 50 } });
    if (!data) return;
    const notifications = (data.notifications && data.notifications.list) || data.notifications || [];
    const unread = data.unread_count || 0;
    if (!notifications.length) {
      area.innerHTML = '<div class="empty"><i class="ph ph-bell-simple"></i><p>暂无消息</p></div>';
      return;
    }
    area.innerHTML = `<h1 class="page-title">消息通知${unread ? `<span class="unread-badge">${unread}</span>` : ''}</h1>` + notifications.map(item => `
      <div class="notification-card${item.is_read ? '' : ' unread'}" data-id="${item.id}">
        <div class="notif-icon"><i class="ph ${notifIcon(item.type)}"></i></div>
        <div class="notif-content">
          <div class="notif-text">${notifText(item)}</div>
          <div class="notif-time">${timeAgo(item.created_at)}</div>
        </div>
      </div>
    `).join('');
    area.querySelectorAll('.notification-card').forEach(card => card.addEventListener('click', async () => {
      try {
        await api('/user/notifications/read', { method: 'PATCH', body: { ids: [Number(card.dataset.id)] } });
        card.classList.remove('unread');
      } catch {}
    }));
  } catch (error) {
    area.innerHTML = `<div class="empty">${escapeHTML(error.message)}</div>`;
  }
}

document.querySelector('#mark-all').addEventListener('click', async () => {
  const cards = Array.from(document.querySelectorAll('.notification-card.unread'));
  if (!cards.length) return;
  try {
    await api('/user/notifications/read', { method: 'PATCH', body: { ids: cards.map(c => Number(c.dataset.id)) } });
    cards.forEach(c => c.classList.remove('unread'));
    document.querySelector('.unread-badge')?.remove();
  } catch (error) {
    alert(error.message);
  }
});

const params = new URLSearchParams(location.hash.slice(1) || location.search);
if (params.get('token')) localStorage.setItem('jwt_token', params.get('token'));
if (!token()) showAuthPrompt(); else loadNotifications();
