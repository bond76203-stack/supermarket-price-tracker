import { createIcons, icons } from 'lucide';
import { getSupabaseCredentials, saveSupabaseCredentials } from './supabase.js';
import { initAuth, signIn, signUp, signOut, getCurrentUser, onAuthStateChanged } from './auth.js';
import {
  fetchPriceRecords,
  fetchMyRecords,
  createPriceRecord,
  updatePriceRecord,
  deletePriceRecord,
  getTaxIncludedPrice,
  validateRecordInput
} from './records.js';

let isSignUpMode = false;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Lucide Icons
  renderIcons();

  // 2. Set default date picker to today
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('confirmed_at');
  if (dateInput) dateInput.value = today;

  // 3. Setup Supabase Config Modal values
  const { url, anonKey, isDemo } = getSupabaseCredentials();
  const cfgUrl = document.getElementById('cfg-url');
  const cfgAnon = document.getElementById('cfg-anon');
  const cfgDemo = document.getElementById('cfg-demo-mode');
  const demoBadge = document.getElementById('demo-indicator');

  if (cfgUrl) cfgUrl.value = url;
  if (cfgAnon) cfgAnon.value = anonKey;
  if (cfgDemo) cfgDemo.checked = isDemo;
  if (demoBadge) demoBadge.style.display = isDemo ? 'inline-block' : 'none';

  // 4. Listen to Auth State
  onAuthStateChanged(user => {
    updateAuthUI(user);
    // Reload views upon auth state change
    loadSearchResults();
    loadMyPostsView();
  });

  await initAuth();

  // 5. Setup Navigation Tabs
  setupTabNavigation();

  // 6. Setup Event Listeners
  setupFormEvents();
  setupSearchEvents();
  setupAuthModalEvents();
  setupEditModalEvents();
});

function renderIcons() {
  createIcons({ icons });
}

/**
 * Show Toast Notification
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  const msgSpan = document.getElementById('toast-message');
  if (toast && msgSpan) {
    msgSpan.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
}

/**
 * Update Header and Auth UI Elements
 */
function updateAuthUI(user) {
  const authLabel = document.getElementById('auth-btn-label');
  const authModal = document.getElementById('auth-modal');

  if (user) {
    if (authLabel) authLabel.textContent = user.email ? user.email.split('@')[0] : 'マイページ';
    if (authModal && authModal.classList.contains('open') && !document.getElementById('supabase-config-body')?.style.display.includes('block')) {
      authModal.classList.remove('open');
    }
  } else {
    if (authLabel) authLabel.textContent = 'ログイン';
  }
}

/**
 * Navigation Tab Switcher
 */
function setupTabNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewSections = document.querySelectorAll('.view-section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetId = item.dataset.target;

      if (item.id === 'nav-account-btn') {
        const user = getCurrentUser();
        if (user) {
          // If already logged in, prompt logout or config
          openAuthModal();
        } else {
          openAuthModal();
        }
        return;
      }

      const user = getCurrentUser();
      // Auth Guard for Register & MyPosts
      if (!user && (targetId === 'view-register' || targetId === 'view-myposts')) {
        showToast('閲覧・投稿にはログインが必要です');
        openAuthModal();
        return;
      }

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      viewSections.forEach(sec => {
        if (sec.id === targetId) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });

      if (targetId === 'view-search') loadSearchResults();
      if (targetId === 'view-myposts') loadMyPostsView();
    });
  });
}

/**
 * Search & Compare View Renderer
 */
