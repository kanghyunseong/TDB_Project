#!/usr/bin/env python3
"""
데이터베이스 레코드 수 확인 스크립트
"""
import os
import sys
import mysql.connector
from mysql.connector import Error

def get_db_config():
    """데이터베이스 연결 정보 가져오기"""
    host = os.getenv('DB_HOST', 'tdb.cxc48q26c73q.ap-southeast-2.rds.amazonaws.com')
    database = os.getenv('DB_DATABASE', 'tdb')
    user = os.getenv('DB_USERNAME', 'tdb')
    password = os.getenv('DB_PASSWORD', 'kdu5525^')
    
    return {
        'host': host,
        'database': database,
        'user': user,
        'password': password,
        'charset': 'utf8mb4',
        'collation': 'utf8mb4_unicode_ci',
        'autocommit': False
    }

def main():
    """메인 함수"""
    print("=" * 70)
    print("📊 데이터베이스 레코드 수 확인")
    print("=" * 70)
    
    try:
        db_config = get_db_config()
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()
        
        print("✅ 데이터베이스 연결 성공\n")
        
        # medicine_master 테이블 레코드 수 확인
        cursor.execute('SELECT COUNT(*) FROM medicine_master')
        medicine_count = cursor.fetchone()[0]
        print(f'📋 medicine_master 레코드 수: {medicine_count:,}개')
        
        # tablet_master 테이블 레코드 수 확인
        cursor.execute('SELECT COUNT(*) FROM tablet_master')
        tablet_count = cursor.fetchone()[0]
        print(f'📋 tablet_master 레코드 수: {tablet_count:,}개')
        
        # 중복 report_no 확인
        cursor.execute('''
            SELECT report_no, COUNT(*) as cnt 
            FROM medicine_master 
            GROUP BY report_no 
            HAVING cnt > 1
        ''')
        duplicates = cursor.fetchall()
        if duplicates:
            print(f'\n⚠️  중복된 report_no: {len(duplicates)}개')
        else:
            print('\n✅ 중복된 report_no 없음')
        
        # 고유한 report_no 수 확인
        cursor.execute('SELECT COUNT(DISTINCT report_no) FROM medicine_master')
        unique_count = cursor.fetchone()[0]
        print(f'📋 고유한 report_no 수: {unique_count:,}개')
        
        # JSON 파일 항목 수와 비교
        try:
            import json
            with open('src/assets/medicine.json', 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            json_count = len(json_data)
            print(f'\n📄 medicine.json 항목 수: {json_count:,}개')
            print(f'📊 차이: {json_count - medicine_count:,}개')
            
            if json_count > medicine_count:
                print(f'   → JSON에 {json_count - medicine_count:,}개 더 많음 (중복 또는 삽입 실패 가능)')
            elif json_count < medicine_count:
                print(f'   → DB에 {medicine_count - json_count:,}개 더 많음 (이전 데이터 포함 가능)')
            else:
                print('   → JSON과 DB 레코드 수 일치!')
        except Exception as e:
            print(f'\n⚠️  JSON 파일 확인 실패: {e}')
        
        cursor.close()
        connection.close()
        
        print("\n" + "=" * 70)
        print("✅ 확인 완료!")
        print("=" * 70)
        
    except Error as e:
        print(f'❌ 데이터베이스 연결 실패: {e}')
        print('\n💡 환경변수 설정:')
        print('   export DB_HOST=your_host')
        print('   export DB_USERNAME=your_username')
        print('   export DB_PASSWORD=your_password')
        print('   export DB_DATABASE=tdb')
        sys.exit(1)
    except Exception as e:
        print(f'❌ 오류 발생: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

