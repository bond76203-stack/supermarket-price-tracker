import { getSupabaseClient, getSupabaseCredentials } from './supabase.js';
import { getCurrentUser } from './auth.js';

const LOCAL_STORAGE_RECORDS_KEY = 'supermarket_app_mock_records';

// Initial sample data for Demo mode
const INITIAL_DEMO_RECORDS = [
  {
    id: 'demo-rec-1',
    user_id: 'demo-user-12345',
    product_name: '牛乳 1L',
    store_name: 'スーパー イオン',
    price: 198,
    is_tax_included: false,
    is_sale: true,
    memo: '特売日（火曜市）。お一人様2本まで',
    confirmed_at: new Date().toISOString().split('T')[0],
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'demo-rec-2',
    user_id: 'demo-user-12345',
    product_name: '牛乳 1L',
    store_name: 'ライフ 〇〇店',
    price: 218,
    is_tax_included: true,
    is_sale: false,
    memo: '通常価格。ポイント2倍デー',
    confirmed_at: new Date().toISOString().split('T')[0],
    created_at: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: 'demo-rec-3',
    user_id: 'demo-user-12345',
    product_name: '食パン 6枚切',
    store_name: '業務スーパー',
    price: 118,
    is_tax_included: false,
    is_sale: false,
    memo: '安定して安い！',
    confirmed_at: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-rec-4',
    user_id: 'demo-user-12345',
    product_name: 'たまご 10個入',
    store_name: 'スーパー イオン',
    price: 238,
    is_tax_included: true,
    is_sale: true,
    memo: '夕方タイムセール限定',
    confirmed_at: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  }
];

/**
 * Validate input fields according to requirements
 */
export function validateRecordInput({ product_name, store_name, price, memo, confirmed_at }) {
  const errors = {};

  // product_name (text, 1〜100文字)
  const trimmedProduct = (product_name || '').trim();
  if (!trimmedProduct) {
    errors.product_name = '商品名を入力してください';
  } else if (trimmedProduct.length > 100) {
    errors.product_name = '商品名は100文字以内で入力してください';
  }

  // store_name (text, 1〜100文字)
  const trimmedStore = (store_name || '').trim();
  if (!trimmedStore) {
    errors.store_name = '店舗名を入力してください';
  } else if (trimmedStore.length > 100) {
    errors.store_name = '店舗名は100文字以内で入力してください';
  }

  // price (integer, 1以上の正の整数)
  const numPrice = Number(price);
  if (price === '' || price === null || price === undefined || isNaN(numPrice)) {
    errors.price = '価格を数値で入力してください';
  } else if (!Number.isInteger(numPrice) || numPrice < 1) {
    errors.price = '価格は1以上の正の整数（整数値）で入力してください';
  }

  // memo (text, 最大500文字)
  if (memo && memo.length > 500) {
    errors.memo = 'メモは500文字以内で入力してください';
  }

  // confirmed_at (date)
  if (!confirmed_at) {
    errors.confirmed_at = '確認日を選択してください';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Calculate tax-included estimated price (assuming 8% standard tax for groceries)
 */
export function getTaxIncludedPrice(record) {
  if (record.is_tax_included) {
    return Math.round(record.price);
  }
  return Math.round(record.price * 1.08);
}

/**
 * Get LocalStorage mock records for Demo mode
 */
function getLocalMockRecords() {
  const stored = localStorage.getItem(LOCAL_STORAGE_RECORDS_KEY);
  if (!stored) {
    localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(INITIAL_DEMO_RECORDS));
    return INITIAL_DEMO_RECORDS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return INITIAL_DEMO_RECORDS;
  }
}

function saveLocalMockRecords(records) {
  localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(records));
}

/**
 * Fetch all price records (optionally filtered by search term)
 */
