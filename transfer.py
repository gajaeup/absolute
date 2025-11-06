import json
from pyproj import Transformer

# --- 설정 (변환할 파일과 좌표계) ---

# 1. GeoJSON 파일 경로 설정
INPUT_FILE = 'sig_4326.geojson'  # 원본 UTM-K 파일 (예시)
OUTPUT_FILE = 'sig_wgs84.geojson' # 변환 후 WGS84 파일

# 2. 좌표계 설정
# UTM-K (EPSG:5179 또는 유사) 정의
UTMK = "epsg:5179"
# WGS84 경위도 (카카오맵 사용)
WGS84 = "epsg:4326"

# pyproj Transformer 객체 생성 (UTMK -> WGS84)
# 항상 (위도, 경도) 순서가 아닌 (경도, 위도) 순서로 변환하도록 설정합니다.
transformer = Transformer.from_crs(UTMK, WGS84, always_xy=True) 

# --- 변환 로직 함수 ---

def transform_coordinates(coordinates):
    """GeoJSON 좌표 구조의 깊이에 따라 재귀적으로 WGS84로 변환합니다."""
    if not isinstance(coordinates, list):
        return coordinates

    if coordinates and isinstance(coordinates[0], list):
        # 중첩된 배열인 경우 (MultiPolygon, Polygon 등)
        return [transform_coordinates(coord_list) for coord_list in coordinates]
    
    # 가장 낮은 깊이의 좌표 [x, y] 쌍인 경우
    if len(coordinates) == 2 and isinstance(coordinates[0], (int, float)):
        # pyproj는 (경도, 위도) 순서로 반환합니다.
        longi, lati = transformer.transform(coordinates[0], coordinates[1])
        return [longi, lati]
    
    return coordinates

# --- 메인 실행 ---

try:
    # 1. 파일 읽기
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        geojson = json.load(f)

    # 2. 모든 Feature의 좌표 변환
    for feature in geojson['features']:
        if feature['geometry'] and feature['geometry']['coordinates']:
            feature['geometry']['coordinates'] = transform_coordinates(feature['geometry']['coordinates'])

    # 3. 변환된 GeoJSON 데이터를 새로운 파일에 저장
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    print(f"✅ {INPUT_FILE} 파일이 {OUTPUT_FILE} (WGS84)로 성공적으로 변환되었습니다.")

except FileNotFoundError:
    print(f"❌ 오류: {INPUT_FILE} 파일을 찾을 수 없습니다. 경로를 확인해주세요.")
except Exception as e:
    print(f"❌ 파일 처리 중 오류가 발생했습니다: {e}")