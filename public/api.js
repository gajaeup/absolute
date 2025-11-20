// public/js/api.js
export const API_BASE = 'https://api.restation.site'; // 배포 시 변경

// 지도 범위 내 주유소 목록
export async function fetchStationsInMap(map, limit = 10000) {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest(); // 남서쪽 좌표
  const ne = bounds.getNorthEast(); // 북동쪽 좌표

  const lat1 = Math.min(sw.getLat(), ne.getLat());
  const lat2 = Math.max(sw.getLat(), ne.getLat());
  const lng1 = Math.min(sw.getLng(), ne.getLng());
  const lng2 = Math.max(sw.getLng(), ne.getLng());

  // FastAPI 요구 파라미터명에 맞춰 URL 구성
  const url = `${API_BASE}/api/stations/map?lat1=${lat1}&lng1=${lng1}&lat2=${lat2}&lng2=${lng2}&limit=${limit}`;
  console.log('📡 Fetching stations:', url);

  const res = await fetch(url);
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`❌ GET /api/stations/map failed (${res.status}): ${msg}`);
  }

  const data = await res.json();
  console.log('✅ API 응답:', data);
  return data;
}

// 지역별 주유소 목록
export async function fetchStationsByRegion(code) {
  const url = `${API_BASE}/api/stations/region/${encodeURIComponent(
    code
  )}?limit=5000`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error(`❌ region API error: ${res.status}`);
    throw new Error(`region API error: ${res.status}`);
  }

  const data = await res.json();
  return data;
}

// 키워드 검색
export async function searchStations(keyword) {
  const url = `${API_BASE}/api/stations/search?query=${encodeURIComponent(
    keyword
  )}`;
  console.log('🔍 검색 요청:', url);
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || data;
}

// 추천 결과
export async function fetchRecommendation(stationId) {
  const res = await fetch(`${API_BASE}/api/stations/${stationId}/recommend`);
  return res.ok ? res.json() : {};
}

// ML 추천
export async function fetchMLRecommendation(stationId) {
  const res = await fetch(
    `${API_BASE}/api/ml-recommend?station_id=${stationId}`
  );
  return res.ok ? res.json() : {};
}

//그래프
export async function fetchStationStats(stationId) {
  if (!stationId) return {};

  const res = await fetch(`${API_BASE}/stations/${stationId}/stats`);
  if (!res.ok) {
    console.error('stats API error', res.status);
    return {};
  }
  return res.json();
}