async function loadSearchResults() {
  const container = document.getElementById('search-results-container');
  const searchInput = document.getElementById('search-input');
  if (!container) return;

  const query = searchInput ? searchInput.value : '';
  container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">読み込み中...</div>';

  const user = getCurrentUser();
  if (!user) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="lock" style="width: 48px; height: 48px;"></i>
        <h3 style="margin-bottom: 8px; color: var(--text-main);">ログインが必要です</h3>
        <p style="margin-bottom: 16px;">価格データの閲覧および店舗比較を行うにはログインが必要です。</p>
        <button id="search-login-btn" class="btn-primary" style="max-width: 220px; margin: 0 auto;">
          <i data-lucide="log-in"></i> ログイン / 新規登録
        </button>
      </div>
    `;
    renderIcons();
    document.getElementById('search-login-btn')?.addEventListener('click', openAuthModal);
    return;
  }

  const { data: records, error } = await fetchPriceRecords(query);

  if (error) {
    container.innerHTML = `<div class="empty-state"><p style="color: var(--sale-red);">エラー: ${error}</p></div>`;
    return;
  }

  if (!records || records.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="shopping-cart" style="width: 48px; height: 48px;"></i>
        <p>${query ? '該当する価格記録が見つかりませんでした' : '登録された価格データがまだありません'}</p>
      </div>
    `;
    renderIcons();
    return;
  }

  // Group records by product_name
  const grouped = {};
  records.forEach(rec => {
    const key = rec.product_name.trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(rec);
  });

  let html = '';
  Object.keys(grouped).forEach(productName => {
    const itemRecords = grouped[productName];

    // Find lowest price calculated by tax-included price
    let lowestTaxIncPrice = Infinity;
    itemRecords.forEach(r => {
      const taxInc = getTaxIncludedPrice(r);
      if (taxInc < lowestTaxIncPrice) lowestTaxIncPrice = taxInc;
    });

    html += `
      <div class="comparison-group card">
        <div class="group-title-bar">
          <div class="group-title">
            <i data-lucide="package" style="color: var(--primary);"></i>
            <span>${escapeHtml(productName)}</span>
          </div>
          <span class="lowest-price-badge-header">
            <i data-lucide="crown" style="width: 14px; height: 14px;"></i> 底値: ¥${lowestTaxIncPrice.toLocaleString()} (税込)
          </span>
        </div>
        <div class="records-list">
    `;

    itemRecords.forEach(rec => {
      const taxIncPrice = getTaxIncludedPrice(rec);
      const isLowest = (taxIncPrice === lowestTaxIncPrice);

      html += `
        <div class="price-card ${isLowest ? 'is-lowest' : ''}">
          <div class="price-card-left">
            <div class="store-name-row">
              <span>${escapeHtml(rec.store_name)}</span>
              ${rec.is_sale ? '<span class="sale-tag">特売</span>' : ''}
            </div>
            <div class="record-meta">
              <span><i data-lucide="calendar" style="width: 12px; height: 12px; vertical-align: middle;"></i> ${rec.confirmed_at || '未設定'}</span>
              <span>${rec.is_tax_included ? '税込表記' : '税別表記'}</span>
            </div>
            ${rec.memo ? `<div class="record-memo">${escapeHtml(rec.memo)}</div>` : ''}
          </div>

          <div class="price-card-right">
            <div class="price-display">
              ¥${rec.price.toLocaleString()}
            </div>
            <div class="tax-unit">${rec.is_tax_included ? '(税込)' : '(税別)'}</div>
            ${!rec.is_tax_included ? `<div class="tax-calc-note">税込約 ¥${taxIncPrice.toLocaleString()}</div>` : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  renderIcons();
}

/**
 * Load My Posts View
 */
async function loadMyPostsView() {
  const container = document.getElementById('myposts-container');
  const countSpan = document.getElementById('myposts-count');
  if (!container) return;

  const user = getCurrentUser();
  if (!user) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="lock" style="width: 48px; height: 48px;"></i>
        <h3 style="margin-bottom: 8px; color: var(--text-main);">ログインが必要です</h3>
        <p style="margin-bottom: 16px;">マイ投稿の確認・編集を行うにはログインしてください。</p>
        <button id="myposts-login-btn" class="btn-primary" style="max-width: 220px; margin: 0 auto;">
          <i data-lucide="log-in"></i> ログイン
        </button>
      </div>
    `;
    renderIcons();
    document.getElementById('myposts-login-btn')?.addEventListener('click', openAuthModal);
    if (countSpan) countSpan.textContent = '0件';
    return;
  }

  container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">読み込み中...</div>';

  const { data: records, error } = await fetchMyRecords();

  if (error) {
    container.innerHTML = `<div class="empty-state"><p style="color: var(--sale-red);">エラー: ${error}</p></div>`;
    return;
  }

  if (countSpan) countSpan.textContent = `${records.length}件`;

  if (!records || records.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="edit-3" style="width: 48px; height: 48px;"></i>
        <p>あなたが登録した価格データはまだありません。</p>
      </div>
    `;
    renderIcons();
    return;
  }

  let html = '';
  records.forEach(rec => {
    const taxIncPrice = getTaxIncludedPrice(rec);
    html += `
      <div class="card" style="margin-bottom: 12px; padding: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 700; font-size: 1rem; color: var(--text-main); margin-bottom: 2px;">
              ${escapeHtml(rec.product_name)}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
              <span>${escapeHtml(rec.store_name)}</span>
              ${rec.is_sale ? '<span class="sale-tag">特売</span>' : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">
              ¥${rec.price.toLocaleString()}
            </div>
            <div style="font-size: 0.725rem; color: var(--text-muted);">${rec.is_tax_included ? '(税込)' : `(税別 / 税込約¥${taxIncPrice})`}</div>
          </div>
        </div>

        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>確認日: ${rec.confirmed_at || '未指定'}</span>
          <div class="card-actions">
            <button class="icon-btn edit-post-btn" data-id="${rec.id}">
              <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
            </button>
            <button class="icon-btn delete delete-post-btn" data-id="${rec.id}">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          </div>
        </div>
        ${rec.memo ? `<div class="record-memo" style="margin-top: 8px;">${escapeHtml(rec.memo)}</div>` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
  renderIcons();

  // Attach Edit/Delete Listeners
  container.querySelectorAll('.edit-post-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const recId = btn.dataset.id;
      const target = records.find(r => r.id === recId);
      if (target) openEditModal(target);
    });
  });

  container.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const recId = btn.dataset.id;
      if (confirm('この投稿を削除してもよろしいですか？')) {
        const { error } = await deletePriceRecord(recId);
        if (error) {
          showToast('削除に失敗しました: ' + error);
        } else {
          showToast('削除しました');
          loadMyPostsView();
          loadSearchResults();
        }
      }
    });
  });
}

