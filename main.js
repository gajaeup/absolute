// public/js/main.js
import { initMap, drawMarkers } from "./map.js";
import { fetchStationsInMap, searchStations } from "./api.js";


async function loadKakaoSDK() {
  let apiKey;
  const isLocal =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

  // 환경에 따라 다른 키 사용 (원하면 둘 다 같은 키여도 됨)
  if (isLocal) {
    apiKey = "65e1c8f1ab7fa043334d2b12c4bde905";
  } else {
    const res = await fetch('/api/kakao');
    const data = await res.json();
    apiKey = data.key;
    console.log(' Vercel Key 사용중');

  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${apiKey}&libraries=services,clusterer`;
    script.onload = () => {
      console.log("✅ Kakao SDK loaded");
      kakao.maps.load(() => {
        console.log("✅ kakao.maps.load() 완료");
        resolve();
      });
    };
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}


window.addEventListener("DOMContentLoaded", async () => {
    console.log("✅ Frontend Initialized");
    await loadKakaoSDK();


  // 1️⃣ 지도 초기화
  const map = initMap();
  const clusterer = new kakao.maps.MarkerClusterer({
    map,
    averageCenter: true,
    minLevel: 10,
    minClusterSize: 10,
    disableClickZoom: false,
  });

  // 2️⃣ 지도 기본 표시 (현재 영역 내 주유소)
  try {
      const response = await fetchStationsInMap(map, 1000);
      if (!response || !response.items) {
          throw new Error("response.items가 비어있습니다");
      }

      const stations = response.items;
      drawMarkers(map, clusterer, stations);
  } catch (error) {
    console.error("❌ Error fetching stations:", error);
  }

  // 3️⃣ 검색 버튼 이벤트
  const searchBtn = document.getElementById("search-button");
  const searchInput = document.getElementById("search-input");

  searchBtn.onclick = async () => {
    const keyword = searchInput.value.trim();
    if (!keyword) return;
    const results = await searchStations(keyword);
    drawMarkers(map, clusterer, results);
  };

  searchInput.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
      const keyword = searchInput.value.trim();
      if (!keyword) return;
      const results = await searchStations(keyword);
      drawMarkers(map, clusterer, results);
    }
  });
});
