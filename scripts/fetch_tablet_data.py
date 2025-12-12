import requests
import json
import os
import time
import subprocess
import sys
from datetime import datetime

API_KEY = '0f9793c39da34445a4d0'
SERVICE_ID = 'C003'  # 건강기능식품 정보
BASE_URL = 'http://openapi.foodsafetykorea.go.kr/api'
DATA_TYPE = 'json'
BATCH_SIZE = 1000

def run_clean_script(input_path, output_path):
    """Node.js 정제 스크립트 실행"""
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        clean_script = os.path.join(script_dir, 'cleanJsonData.js')
        
        # Node.js 스크립트를 직접 호출하여 정제 실행
        # 절대 경로를 사용하여 안정성 향상
        abs_input = os.path.abspath(input_path)
        abs_output = os.path.abspath(output_path)
        
        cmd = [
            'node',
            '-e',
            f"""
            const {{ cleanJsonFile }} = require('{clean_script.replace(os.sep, '/')}');
            cleanJsonFile('{abs_input.replace(os.sep, '/')}', '{abs_output.replace(os.sep, '/')}', false)
              .then(() => {{ console.log('✅ 정제 완료'); }})
              .catch(err => {{ console.error('❌ 정제 실패:', err.message); process.exit(1); }});
            """
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=project_root
        )
        
        # 출력 표시
        if result.stdout:
            print(result.stdout)
        if result.stderr and result.returncode != 0:
            print(result.stderr)
        
        return result.returncode == 0
            
    except Exception as e:
        print(f"⚠️  정제 스크립트 실행 실패: {e}")
        return False

def fetch_tablet_data():
    """건강기능식품 데이터를 API에서 가져와서 JSON 파일로 저장"""
    print(f"🚀 건강기능식품 데이터 다운로드 시작 (서비스 ID: {SERVICE_ID})")
    print(f"📅 시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    all_rows = []
    start_idx = 1
    total_fetched = 0
    
    try:
        while True:
            end_idx = start_idx + BATCH_SIZE - 1
            url = f"{BASE_URL}/{API_KEY}/{SERVICE_ID}/{DATA_TYPE}/{start_idx}/{end_idx}"
            print(f"📥 요청 중: {start_idx}~{end_idx} (총 진행률: {total_fetched:,}개)")
            
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            
            rows = data.get(SERVICE_ID, {}).get('row', [])
            if not rows:
                print("✅ 모든 데이터 수집 완료")
                break
            
            all_rows.extend(rows)
            total_fetched += len(rows)
            
            if len(rows) < BATCH_SIZE:
                print("✅ 마지막 배치 수집 완료")
                break
            
            start_idx += BATCH_SIZE
            time.sleep(0.2)  # 과도한 요청 방지
            
        print()
        print(f"✅ 총 {total_fetched:,}개 데이터 수집 완료")
        
        # 백업 생성
        output_dir = 'src/assets'
        os.makedirs(output_dir, exist_ok=True)
        
        backup_path = os.path.join(output_dir, f'tablet_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        current_path = os.path.join(output_dir, 'tablet.json')
        
        # 기존 파일이 있으면 백업
        if os.path.exists(current_path):
            print(f"💾 기존 파일 백업: {backup_path}")
            with open(current_path, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)
            with open(backup_path, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, ensure_ascii=False, indent=2)
        
        # 새 데이터 저장
        print(f"💾 새 데이터 저장: {current_path}")
        with open(current_path, 'w', encoding='utf-8') as f:
            json.dump(all_rows, f, ensure_ascii=False, indent=2)
        
        print()
        print(f"✅ 데이터 다운로드 완료!")
        print(f"   - 총 데이터: {len(all_rows):,}개")
        
        # 데이터 정제 실행
        print()
        print("🧹 데이터 정제 시작...")
        cleaned_path = os.path.join(output_dir, 'tablet_cleaned.json')
        clean_success = run_clean_script(current_path, cleaned_path)
        
        if clean_success and os.path.exists(cleaned_path):
            # 정제된 파일로 교체
            print(f"✅ 정제 완료! 정제된 파일로 교체합니다.")
            os.replace(cleaned_path, current_path)
            print(f"   - 정제된 파일이 {current_path}에 저장되었습니다.")
        else:
            print(f"⚠️  정제 스크립트 실행 실패 또는 정제된 파일이 없습니다.")
            print(f"   - 원본 파일이 그대로 유지됩니다: {current_path}")
        
        print()
        print(f"✅ 업데이트 완료!")
        print(f"   - 저장 위치: {current_path}")
        print(f"   - 백업 위치: {backup_path if os.path.exists(backup_path) else '없음'}")
        print(f"📅 완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ API 요청 실패: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 실패: {e}")
        return False
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        return False

if __name__ == '__main__':
    success = fetch_tablet_data()
    exit(0 if success else 1)