/**
 * Setup Forms and Toggles
 */
function setupFormEvents() {
  const recordForm = document.getElementById('record-form');

  // Toggle Chip behaviors
  const taxToggle = document.getElementById('toggle-tax');
  const taxCheckbox = document.getElementById('is_tax_included');
  if (taxToggle && taxCheckbox) {
    taxToggle.addEventListener('click', () => {
      taxCheckbox.checked = !taxCheckbox.checked;
      taxToggle.classList.toggle('active', taxCheckbox.checked);
    });
  }

  const saleToggle = document.getElementById('toggle-sale');
  const saleCheckbox = document.getElementById('is_sale');
  if (saleToggle && saleCheckbox) {
    saleToggle.addEventListener('click', () => {
      saleCheckbox.checked = !saleCheckbox.checked;
      saleToggle.classList.toggle('active-sale', saleCheckbox.checked);
    });
  }

  // Handle Form Submit
  if (recordForm) {
    recordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Clear previous error messages
      clearFormErrors(['product_name', 'store_name', 'price', 'confirmed_at', 'memo']);

      const formData = {
        product_name: document.getElementById('product_name').value,
        store_name: document.getElementById('store_name').value,
        price: document.getElementById('price').value,
        is_tax_included: document.getElementById('is_tax_included').checked,
        is_sale: document.getElementById('is_sale').checked,
        confirmed_at: document.getElementById('confirmed_at').value,
        memo: document.getElementById('memo').value
      };

      const result = await createPriceRecord(formData);

      if (result.error) {
        if (result.validationErrors) {
          showFormErrors(result.validationErrors);
        } else {
          showToast(result.error);
        }
        return;
      }

      showToast('価格を正常に登録しました！');

      // Reset form
      recordForm.reset();
      document.getElementById('confirmed_at').value = new Date().toISOString().split('T')[0];
      if (taxToggle && taxCheckbox) {
        taxCheckbox.checked = true;
        taxToggle.classList.add('active');
      }
      if (saleToggle && saleCheckbox) {
        saleCheckbox.checked = false;
        saleToggle.classList.remove('active-sale');
      }

      // Switch to search tab to see updated comparison
      document.querySelector('[data-target="view-search"]')?.click();
    });
  }
}

