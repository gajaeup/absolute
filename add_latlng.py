import pandas as pd
import requests
from geopy.geocoders import Nominatim
from tqdm import tqdm
import time



# CSV 파일 읽기
file_name = "산업통상자원부_전국_주유소_등록현황_20241231.csv"
df = pd.read_csv(file_name, encoding="utf-8")

status_col = df.columns[3]
address_col = df.columns[5]
filtered_df = df[df[status_col].astype(str).str.contains("휴업|폐업", na=False)].copy()
print(f"총 {len(filtered_df)}개의 휴업·폐업 주유소 주소를 변환합니다.")
# 지오코더 설정
geolocator = Nominatim(user_agent="station_locator")

# 결과를 저장할 리스트
latitudes = []
longitudes = []

print("주소 → 좌표 변환 중입니다. (약간의 시간이 걸립니다...)")

def get_coords_kakao(address):
    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_API_KEY}"}
    params = {"query": address}
    try:
        response = requests.get(url, headers=headers, params=params, timeout=3)
        if response.status_code == 200:
            result = response.json()
            if result['documents']:
                y = result['documents'][0]['y']  # 위도
                x = result['documents'][0]['x']  # 경도
                return float(y), float(x)
    except Exception as e:
        pass
    return None, None

# 변환 실행
for addr in tqdm(filtered_df[address_col]):
    if pd.isna(addr) or str(addr).strip() == "":
        latitudes.append(None)
        longitudes.append(None)
        continue

    lat, lng = get_coords_kakao(addr)
    latitudes.append(lat)
    longitudes.append(lng)
    time.sleep(0.2)  # 요청 간 간격 (너무 빠르면 429 에러 가능)

# 좌표 추가
filtered_df["위도"] = latitudes
filtered_df["경도"] = longitudes

# 결과 저장
output_name = "산업통상자원부_폐휴업주유소_좌표추가_kakao.csv"
filtered_df.to_csv(output_name, encoding="utf-8-sig", index=False)

print(f"\n✅ 좌표 변환 완료! → {output_name}")