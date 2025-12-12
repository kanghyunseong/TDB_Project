import requests
import json
import os
import time
import subprocess
import sys
from datetime import datetime
from urllib.parse import quote

# 🔥 의약품 낱알식별정보 API 설정
# 공공데이터포털: https://www.data.go.kr/
# API 상세 페이지: https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15000757
# 활용가이드: API 상세 페이지에서 다운로드 가능
# 백업 파일 형식: "품목기준코드 [ITEMSEQ]", "제품명 [ITEMNAME]" 등
# 현재 형식: "PRDLST_REPORT_NO", "PRDLST_NM" 등

# 🔑 API 키 설정 (우선순위: 명령줄 인자 > 환경변수 > 기본값)
def get_api_key():
    """API 키를 가져옵니다 (명령줄 인자 > 환경변수 > 기본값)"""
    # 1. 명령줄 인자에서 확인 (--api-key 또는 --service-key)
    if '--api-key' in sys.argv:
        idx = sys.argv.index('--api-key')
        if idx + 1 < len(sys.argv):
            return sys.argv[idx + 1]
    if '--service-key' in sys.argv:
        idx = sys.argv.index('--service-key')
        if idx + 1 < len(sys.argv):
            return sys.argv[idx + 1]
    
    # 2. 환경변수에서 확인
    api_key = os.getenv('DATA_GO_KR_API_KEY') or os.getenv('PUBLIC_DATA_API_KEY') or os.getenv('SERVICE_KEY')
    if api_key:
        return api_key
    
    # 3. 기본값 (사용자 제공 키 - URL 인코딩된 형태)
    # 원본: JjDWdlAv7EoXnVVyglmBvILGrHIHLaACtRZrf7Is4tAgA+01JqmxS8kQtL6OEuqQ+Zi/KCNnDTgon3p/c6rQSA==
    return 'JjDWdlAv7EoXnVVyglmBvILGrHIHLaACtRZrf7Is4tAgA%2B01JqmxS8kQtL6OEuqQ%2BZi%2FKCNnDTgon3p%2Fc6rQSA%3D%3D'

API_KEY = get_api_key()

SERVICE_ID = 'C005'  # 의약품 낱알식별정보 서비스 ID
BASE_URL = 'http://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService04'  # 의약품 API
DATA_TYPE = 'json'
BATCH_SIZE = 1000  # 한 번에 가져올 최대 개수 (API 제한 확인 필요)

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
            cleanJsonFile('{abs_input.replace(os.sep, '/')}', '{abs_output.replace(os.sep, '/')}')
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

def convert_medicine_format(old_item):
    """의약품 데이터를 현재 형식(PRDLST_REPORT_NO 등)으로 변환"""
    # 백업 파일 형식: "품목기준코드 [ITEMSEQ] ", "제품명 [ITEMNAME] " 등 (키 이름 끝에 공백 있음)
    # 현재 형식: "PRDLST_REPORT_NO", "PRDLST_NM" 등
    
    # 🔥 키 이름에서 공백 제거하여 안전하게 값 추출
    def safe_get(key_variants):
        """여러 키 이름 변형을 시도하여 값 추출"""
        for key in key_variants:
            # 원본 키, 공백 제거된 키, 공백 추가된 키 모두 시도
            value = old_item.get(key) or old_item.get(key.strip()) or old_item.get(key + ' ')
            if value:
                return str(value).strip() if isinstance(value, (str, int, float)) else str(value)
        return ''
    
    report_no = safe_get(['품목기준코드 [ITEMSEQ]', '품목기준코드 [ITEMSEQ] ', 'ITEMSEQ'])
    item_name = safe_get(['제품명 [ITEMNAME]', '제품명 [ITEMNAME] ', 'ITEMNAME'])
    entp_name = safe_get(['업체명 [ENTPNAME]', '업체명 [ENTPNAME] ', 'ENTPNAME'])
    efcy = safe_get(['문항1(효능) [EFCYQESITM]', '문항1(효능) [EFCYQESITM] ', 'EFCYQESITM'])
    use_method = safe_get(['문항2(사용법) [USEMETHODQESITM]', '문항2(사용법) [USEMETHODQESITM] ', 'USEMETHODQESITM'])
    atpn = safe_get(['문항4(주의사항) [ATPNQESITM]', '문항4(주의사항) [ATPNQESITM] ', 'ATPNQESITM'])
    atpn_warn = safe_get(['문항3(주의사항 경고) [ATPNWARNQESITM]', '문항3(주의사항 경고) [ATPNWARNQESITM] ', 'ATPNWARNQESITM'])
    seqesitm = safe_get(['문항6(부작용) [SEQESITM]', '문항6(부작용) [SEQESITM] ', 'SEQESITM'])
    deposit = safe_get(['문항7(보관법) [DEPOSITMETHODQESITM]', '문항7(보관법) [DEPOSITMETHODQESITM] ', 'DEPOSITMETHODQESITM'])
    opende = safe_get(['공개일자 [OPENDE]', '공개일자 [OPENDE] ', 'OPENDE'])
    updatede = safe_get(['수정일자 [UPDATEDE]', '수정일자 [UPDATEDE] ', 'UPDATEDE'])
    
    # 주의사항 결합
    ifkn_atnt_matr_cn = atpn
    if atpn_warn:
        ifkn_atnt_matr_cn = f"{atpn}\n{atpn_warn}" if atpn else atpn_warn
    
    # 날짜 처리
    prms_dt = ''
    if opende:
        try:
            prms_dt = opende.split(' ')[0].replace('-', '')
        except:
            pass
    
    last_updt_dtm = ''
    if updatede:
        try:
            last_updt_dtm = updatede.replace('-', '')
        except:
            pass
    
    return {
        'PRDLST_REPORT_NO': report_no,
        'PRDLST_NM': item_name,
        'BSSH_NM': entp_name,
        'LCNS_NO': '',
        'PRDT_SHAP_CD_NM': '',
        'SHAP': '',
        'DISPOS': '',
        'PRIMARY_FNCLTY': efcy,
        'NTK_MTHD': use_method,
        'IFTKN_ATNT_MATR_CN': ifkn_atnt_matr_cn,
        'SEQESITM': seqesitm,  # 🔥 부작용 필드 추가
        'CSTDY_MTHD': deposit,
        'POG_DAYCNT': '',
        'RAWMTRL_NM': '',
        'STDR_STND': '',
        'PRMS_DT': prms_dt,
        'CRET_DTM': opende,
        'LAST_UPDT_DTM': last_updt_dtm
    }

