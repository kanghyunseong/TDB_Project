#!/usr/bin/env python3
"""
의약품 백업 파일을 medicine.json으로 변환하는 스크립트
"""

import json
import os
from datetime import datetime

def convert_medicine_format(old_item):
    """의약품 데이터를 현재 형식으로 변환"""
    # 키 이름에 공백이 있을 수 있으므로 여러 가지 시도
    def get_value(*keys):
        for key in keys:
            if key in old_item:
                return old_item[key]
        return ''
    
    itemseq = get_value('품목기준코드 [ITEMSEQ] ', '품목기준코드 [ITEMSEQ]', 'ITEMSEQ')
    itemname = get_value('제품명 [ITEMNAME] ', '제품명 [ITEMNAME]', 'ITEMNAME')
    entpname = get_value('업체명 [ENTPNAME] ', '업체명 [ENTPNAME]', 'ENTPNAME')
    efcy = get_value('문항1(효능) [EFCYQESITM] ', '문항1(효능) [EFCYQESITM]', 'EFCYQESITM')
    usemethod = get_value('문항2(사용법) [USEMETHODQESITM] ', '문항2(사용법) [USEMETHODQESITM]', 'USEMETHODQESITM')
    atpn = get_value('문항4(주의사항) [ATPNQESITM] ', '문항4(주의사항) [ATPNQESITM]', 'ATPNQESITM')
    atpnwarn = get_value('문항3(주의사항 경고) [ATPNWARNQESITM] ', '문항3(주의사항 경고) [ATPNWARNQESITM]', 'ATPNWARNQESITM')
    deposit = get_value('문항7(보관법) [DEPOSITMETHODQESITM] ', '문항7(보관법) [DEPOSITMETHODQESITM]', 'DEPOSITMETHODQESITM')
    opende = get_value('공개일자 [OPENDE] ', '공개일자 [OPENDE]', 'OPENDE')
    updatede = get_value('수정일자 [UPDATEDE] ', '수정일자 [UPDATEDE]', 'UPDATEDE')
    
    precautions = atpn
    if atpnwarn:
        precautions = f"{atpn}\n{atpnwarn}".strip() if atpn else atpnwarn
    
    prms_dt = ''
    if opende:
        prms_dt = opende.split(' ')[0].replace('-', '')
    
    last_update = ''
    if updatede:
        last_update = updatede.replace('-', '')
    
    return {
        'PRDLST_REPORT_NO': itemseq,
        'PRDLST_NM': itemname,
        'BSSH_NM': entpname,
        'LCNS_NO': '',
        'PRDT_SHAP_CD_NM': '',
        'SHAP': '',
        'DISPOS': '',
        'PRIMARY_FNCLTY': efcy,
        'NTK_MTHD': usemethod,
        'IFTKN_ATNT_MATR_CN': precautions,
        'CSTDY_MTHD': deposit,
        'POG_DAYCNT': '',
        'RAWMTRL_NM': '',
        'STDR_STND': '',
        'PRMS_DT': prms_dt,
        'CRET_DTM': opende,
        'LAST_UPDT_DTM': last_update
    }

def main():
    """메인 함수"""
    print("=" * 70)
    print("🔄 의약품 백업 파일 변환 스크립트")
    print("=" * 70)
    print()
    
    assets_dir = 'src/assets'
    backup_file = os.path.join(assets_dir, 'medicine_backup_20251207_101001.json')
    output_file = os.path.join(assets_dir, 'medicine.json')
    
    if not os.path.exists(backup_file):
        print(f"❌ 백업 파일을 찾을 수 없습니다: {backup_file}")
        return
    
    print(f"📂 백업 파일 로딩: {backup_file}")
    
    try:
        with open(backup_file, 'r', encoding='utf-8') as f:
            old_data = json.load(f)
        
        if not isinstance(old_data, list):
            print(f"❌ JSON 파일이 배열 형식이 아닙니다.")
            return
        
        print(f"✅ {len(old_data):,}개 항목 로드 완료")
        
        # 형식 변환
        print(f"🔄 데이터 형식 변환 중...")
        new_data = []
        for i, item in enumerate(old_data):
            converted = convert_medicine_format(item)
            # report_no가 필수이므로 빈 값은 스킵
            if converted['PRDLST_REPORT_NO']:
                new_data.append(converted)
            if (i + 1) % 10000 == 0:
                print(f"   진행률: {i + 1:,}/{len(old_data):,} ({((i+1)*100//len(old_data))}%)")
        
        print(f"✅ {len(new_data):,}개 항목 변환 완료")
        
        # 새 파일 저장
        print(f"💾 변환된 데이터 저장: {output_file}")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False, indent=2)
        
        print()
        print("=" * 70)
        print("✅ 변환 완료!")
        print("=" * 70)
        print(f"   - 입력: {backup_file}")
        print(f"   - 출력: {output_file}")
        print(f"   - 항목 수: {len(new_data):,}개")
        print()
        print("다음 단계:")
        print("1. medicine.json 파일이 올바른 의약품 데이터인지 확인")
        print("2. 데이터베이스 정리: TRUNCATE TABLE medicine_master;")
        print("3. 데이터 재삽입: python3 scripts/insert_master_data.py")
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 실패: {e}")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()

