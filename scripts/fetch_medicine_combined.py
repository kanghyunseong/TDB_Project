"""
여러 공공데이터포털 API를 조합하여 medicine.json 생성
- 의약품 제품 허가정보: 파일 데이터 또는 API
- 의약품개요정보(e약은요): 이미 medicine.json에 포함됨 (기존 데이터 활용)
- 의약품안전사용서비스(DUR): API
- 의약품 낱알식별 정보: API
"""
import requests
import json
import os
import time
import sys
import csv
import re
from datetime import datetime
from urllib.parse import quote
from typing import Dict, List, Optional, Tuple

# 🔑 API 키 설정
def get_api_key():
    """API 키를 가져옵니다"""
    if '--api-key' in sys.argv:
        idx = sys.argv.index('--api-key')
        if idx + 1 < len(sys.argv):
            return sys.argv[idx + 1]
    if '--service-key' in sys.argv:
        idx = sys.argv.index('--service-key')
        if idx + 1 < len(sys.argv):
            return sys.argv[idx + 1]
    
    api_key = os.getenv('DATA_GO_KR_API_KEY') or os.getenv('PUBLIC_DATA_API_KEY') or os.getenv('SERVICE_KEY')
    if api_key:
        return api_key
    
    return 'JjDWdlAv7EoXnVVyglmBvILGrHIHLaACtRZrf7Is4tAgA%2B01JqmxS8kQtL6OEuqQ%2BZi%2FKCNnDTgon3p%2Fc6rQSA%3D%3D'

API_KEY = get_api_key()

# 📋 API 서비스 설정
# 각 API의 publicDataPk와 서비스 번호는 공공데이터포털에서 확인 필요
API_SERVICES = {
    'permit': {
        'name': '의약품 제품 허가정보',
        'base_url': 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07',
        'endpoints': {
            'list': 'getDrugPrdtPrmsnInfoList04',
            'detail': 'getDrugPrdtPrmsnDtlInq04'
        },
        'description': '품목명, 주성분, 제조사, 분류명(전문/일반), 품목기준코드'
    },
    'overview': {
        'name': '의약품개요정보(e약은요)',
        'base_url': 'http://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService04',  # 확인 필요
        'endpoints': {
            'list': 'getDrugPrdtPrmsnInfoList04',  # 확인 필요
            'detail': 'getDrugPrdtPrmsnDtlInq04'  # 확인 필요
        },
        'description': '효능/효과, 용법/용량, 주의사항 등 상세 복약 정보'
    },
    'dur': {
        'name': '의약품안전사용서비스(DUR)',
        'base_url': 'http://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService04',  # 확인 필요
        'endpoints': {
            'list': 'getDrugPrdtPrmsnInfoList04',  # 확인 필요
        },
        'description': '임부/연령대 금기, 병용금기 등 안전사용 주의사항'
    },
    'tablet': {
        'name': '의약품 낱알식별 정보',
        'base_url': 'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03',
        'endpoints': {
            'list': 'getMdcinGrnIdntfcInfoList03',
            'detail': 'getMdcinGrnIdntfcInfoDtlInq03'
        },
        'description': '알약의 모양, 색상, 식별 문자 정보'
    }
}

BATCH_SIZE = 1000
DATA_TYPE = 'json'

def fetch_from_api(service_name: str, endpoint_name: str, params: Dict = None, fetch_all: bool = False) -> Optional[List[Dict]]:
    """특정 API에서 데이터를 가져옵니다 (페이지네이션 지원)"""
    if service_name not in API_SERVICES:
        print(f"❌ 알 수 없는 서비스: {service_name}")
        return None
    
    service = API_SERVICES[service_name]
    if endpoint_name not in service['endpoints']:
        print(f"❌ 알 수 없는 엔드포인트: {endpoint_name}")
        return None
    
    url = f"{service['base_url']}/{service['endpoints'][endpoint_name]}"
    
    all_items = []
    page_no = 1
    
    while True:
        default_params = {
            'serviceKey': API_KEY,
            'pageNo': page_no,
            'numOfRows': BATCH_SIZE,
            'type': DATA_TYPE
        }
        
        if params:
            default_params.update(params)
        
        try:
            if page_no == 1:
                print(f"📡 {service['name']} API 호출 중...")
            resp = requests.get(url, params=default_params, timeout=30)
            
            if resp.status_code != 200:
                print(f"   ⚠️  상태 코드: {resp.status_code}")
                if page_no == 1:
                    return None
                break
            
            data = resp.json()
            
            # 응답 데이터 추출
            items = (
                data.get('body', {}).get('items', []) or 
                data.get('response', {}).get('body', {}).get('items', []) or 
                data.get('items', []) or 
                []
            )
            
            if not items:
                break
            
            all_items.extend(items)
            
            # 전체 데이터를 가져올 필요가 없거나 마지막 페이지인 경우
            total_count = (
                data.get('body', {}).get('totalCount', 0) or
                data.get('response', {}).get('body', {}).get('totalCount', 0) or
                0
            )
            
            if page_no == 1:
                print(f"   📊 총 {total_count:,}개 항목 발견")
            
            if not fetch_all or len(items) < BATCH_SIZE or len(all_items) >= total_count:
                break
            
            page_no += 1
            if page_no % 10 == 0:
                print(f"   ⏳ 진행 중... {len(all_items):,}개 수집 완료")
            time.sleep(0.2)  # API 호출 제한 방지
            
        except Exception as e:
            print(f"   ❌ 오류: {str(e)[:100]}")
            if page_no == 1:
                return None
            break
    
    print(f"   ✅ 총 {len(all_items):,}개 항목 수집 완료")
    return all_items

