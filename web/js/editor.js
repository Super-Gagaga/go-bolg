const API = '/api/v1';
const token = () => localStorage.getItem('jwt_token');
const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
let editingID = params.get('id');
function esc(v = '') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function show(msg) { $('#status').textContent = msg; $('#status').hidden = !msg; }
async function api(path, options = {}) {
  if (!token()) throw new Error('请先登录后写作。');
  const headers = { Authorization: `Bearer ${token()}`, ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code !== 0) throw new Error(body.message || `请求失败 ${res.status}`);
  return body.data;
}
async function loadOptions() {
  const [categories, tags] = await Promise.all([
    fetch(API + '/categories').then(r => r.json()).then(b => b.data || []).catch(() => []),
    fetch(API + '/tags').then(r => r.json()).then(b => b.data || []).catch(() => [])
  ]);
  $('#category').innerHTML = '<option value="">不选择分类</option>' + categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#tags').innerHTML = tags.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
}
function payload(status) {
  const tagIDs = Array.from($('#tags').selectedOptions).map(o => Number(o.value));
  const category = $('#category').value;
  return {
    title: $('#title').value.trim(),
    content: $('#content').value,
    category_id: category ? Number(category) : null,
    tag_ids: tagIDs,
    cover_image: $('#cover').value.trim(),
    status
  };
}
async function save(status) {
  const data = payload(status);
  if (!data.title || !data.content.trim()) { show('标题和正文都需要填写。'); return; }
  show(status === 'published' ? '正在提交审核...' : '正在保存草稿...');
  try {
    const path = editingID ? `/articles/${editingID}` : '/articles';
    const method = editingID ? 'PUT' : 'POST';
    const article = await api(path, { method, body: JSON.stringify(data) });
    editingID = article.id;
    history.replaceState(null, '', `/editor?id=${editingID}`);
    show(status === 'published' ? '已提交审核。' : '草稿已保存。');
    loadMine();
  } catch (e) { show(e.message); }
}
async function loadArticle() {
  if (!editingID) return;
  show('正在载入文章...');
  try {
    const a = await api(`/articles/${editingID}`);
    $('#title').value = a.title || '';
    $('#content').value = a.content || '';
    $('#cover').value = a.cover_image || '';
    if (a.category_id) $('#category').value = String(a.category_id);
    const tagSet = new Set((a.tags || []).map(t => String(t.id)));
    Array.from($('#tags').options).forEach(o => { o.selected = tagSet.has(o.value); });
    show(a.review_comment ? `驳回原因：${a.review_comment}` : '');
  } catch (e) { show(e.message); }
}
function statusChip(s) {
  const map = { draft:'草稿', pending_review:'待审核', published:'已发布', archived:'已归档' };
  const color = s === 'published' ? 'green' : s === 'pending_review' ? 'orange' : '';
  return `<span class="chip ${color}">${map[s] || s}</span>`;
}
async function loadMine() {
  try {
    const st = $('#article-status').value;
    const data = await api(`/user/articles?page=1&page_size=30${st ? `&status=${encodeURIComponent(st)}` : ''}`);
    const list = data.list || [];
    $('#my-articles').innerHTML = list.length ? list.map(a => `<article class="my-article" data-id="${a.id}">
      <div class="my-article-title">${esc(a.title)}</div>
      <div class="my-article-meta">${statusChip(a.status)}<span class="tiny">${new Date(a.updated_at || a.created_at).toLocaleDateString('zh-CN')}</span></div>
      ${a.review_comment ? `<div class="tiny">驳回：${esc(a.review_comment)}</div>` : ''}
    </article>`).join('') : '<div class="empty">还没有文章。</div>';
    document.querySelectorAll('.my-article').forEach(el => el.onclick = () => location.href = `/editor?id=${el.dataset.id}`);
  } catch (e) { $('#my-articles').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
$('#save-draft').onclick = () => save('draft');
$('#submit-review').onclick = () => save('published');
$('#refresh-mine').onclick = loadMine;
$('#article-status').onchange = loadMine;
(async function init() {
  if (!token()) { show('请先从首页登录，再进入编辑器。'); return; }
  await loadOptions();
  await loadArticle();
  await loadMine();
})();
