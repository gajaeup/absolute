// public/js/main.js
import { initMap, drawMarkers, highlightMarkers } from "./map.js";
import { fetchStationsInMap, searchStations } from "./api.js";
import { switchSearchMode, initSearchTabs, loadSidoData } from "./search.js";


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
    initSearchTabs();

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
        const response = await fetchStationsInMap(map, 10000);
        if (!response || !response.items) {
            throw new Error("response.items가 비어있습니다");
        }

        const stations = response.items;
        drawMarkers(map, clusterer, stations);
    } catch (error) {
        console.error("❌ Error fetching stations:", error);
    }
    initSearch(map, clusterer);
});

    export async function initSearch(map, clusterer) {
        const searchBtn = document.getElementById("search-button");
      const searchInput = document.getElementById("search-input");
      
        searchBtn.onclick = handleSearch;
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") handleSearch();
        });

        async function handleSearch() {
          const keyword = searchInput.value.trim();
          const list = document.getElementById('suggestions');
          list.classList.remove('open');
          list.innerHTML = '';
          if (!keyword) return alert("검색어를 입력하세요.");

            try {
                // ✅ 1️⃣ Flask API 호출
                const results = await searchStations(keyword);
                const features = results.features || [];

                if (!features || features.length === 0) {
                  alert("검색 결과가 없습니다.");
                  list.classList.remove('open');
                  list.innerHTML = '';
                  return;
                }

                // ✅ 2️⃣ GeoJSON 구조를 평탄화해서 사용
                const stations = features.map((feature) => ({
                    lat: feature.geometry.coordinates[1],
                    lng: feature.geometry.coordinates[0],
                    name: feature.properties["상호"],
                    address: feature.properties["주소"],
                }));

                const foundStation = stations.filter(
                  (s) =>
                    s.name &&
                    s.name.toLowerCase().startsWith(keyword.toLowerCase())
                );
                if (foundStation.length === 0) {
                  alert("검색 결과가 없습니다.");
                  list.classList.remove('open');
                  list.innerHTML = '';
                  return;
              }
                  list.innerHTML = "";
                  foundStation.forEach((station) => {
                      const li = document.createElement("li");
                      li.textContent = `${station.name} (${station.address})`;
                      li.classList.add('suggestion-item');
                      li.addEventListener("click", () => {
                          const pos = new kakao.maps.LatLng(station.lat, station.lng);
                          map.setLevel(4);
                          map.panTo(pos);

                          list.innerHTML = "";
                          list.classList.remove("open");
                          document.getElementById("search-input").value = station.name;
                      });
                      list.appendChild(li);
                  });
                  list.classList.add("open");   
            } catch (err) {
                console.error("❌ 검색 중 오류:", err);
                alert("검색 중 오류가 발생했습니다.");
            }
        }
    }