def load_permit_data_from_file(file_path: str) -> List[Dict]:
    """의약품 제품 허가정보 파일에서 데이터 로드 (CSV 또는 JSON)"""
    print(f"📂 허가정보 파일 읽기: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"   ⚠️  파일이 없습니다: {file_path}")
        return []
    
    try:
        if file_path.endswith('.csv'):
            # CSV 파일 읽기
            encodings = ['cp949', 'utf-8', 'euc-kr', 'latin1']
            for encoding in encodings:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        reader = csv.DictReader(f)
                        data = list(reader)
                        print(f"   ✅ CSV 파일 읽기 성공 (인코딩: {encoding})")
                        print(f"   총 항목 수: {len(data):,}개")
                        return data
                except:
                    continue
            print(f"   ❌ CSV 파일을 읽을 수 없습니다.")
            return []
        
        elif file_path.endswith('.json'):
            # JSON 파일 읽기
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                print(f"   ✅ JSON 파일 읽기 성공")
                print(f"   총 항목 수: {len(data):,}개")
                return data if isinstance(data, list) else []
        
        else:
            print(f"   ❌ 지원하지 않는 파일 형식: {file_path}")
            return []
            
    except Exception as e:
        print(f"   ❌ 파일 읽기 오류: {str(e)[:100]}")
        return []

def load_all_dur_files(assets_dir: str = 'src/assets') -> Tuple[List[Dict], List[Dict]]:
    """모든 DUR CSV 파일을 자동으로 찾아서 로드 (병합 파일 우선)
    
    Returns:
        (dur_data, permit_data): DUR 데이터와 허가정보 데이터 튜플
    """
    dur_files = []
    merged_file = None
    
    if os.path.exists(assets_dir):
        all_files = [f for f in os.listdir(assets_dir) if 'DUR' in f and f.endswith('.csv')]
        
        # 병합 파일이 있으면 우선 처리
        for f in all_files:
            if '병합' in f:
                merged_file = f
                break
        
        # 병합 파일이 있으면 제외하고 나머지 파일 로드
        if merged_file:
            dur_files = [f for f in all_files if f != merged_file and '병합' not in f]
        else:
            dur_files = all_files
        
        dur_files.sort()
    
    if not dur_files and not merged_file:
        print(f"⚠️  DUR CSV 파일을 찾을 수 없습니다.")
        return [], []
    
    print(f"📂 DUR CSV 파일 로드 시작")
    all_dur_data = []
    permit_data = []  # 병합 파일에서 추출한 허가정보
    
    # 1. 병합 파일 우선 처리 (허가정보 포함)
    if merged_file:
        file_path = os.path.join(assets_dir, merged_file)
        print(f"   📄 {merged_file} (병합 파일 - 허가정보 + DUR)")
        
        encodings = ['cp949', 'utf-8', 'euc-kr']
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    reader = csv.DictReader(f)
                    rows = list(reader)
                    if rows:
                        print(f"      ✅ {len(rows):,}개 행 읽기 성공")
                        # 병합 파일은 여러 타입이 섞여있으므로 상세정보 필드로 타입 판단
                        for row in rows:
                            # 허가정보 추출 (제품코드를 PRDLST_REPORT_NO로 매핑)
                            product_code = row.get('제품코드', '').strip()
                            if product_code:
                                product_name = row.get('제품명', '').strip()
                                # 제품명에서 형태 추출
                                shape, shape_code = extract_shape_from_product_name(product_name)
                                
                                permit_item = {
                                    'PRDLST_REPORT_NO': product_code,  # 제품코드를 품목기준코드로 사용
                                    'PRDLST_NM': product_name,
                                    'BSSH_NM': row.get('업체명', row.get('업소명', '')).strip(),
                                    'RAWMTRL_NM': row.get('성분명', '').strip(),
                                    'PRIMARY_FNCLTY': row.get('약품상세정보', '').strip(),  # 약품상세정보 추가
                                    'PRMS_DT': row.get('고시일자', row.get('공고일자', '')).strip().replace('-', ''),  # 날짜 형식 변환
                                    'LCNS_NO': row.get('공고번호', row.get('고시번호', '')).strip(),  # 공고번호/고시번호를 허가번호로
                                    'SHAP': shape,  # 형태 추출
                                    'PRDT_SHAP_CD_NM': shape_code,  # 형태코드명
                                    'DISPOS': 'Y' if row.get('급여여부', '').strip() == '급여' else 'N',  # 급여여부를 처방전 필요 여부로 매핑
                                    'ITEM_SEQ': product_code,  # 호환성을 위해
                                    'item_seq': product_code,
                                }
                                permit_data.append(permit_item)
                            
                            # 상세정보 필드 확인하여 타입 추정
                            detail = row.get('상세정보', row.get('약품상세정보', ''))
                            if '노인' in str(detail) or '노인주의' in str(detail):
                                if '해열' in str(detail) or '진통' in str(detail):
                                    row['_DUR_TYPE'] = 'elderly_nsaid'
                                else:
                                    row['_DUR_TYPE'] = 'elderly'
                            elif '연령' in str(detail) or '특정연령' in str(row.get('특정연령', '')):
                                row['_DUR_TYPE'] = 'age'
                            else:
                                row['_DUR_TYPE'] = 'elderly'  # 기본값
                            row['_DUR_FILE'] = merged_file
                        all_dur_data.extend(rows)
                        break
            except Exception as e:
                continue
    
    # 2. 나머지 개별 파일 처리 (임부금기, 병용금기 등)
    for dur_file in dur_files:
        file_path = os.path.join(assets_dir, dur_file)
        file_type = 'unknown'
        
        # 파일명에서 타입 추출
        if '임부금기' in dur_file:
            file_type = 'pregnancy'
        elif '연령금기' in dur_file:
            file_type = 'age'
        elif '노인주의' in dur_file and '해열진통소염제' in dur_file:
            file_type = 'elderly_nsaid'
        elif '노인주의' in dur_file:
            file_type = 'elderly'
        elif '병용금기' in dur_file:
            file_type = 'interaction'
        
        print(f"   📄 {dur_file} ({file_type})")
        
        # CSV 파일 읽기
        encodings = ['cp949', 'utf-8', 'euc-kr']
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    reader = csv.DictReader(f)
                    rows = list(reader)
                    if rows:
                        print(f"      ✅ {len(rows):,}개 행 읽기 성공")
                        # 파일 타입 정보 추가 및 허가정보 추출
                        for row in rows:
                            row['_DUR_TYPE'] = file_type
                            row['_DUR_FILE'] = dur_file
                            
                            # 개별 파일에서도 허가정보 추출 (제품코드가 있는 경우)
                            product_code = row.get('제품코드', row.get('제품코드A', row.get('제품코드B', ''))).strip()
                            if product_code:
                                product_name = row.get('제품명', row.get('제품명A', row.get('제품명B', ''))).strip()
                                # 제품명에서 형태 추출
                                shape, shape_code = extract_shape_from_product_name(product_name)
                                
                                permit_item = {
                                    'PRDLST_REPORT_NO': product_code,
                                    'PRDLST_NM': product_name,
                                    'BSSH_NM': row.get('업체명', row.get('업소명', row.get('업체명A', row.get('업체명B', '')))).strip(),
                                    'RAWMTRL_NM': row.get('성분명', row.get('성분명A', row.get('성분명B', ''))).strip(),
                                    'PRIMARY_FNCLTY': row.get('약품상세정보', '').strip(),
                                    'PRMS_DT': row.get('고시일자', row.get('공고일자', '')).strip().replace('-', ''),
                                    'LCNS_NO': row.get('공고번호', row.get('고시번호', '')).strip(),  # 공고번호/고시번호를 허가번호로
                                    'SHAP': shape,  # 형태 추출
                                    'PRDT_SHAP_CD_NM': shape_code,  # 형태코드명
                                    'DISPOS': 'Y' if row.get('급여여부', row.get('급여여부A', row.get('급여여부B', ''))).strip() == '급여' else 'N',
                                    'ITEM_SEQ': product_code,
                                    'item_seq': product_code,
                                }
                                permit_data.append(permit_item)
                        
                        all_dur_data.extend(rows)
                        break
            except Exception as e:
                continue
    
    print(f"✅ 총 {len(all_dur_data):,}개 DUR 데이터 로드 완료")
    if permit_data:
        print(f"✅ 병합 파일에서 {len(permit_data):,}개 허가정보 추출 완료")
    return all_dur_data, permit_data

def load_existing_medicine_data() -> Dict[str, Dict]:
    """기존 medicine.json 데이터 로드 (e약은요 정보 포함)"""
    medicine_path = 'src/assets/medicine.json'
    
    if not os.path.exists(medicine_path):
        print(f"⚠️  기존 medicine.json이 없습니다.")
        return {}
    
    try:
        with open(medicine_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 품목기준코드를 키로 하는 딕셔너리로 변환
        result = {}
        for item in data:
            item_seq = item.get('PRDLST_REPORT_NO', '').strip()
            if item_seq:
                result[item_seq] = item
        
        print(f"✅ 기존 medicine.json 로드: {len(result):,}개 항목")
        return result
        
    except Exception as e:
        print(f"❌ 기존 medicine.json 읽기 오류: {str(e)[:100]}")
        return {}

def normalize_product_name(name):
    """제품명 정규화 (더 정교한 버전)"""
    if not name:
        return ''
    # 소문자 변환
    normalized = name.lower()
    # 괄호 내용 제거 (성분명, 용량 등)
    normalized = re.sub(r'\([^)]*\)', '', normalized)
    normalized = re.sub(r'\[[^\]]*\]', '', normalized)
    # 공백, 특수문자 제거
    normalized = re.sub(r'[_\-\s\.]', '', normalized)
    # 숫자와 단위 제거 (예: 100mg, 0.25g, 333mg 등)
    normalized = re.sub(r'\d+\.?\d*\s*(mg|g|ml|정|캡슐|앰플|병|밀리그람)', '', normalized, flags=re.IGNORECASE)
    # 슬래시 제거
    normalized = normalized.replace('/', '')
    return normalized

def extract_shape_from_product_name(product_name):
    """제품명에서 형태 정보 추출"""
    if not product_name:
        return '', ''
    
    product_lower = product_name.lower()
    
    # 형태 매핑
    shape_mapping = {
        '정': ('정', '정제'),
        '캡슐': ('캡슐', '캡슐제'),
        '앰플': ('앰플', '주사제'),
        '주사': ('주사제', '주사제'),
        '시럽': ('시럽', '시럽제'),
        '연고': ('연고', '연고제'),
        '크림': ('크림', '크림제'),
        '점안': ('점안액', '점안제'),
        '좌제': ('좌제', '좌제'),
        '반창고': ('반창고', '반창고'),
        '패치': ('패치', '패치제'),
        '스프레이': ('스프레이', '스프레이제'),
        '로션': ('로션', '로션제'),
        '젤': ('젤', '젤제'),
        '파우더': ('파우더', '파우더제'),
        '가글': ('가글', '가글제'),
        '좌약': ('좌제', '좌제'),
    }
    
    # 형태 추출
    for keyword, (shape, shape_code) in shape_mapping.items():
        if keyword in product_lower:
            return shape, shape_code
    
    return '', ''

def merge_medicine_data(existing_data: Dict[str, Dict], permit_data: List[Dict], 
                        dur_data: List[Dict], tablet_data: List[Dict]) -> List[Dict]:
    """여러 API의 데이터를 품목기준코드를 기준으로 병합"""
    print(f"\n🔄 데이터 병합 중...")
    
    # 기존 데이터를 기본으로 사용 (e약은요 정보 포함)
    merged = existing_data.copy()
    
    # 1. 허가정보 데이터 병합 (주성분, 분류명 등 추가)
    permit_count = 0
    for item in permit_data:
        item_seq = None
        # 품목기준코드 추출 (여러 형식 지원)
        for key in ['ITEM_SEQ', 'item_seq', '품목기준코드', 'PRDLST_REPORT_NO', 'report_no', 'ITEM_SEQ ', '품목기준코드 ']:
            if key in item:
                item_seq = str(item[key]).strip()
                break
        
        if item_seq:
            # 기존 항목이 없으면 기본 구조 생성
            if item_seq not in merged:
                merged[item_seq] = {
                    'PRDLST_REPORT_NO': item_seq,
                    'PRDLST_NM': '',
                    'BSSH_NM': '',
                    'LCNS_NO': '',
                    'PRDT_SHAP_CD_NM': '',
                    'SHAP': '',
                    'DISPOS': '',
                    'PRIMARY_FNCLTY': '',
                    'NTK_MTHD': '',
                    'IFTKN_ATNT_MATR_CN': '',
                    'SEQESITM': '',
                    'CSTDY_MTHD': '',
                    'POG_DAYCNT': '',
                    'RAWMTRL_NM': '',
                    'STDR_STND': '',
                    'PRMS_DT': '',
                    'CRET_DTM': '',
                    'LAST_UPDT_DTM': ''
                }
            
            # 허가정보 업데이트 (기존 값이 없을 때만)
            if not merged[item_seq].get('PRDLST_NM'):
                merged[item_seq]['PRDLST_NM'] = item.get('ITEM_NAME', item.get('item_name', item.get('PRDLST_NM', '')))
            if not merged[item_seq].get('BSSH_NM'):
                merged[item_seq]['BSSH_NM'] = item.get('ENTP_NAME', item.get('entp_name', item.get('BSSH_NM', '')))
            if not merged[item_seq].get('RAWMTRL_NM'):
                merged[item_seq]['RAWMTRL_NM'] = item.get('RAWMTRL_NM', item.get('rawmtrl_nm', item.get('주성분', item.get('주성분 ', ''))))
            if not merged[item_seq].get('LCNS_NO'):
                merged[item_seq]['LCNS_NO'] = item.get('LCNS_NO', item.get('lcs_no', ''))
            if not merged[item_seq].get('PRDT_SHAP_CD_NM'):
                merged[item_seq]['PRDT_SHAP_CD_NM'] = item.get('PRDT_SHAP_CD_NM', item.get('prdt_shap_cd_nm', ''))
            if not merged[item_seq].get('STDR_STND'):
                merged[item_seq]['STDR_STND'] = item.get('STDR_STND', item.get('stdr_stnd', ''))
            # 약품상세정보 추가 (PRIMARY_FNCLTY)
            if not merged[item_seq].get('PRIMARY_FNCLTY') and item.get('PRIMARY_FNCLTY'):
                merged[item_seq]['PRIMARY_FNCLTY'] = item.get('PRIMARY_FNCLTY', '')
            # 고시일자 추가 (PRMS_DT)
            if not merged[item_seq].get('PRMS_DT') and item.get('PRMS_DT'):
                merged[item_seq]['PRMS_DT'] = item.get('PRMS_DT', '')
            # 형태 정보 추가 (SHAP, PRDT_SHAP_CD_NM)
            if not merged[item_seq].get('SHAP') and item.get('SHAP'):
                merged[item_seq]['SHAP'] = item.get('SHAP', '')
            if not merged[item_seq].get('PRDT_SHAP_CD_NM') and item.get('PRDT_SHAP_CD_NM'):
                merged[item_seq]['PRDT_SHAP_CD_NM'] = item.get('PRDT_SHAP_CD_NM', '')
            # 처방전 필요 여부 추가 (DISPOS)
            if not merged[item_seq].get('DISPOS') and item.get('DISPOS'):
                merged[item_seq]['DISPOS'] = item.get('DISPOS', '')
            permit_count += 1
    
    print(f"   ✅ 허가정보 병합: {permit_count:,}개 항목 업데이트")
    
    # 2. DUR 데이터 병합 (제품코드와 제품명으로 매칭)
    dur_count = 0
    
    # medicine.json의 제품명 인덱스 생성 (매칭을 위해)
    # normalize_product_name 함수는 이미 위에 정의되어 있음
    medicine_name_index = {}  # 정규화된 제품명 -> PRDLST_REPORT_NO 매핑
    medicine_name_to_code = {}  # 원본 제품명 -> PRDLST_REPORT_NO 매핑
    for item_seq, item in merged.items():
        product_name = item.get('PRDLST_NM', '').strip()
        if product_name:
            normalized_name = normalize_product_name(product_name)
            if normalized_name:
                if normalized_name not in medicine_name_index:
                    medicine_name_index[normalized_name] = []
                medicine_name_index[normalized_name].append(item_seq)
            # 원본 이름도 저장
            medicine_name_to_code[product_name.lower()] = item_seq
    
    # DUR 데이터를 제품코드와 제품명으로 그룹화
    dur_by_code = {}  # 제품코드별
    dur_by_name = {}  # 제품명별
    
    for item in dur_data:
        # 제품코드 추출
        product_code = None
        for key in ['제품코드', '제품코드A', '제품코드B']:
            if key in item:
                product_code = str(item[key]).strip()
                break
        
        # 제품명 추출
        product_name = None
        for key in ['제품명', '제품명A', '제품명B']:
            if key in item:
                product_name = str(item[key]).strip()
                break
        
        if not product_code and not product_name:
            continue
        
        dur_type = item.get('_DUR_TYPE', 'unknown')
        detail_info = item.get('상세정보', item.get('약품상세정보', ''))
        
        # 제품코드로 그룹화
        if product_code:
            if product_code not in dur_by_code:
                dur_by_code[product_code] = {
                    'pregnancy': [],
                    'age': [],
                    'elderly': [],
                    'interaction': []
                }
            
            if dur_type == 'pregnancy' and detail_info:
                dur_by_code[product_code]['pregnancy'].append(detail_info)
            elif dur_type == 'age' and detail_info:
                dur_by_code[product_code]['age'].append(detail_info)
            elif dur_type in ['elderly', 'elderly_nsaid'] and detail_info:
                dur_by_code[product_code]['elderly'].append(detail_info)
        
        # 제품명으로 그룹화
        if product_name:
            normalized_name = normalize_product_name(product_name)
            if normalized_name:
                if normalized_name not in dur_by_name:
                    dur_by_name[normalized_name] = {
                        'pregnancy': [],
                        'age': [],
                        'elderly': [],
                        'interaction': []
                    }
                
                if dur_type == 'pregnancy' and detail_info:
                    dur_by_name[normalized_name]['pregnancy'].append(detail_info)
                elif dur_type == 'age' and detail_info:
                    dur_by_name[normalized_name]['age'].append(detail_info)
                elif dur_type in ['elderly', 'elderly_nsaid'] and detail_info:
                    dur_by_name[normalized_name]['elderly'].append(detail_info)
                elif dur_type == 'interaction':
                    # 병용금기는 제품명A와 제품명B 모두에 추가
                    name_a = item.get('제품명A', '').strip()
                    name_b = item.get('제품명B', '').strip()
                    interaction_info = f"{name_a} + {name_b}: {detail_info}"
                    
                    if name_a:
                        norm_a = normalize_product_name(name_a)
                        if norm_a:
                            if norm_a not in dur_by_name:
                                dur_by_name[norm_a] = {'pregnancy': [], 'age': [], 'elderly': [], 'interaction': []}
                            dur_by_name[norm_a]['interaction'].append(interaction_info)
                    
                    if name_b:
                        norm_b = normalize_product_name(name_b)
                        if norm_b:
                            if norm_b not in dur_by_name:
                                dur_by_name[norm_b] = {'pregnancy': [], 'age': [], 'elderly': [], 'interaction': []}
                            dur_by_name[norm_b]['interaction'].append(interaction_info)
    
    # DUR 정보를 medicine.json에 병합 (제품코드 우선, 없으면 제품명으로)
    matched_by_code = 0
    matched_by_name = 0
    
    # 1) 제품코드로 매칭
    for product_code, dur_info in dur_by_code.items():
        if product_code in merged:
            warnings = []
            if dur_info['pregnancy']:
                warnings.append(f"[임부금기]\n" + "\n".join(dur_info['pregnancy']))
            if dur_info['age']:
                warnings.append(f"[연령금기]\n" + "\n".join(dur_info['age']))
            if dur_info['elderly']:
                warnings.append(f"[노인주의]\n" + "\n".join(dur_info['elderly']))
            if dur_info['interaction']:
                warnings.append(f"[병용금기]\n" + "\n".join(dur_info['interaction']))
            
            if warnings:
                existing = merged[product_code].get('IFTKN_ATNT_MATR_CN', '')
                dur_warning = "\n\n".join(warnings)
                if existing:
                    merged[product_code]['IFTKN_ATNT_MATR_CN'] = f"{existing}\n\n[안전사용 주의]\n{dur_warning}"
                else:
                    merged[product_code]['IFTKN_ATNT_MATR_CN'] = f"[안전사용 주의]\n{dur_warning}"
                matched_by_code += 1
    
    # 2) 제품명으로 매칭
    for normalized_name, dur_info in dur_by_name.items():
        if normalized_name in medicine_name_index:
            for item_seq in medicine_name_index[normalized_name]:
                # 이미 제품코드로 매칭된 경우 스킵
                if item_seq in dur_by_code:
                    continue
                
                warnings = []
                if dur_info['pregnancy']:
                    warnings.append(f"[임부금기]\n" + "\n".join(dur_info['pregnancy']))
                if dur_info['age']:
                    warnings.append(f"[연령금기]\n" + "\n".join(dur_info['age']))
                if dur_info['elderly']:
                    warnings.append(f"[노인주의]\n" + "\n".join(dur_info['elderly']))
                if dur_info['interaction']:
                    warnings.append(f"[병용금기]\n" + "\n".join(dur_info['interaction']))
                
                if warnings:
                    existing = merged[item_seq].get('IFTKN_ATNT_MATR_CN', '')
                    dur_warning = "\n\n".join(warnings)
                    if existing:
                        merged[item_seq]['IFTKN_ATNT_MATR_CN'] = f"{existing}\n\n[안전사용 주의]\n{dur_warning}"
                    else:
                        merged[item_seq]['IFTKN_ATNT_MATR_CN'] = f"[안전사용 주의]\n{dur_warning}"
                    matched_by_name += 1
    
    dur_count = matched_by_code + matched_by_name
    print(f"   ✅ DUR 정보 병합: {dur_count:,}개 항목 업데이트 (코드: {matched_by_code:,}, 이름: {matched_by_name:,})")
    
    # 3. 낱알식별 정보 병합
    tablet_count = 0
    for item in tablet_data:
        item_seq = None
        for key in ['ITEM_SEQ', 'item_seq', '품목기준코드', 'PRDLST_REPORT_NO', 'report_no', 'ITEM_SEQ ', '품목기준코드 ']:
            if key in item:
                item_seq = str(item[key]).strip()
                break
        
        if item_seq and item_seq in merged:
            if item.get('SHAP') or item.get('shap'):
                merged[item_seq]['SHAP'] = item.get('SHAP', item.get('shap', ''))
            if item.get('PRDT_SHAP_CD_NM') or item.get('prdt_shap_cd_nm'):
                merged[item_seq]['PRDT_SHAP_CD_NM'] = item.get('PRDT_SHAP_CD_NM', item.get('prdt_shap_cd_nm', ''))
            tablet_count += 1
    
    if tablet_data:
        print(f"   ✅ 낱알식별 정보 병합: {tablet_count:,}개 항목 업데이트")
    else:
        print(f"   ⏭️  낱알식별 정보 병합: 건너뜀 (나중에 처리)")
    
    # medicine.json 필드 구조에 맞게 정리 (18개 필드)
    result = []
    for item_seq, item in merged.items():
        if not item.get('PRDLST_REPORT_NO'):
            continue
        
        # medicine.json 필드 구조에 맞게 정리
        cleaned_item = {
            'PRDLST_REPORT_NO': item.get('PRDLST_REPORT_NO', ''),
            'PRDLST_NM': item.get('PRDLST_NM', ''),
            'BSSH_NM': item.get('BSSH_NM', ''),
            'LCNS_NO': item.get('LCNS_NO', ''),
            'PRDT_SHAP_CD_NM': item.get('PRDT_SHAP_CD_NM', ''),
            'SHAP': item.get('SHAP', ''),
            'DISPOS': item.get('DISPOS', ''),
            'PRIMARY_FNCLTY': item.get('PRIMARY_FNCLTY', ''),
            'NTK_MTHD': item.get('NTK_MTHD', ''),
            'IFTKN_ATNT_MATR_CN': item.get('IFTKN_ATNT_MATR_CN', ''),
            'SEQESITM': item.get('SEQESITM', ''),
            'CSTDY_MTHD': item.get('CSTDY_MTHD', ''),
            'POG_DAYCNT': item.get('POG_DAYCNT', ''),
            'RAWMTRL_NM': item.get('RAWMTRL_NM', ''),
            'STDR_STND': item.get('STDR_STND', ''),
            'PRMS_DT': item.get('PRMS_DT', ''),
            'CRET_DTM': item.get('CRET_DTM', ''),
            'LAST_UPDT_DTM': item.get('LAST_UPDT_DTM', '')
        }
        result.append(cleaned_item)
    
    print(f"✅ {len(result):,}개 항목 병합 완료")
    return result

def fetch_missing_fields_from_api(medicine_data: List[Dict]) -> Dict[str, Dict]:
    """비어있는 필드가 있는 항목들에 대해 API를 호출하여 데이터 채우기"""
    print(f"\n🌐 API를 통한 비어있는 필드 채우기 시작...")
    
    # 비어있는 필드가 있는 항목 찾기
    items_to_fetch = []
    for item in medicine_data:
        item_seq = item.get('PRDLST_REPORT_NO', '').strip()
        if not item_seq:
            continue
        
        # 비어있는 필드 확인
        missing_fields = []
        if not item.get('PRIMARY_FNCLTY') or not str(item.get('PRIMARY_FNCLTY')).strip():
            missing_fields.append('PRIMARY_FNCLTY')
        if not item.get('NTK_MTHD') or not str(item.get('NTK_MTHD')).strip():
            missing_fields.append('NTK_MTHD')
        if not item.get('IFTKN_ATNT_MATR_CN') or not str(item.get('IFTKN_ATNT_MATR_CN')).strip():
            missing_fields.append('IFTKN_ATNT_MATR_CN')
        if not item.get('CSTDY_MTHD') or not str(item.get('CSTDY_MTHD')).strip():
            missing_fields.append('CSTDY_MTHD')
        if not item.get('RAWMTRL_NM') or not str(item.get('RAWMTRL_NM')).strip():
            missing_fields.append('RAWMTRL_NM')
        
        if missing_fields:
            items_to_fetch.append((item_seq, missing_fields))
    
    print(f"   📋 비어있는 필드가 있는 항목: {len(items_to_fetch):,}개")
    
    if not items_to_fetch:
        print(f"   ✅ 모든 필드가 채워져 있습니다.")
        return {}
    
    # API 호출로 데이터 가져오기 (품목기준코드로 상세 정보 조회)
    api_data = {}
    fetched_count = 0
    error_count = 0
    consecutive_errors = 0
    max_consecutive_errors = 10  # 연속 에러 최대 횟수
    
    # 배치로 처리 (API 호출 제한 고려)
    # 시간이 오래 걸리므로 샘플만 처리하거나 사용자에게 알림
    if len(items_to_fetch) > 1000:
        print(f"   ⚠️  비어있는 필드가 있는 항목이 {len(items_to_fetch):,}개로 많습니다.")
        print(f"   💡 모든 항목을 처리하려면 시간이 매우 오래 걸립니다 (예상: {len(items_to_fetch) * 0.2 / 60:.1f}분 이상)")
        print(f"   📝 처음 100개만 샘플로 처리합니다. 전체를 처리하려면 스크립트를 수정하세요.")
        items_to_fetch = items_to_fetch[:100]  # 샘플만 처리
    
    batch_size = 10  # 배치 크기 줄임
    for i in range(0, len(items_to_fetch), batch_size):
        batch = items_to_fetch[i:i+batch_size]
        print(f"   ⏳ 진행 중... {min(i+batch_size, len(items_to_fetch)):,}/{len(items_to_fetch):,}개 항목 처리 중")
        
        for item_seq, missing_fields in batch:
            # 연속 에러가 너무 많으면 중단
            if consecutive_errors >= max_consecutive_errors:
                print(f"   ⚠️  연속 에러 {max_consecutive_errors}회 발생. API 호출 중단.")
                print(f"   💡 --skip-api-fetch 옵션을 사용하여 이 단계를 건너뛸 수 있습니다.")
                break
            
            # e약은요 API 호출 (품목기준코드로 상세 정보 조회)
            try:
                params = {'item_seq': item_seq}
                detail_data = fetch_from_api('overview', 'detail', params=params, fetch_all=False)
                
                if detail_data and len(detail_data) > 0:
                    api_item = detail_data[0]
                    api_data[item_seq] = api_item
                    fetched_count += 1
                    consecutive_errors = 0  # 성공 시 에러 카운터 리셋
                    
                    # API 응답 필드 매핑
                    if 'PRIMARY_FNCLTY' in missing_fields:
                        api_item['PRIMARY_FNCLTY'] = api_item.get('EFCY_QESITM', api_item.get('efcy_qesitm', ''))
                    if 'NTK_MTHD' in missing_fields:
                        api_item['NTK_MTHD'] = api_item.get('USE_METHOD_QESITM', api_item.get('use_method_qesitm', ''))
                    if 'IFTKN_ATNT_MATR_CN' in missing_fields:
                        api_item['IFTKN_ATNT_MATR_CN'] = api_item.get('ATPN_WARN_QESITM', api_item.get('atpn_warn_qesitm', ''))
                    if 'CSTDY_MTHD' in missing_fields:
                        api_item['CSTDY_MTHD'] = api_item.get('DEPOSIT_METHOD_QESITM', api_item.get('deposit_method_qesitm', ''))
                    if 'RAWMTRL_NM' in missing_fields:
                        api_item['RAWMTRL_NM'] = api_item.get('ITEM_INGREDIENT', api_item.get('item_ingredient', ''))
                else:
                    error_count += 1
                    consecutive_errors += 1
                
                time.sleep(0.1)  # API 호출 제한 방지
            except Exception as e:
                error_count += 1
                consecutive_errors += 1
                continue
        
        # 배치 중단 체크
        if consecutive_errors >= max_consecutive_errors:
            break
    
    print(f"   ✅ {fetched_count:,}개 항목의 API 데이터 수집 완료")
    if error_count > 0:
        print(f"   ⚠️  {error_count:,}개 항목 처리 실패")
    return api_data

def fetch_all_combined_data(permit_file: str = None, use_existing_medicine: bool = True, skip_api_fetch: bool = False):
    """모든 데이터 소스를 조합하여 medicine.json 생성
    
    목표: 기존 medicine.json(일반의약품)에 전문의약품 추가하여 확장
    
    Args:
        permit_file: 허가정보 파일 경로 (없으면 API 호출)
        use_existing_medicine: 기존 medicine.json 사용 여부 (False면 e약은요 API 호출)
        skip_api_fetch: API를 통한 비어있는 필드 채우기 단계 건너뛰기
    """
    print(f"🚀 4개 데이터 소스 조합하여 의약품 데이터 수집 시작")
    print(f"📅 시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("📋 조합할 데이터 소스:")
    print("   1️⃣  의약품 제품 허가정보 (파일 제공 시에만 사용)")
    print("   2️⃣  의약품개요정보(e약은요) - 기존 medicine.json (일반의약품)")
    print("   3️⃣  의약품안전사용서비스(DUR) - CSV 파일 5개")
    print("   4️⃣  의약품 낱알식별 정보 (API) - 현재 비활성화")
    print()
    print("💡 목표: 일반의약품(e약은요) + DUR 정보 통합")
    print()
    
    # 1. e약은요 데이터 수집 (기존 medicine.json 또는 API)
    overview_data = {}
    if use_existing_medicine:
        print(f"📂 기존 medicine.json 로드 (e약은요 정보 포함)...")
        overview_data = load_existing_medicine_data()
    else:
        print(f"🌐 e약은요 API 호출 시도...")
        overview_api_data = fetch_from_api('overview', 'detail', fetch_all=True) or []
        # API 데이터를 딕셔너리로 변환
        for item in overview_api_data:
            item_seq = None
            for key in ['ITEM_SEQ', 'item_seq', '품목기준코드', 'PRDLST_REPORT_NO']:
                if key in item:
                    item_seq = str(item[key]).strip()
                    break
            if item_seq:
                overview_data[item_seq] = item
    print()
    
    # 2. 허가정보 데이터 수집 (전문의약품 + 일반의약품 포함)
    # 이 데이터가 기존 medicine.json에 없는 전문의약품을 추가함
    permit_data = []
    if permit_file and os.path.exists(permit_file):
        print(f"📂 허가정보 파일 사용: {permit_file}")
        permit_data = load_permit_data_from_file(permit_file)
    # 허가정보 파일이 없으면 조용히 건너뜀 (정상 동작)
    print()
    
    # 3. DUR 데이터 수집 (모든 CSV 파일 자동 로드)
    # 병합 파일에서 허가정보도 함께 추출됨
    print(f"📂 DUR CSV 파일 자동 로드 (5개 파일)...")
    dur_data, dur_permit_data = load_all_dur_files()
    
    # 병합 파일에서 추출한 허가정보를 permit_data에 추가
    if dur_permit_data:
        print(f"📂 병합 파일에서 허가정보 추출: {len(dur_permit_data):,}개")
        permit_data.extend(dur_permit_data)
    print()
    
    # 4. 낱알식별 정보 수집 (API) - 현재 비활성화
    # print(f"🌐 낱알식별 정보 API 호출 시도...")
    # tablet_data = fetch_from_api('tablet', 'list', fetch_all=True) or []
    tablet_data = []  # 낱알정보는 나중에 처리
    # print()
    
    # 데이터 병합
    merged_data = merge_medicine_data(overview_data, permit_data, dur_data, tablet_data)
    
    if not merged_data:
        print("❌ 병합된 데이터가 없습니다.")
        return False
    
    # 비어있는 필드가 있는 항목들에 대해 API 호출하여 채우기
    api_fetched_data = {}
    if not skip_api_fetch:
        api_fetched_data = fetch_missing_fields_from_api(merged_data)
    else:
        print(f"\n⏭️  API를 통한 비어있는 필드 채우기 단계 건너뜀 (--skip-api-fetch 옵션)")
    
    # API에서 가져온 데이터로 비어있는 필드 채우기
    if api_fetched_data:
        print(f"\n🔄 API 데이터로 비어있는 필드 채우기...")
        filled_count = 0
        for item in merged_data:
            item_seq = item.get('PRDLST_REPORT_NO', '').strip()
            if item_seq in api_fetched_data:
                api_item = api_fetched_data[item_seq]
                
                # 비어있는 필드만 채우기
                if not item.get('PRIMARY_FNCLTY') and api_item.get('PRIMARY_FNCLTY'):
                    item['PRIMARY_FNCLTY'] = api_item.get('PRIMARY_FNCLTY', '')
                if not item.get('NTK_MTHD') and api_item.get('NTK_MTHD'):
                    item['NTK_MTHD'] = api_item.get('NTK_MTHD', '')
                if not item.get('IFTKN_ATNT_MATR_CN') and api_item.get('IFTKN_ATNT_MATR_CN'):
                    item['IFTKN_ATNT_MATR_CN'] = api_item.get('IFTKN_ATNT_MATR_CN', '')
                if not item.get('CSTDY_MTHD') and api_item.get('CSTDY_MTHD'):
                    item['CSTDY_MTHD'] = api_item.get('CSTDY_MTHD', '')
                if not item.get('RAWMTRL_NM') and api_item.get('RAWMTRL_NM'):
                    item['RAWMTRL_NM'] = api_item.get('RAWMTRL_NM', '')
                
                filled_count += 1
        
        print(f"   ✅ {filled_count:,}개 항목의 비어있는 필드 채움 완료")
    
    # 저장
    assets_dir = 'src/assets'
    current_path = os.path.join(assets_dir, 'medicine.json')
    
    # 기존 파일 백업
    if os.path.exists(current_path):
        current_backup = os.path.join(assets_dir, f'medicine_current_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        print(f"\n💾 기존 medicine.json 백업: {current_backup}")
        with open(current_path, 'r', encoding='utf-8') as f:
            current_data = json.load(f)
        with open(current_backup, 'w', encoding='utf-8') as f:
            json.dump(current_data, f, ensure_ascii=False, indent=2)
    
    print(f"💾 병합된 데이터 저장: {current_path}")
    with open(current_path, 'w', encoding='utf-8') as f:
        json.dump(merged_data, f, ensure_ascii=False, indent=2)
    
    print()
    print(f"✅ 데이터 수집 및 병합 완료!")
    print(f"   - 저장 위치: {current_path}")
    print(f"   - 항목 수: {len(merged_data):,}개")
    print(f"📅 완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return True

if __name__ == '__main__':
    if '--help' in sys.argv or '-h' in sys.argv:
        print("""
📋 여러 API 조합하여 의약품 데이터 수집

사용법:
  python3 scripts/fetch_medicine_combined.py [옵션]

옵션:
  --permit-file <파일>  허가정보 파일 경로 (CSV 또는 JSON)
  --api-key <키>        공공데이터포털 서비스키 지정
  -h, --help            이 도움말 출력

환경변수:
  DATA_GO_KR_API_KEY    공공데이터포털 서비스키

조합하는 데이터 소스:
  1. 의약품 제품 허가정보 - 품목명, 주성분, 제조사, 분류명 (파일 또는 API)
  2. 의약품개요정보(e약은요) - 효능/효과, 용법/용량, 주의사항 (기존 medicine.json 활용)
  3. 의약품안전사용서비스(DUR) - 임부/연령대 금기, 병용금기, 노인주의 (CSV 파일 자동 로드)
     - src/assets/ 폴더의 모든 DUR*.csv 파일 자동 인식
  4. 의약품 낱알식별 정보 - 알약 모양, 색상, 식별 문자 (API)

예시:
  # 허가정보 파일 사용
  python3 scripts/fetch_medicine_combined.py --permit-file src/assets/의약품허가정보.csv
  
  # API만 사용
  python3 scripts/fetch_medicine_combined.py

⚠️  주의:
   - DUR CSV 파일은 src/assets/ 폴더에 있어야 자동 인식됨
   - 각 API의 서비스 ID와 엔드포인트는 공공데이터포털에서 확인 필요
   - e약은요 정보는 기존 medicine.json에서 자동으로 활용됨
        """)
        exit(0)
    
    # 허가정보 파일 경로 확인
    permit_file = None
    if '--permit-file' in sys.argv:
        idx = sys.argv.index('--permit-file')
        if idx + 1 < len(sys.argv):
            permit_file = sys.argv[idx + 1]
    
    # API 호출 단계 건너뛰기 옵션 확인
    skip_api_fetch = '--skip-api-fetch' in sys.argv
    
    success = fetch_all_combined_data(permit_file=permit_file, skip_api_fetch=skip_api_fetch)
    exit(0 if success else 1)