/**
 * Setup Real-time Search Events
 */
function setupSearchEvents() {
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search');

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      if (clearBtn) clearBtn.style.display = searchInput.value ? 'block' : 'none';
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadSearchResults();
      }, 250);
    });
  }

  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      loadSearchResults();
    });
  }
}

/**
 * Auth & Config Modal Logic
 */
function setupAuthModalEvents() {
  const modal = document.getElementById('auth-modal');
  const closeBtn = document.getElementById('close-auth-modal');
  const authStatusBtn = document.getElementById('auth-status-btn');
  const tabLogin = document.getElementById('tab-login');
  const tabSignUp = document.getElementById('tab-signup');
  const authForm = document.getElementById('auth-form');
  const authSubmitBtn = document.getElementById('auth-submit-btn');

  const toggleCfgBtn = document.getElementById('toggle-supabase-config');
  const cfgBody = document.getElementById('supabase-config-body');
  const saveCfgBtn = document.getElementById('save-config-btn');

  if (authStatusBtn) authStatusBtn.addEventListener('click', openAuthModal);
  if (closeBtn) closeBtn.addEventListener('click', () => modal?.classList.remove('open'));

  if (tabLogin && tabSignUp) {
    tabLogin.addEventListener('click', () => {
      isSignUpMode = false;
      tabLogin.classList.add('active');
      tabSignUp.classList.remove('active');
      if (authSubmitBtn) authSubmitBtn.textContent = 'ログインする';
    });

    tabSignUp.addEventListener('click', () => {
      isSignUpMode = true;
      tabSignUp.classList.add('active');
      tabLogin.classList.remove('active');
      if (authSubmitBtn) authSubmitBtn.textContent = '新規アカウントを登録';
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      const errEl = document.getElementById('auth-error-msg');
      if (errEl) errEl.textContent = '';

      if (isSignUpMode) {
        const { error } = await signUp(email, password);
        if (error) {
          if (errEl) errEl.textContent = error.message || '登録エラーが発生しました';
        } else {
          showToast('新規登録・ログインしました');
          modal?.classList.remove('open');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (errEl) errEl.textContent = error.message || 'ログインに失敗しました';
        } else {
          showToast('ログインしました');
          modal?.classList.remove('open');
        }
      }
    });
  }

  if (toggleCfgBtn && cfgBody) {
    toggleCfgBtn.addEventListener('click', () => {
      cfgBody.style.display = cfgBody.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (saveCfgBtn) {
    saveCfgBtn.addEventListener('click', () => {
      const url = document.getElementById('cfg-url').value;
      const key = document.getElementById('cfg-anon').value;
      const demo = document.getElementById('cfg-demo-mode').checked;

      saveSupabaseCredentials(url, key, demo);
      showToast('Supabase接続設定を保存しました');

      const demoBadge = document.getElementById('demo-indicator');
      if (demoBadge) demoBadge.style.display = demo ? 'inline-block' : 'none';

      initAuth();
    });
  }
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  const user = getCurrentUser();

  if (user) {
    if (confirm(`現在 ${user.email || 'デモユーザー'} でログイン中です。\nログアウトしますか？`)) {
      signOut();
      showToast('ログアウトしました');
    }
    return;
  }

  if (modal) modal.classList.add('open');
}

/**
 * Edit Record Modal Handlers
 */
function setupEditModalEvents() {
  const editModal = document.getElementById('edit-modal');
  const closeBtn = document.getElementById('close-edit-modal');
  const editForm = document.getElementById('edit-record-form');

  const taxToggle = document.getElementById('edit-toggle-tax');
  const taxCheckbox = document.getElementById('edit-is_tax_included');
  if (taxToggle && taxCheckbox) {
    taxToggle.addEventListener('click', () => {
      taxCheckbox.checked = !taxCheckbox.checked;
      taxToggle.classList.toggle('active', taxCheckbox.checked);
    });
  }

  const saleToggle = document.getElementById('edit-toggle-sale');
  const saleCheckbox = document.getElementById('edit-is_sale');
  if (saleToggle && saleCheckbox) {
    saleToggle.addEventListener('click', () => {
      saleCheckbox.checked = !saleCheckbox.checked;
      saleToggle.classList.toggle('active-sale', saleCheckbox.checked);
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', () => editModal?.classList.remove('open'));

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFormErrors(['product_name', 'store_name', 'price', 'confirmed_at', 'memo'], 'edit-err-');

      const id = document.getElementById('edit-id').value;
      const formData = {
        product_name: document.getElementById('edit-product_name').value,
        store_name: document.getElementById('edit-store_name').value,
        price: document.getElementById('edit-price').value,
        is_tax_included: document.getElementById('edit-is_tax_included').checked,
        is_sale: document.getElementById('edit-is_sale').checked,
        confirmed_at: document.getElementById('edit-confirmed_at').value,
        memo: document.getElementById('edit-memo').value
      };

      const result = await updatePriceRecord(id, formData);

      if (result.error) {
        if (result.validationErrors) {
          showFormErrors(result.validationErrors, 'edit-err-');
        } else {
          showToast(result.error);
        }
        return;
      }

      showToast('価格情報を更新しました');
      editModal?.classList.remove('open');
      loadMyPostsView();
      loadSearchResults();
    });
  }
}

function openEditModal(record) {
  const editModal = document.getElementById('edit-modal');
  if (!editModal) return;

  document.getElementById('edit-id').value = record.id;
  document.getElementById('edit-product_name').value = record.product_name;
  document.getElementById('edit-store_name').value = record.store_name;
  document.getElementById('edit-price').value = record.price;

  const taxCb = document.getElementById('edit-is_tax_included');
  const taxTg = document.getElementById('edit-toggle-tax');
  taxCb.checked = Boolean(record.is_tax_included);
  if (taxTg) taxTg.classList.toggle('active', taxCb.checked);

  const saleCb = document.getElementById('edit-is_sale');
  const saleTg = document.getElementById('edit-toggle-sale');
  saleCb.checked = Boolean(record.is_sale);
  if (saleTg) saleTg.classList.toggle('active-sale', saleCb.checked);

  document.getElementById('edit-confirmed_at').value = record.confirmed_at || new Date().toISOString().split('T')[0];
  document.getElementById('edit-memo').value = record.memo || '';

  editModal.classList.add('open');
}

/**
 * Form Helper Utilities
 */
function clearFormErrors(fields, prefix = 'err-') {
  fields.forEach(f => {
    const el = document.getElementById(prefix + f);
    if (el) el.textContent = '';
  });
}

function showFormErrors(errors, prefix = 'err-') {
  Object.keys(errors).forEach(key => {
    const el = document.getElementById(prefix + key);
    if (el) el.textContent = errors[key];
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}