export async function fetchPriceRecords(searchQuery = '') {
  const { isDemo } = getSupabaseCredentials();
  const client = getSupabaseClient();

  if (isDemo || !client) {
    let records = getLocalMockRecords();
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      records = records.filter(r => r.product_name.toLowerCase().includes(q));
    }
    // Sort by confirmed_at desc, then created_at desc
    records.sort((a, b) => new Date(b.confirmed_at || b.created_at) - new Date(a.confirmed_at || a.created_at));
    return { data: records, error: null };
  }

  try {
    let query = client.from('price_records').select('*').order('confirmed_at', { ascending: false });

    if (searchQuery.trim()) {
      query = query.ilike('product_name', `%${searchQuery.trim()}%`);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  } catch (err) {
    console.error('Error fetching price records:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Fetch records created by current logged-in user
 */
export async function fetchMyRecords() {
  const user = getCurrentUser();
  if (!user) return { data: [], error: 'ログインしていません' };

  const { isDemo } = getSupabaseCredentials();
  const client = getSupabaseClient();

  if (isDemo || !client) {
    const records = getLocalMockRecords().filter(r => r.user_id === user.id);
    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { data: records, error: null };
  }

  try {
    const { data, error } = await client
      .from('price_records')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return { data: data || [], error };
  } catch (err) {
    console.error('Error fetching my records:', err);
    return { data: [], error: err.message };
  }
}

/**
 * Create a new price record
 */
export async function createPriceRecord(recordData) {
  const user = getCurrentUser();
  if (!user) return { data: null, error: 'ログインしてください' };

  const validation = validateRecordInput(recordData);
  if (!validation.isValid) {
    return { data: null, error: '入力内容に不備があります', validationErrors: validation.errors };
  }

  const { isDemo } = getSupabaseCredentials();
  const client = getSupabaseClient();

  const payload = {
    user_id: user.id,
    product_name: recordData.product_name.trim(),
    store_name: recordData.store_name.trim(),
    price: parseInt(recordData.price, 10),
    is_tax_included: Boolean(recordData.is_tax_included),
    is_sale: Boolean(recordData.is_sale),
    memo: recordData.memo ? recordData.memo.trim() : '',
    confirmed_at: recordData.confirmed_at || new Date().toISOString().split('T')[0]
  };

  if (isDemo || !client) {
    const newRecord = {
      ...payload,
      id: 'demo-rec-' + Date.now(),
      created_at: new Date().toISOString()
    };
    const records = getLocalMockRecords();
    records.unshift(newRecord);
    saveLocalMockRecords(records);
    return { data: newRecord, error: null };
  }

  try {
    const { data, error } = await client
      .from('price_records')
      .insert([payload])
      .select()
      .single();

    return { data, error };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Update an existing price record
 */
export async function updatePriceRecord(id, recordData) {
  const user = getCurrentUser();
  if (!user) return { data: null, error: 'ログインしてください' };

  const validation = validateRecordInput(recordData);
  if (!validation.isValid) {
    return { data: null, error: '入力内容に不備があります', validationErrors: validation.errors };
  }

  const { isDemo } = getSupabaseCredentials();
  const client = getSupabaseClient();

  const payload = {
    product_name: recordData.product_name.trim(),
    store_name: recordData.store_name.trim(),
    price: parseInt(recordData.price, 10),
    is_tax_included: Boolean(recordData.is_tax_included),
    is_sale: Boolean(recordData.is_sale),
    memo: recordData.memo ? recordData.memo.trim() : '',
    confirmed_at: recordData.confirmed_at
  };

  if (isDemo || !client) {
    let records = getLocalMockRecords();
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return { data: null, error: '対象レコードが見つかりません' };
    if (records[idx].user_id !== user.id) return { data: null, error: '編集権限がありません' };

    records[idx] = { ...records[idx], ...payload };
    saveLocalMockRecords(records);
    return { data: records[idx], error: null };
  }

  try {
    const { data, error } = await client
      .from('price_records')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    return { data, error };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Delete a price record
 */
export async function deletePriceRecord(id) {
  const user = getCurrentUser();
  if (!user) return { error: 'ログインしてください' };

  const { isDemo } = getSupabaseCredentials();
  const client = getSupabaseClient();

  if (isDemo || !client) {
    let records = getLocalMockRecords();
    records = records.filter(r => r.id !== id);
    saveLocalMockRecords(records);
    return { error: null };
  }

  try {
    const { error } = await client
      .from('price_records')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    return { error };
  } catch (err) {
    return { error: err.message };
  }
}
