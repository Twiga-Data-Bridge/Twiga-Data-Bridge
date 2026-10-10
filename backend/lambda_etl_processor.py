import json
import urllib.parse
import urllib.request
import boto3
import pandas as pd
import os
from datetime import datetime

s3_client = boto3.client('s3')
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']

def lambda_handler(event, context):
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')

    if not key.startswith('incoming/'):
        return {"statusCode": 200, "body": "Skipped non-incoming file."}

    local_file = f"/tmp/{os.path.basename(key)}"

    try:
        s3_client.download_file(bucket, key, local_file)
        df = pd.read_csv(local_file)

        df['Line_Total'] = (df['Quantity'] * df['Unit_Price']) - df['Discount']

        product_stats = df.groupby(['SKU', 'Product_Name']).agg(
            Total_Volume=('Line_Total', 'sum'),
            Total_Count=('Quantity', 'sum')
        ).reset_index()

        report_date = datetime.now().strftime("%Y-%m-%d")
        payload = []

        for _, row in product_stats.iterrows():
            payload.append({
                "report_date": report_date,
                "metric_type": "PRODUCT_PERFORMANCE",
                "metric_key": row['SKU'],
                "metric_label": row['Product_Name'],
                "total_volume": float(row['Total_Volume']),
                "total_count": int(row['Total_Count'])
            })

        endpoint = f"{SUPABASE_URL}/rest/v1/daily_aggregates"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }

        req = urllib.request.Request(endpoint, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
        with urllib.request.urlopen(req) as resp:
            print(f"Supabase upsert status: {resp.getcode()}")

        archive_key = key.replace('incoming/', 'processed/')
        s3_client.copy_object(Bucket=bucket, CopySource={'Bucket': bucket, 'Key': key}, Key=archive_key)
        s3_client.delete_object(Bucket=bucket, Key=key)

        return {"statusCode": 200, "body": "ETL complete"}
    except Exception as e:
        print(f"ETL Error: {e}")
        raise e
