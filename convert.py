import geopandas as gpd

# ✅ 1) SHP 파일 경로
shp_file = r"sig.shp"

# ✅ 2) Shapefile 읽기
gdf = gpd.read_file(shp_file)

print("원본 좌표계:", gdf.crs)

# ✅ 3) 좌표계를 WGS84(EPSG:4326)로 변환 (웹지도 표준)
if gdf.crs is None:
    print("⚠ 좌표계가 명시되지 않음! PRJ 파일 확인 또는 EPSG:5179 가정")
    gdf = gdf.set_crs(epsg=4326)  # 한국 국토정보 시스템 좌표계

# ✅ 4) GeoJSON으로 저장
output = r"sig.geojson"
gdf.to_file(output, driver="GeoJSON")

print("✅ 변환 완료:", output)
