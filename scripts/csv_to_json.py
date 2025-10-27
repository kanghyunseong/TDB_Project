import pandas as pd

csv_path = 'data/medicine_all.csv'
json_path = 'data/medicine_all.json'

df = pd.read_csv(csv_path)
df.to_json(json_path, orient='records', force_ascii=False, indent=2)
print(f'JSON 저장 완료: {json_path}')