const API_BASE = '/api/v1';
let currentMode = 'following';
const pageSize = 20;

function token() { return localStorage.getItem('jwt_token'); }
function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])); }
function avatarFor(user) { return (user && user.avatar) || `https://picsum.photos/seed/${encodeURIComponent((user && user.username) || 'user')}/100/100`; }

function showAuthPrompt() {
  document.querySelector('#content-area').innerHTML = `
    <div class="auth-prompt">
      <h2>需要登录</h2>
      <p>请登录后查看关注列表。</p>
      <a class="btn-login" href="/"><i class="ph ph-sign-in"></i>返回首页登录</a>
    </div>`;
}

async function getJSON(path, params = {}) {
  const url = new URL(API_BASE + path, location.origin);
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) url.searchParams.set(k, v); });
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (res.status === 401) { showAuthPrompt(); return null; }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code !== 0) throw new Error(body.message || `请求失败：${res.status}`);
  return body.data;
}

async function loadUsers() {
  const area = document.querySelector('#content-area');
  area.innerHTML = '<div class="status-line visible">正在加载...</div>';
  try {
    const endpoint = currentMode === 'following' ? '/user/following' : '/user/followers';
    const data = await getJSON(endpoint, { page: 1, page_size: pageSize });
    if (!data) return;
    const users = data.list || [];
    if (!users.length) {
      area.innerHTML = `<div class="empty">${currentMode === 'following' ? '还没有关注任何人' : '还没有粉丝'}</div>`;
      return;
    }
    const title = currentMode === 'following' ? '我关注的' : '关注我的';
    area.innerHTML = `<h1 class="page-title">${title} (${(data.pagination && data.pagination.total) || users.length})</h1>` + users.map(item => {
      const user = item.followee || item.follower || item;
      return `<div class="user-card">
        <img src="${escapeHTML(avatarFor(user))}" alt="" class="user-avatar">
        <div class="user-info">
          <div class="user-name">${escapeHTML(user.username || '用户')}</div>
          <div class="user-bio">${escapeHTML(user.bio || '')}</div>
          <div class="user-stats">${user.article_count || 0} 篇文章 · ${user.follower_count || 0} 粉丝</div>
        </div>
      </div>`;
    }).join('');
  } catch (error) {
    area.innerHTML = `<div class="empty">${escapeHTML(error.message)}</div>`;
  }
}

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
  tab.classList.add('active');
  currentMode = tab.dataset.mode;
  loadUsers();
}));

const params = new URLSearchParams(location.hash.slice(1) || location.search);
if (params.get('token')) localStorage.setItem('jwt_token', params.get('token'));
if (!token()) showAuthPrompt(); else loadUsers();
