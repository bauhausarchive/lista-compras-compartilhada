import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.APP_CONFIG || {};
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const authFeedback = document.getElementById('auth-feedback');
const appFeedback = document.getElementById('app-feedback');
const signInButton = document.getElementById('google-sign-in');
const signOutButton = document.getElementById('sign-out');
const syncStatus = document.getElementById('sync-status');
const statusDot = document.getElementById('status-dot');
const form = document.getElementById('add-form');
const field = document.getElementById('new-item');
const list = document.getElementById('list');
const count = document.getElementById('count');
const progress = document.getElementById('progress');
const clearButton = document.getElementById('clear-done');
const importDialog = document.getElementById('import-dialog');
const bulkField = document.getElementById('bulk-items');
const importOpen = document.getElementById('import-open');
const importSubmit = document.getElementById('import-submit');
const exportButton = document.getElementById('export-list');

const supabaseUrl = String(config.supabaseUrl || '').trim();
const supabaseKey = String(config.supabaseAnonKey || '').trim();
const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)
  && supabaseKey.length > 20
  && !supabaseKey.includes('YOUR_');

if (!ready) {
  signInButton.disabled = true;
  setFeedback(authFeedback, 'Falta configurar a conexão com o banco. Siga o README do projeto.', true);
}

const supabase = ready ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
}) : null;

let currentUserId = null;
let channel = null;
let pollTimer = null;
let toastTimer = null;
let currentItems = [];

function setFeedback(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function toast(message, isError = false) {
  clearTimeout(toastTimer);
  setFeedback(appFeedback, message, isError);
  toastTimer = setTimeout(() => { appFeedback.textContent = ''; appFeedback.classList.remove('error'); }, 3500);
}

function setSync(message, online = true) {
  syncStatus.textContent = message;
  statusDot.classList.toggle('offline', !online);
}

function normalizeName(name) {
  return name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function iconFor(name) {
  const n = normalizeName(name);
  if (/ovo/.test(n)) return '🥚';
  if (/queijo/.test(n)) return '🧀';
  if (/manteiga/.test(n)) return '🧈';
  if (/requeij|cream cheese/.test(n)) return '🫙';
  if (/suco|bebida/.test(n)) return '🧃';
  if (/cafe|capsula/.test(n)) return '☕';
  if (/molho|tomate/.test(n)) return '🍅';
  if (/torrada|pao/.test(n)) return '🍞';
  if (/bolacha|biscoito/.test(n)) return '🍪';
  if (/chocolate/.test(n)) return '🍫';
  if (/fruta|maca/.test(n)) return '🍎';
  if (/leite/.test(n)) return '🥛';
  if (/carne|frango/.test(n)) return '🥩';
  return '🛒';
}

function render() {
  list.replaceChildren();
  const doneCount = currentItems.filter(item => item.done).length;
  count.textContent = `${currentItems.length} ${currentItems.length === 1 ? 'item' : 'itens'}`;
  progress.textContent = currentItems.length ? `${doneCount} de ${currentItems.length} comprados` : '0 comprados';
  clearButton.hidden = doneCount === 0;

  if (!currentItems.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'Sua lista está vazia. Adicione um item ou cole vários de uma vez.';
    list.append(empty);
    return;
  }

  for (const item of currentItems) {
    const row = document.createElement('li');
    row.className = `item${item.done ? ' done' : ''}`;

    const check = document.createElement('input');
    check.className = 'check';
    check.type = 'checkbox';
    check.checked = item.done;
    check.setAttribute('aria-label', `Marcar ${item.name} como comprado`);
    check.addEventListener('change', () => updateItem(item.id, { done: check.checked }, item.name));

    const icon = document.createElement('span');
    icon.className = 'item-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = iconFor(item.name);

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = item.name;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.setAttribute('aria-label', `Remover ${item.name}`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/></svg>';
    remove.addEventListener('click', () => deleteItem(item.id, item.name));

    row.append(check, icon, label, remove);
    list.append(row);
  }
}

async function loadItems(showError = true) {
  if (!supabase || !currentUserId) return;
  const { data, error } = await supabase
    .from('shopping_items')
    .select('id,name,name_key,done,sort_order,created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    if (showError) toast('Não consegui carregar a lista. Confira a conexão e as regras do banco.', true);
    setSync('Sem conexão', false);
    return;
  }
  currentItems = data || [];
  render();
  setSync('Sincronizado', true);
}

async function handleSession(session) {
  if (!session) {
    if (channel && supabase) await supabase.removeChannel(channel);
    channel = null;
    clearInterval(pollTimer);
    pollTimer = null;
    currentUserId = null;
    currentItems = [];
    appScreen.hidden = true;
    authScreen.hidden = false;
    return;
  }

  if (currentUserId === session.user.id && !appScreen.hidden) return;
  currentUserId = session.user.id;
  setFeedback(authFeedback, 'Verificando acesso…');

  const email = String(session.user.email || '').toLowerCase();
  const { data: allowed, error } = await supabase
    .from('allowed_users')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  if (error || !allowed) {
    currentUserId = null;
    await supabase.auth.signOut();
    authScreen.hidden = false;
    appScreen.hidden = true;
    setFeedback(authFeedback, error ? 'Não consegui verificar esse acesso. Confira a conexão e tente novamente.' : 'Esta conta ainda não tem acesso à lista. Peça ao responsável para autorizá-la.', true);
    return;
  }

  setFeedback(authFeedback, '');
  document.getElementById('account-email').textContent = email;
  authScreen.hidden = true;
  appScreen.hidden = false;
  await loadItems();
  connectRealtime();
}

function connectRealtime() {
  if (!supabase || channel) return;
  setSync('Conectando…', false);
  channel = supabase.channel('shared-shopping-list')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => { void loadItems(false); })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') setSync('Sincronizado', true);
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSync('Reconectando…', false);
    });
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void loadItems(false);
  }, 15000);
}

