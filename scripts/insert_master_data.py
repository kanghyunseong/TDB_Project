#!/usr/bin/env python3
"""
JSON 파일 데이터를 MySQL 데이터베이스에 삽입하는 스크립트
"""

import json
import mysql.connector
from mysql.connector import Error
import os
from datetime import datetime
import sys

# 데이터베이스 연결 설정 (환경변수 또는 직접 설정)
def get_db_config():
    """데이터베이스 연결 정보 가져오기"""
    host = os.getenv('DB_HOST', 'tdb.cxc48q26c73q.ap-southeast-2.rds.amazonaws.com')
    database = os.getenv('DB_DATABASE', 'tdb')
    user = os.getenv('DB_USERNAME', 'tdb')
    password = os.getenv('DB_PASSWORD', 'kdu5525^')
    
    # 환경변수가 없으면 직접 입력받기
    if not user:
        print("\n" + "=" * 70)
        print("📋 데이터베이스 연결 정보 입력")
        print("=" * 70)
        user = input("사용자명 (DB_USERNAME): ").strip()
        password = input("비밀번호 (DB_PASSWORD): ").strip()
        print()
    
    return {
        'host': host,
        'database': database,
        'user': user,
        'password': password,
        'charset': 'utf8mb4',
        'collation': 'utf8mb4_unicode_ci',
        'autocommit': False
    }

# JSON 파일 경로
MEDICINE_JSON = 'src/assets/medicine_backup_20251207_101001.json'  # 🔥 백업 파일 사용
TABLET_JSON = 'src/assets/tablet.json'

def convert_medicine_format(old_item):
    """의약품 백업 파일 형식을 현재 형식으로 변환"""
    # 백업 파일 형식: "품목기준코드 [ITEMSEQ] " (뒤에 공백 있음), "제품명 [ITEMNAME] " 등
    # 현재 형식: "PRDLST_REPORT_NO", "PRDLST_NM" 등
    return {
        'PRDLST_REPORT_NO': (old_item.get('품목기준코드 [ITEMSEQ] ', '') or old_item.get('품목기준코드 [ITEMSEQ]', '') or old_item.get('ITEMSEQ', '')).strip(),
        'PRDLST_NM': (old_item.get('제품명 [ITEMNAME] ', '') or old_item.get('제품명 [ITEMNAME]', '') or old_item.get('ITEMNAME', '')).strip(),
        'BSSH_NM': (old_item.get('업체명 [ENTPNAME] ', '') or old_item.get('업체명 [ENTPNAME]', '') or old_item.get('ENTPNAME', '')).strip(),
        'LCNS_NO': '',
        'PRDT_SHAP_CD_NM': '',
        'SHAP': '',
        'DISPOS': '',
        'PRIMARY_FNCLTY': (old_item.get('문항1(효능) [EFCYQESITM] ', '') or old_item.get('문항1(효능) [EFCYQESITM]', '') or old_item.get('EFCYQESITM', '')).strip(),
        'NTK_MTHD': (old_item.get('문항2(사용법) [USEMETHODQESITM] ', '') or old_item.get('문항2(사용법) [USEMETHODQESITM]', '') or old_item.get('USEMETHODQESITM', '')).strip(),
        'IFTKN_ATNT_MATR_CN': ((old_item.get('문항4(주의사항) [ATPNQESITM] ', '') or old_item.get('문항4(주의사항) [ATPNQESITM]', '') or old_item.get('ATPNQESITM', '')).strip() + 
                             (f"\n{(old_item.get('문항3(주의사항 경고) [ATPNWARNQESITM] ', '') or old_item.get('문항3(주의사항 경고) [ATPNWARNQESITM]', '') or old_item.get('ATPNWARNQESITM', '')).strip()}" 
                              if (old_item.get('문항3(주의사항 경고) [ATPNWARNQESITM] ', '') or old_item.get('문항3(주의사항 경고) [ATPNWARNQESITM]', '') or old_item.get('ATPNWARNQESITM', '')).strip() else '')).strip(),
        'SEQESITM': (old_item.get('문항6(부작용) [SEQESITM] ', '') or old_item.get('문항6(부작용) [SEQESITM]', '') or old_item.get('SEQESITM', '')).strip(),  # 🔥 부작용 필드 추가
        'CSTDY_MTHD': (old_item.get('문항7(보관법) [DEPOSITMETHODQESITM] ', '') or old_item.get('문항7(보관법) [DEPOSITMETHODQESITM]', '') or old_item.get('DEPOSITMETHODQESITM', '')).strip(),
        'POG_DAYCNT': '',
        'RAWMTRL_NM': '',
        'STDR_STND': '',
        'PRMS_DT': ((old_item.get('공개일자 [OPENDE] ', '') or old_item.get('공개일자 [OPENDE]', '') or old_item.get('OPENDE', '')).split(' ')[0].replace('-', '') if (old_item.get('공개일자 [OPENDE] ', '') or old_item.get('공개일자 [OPENDE]', '') or old_item.get('OPENDE', '')) else '').strip(),
        'CRET_DTM': (old_item.get('공개일자 [OPENDE] ', '') or old_item.get('공개일자 [OPENDE]', '') or old_item.get('OPENDE', '')).strip(),
        'LAST_UPDT_DTM': ((old_item.get('수정일자 [UPDATEDE] ', '') or old_item.get('수정일자 [UPDATEDE]', '') or old_item.get('UPDATEDE', '')).replace('-', '') if (old_item.get('수정일자 [UPDATEDE] ', '') or old_item.get('수정일자 [UPDATEDE]', '') or old_item.get('UPDATEDE', '')) else '').strip()
    }

