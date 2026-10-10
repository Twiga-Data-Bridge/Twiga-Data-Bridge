-- Table 1: Raw Transactions (Append-Only Log)
CREATE TABLE public.raw_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    cashier TEXT NOT NULL,
    sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) DEFAULT 0.00,
    payment_method TEXT NOT NULL,
    line_total NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 2: Daily Aggregates (BI Dashboard Data)
CREATE TABLE public.daily_aggregates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_date DATE NOT NULL,
    metric_type TEXT NOT NULL, 
    metric_key TEXT NOT NULL,  
    metric_label TEXT,         
    total_volume NUMERIC(12, 2) DEFAULT 0.00,
    total_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(report_date, metric_type, metric_key)
);

ALTER TABLE public.raw_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_aggregates ENABLE ROW LEVEL SECURITY;

-- Allow public read access for the PWA dashboard via anon key
CREATE POLICY "Allow public read daily_aggregates" 
ON public.daily_aggregates FOR SELECT 
TO anon USING (true);
