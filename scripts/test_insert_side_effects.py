#!/usr/bin/env python3
"""
INSERT 스크립트가 부작용 데이터를 제대로 삽입하는지 테스트하는 스크립트
실제 데이터베이스에 샘플 데이터를 삽입하여 확인합니다.
"""

import json
import mysql.connector
from mysql.connector import Error
import os
import sys

# insert_master_data.py의 함수들 import
sys.path.append(os.path.dirname(__file__))
from insert_master_data import get_db_config, convert_medicine_format, map_json_to_db

def test_insert_side_effects():
    """부작용 데이터 삽입 테스트"""
    # 백업 파일에서 부작용이 있는 샘플 3개 찾기
    json_path = 'src/assets/medicine_backup_20251207_101001.json'
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 부작용이 있는 항목 3개 찾기
    sample_items = []
    for item in data:
        side_effect = item.get('문항6(부작용) [SEQESITM] ', '')
        if side_effect and side_effect.strip() and len(sample_items) < 3:
            sample_items.append(item)
    
    if not sample_items:
        print("❌ 부작용이 있는 샘플 항목을 찾을 수 없습니다.")
        return False
    
    print("=" * 70)
    print("📋 INSERT 부작용 데이터 테스트")
    print("=" * 70)
    print()
    
    # 데이터베이스 연결
    try:
        db_config = get_db_config()
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()
        print(f"✅ 데이터베이스 연결 성공: {db_config['database']}")
    except Error as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        return False
    
    try:
        # 각 샘플 항목에 대해 테스트
        for idx, item in enumerate(sample_items, 1):
            print(f"\n[{idx}] 테스트 항목:")
            print(f"    제품명: {item.get('제품명 [ITEMNAME] ', 'N/A')}")
            
            # 데이터 변환 및 매핑
            mapped = map_json_to_db(item, is_medicine_backup=True)
            report_no = mapped.get('report_no', '').strip()
            side_effects = mapped.get('side_effects', '').strip()
            
            print(f"    report_no: {report_no}")
            print(f"    side_effects 길이: {len(side_effects)} 문자")
            print(f"    side_effects 미리보기: {side_effects[:100]}...")
            
            if not report_no:
                print("    ❌ report_no가 없어서 스킵")
                continue
            
            if not side_effects:
                print("    ⚠️  side_effects가 비어있음")
                continue
            
            # 실제 INSERT 쿼리 실행
            insert_query = """
            INSERT INTO `medicine_master` (
                report_no, name, company_name, license_no, product_shape, shape,
                dispos, primary_function, intake_method, precautions, side_effects, storage_method,
                shelf_life, raw_materials, standard_spec, permit_date, create_date, last_update_date
            ) VALUES (
                %(report_no)s, %(name)s, %(company_name)s, %(license_no)s, %(product_shape)s, %(shape)s,
                %(dispos)s, %(primary_function)s, %(intake_method)s, %(precautions)s, %(side_effects)s, %(storage_method)s,
                %(shelf_life)s, %(raw_materials)s, %(standard_spec)s, %(permit_date)s, %(create_date)s, %(last_update_date)s
            ) ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                company_name = VALUES(company_name),
                side_effects = VALUES(side_effects),
                last_update_date = VALUES(last_update_date),
                updated_at = CURRENT_TIMESTAMP
            """
            
            try:
                cursor.execute(insert_query, mapped)
                connection.commit()
                print(f"    ✅ INSERT 성공 (rowcount: {cursor.rowcount})")
                
                # 삽입된 데이터 확인
                check_query = "SELECT report_no, name, side_effects FROM medicine_master WHERE report_no = %s"
                cursor.execute(check_query, (report_no,))
                result = cursor.fetchone()
                
                if result:
                    db_report_no, db_name, db_side_effects = result
                    print(f"    📊 DB 확인:")
                    print(f"       report_no: {db_report_no}")
                    print(f"       name: {db_name}")
                    print(f"       side_effects: {db_side_effects[:100] if db_side_effects else '(NULL)'}...")
                    
                    if db_side_effects and db_side_effects.strip():
                        print(f"    ✅ 부작용 데이터가 제대로 저장되었습니다!")
                    else:
                        print(f"    ❌ 부작용 데이터가 저장되지 않았습니다!")
                else:
                    print(f"    ❌ 데이터를 찾을 수 없습니다!")
                    
            except Error as e:
                print(f"    ❌ INSERT 실패: {e}")
                connection.rollback()
        
        print("\n" + "=" * 70)
        print("✅ 테스트 완료!")
        print("=" * 70)
        
        return True
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        connection.rollback()
        return False
    finally:
        cursor.close()
        connection.close()

if __name__ == '__main__':
    test_insert_side_effects()

