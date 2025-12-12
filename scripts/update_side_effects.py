#!/usr/bin/env python3
"""
기존 데이터베이스에 부작용 정보를 업데이트하는 스크립트
이미 삽입된 데이터에 부작용 정보를 추가합니다.
"""

import json
import os
from mysql.connector import connect, Error
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

def get_db_config():
    """데이터베이스 설정 가져오기"""
    return {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 3306)),
        'user': os.getenv('DB_USERNAME', 'root'),
        'password': os.getenv('DB_PASSWORD', ''),
        'database': os.getenv('DB_NAME', 'tdb'),
        'charset': 'utf8mb4',
        'collation': 'utf8mb4_unicode_ci',
        'autocommit': False
    }

def convert_medicine_format(old_item):
    """의약품 백업 파일 형식을 현재 형식으로 변환"""
    return {
        'PRDLST_REPORT_NO': (old_item.get('품목기준코드 [ITEMSEQ] ', '') or old_item.get('품목기준코드 [ITEMSEQ]', '') or old_item.get('ITEMSEQ', '')).strip(),
        'SEQESITM': (old_item.get('문항6(부작용) [SEQESITM] ', '') or old_item.get('문항6(부작용) [SEQESITM]', '') or old_item.get('SEQESITM', '')).strip(),
    }

def update_side_effects():
    """부작용 정보를 데이터베이스에 업데이트"""
    json_path = 'src/assets/medicine_backup_20251207_101001.json'
    
    if not os.path.exists(json_path):
        print(f"❌ 파일을 찾을 수 없습니다: {json_path}")
        return False
    
    print(f"\n📂 {json_path} 로딩 중...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            print(f"❌ JSON 파일이 배열 형식이 아닙니다.")
            return False
        
        print(f"✅ {len(data):,}개 항목 로드 완료")
        
        # 데이터베이스 연결
        config = get_db_config()
        connection = connect(**config)
        cursor = connection.cursor()
        
        print(f"\n🔄 부작용 정보 업데이트 중...")
        
        updated_count = 0
        skipped_count = 0
        error_count = 0
        
        for i, item in enumerate(data):
            if (i + 1) % 1000 == 0:
                print(f"  진행 중: {i + 1:,}/{len(data):,}개 ({updated_count:,}개 업데이트)")
            
            # 변환
            converted = convert_medicine_format(item)
            report_no = converted.get('PRDLST_REPORT_NO', '').strip()
            side_effects = converted.get('SEQESITM', '').strip()
            
            if not report_no:
                skipped_count += 1
                continue
            
            if not side_effects:
                skipped_count += 1
                continue
            
            # 데이터베이스 업데이트
            try:
                update_query = """
                UPDATE `medicine_master`
                SET `side_effects` = %s, `updated_at` = CURRENT_TIMESTAMP
                WHERE `report_no` = %s
                """
                cursor.execute(update_query, (side_effects, report_no))
                
                if cursor.rowcount > 0:
                    updated_count += 1
                else:
                    skipped_count += 1
            except Error as e:
                error_count += 1
                if error_count <= 10:
                    print(f"  ❌ 업데이트 실패 (report_no: {report_no}): {e}")
        
        connection.commit()
        cursor.close()
        connection.close()
        
        print(f"\n✅ 부작용 정보 업데이트 완료!")
        print(f"   - 업데이트: {updated_count:,}개")
        print(f"   - 스킵: {skipped_count:,}개 (report_no 없음 또는 부작용 없음)")
        print(f"   - 오류: {error_count:,}개")
        
        return True
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("=" * 70)
    print("부작용 정보 업데이트 스크립트")
    print("=" * 70)
    update_side_effects()

