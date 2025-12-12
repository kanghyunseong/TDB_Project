#!/usr/bin/env python3
"""
JSON 파일과 데이터베이스 데이터를 확인하고 수정하는 스크립트
"""

import json
import os
import sys

def check_json_files():
    """JSON 파일의 내용을 확인"""
    print("=" * 70)
    print("📋 JSON 파일 확인")
    print("=" * 70)
    
    medicine_json = 'src/assets/medicine.json'
    tablet_json = 'src/assets/tablet.json'
    
    # medicine.json 확인
    if os.path.exists(medicine_json):
        print(f"\n📂 {medicine_json} 확인 중...")
        with open(medicine_json, 'r', encoding='utf-8') as f:
            medicine_data = json.load(f)
        
        if isinstance(medicine_data, list) and len(medicine_data) > 0:
            sample = medicine_data[0]
            print(f"   ✅ 파일 존재: {len(medicine_data):,}개 항목")
            print(f"   📝 샘플 데이터:")
            print(f"      - 제품명: {sample.get('PRDLST_NM', 'N/A')}")
            print(f"      - 신고번호: {sample.get('PRDLST_REPORT_NO', 'N/A')}")
            print(f"      - 업체명: {sample.get('BSSH_NM', 'N/A')}")
        else:
            print(f"   ❌ 파일이 비어있거나 잘못된 형식입니다.")
    else:
        print(f"   ❌ 파일이 없습니다: {medicine_json}")
    
    # tablet.json 확인
    if os.path.exists(tablet_json):
        print(f"\n📂 {tablet_json} 확인 중...")
        with open(tablet_json, 'r', encoding='utf-8') as f:
            tablet_data = json.load(f)
        
        if isinstance(tablet_data, list) and len(tablet_data) > 0:
            sample = tablet_data[0]
            print(f"   ✅ 파일 존재: {len(tablet_data):,}개 항목")
            print(f"   📝 샘플 데이터:")
            print(f"      - 제품명: {sample.get('PRDLST_NM', 'N/A')}")
            print(f"      - 신고번호: {sample.get('PRDLST_REPORT_NO', 'N/A')}")
            print(f"      - 업체명: {sample.get('BSSH_NM', 'N/A')}")
        else:
            print(f"   ❌ 파일이 비어있거나 잘못된 형식입니다.")
    else:
        print(f"   ❌ 파일이 없습니다: {tablet_json}")
    
    # 두 파일의 샘플 데이터 비교
    if os.path.exists(medicine_json) and os.path.exists(tablet_json):
        print(f"\n🔍 두 파일 비교 중...")
        with open(medicine_json, 'r', encoding='utf-8') as f:
            medicine_data = json.load(f)
        with open(tablet_json, 'r', encoding='utf-8') as f:
            tablet_data = json.load(f)
        
        if isinstance(medicine_data, list) and isinstance(tablet_data, list):
            # 첫 번째 항목의 신고번호 비교
            med_sample = medicine_data[0] if len(medicine_data) > 0 else {}
            tab_sample = tablet_data[0] if len(tablet_data) > 0 else {}
            
            med_report_no = med_sample.get('PRDLST_REPORT_NO', '')
            tab_report_no = tab_sample.get('PRDLST_REPORT_NO', '')
            
            if med_report_no == tab_report_no:
                print(f"   ⚠️  경고: 두 파일의 첫 번째 항목 신고번호가 같습니다!")
                print(f"      - medicine.json: {med_report_no}")
                print(f"      - tablet.json: {tab_report_no}")
                print(f"      → 같은 데이터가 들어있을 가능성이 높습니다!")
            else:
                print(f"   ✅ 두 파일의 신고번호가 다릅니다 (정상)")
                print(f"      - medicine.json: {med_report_no}")
                print(f"      - tablet.json: {tab_report_no}")
            
            # 중복된 신고번호 확인
            med_report_nos = {item.get('PRDLST_REPORT_NO', '') for item in medicine_data if item.get('PRDLST_REPORT_NO')}
            tab_report_nos = {item.get('PRDLST_REPORT_NO', '') for item in tablet_data if item.get('PRDLST_REPORT_NO')}
            duplicates = med_report_nos & tab_report_nos
            
            if duplicates:
                print(f"   ⚠️  경고: {len(duplicates):,}개의 중복된 신고번호가 발견되었습니다!")
                print(f"      → 일부 데이터가 두 파일에 모두 포함되어 있습니다.")
            else:
                print(f"   ✅ 중복된 신고번호 없음 (정상)")

def print_instructions():
    """수정 방법 안내"""
    print("\n" + "=" * 70)
    print("🔧 데이터 수정 방법")
    print("=" * 70)
    print("""
1. JSON 파일 확인:
   - medicine.json: 의약품 데이터여야 함 (예: 타이레놀, 아스피린 등)
   - tablet.json: 건강기능식품 데이터여야 함 (예: 비타민, 영양제 등)

2. 데이터베이스 정리:
   - 두 테이블을 모두 비우고 올바른 데이터로 재삽입
   - 또는 중복된 데이터만 삭제

3. 올바른 데이터 수집:
   - 의약품: 식약처 공공데이터 API C003 서비스 (의약품)
   - 건강기능식품: 식약처 공공데이터 API C003 서비스 (건강기능식품)

4. 재삽입:
   python3 scripts/insert_master_data.py
    """)

if __name__ == '__main__':
    check_json_files()
    print_instructions()