def map_json_to_db(json_item, is_medicine_backup=False):
    """JSON 항목을 데이터베이스 컬럼에 매핑"""
    # 🔥 의약품 백업 파일인 경우 형식 변환
    if is_medicine_backup:
        converted = convert_medicine_format(json_item)
        return {
            'report_no': converted.get('PRDLST_REPORT_NO', ''),
            'name': converted.get('PRDLST_NM', ''),
            'company_name': converted.get('BSSH_NM', ''),
            'license_no': converted.get('LCNS_NO', ''),
            'product_shape': converted.get('PRDT_SHAP_CD_NM', ''),
            'shape': converted.get('SHAP', ''),
            'dispos': converted.get('DISPOS', ''),
            'primary_function': converted.get('PRIMARY_FNCLTY', ''),
            'intake_method': converted.get('NTK_MTHD', ''),
            'precautions': converted.get('IFTKN_ATNT_MATR_CN', ''),
            'side_effects': converted.get('SEQESITM', ''),  # 🔥 부작용 필드 추가
            'storage_method': converted.get('CSTDY_MTHD', ''),
            'shelf_life': converted.get('POG_DAYCNT', ''),
            'raw_materials': converted.get('RAWMTRL_NM', ''),
            'standard_spec': converted.get('STDR_STND', ''),
            'permit_date': converted.get('PRMS_DT', ''),
            'create_date': converted.get('CRET_DTM', ''),
            'last_update_date': converted.get('LAST_UPDT_DTM', '')
        }
    
    # 일반 형식 (tablet.json 등)
    return {
        'report_no': json_item.get('PRDLST_REPORT_NO', ''),
        'name': json_item.get('PRDLST_NM', ''),
        'company_name': json_item.get('BSSH_NM', ''),
        'license_no': json_item.get('LCNS_NO', ''),
        'product_shape': json_item.get('PRDT_SHAP_CD_NM', ''),
        'shape': json_item.get('SHAP', ''),
        'dispos': json_item.get('DISPOS', ''),
        'primary_function': json_item.get('PRIMARY_FNCLTY', ''),
        'intake_method': json_item.get('NTK_MTHD', ''),
        'precautions': json_item.get('IFTKN_ATNT_MATR_CN', ''),
        'side_effects': json_item.get('SEQESITM', ''),  # 🔥 부작용 필드 추가 (일반 형식에도)
        'storage_method': json_item.get('CSTDY_MTHD', ''),
        'shelf_life': json_item.get('POG_DAYCNT', ''),
        'raw_materials': json_item.get('RAWMTRL_NM', ''),
        'standard_spec': json_item.get('STDR_STND', ''),
        'permit_date': json_item.get('PRMS_DT', ''),
        'create_date': json_item.get('CRET_DTM', ''),
        'last_update_date': json_item.get('LAST_UPDT_DTM', '')
    }