async function updateItem(id, changes, name) {
  const old = currentItems.find(item => item.id === id);
  if (old) old.done = changes.done;
  render();
  const { error } = await supabase.from('shopping_items').update(changes).eq('id', id);
  if (error) {
    toast(`Não consegui atualizar ${name}.`, true);
    await loadItems(false);
    return;
  }
  toast(`${name} ${changes.done ? 'marcado como comprado' : 'desmarcado'}.`);
}

async function deleteItem(id, name) {
  const { error } = await supabase.from('shopping_items').delete().eq('id', id);
  if (error) { toast(`Não consegui remover ${name}.`, true); return; }
  await loadItems(false);
  toast(`${name} removido.`);
}

signInButton.addEventListener('click', async () => {
  if (!supabase) return;
  signInButton.disabled = true;
  setFeedback(authFeedback, 'Abrindo o Google…');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${location.pathname}` }
  });
  if (error) {
    setFeedback(authFeedback, 'Não consegui iniciar o acesso com Google. Confira a configuração do Supabase.', true);
    signInButton.disabled = false;
  }
});

signOutButton.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) toast('Não consegui encerrar a sessão.', true);
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const name = field.value.trim().slice(0, 120);
  if (!name) return;
  const nameKey = normalizeName(name);
  if (currentItems.some(item => item.name_key === nameKey)) {
    toast(`${name} já está na lista.`, true);
    field.select();
    return;
  }
  const { error } = await supabase.from('shopping_items').insert({ name, name_key: nameKey });
  if (error) {
    toast(error.code === '23505' ? `${name} já está na lista.` : 'Não consegui adicionar o item. Confira a conexão.', true);
    return;
  }
  field.value = '';
  await loadItems(false);
  toast(`${name} adicionado.`);
  field.focus();
});

clearButton.addEventListener('click', async () => {
  if (!currentItems.some(item => item.done)) return;
  const { error } = await supabase.from('shopping_items').delete().eq('done', true);
  if (error) { toast('Não consegui apagar os itens comprados.', true); return; }
  await loadItems(false);
  toast('Itens comprados apagados.');
});

importOpen.addEventListener('click', () => { bulkField.value = ''; importDialog.showModal(); bulkField.focus(); });
document.getElementById('cancel-import').addEventListener('click', () => importDialog.close());
importSubmit.addEventListener('click', async () => {
  const raw = bulkField.value.trim();
  if (!raw) { importDialog.close(); return; }
  let entries;
  try {
    const parsed = JSON.parse(raw);
    const collection = Array.isArray(parsed) ? parsed : parsed.items;
    if (Array.isArray(collection)) entries = collection.map(item => ({ name: item.name, done: Boolean(item.done) }));
  } catch {}
  if (!entries) entries = raw.split(/[\n,;]+/).map(name => ({ name: name.trim(), done: false })).filter(item => item.name);
  try {
    const unique = new Map();
    for (const item of entries) {
      const name = String(item.name || '').trim().slice(0, 120);
      const nameKey = normalizeName(name);
      if (name && nameKey && !unique.has(nameKey)) unique.set(nameKey, { name, name_key: nameKey, done: Boolean(item.done) });
    }
    if (!unique.size) { toast('Não encontrei itens para adicionar.', true); return; }
    const { error } = await supabase.from('shopping_items').upsert([...unique.values()], { onConflict: 'name_key', ignoreDuplicates: true });
    if (error) throw error;
    importDialog.close();
    await loadItems(false);
    toast('Itens importados para a lista compartilhada.');
  } catch {
    toast('Não consegui importar. Confira o formato e tente novamente.', true);
  }
});

exportButton.addEventListener('click', () => {
  const file = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items: currentItems.map(({ name, done }) => ({ name, done })) }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lista-de-compras-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast('Cópia da lista exportada.');
});

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => { void handleSession(session); }, 0); });
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) setFeedback(authFeedback, 'Não consegui verificar a sessão. Tente entrar novamente.', true);
    else void handleSession(data.session);
  });
}
