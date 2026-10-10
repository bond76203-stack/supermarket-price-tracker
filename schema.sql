-- ==========================================
-- スーパー底値・価格比較Webアプリ データベース初期化SQL
-- Supabase Dashboard の SQL Editor で実行してください
-- ==========================================

-- 1. price_records テーブルの作成
CREATE TABLE IF NOT EXISTS public.price_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 100),
    store_name TEXT NOT NULL CHECK (char_length(store_name) BETWEEN 1 AND 100),
    price INTEGER NOT NULL CHECK (price >= 1),
    is_tax_included BOOLEAN NOT NULL DEFAULT true,
    is_sale BOOLEAN NOT NULL DEFAULT false,
    memo TEXT CHECK (memo IS NULL OR char_length(memo) <= 500),
    confirmed_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックスの作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_price_records_product_name ON public.price_records (product_name);
CREATE INDEX IF NOT EXISTS idx_price_records_user_id ON public.price_records (user_id);
CREATE INDEX IF NOT EXISTS idx_price_records_confirmed_at ON public.price_records (confirmed_at DESC);

-- 2. Row Level Security (RLS) の有効化
ALTER TABLE public.price_records ENABLE ROW LEVEL SECURITY;

-- 3. RLS ポリシーの設定

-- ① 閲覧ポリシー: ログイン済み（ authenticated ）ユーザー全員が全投稿を閲覧可能
CREATE POLICY "ログインユーザーはすべての価格投稿を閲覧可能"
ON public.price_records
FOR SELECT
TO authenticated
USING (true);

-- ② 追加ポリシー: ログインユーザーが自身の user_id で新規投稿可能
CREATE POLICY "ユーザーは自身の投稿を作成可能"
ON public.price_records
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ③ 更新ポリシー: ユーザーは自分が登録したデータのみ更新可能
CREATE POLICY "ユーザーは自身の投稿のみ更新可能"
ON public.price_records
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ④ 削除ポリシー: ユーザーは自分が登録したデータのみ削除可能
CREATE POLICY "ユーザーは自身の投稿のみ削除可能"
ON public.price_records
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
