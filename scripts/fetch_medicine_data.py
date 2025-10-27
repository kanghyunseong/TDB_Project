import requests
import pandas as pd
import os
import time

API_KEY = '0f9793c39da34445a4d0'
SERVICE_ID = 'C003'  # 서비스명(데이터셋에 따라 다름)
BASE_URL = 'http://openapi.foodsafetykorea.go.kr/api'
DATA_TYPE = 'json'
BATCH_SIZE = 1000

all_rows = []
start_idx = 1

while True:
    end_idx = start_idx + BATCH_SIZE - 1
    url = f"{BASE_URL}/{API_KEY}/{SERVICE_ID}/{DATA_TYPE}/{start_idx}/{end_idx}"
    print(f"요청: {url}")
    resp = requests.get(url)
    data = resp.json()
    rows = data.get(SERVICE_ID, {}).get('row', [])
    if not rows:
        break
    all_rows.extend(rows)
    if len(rows) < BATCH_SIZE:
        break
    start_idx += BATCH_SIZE
    time.sleep(0.2)  # 과도한 요청 방지

# DataFrame으로 변환 후 CSV 저장
os.makedirs('data', exist_ok=True)
df = pd.DataFrame(all_rows)
csv_path = 'data/medicine_all.csv'
df.to_csv(csv_path, index=False, encoding='utf-8-sig')
print(f'CSV 저장 완료: {csv_path}')