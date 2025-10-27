import json
import re

# 1. 제거할 특수문자 및 장식용 기호
decorative_symbols = r"[※★◆▶●■☆○□]"

# 2. 항목 번호(①~⑳, 유니코드 U+2460~U+2473)
item_numbers = r"[\u2460-\u2473]"

# 3. 회사 형태 및 불필요한 괄호/메타 정보
company_types = r"\((주|사|유)\)"
meta_info = r"\[표\d+\]|<.*?>|\(그림\d+\)"

# 4. 불필요한 필드
remove_keys = [
    "PRDLST_REPORT_NO", "SHAP", "PRMS_DT", "LAST_UPDT_DTM",
    "LCNS_NO", "CRET_DTM", "DISPOS", "STDR_STND"
]

# 5. 통합 정규표현식 패턴 리스트
patterns = [
    decorative_symbols,
    item_numbers,
    company_types,
    meta_info
]

def clean_text(text):
    if not isinstance(text, str):
        return text
    for pat in patterns:
        text = re.sub(pat, "", text)
    return text.strip()

input_path = "data/medicine_all.json"
output_path = "data/medicine_all_cleaned.json"

with open(input_path, "r", encoding="utf-8") as f:
    data = json.load(f)

for row in data:
    # 1. 불필요한 필드 삭제
    for key in remove_keys:
        row.pop(key, None)
    # 2. 모든 텍스트 필드 정제
    for key in row:
        row[key] = clean_text(row[key])

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"필드 삭제 + 텍스트 정제 완료: {output_path}")