const API_BASE = '/api/v1';
let editMode = false;
let editArticleId = null;
let selectedTags = new Set();
let currentStatus = 'draft';

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function token() {
  return localStorage.getItem('jwt_token');
}

function toast(message, error = false) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.className = `toast${error ? ' error' : ''} show`;
  setTimeout(() => el.classList.remove('show'), 2200);
}

function showAuthPrompt() {
  document.querySelector('#status-line').classList.add('visible');
  document.querySelector('#status-line').innerHTML = '需要登录，请<a href="/">返回首页</a>登录后再写文章。';
  document.querySelector('#editor-content').hidden = true;
}

async function api(path, opts = {}) {
  const headers = {};
  if (token()) headers.Authorization = `Bearer ${token()}`;
  if (!opts.isForm) headers['Content-Type'] = 'application/json';
  const url = new URL(API_BASE + path, location.origin);
  Object.entries(opts.params || {}).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) url.searchParams.set(key, value);
  });
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? (opts.isForm ? opts.body : JSON.stringify(opts.body)) : undefined
  });
  if (res.status === 401) {
    showAuthPrompt();
    return null;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code !== 0) throw new Error(body.message || `请求失败：${res.status}`);
  return body.data;
}

async function loadMeta() {
  const [categories, tags] = await Promise.all([
    api('/categories').catch(() => []),
    api('/tags').catch(() => [])
  ]);
  const category = document.querySelector('#category');
  category.innerHTML = '<option value="">无专题</option>' + (categories || []).map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
  document.querySelector('#tag-chips').innerHTML = (tags || []).map(t => `<button class="tag-chip" type="button" data-tag-id="${t.id}">${escapeHTML(t.name)}</button>`).join('');
  document.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.tagId;
      if (selectedTags.has(id)) selectedTags.delete(id);
      else selectedTags.add(id);
      chip.classList.toggle('selected', selectedTags.has(id));
    });
  });
}

async function loadArticle(id) {
  const article = await api(`/articles/${id}`);
  if (!article) return;
  document.querySelector('#title').value = article.title || '';
  document.querySelector('#content').value = article.content || '';
  document.querySelector('#cover-image').value = article.cover_image || '';
  if (article.cover_image) {
    const img = document.querySelector('#cover-preview');
    img.src = article.cover_image;
    img.classList.add('visible');
  }
  if (article.category_id) document.querySelector('#category').value = article.category_id;
  currentStatus = article.status || 'draft';
  document.querySelectorAll('.status-option').forEach(btn => btn.classList.toggle('selected', btn.dataset.status === currentStatus));
  (article.tags || []).forEach(tag => selectedTags.add(String(tag.id)));
  document.querySelectorAll('.tag-chip').forEach(chip => chip.classList.toggle('selected', selectedTags.has(chip.dataset.tagId)));
  document.querySelector('#btn-save').innerHTML = '<i class="ph ph-floppy-disk"></i>更新';
}

async function saveArticle() {
  const title = document.querySelector('#title').value.trim();
  const content = document.querySelector('#content').value.trim();
  if (!title || !content) {
    toast('标题和内容不能为空', true);
    return;
  }
  const categoryId = document.querySelector('#category').value;
  const body = {
    title,
    content,
    category_id: categoryId ? Number(categoryId) : null,
    tag_ids: Array.from(selectedTags).map(Number),
    cover_image: document.querySelector('#cover-image').value.trim(),
    status: currentStatus
  };
  const result = await api(editMode ? `/articles/${editArticleId}` : '/articles', {
    method: editMode ? 'PUT' : 'POST',
    body
  });
  if (!result) return;
  editMode = true;
  editArticleId = result.id;
  history.replaceState({}, '', `/editor.html?id=${result.id}`);
  toast('文章已保存');
}

async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  const data = await api('/articles/upload', { method: 'POST', body: form, isForm: true });
  return data && data.url;
}

document.querySelector('#btn-save').addEventListener('click', () => saveArticle().catch(e => toast(e.message, true)));
document.querySelector('#btn-preview').addEventListener('click', () => {
  const title = document.querySelector('#title').value.trim() || '未命名';
  const content = escapeHTML(document.querySelector('#content').value).replace(/\n/g, '<br>');
  const win = window.open('', '_preview');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>预览 - ${escapeHTML(title)}</title></head><body style="max-width:820px;margin:40px auto;font-family:sans-serif;line-height:1.8"><h1>${escapeHTML(title)}</h1>${content}</body></html>`);
});
document.querySelector('#btn-upload').addEventListener('click', () => document.querySelector('#file-input').click());
document.querySelector('#file-input').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const url = await uploadImage(file);
    if (url) {
      document.querySelector('#cover-image').value = url;
      const img = document.querySelector('#cover-preview');
      img.src = url;
      img.classList.add('visible');
    }
  } catch (error) {
    toast(error.message, true);
  }
});
document.querySelector('#cover-image').addEventListener('input', event => {
  const img = document.querySelector('#cover-preview');
  if (event.target.value.trim()) {
    img.src = event.target.value.trim();
    img.classList.add('visible');
  } else {
    img.classList.remove('visible');
  }
});
document.querySelectorAll('.status-option').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.status-option').forEach(item => item.classList.remove('selected'));
  btn.classList.add('selected');
  currentStatus = btn.dataset.status;
}));
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveArticle().catch(e => toast(e.message, true));
  }
});

(async function init() {
  const params = new URLSearchParams(location.hash.slice(1) || location.search);
  if (params.get('token')) localStorage.setItem('jwt_token', params.get('token'));
  if (!token()) {
    showAuthPrompt();
    return;
  }
  document.querySelector('#editor-content').hidden = false;
  document.querySelector('#status-line').classList.remove('visible');
  await loadMeta();
  const id = params.get('id');
  if (id) {
    editMode = true;
    editArticleId = Number(id);
    await loadArticle(id);
  }
})().catch(error => toast(error.message, true));