def insert_batch(cursor, table_name, data_list, batch_size=1000):
    """배치로 데이터 삽입"""
    insert_query = f"""
    INSERT INTO `{table_name}` (
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
    
    total = len(data_list)
    inserted = 0
    errors = 0
    
    for i in range(0, total, batch_size):
        batch = data_list[i:i + batch_size]
        try:
            cursor.executemany(insert_query, batch)
            inserted += len(batch)
            # 🔥 첫 번째 배치에서 샘플 데이터 확인
            if i == 0 and batch:
                sample = batch[0]
                sample_side_effects = sample.get('side_effects', '').strip() if sample.get('side_effects') else ''
                if sample_side_effects:
                    print(f"  ✅ {inserted:,}/{total:,}개 삽입 완료 ({inserted*100//total}%) [부작용 데이터 포함: {sample.get('name', 'N/A')[:30]}]")
                else:
                    print(f"  ✅ {inserted:,}/{total:,}개 삽입 완료 ({inserted*100//total}%)")
            else:
                print(f"  ✅ {inserted:,}/{total:,}개 삽입 완료 ({inserted*100//total}%)")
        except Error as e:
            errors += len(batch)
            print(f"  ❌ 배치 삽입 실패: {e}")
            # 🔥 에러 상세 정보 출력
            if 'side_effects' in str(e):
                print(f"     ⚠️  side_effects 컬럼 관련 오류일 수 있습니다. 테이블에 컬럼이 추가되었는지 확인하세요.")
            # 개별 삽입 시도
            for item in batch:
                try:
                    cursor.execute(insert_query, item)
                    inserted += 1
                except Error as e2:
                    errors += 1
                    if errors <= 10:  # 처음 10개 에러만 출력
                        print(f"    ⚠️  항목 삽입 실패 (report_no: {item.get('report_no', 'N/A')}): {e2}")
                        if 'side_effects' in str(e2):
                            print(f"       side_effects 값: {str(item.get('side_effects', ''))[:50]}...")
    
    return inserted, errors

def load_and_insert_json(json_path, table_name, connection, is_medicine_backup=False):
    """JSON 파일을 로드하고 데이터베이스에 삽입"""
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
        
        # JSON 데이터를 DB 형식으로 변환
        print(f"🔄 데이터 변환 중...")
        db_data = []
        skipped_count = 0
        side_effects_count = 0  # 🔥 부작용이 있는 항목 카운트
        for item in data:
            mapped = map_json_to_db(item, is_medicine_backup=is_medicine_backup)
            # report_no가 필수이므로 빈 값은 스킵
            report_no = mapped.get('report_no', '').strip() if mapped.get('report_no') else ''
            if report_no:
                # 🔥 부작용 데이터 확인
                side_effects = mapped.get('side_effects', '').strip() if mapped.get('side_effects') else ''
                if side_effects:
                    side_effects_count += 1
                db_data.append(mapped)
            else:
                skipped_count += 1
                if skipped_count <= 5:  # 처음 5개만 출력
                    print(f"  ⚠️  스킵된 항목 (report_no 없음): {mapped.get('name', 'N/A')[:30]}")
        
        if skipped_count > 0:
            print(f"  ⚠️  총 {skipped_count:,}개 항목 스킵됨 (report_no 없음)")
        print(f"✅ {len(db_data):,}개 항목 변환 완료")
        print(f"📊 부작용 데이터가 있는 항목: {side_effects_count:,}개 ({side_effects_count*100//len(db_data) if db_data else 0}%)")
        
        # 데이터베이스에 삽입
        print(f"💾 {table_name} 테이블에 삽입 중...")
        cursor = connection.cursor()
        
        inserted, errors = insert_batch(cursor, table_name, db_data)
        
        connection.commit()
        cursor.close()
        
        print(f"\n✅ {table_name} 삽입 완료!")
        print(f"   - 성공: {inserted:,}개")
        print(f"   - 실패: {errors:,}개")
        
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 실패: {e}")
        return False
    except Error as e:
        print(f"❌ 데이터베이스 오류: {e}")
        connection.rollback()
        return False
    except Exception as e:
        print(f"❌ 예상치 못한 오류: {e}")
        connection.rollback()
        return False

def main():
    """메인 함수"""
    print("=" * 70)
    print("📊 약물 및 영양제 마스터 데이터 삽입 스크립트")
    print("=" * 70)
    print(f"시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # 데이터베이스 연결
    print("🔌 데이터베이스 연결 중...")
    try:
        db_config = get_db_config()
        connection = mysql.connector.connect(**db_config)
        print(f"✅ 데이터베이스 연결 성공: {db_config['database']}")
    except Error as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        print("\n💡 환경변수 설정:")
        print("   export DB_HOST=your_host")
        print("   export DB_USERNAME=your_username")
        print("   export DB_PASSWORD=your_password")
        print("   export DB_DATABASE=tdb")
        sys.exit(1)
    
    try:
        # medicine_master 테이블에 데이터 삽입 (백업 파일 형식 변환)
        if os.path.exists(MEDICINE_JSON):
            print(f"🔥 의약품 백업 파일 형식으로 변환하여 삽입합니다: {MEDICINE_JSON}")
            success = load_and_insert_json(MEDICINE_JSON, 'medicine_master', connection, is_medicine_backup=True)
            if not success:
                print("⚠️  medicine_master 삽입 실패")
        else:
            print(f"⚠️  {MEDICINE_JSON} 파일이 없습니다.")
        
        # tablet_master 테이블에 데이터 삽입
        if os.path.exists(TABLET_JSON):
            success = load_and_insert_json(TABLET_JSON, 'tablet_master', connection, is_medicine_backup=False)
            if not success:
                print("⚠️  tablet_master 삽입 실패")
        else:
            print(f"⚠️  {TABLET_JSON} 파일이 없습니다.")
        
        print("\n" + "=" * 70)
        print("✅ 모든 작업 완료!")
        print(f"완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
    finally:
        connection.close()
        print("🔌 데이터베이스 연결 종료")

if __name__ == '__main__':
    main()