def fetch_medicine_data_from_csv(csv_path):
    """CSV 파일에서 의약품 데이터를 읽어서 JSON 파일로 변환"""
    import csv
    
    print(f"📂 CSV 파일에서 데이터 읽기: {csv_path}")
    print()
    
    # 여러 인코딩 시도
    encodings = ['cp949', 'utf-8', 'euc-kr', 'latin1']
    data = None
    
    for encoding in encodings:
        try:
            with open(csv_path, 'r', encoding=encoding) as f:
                reader = csv.DictReader(f)
                data = list(reader)
                print(f"✅ CSV 파일 읽기 성공 (인코딩: {encoding})")
                print(f"   총 항목 수: {len(data):,}개")
                break
        except Exception as e:
            continue
    
    if not data:
        print(f"❌ CSV 파일을 읽을 수 없습니다.")
        return False
    
    print(f"🔄 데이터 형식 변환 중...")
    all_rows = []
    for item in data:
        converted = convert_medicine_format(item)
        if converted['PRDLST_REPORT_NO']:  # report_no가 필수
            all_rows.append(converted)
    
    print(f"✅ {len(all_rows):,}개 항목 변환 완료")
    
    # 변환된 데이터 저장
    assets_dir = 'src/assets'
    current_path = os.path.join(assets_dir, 'medicine.json')
    
    # 기존 파일 백업
    if os.path.exists(current_path):
        current_backup = os.path.join(assets_dir, f'medicine_current_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        print(f"💾 기존 medicine.json 백업: {current_backup}")
        with open(current_path, 'r', encoding='utf-8') as f:
            current_data = json.load(f)
        with open(current_backup, 'w', encoding='utf-8') as f:
            json.dump(current_data, f, ensure_ascii=False, indent=2)
    
    print(f"💾 변환된 데이터 저장: {current_path}")
    with open(current_path, 'w', encoding='utf-8') as f:
        json.dump(all_rows, f, ensure_ascii=False, indent=2)
    
    print()
    print(f"✅ CSV 파일 변환 완료!")
    print(f"   - 저장 위치: {current_path}")
    print(f"   - 항목 수: {len(all_rows):,}개")
    print(f"📅 완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return True

def fetch_medicine_data(force_api=False):
    """의약품 데이터를 API에서 가져와서 JSON 파일로 저장"""
    print(f"🚀 의약품 데이터 다운로드 시작")
    print(f"📅 시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # force_api가 True이면 백업 파일을 건너뛰고 API에서 직접 다운로드
    if not force_api:
        # 먼저 백업 파일 확인
        assets_dir = 'src/assets'
        backup_files = [f for f in os.listdir(assets_dir) if f.startswith('medicine_backup_') and f.endswith('.json')]
        
        if backup_files:
            backup_files.sort(reverse=True)
            latest_backup = os.path.join(assets_dir, backup_files[0])
            print(f"📂 백업 파일 발견: {backup_files[0]}")
            print(f"   백업 파일을 변환하여 사용합니다.")
            print()
            
            try:
                with open(latest_backup, 'r', encoding='utf-8') as f:
                    old_data = json.load(f)
                
                if isinstance(old_data, list) and len(old_data) > 0:
                    print(f"✅ {len(old_data):,}개 항목 로드 완료")
                    print(f"🔄 데이터 형식 변환 중...")
                    
                    all_rows = []
                    for item in old_data:
                        converted = convert_medicine_format(item)
                        if converted['PRDLST_REPORT_NO']:  # report_no가 필수
                            all_rows.append(converted)
                    
                    print(f"✅ {len(all_rows):,}개 항목 변환 완료")
                    
                    # 변환된 데이터 저장
                    current_path = os.path.join(assets_dir, 'medicine.json')
                    
                    # 기존 파일 백업
                    if os.path.exists(current_path):
                        current_backup = os.path.join(assets_dir, f'medicine_current_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
                        print(f"💾 기존 medicine.json 백업: {current_backup}")
                        with open(current_path, 'r', encoding='utf-8') as f:
                            current_data = json.load(f)
                        with open(current_backup, 'w', encoding='utf-8') as f:
                            json.dump(current_data, f, ensure_ascii=False, indent=2)
                    
                    print(f"💾 변환된 데이터 저장: {current_path}")
                    with open(current_path, 'w', encoding='utf-8') as f:
                        json.dump(all_rows, f, ensure_ascii=False, indent=2)
                    
                    print()
                    print(f"✅ 백업 파일 변환 완료!")
                    print(f"   - 저장 위치: {current_path}")
                    print(f"   - 항목 수: {len(all_rows):,}개")
                    print(f"📅 완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                    
                    return True
            except Exception as e:
                print(f"⚠️  백업 파일 변환 실패: {e}")
                print(f"   API에서 직접 다운로드를 시도합니다.")
                print()
    
    # API에서 직접 다운로드
    print(f"🌐 API에서 직접 다운로드 시도")
    print(f"⚠️  여러 엔드포인트를 시도합니다")
    print()
    
    # 여러 엔드포인트 시도 (공공데이터포털 문서 기준)
    # 참고: https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15000757
    endpoints = [
        {
            'name': 'getDrugPrdtPrmsnInfoList04 (목록 조회)',
            'url': f"{BASE_URL}/getDrugPrdtPrmsnInfoList04",
            'params': ['serviceKey', 'pageNo', 'numOfRows', 'type'],
            'description': '의약품 제품 허가 정보 목록 조회'
        },
        {
            'name': 'getDrugPrdtPrmsnDtlInq04 (상세 조회)',
            'url': f"{BASE_URL}/getDrugPrdtPrmsnDtlInq04",
            'params': ['serviceKey', 'pageNo', 'numOfRows', 'type'],
            'description': '의약품 제품 허가 정보 상세 조회'
        },
        {
            'name': 'getDrugPrdtPrmsnInfoList03 (이전 버전)',
            'url': f"http://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService03/getDrugPrdtPrmsnInfoList03",
            'params': ['serviceKey', 'pageNo', 'numOfRows', 'type'],
            'description': '의약품 제품 허가 정보 목록 조회 (Service03)'
        }
    ]
    
    all_rows = []
    working_endpoint = None
    working_key = None
    
    # 먼저 작동하는 엔드포인트 찾기
    for endpoint in endpoints:
        print(f"🔍 엔드포인트 테스트: {endpoint['name']}")
        print(f"   설명: {endpoint.get('description', 'N/A')}")
        try:
            # serviceKey를 URL 인코딩 (공공데이터포털 API는 인코딩된 키를 요구할 수 있음)
            encoded_key = quote(API_KEY, safe='')
            
            # 여러 방식으로 시도
            test_keys = [
                encoded_key,  # URL 인코딩된 키
                API_KEY,      # 원본 키
            ]
            
            for test_key in test_keys:
                test_url = f"{endpoint['url']}?serviceKey={test_key}&pageNo=1&numOfRows=1&type={DATA_TYPE}"
                resp = requests.get(test_url, timeout=10)
                
                if resp.status_code == 200:
                    try:
                        data = resp.json()
                        # 응답 확인
                        items = (
                            data.get('body', {}).get('items', []) or 
                            data.get('response', {}).get('body', {}).get('items', []) or 
                            data.get('items', []) or 
                            []
                        )
                        total_count = (
                            data.get('body', {}).get('totalCount') or 
                            data.get('response', {}).get('body', {}).get('totalCount') or
                            data.get('totalCount')
                        )
                        
                        if items or total_count:
                            working_endpoint = endpoint
                            working_key = test_key
                            print(f"   ✅ 엔드포인트 작동 확인!")
                            if total_count:
                                print(f"   📊 총 데이터 개수: {total_count:,}개")
                            break
                    except json.JSONDecodeError:
                        # JSON이 아니어도 200이면 일단 성공으로 간주
                        if 'error' not in resp.text.lower() and 'fail' not in resp.text.lower():
                            working_endpoint = endpoint
                            working_key = test_key
                            print(f"   ✅ 엔드포인트 응답 확인 (JSON 아님)")
                            break
                
                if working_endpoint:
                    break
                
                elif resp.status_code == 400:
                    print(f"   ⚠️  잘못된 요청 (파라미터 오류 가능)")
                elif resp.status_code == 401:
                    print(f"   ⚠️  인증 실패 (API 키 오류 가능)")
                elif resp.status_code == 500:
                    print(f"   ❌ 서버 오류 (500)")
                else:
                    print(f"   ⚠️  상태 코드: {resp.status_code}")
            
            if working_endpoint:
                break
                
        except requests.exceptions.Timeout:
            print(f"   ❌ 타임아웃")
        except Exception as e:
            print(f"   ❌ 실패: {str(e)[:100]}")
        print()
    
    if not working_endpoint:
        print("❌ 작동하는 엔드포인트를 찾을 수 없습니다.")
        print()
        print("⚠️  가능한 원인:")
        print("   1. 공공데이터포털 API 서버 일시 중단")
        print("   2. API 키가 잘못되었거나 만료됨")
        print("   3. API 활용 신청이 승인되지 않음")
        print("   4. 엔드포인트 URL이 변경됨")
        print()
        print("📋 해결 방법:")
        print("   1. 공공데이터포털(https://www.data.go.kr/)에 로그인")
        print("   2. 마이페이지 > 오픈 API > 인증키 발급현황에서 API 키 확인")
        print("   3. 의약품 낱알식별정보 API 상세 페이지에서 활용가이드 다운로드")
        print("   4. API 상태 및 공지사항 확인")
        print()
        print("기본 엔드포인트로 시도합니다...")
        working_endpoint = endpoints[0]
        working_key = quote(API_KEY, safe='')
    else:
        if working_key is None:
            working_key = quote(API_KEY, safe='')
    
    print(f"📡 사용할 엔드포인트: {working_endpoint['name']}")
    print()
    
    page_no = 1
    total_fetched = 0
    total_count = None
    
    try:
        while True:
            url = f"{working_endpoint['url']}?serviceKey={working_key}&pageNo={page_no}&numOfRows={BATCH_SIZE}&type={DATA_TYPE}"
            print(f"📥 페이지 {page_no} 요청 중... (현재 수집: {total_fetched:,}개)")
            
            resp = requests.get(url, timeout=30)
            
            if resp.status_code != 200:
                print(f"   ⚠️  상태 코드: {resp.status_code}")
                print(f"   응답: {resp.text[:200]}")
                if resp.status_code == 500:
                    print(f"   ❌ 서버 오류. 다른 엔드포인트를 시도하거나 나중에 다시 시도하세요.")
                    break
                page_no += 1
                time.sleep(0.5)
                continue
            
            data = resp.json()
            
            # 총 개수 확인
            if total_count is None:
                total_count = (
                    data.get('body', {}).get('totalCount') or 
                    data.get('response', {}).get('body', {}).get('totalCount') or
                    data.get('totalCount') or
                    0
                )
                if total_count:
                    print(f"   📊 총 데이터 개수: {total_count:,}개")
            
            # 데이터 추출
            rows = (
                data.get('body', {}).get('items', []) or 
                data.get('response', {}).get('body', {}).get('items', []) or 
                data.get('items', []) or
                []
            )
            
            if not rows:
                print("   ✅ 더 이상 데이터가 없습니다.")
                break
            
            # API 응답이 백업 파일 형식이면 변환
            if rows and isinstance(rows[0], dict):
                if '품목기준코드 [ITEMSEQ]' in rows[0] or 'ITEMSEQ' in rows[0] or any('ITEMSEQ' in str(k) for k in rows[0].keys()):
                    converted_rows = []
                    for item in rows:
                        converted = convert_medicine_format(item)
                        if converted['PRDLST_REPORT_NO']:
                            converted_rows.append(converted)
                    all_rows.extend(converted_rows)
                    print(f"   ✅ {len(converted_rows)}개 항목 변환 및 추가 (총 {len(all_rows):,}개)")
                else:
                    all_rows.extend(rows)
                    print(f"   ✅ {len(rows)}개 항목 추가 (총 {len(all_rows):,}개)")
            else:
                all_rows.extend(rows)
                print(f"   ✅ {len(rows)}개 항목 추가 (총 {len(all_rows):,}개)")
            
            total_fetched += len(rows)
            
            # 마지막 페이지 확인
            if len(rows) < BATCH_SIZE:
                print("   ✅ 마지막 페이지 도달")
                break
            
            # 총 개수와 비교
            if total_count and total_fetched >= total_count:
                print(f"   ✅ 모든 데이터 수집 완료 (총 {total_count:,}개)")
                break
            
            page_no += 1
            time.sleep(0.3)  # 과도한 요청 방지
            
        print()
        print(f"✅ 총 {total_fetched:,}개 데이터 수집 완료")
        
        # 백업 생성
        output_dir = 'src/assets'
        os.makedirs(output_dir, exist_ok=True)
        
        backup_path = os.path.join(output_dir, f'medicine_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        current_path = os.path.join(output_dir, 'medicine.json')
        
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
        cleaned_path = os.path.join(output_dir, 'medicine_cleaned.json')
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
    import sys
    
    # 사용법 출력
    if '--help' in sys.argv or '-h' in sys.argv:
        print("""
📋 의약품 데이터 다운로드 스크립트 사용법

사용법:
  python3 scripts/fetch_medicine_data.py [옵션]

옵션:
  --api, --force-api          백업 파일을 건너뛰고 API에서 직접 다운로드
  --csv <파일경로>             CSV 파일에서 데이터 변환
  --api-key <키>              공공데이터포털 서비스키 지정
  --service-key <키>          공공데이터포털 서비스키 지정 (--api-key와 동일)
  -h, --help                  이 도움말 출력

환경변수:
  DATA_GO_KR_API_KEY          공공데이터포털 서비스키
  PUBLIC_DATA_API_KEY         공공데이터포털 서비스키 (대체)
  SERVICE_KEY                 공공데이터포털 서비스키 (대체)

예제:
  # CSV 파일에서 변환
  python3 scripts/fetch_medicine_data.py --csv "src/assets/의약품개요정보 조회_20251208.csv"

  # 환경변수 사용하여 API에서 다운로드
  export DATA_GO_KR_API_KEY="your-service-key"
  python3 scripts/fetch_medicine_data.py --api

  # 명령줄 인자 사용하여 API에서 다운로드
  python3 scripts/fetch_medicine_data.py --api --api-key "your-service-key"

  # 백업 파일에서 변환 (기본 동작)
  python3 scripts/fetch_medicine_data.py

서비스키 발급:
  1. https://www.data.go.kr/ 접속 및 로그인
  2. 마이페이지 > 오픈 API > 인증키 발급현황
  3. 의약품 낱알식별정보 API 활용 신청
  4. 발급된 서비스키 복사
        """)
        exit(0)
    
    # CSV 파일에서 변환
    if '--csv' in sys.argv:
        idx = sys.argv.index('--csv')
        if idx + 1 < len(sys.argv):
            csv_path = sys.argv[idx + 1]
            success = fetch_medicine_data_from_csv(csv_path)
            exit(0 if success else 1)
        else:
            print("❌ --csv 옵션 뒤에 파일 경로를 지정해주세요.")
            print("   예: python3 scripts/fetch_medicine_data.py --csv \"src/assets/의약품개요정보 조회_20251208.csv\"")
            exit(1)
    
    # API 키 확인
    if not API_KEY or API_KEY == '0f9793c39da34445a4d0':
        print("⚠️  경고: 기본 API 키를 사용하고 있습니다.")
        print("   공공데이터포털에서 발급받은 서비스키를 사용하세요.")
        print("   사용법: python3 scripts/fetch_medicine_data.py --api-key <서비스키>")
        print("   또는 환경변수 설정: export DATA_GO_KR_API_KEY='<서비스키>'")
        print()
    
    # --api 플래그가 있으면 백업 파일을 건너뛰고 API에서 직접 다운로드
    force_api = '--api' in sys.argv or '--force-api' in sys.argv
    success = fetch_medicine_data(force_api=force_api)
    exit(0 if success else 1)