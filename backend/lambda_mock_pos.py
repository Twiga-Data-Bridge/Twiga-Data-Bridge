import csv
import random
import os
import boto3
from datetime import datetime, timedelta

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'simba-pos-simulation-bucket')
PREFIX = 'incoming/'
s3_client = boto3.client('s3')

CASHIERS = ['Mary', 'John', 'Alice', 'David']
PAYMENT_METHODS = ['M-Pesa', 'Card', 'Cash']
PRODUCTS = [
    {'sku': 'SKU-B01', 'name': 'Tusker Lager 500ml', 'price': 200.00},
    {'sku': 'SKU-M02', 'name': 'Unga Maize Meal 2kg', 'price': 210.00},
    {'sku': 'SKU-C12', 'name': 'Coca-Cola 500ml', 'price': 70.00},
    {'sku': 'SKU-S05', 'name': 'Kenchic Sausage', 'price': 60.00}
]

def generate_transactions(num_receipts=25):
    transactions = []
    base_time = datetime.now().replace(hour=8, minute=0, second=0)
    txn_id_counter = random.randint(1000, 9999)

    for _ in range(num_receipts):
        txn_id_counter += 1
        txn_id = f"TXN-{txn_id_counter}"
        cashier = random.choice(CASHIERS)
        payment_method = random.choice(PAYMENT_METHODS)
        base_time += timedelta(minutes=random.randint(5, 40))

        num_items = random.randint(1, 4)
        receipt_items = random.sample(PRODUCTS, num_items)

        for item in receipt_items:
            quantity = random.randint(1, 5)
            discount = random.choice([0, 0, 0, 10.00])
            transactions.append([
                txn_id,
                base_time.strftime("%Y-%m-%d %H:%M:%S"),
                cashier,
                item['sku'],
                item['name'],
                quantity,
                item['price'],
                discount,
                payment_method
            ])
    return transactions

def lambda_handler(event, context):
    data = generate_transactions()
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"simba_export_{timestamp_str}.csv"
    s3_key = f"{PREFIX}{filename}"
    tmp_filepath = f"/tmp/{filename}"

    headers = ['Transaction_ID', 'Timestamp', 'Cashier', 'SKU', 'Product_Name', 'Quantity', 'Unit_Price', 'Discount', 'Payment_Method']

    with open(tmp_filepath, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(headers)
        writer.writerows(data)

    s3_client.upload_file(tmp_filepath, BUCKET_NAME, s3_key)
    return {"statusCode": 200, "body": f"Exported {filename} to {BUCKET_NAME}"}
