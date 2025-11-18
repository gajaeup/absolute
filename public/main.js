// public/js/main.js
import { initMap, drawMarkers, highlightMarkers } from './map.js';
import { fetchStationsInMap, searchStations } from './api.js';
import {
  switchSearchMode,
  initSearchTabs,
  loadSidoData,
  initRegionSearch,
} from './search.js';

async function loadKakaoSDK() {
  let apiKey;
  const isLocal =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  // 환경에 따라 다른 키 사용 (원하면 둘 다 같은 키여도 됨)
  if (isLocal) {
    apiKey = '65e1c8f1ab7fa043334d2b12c4bde905';
  } else {
    const res = await fetch('/api/kakao');
    const data = await res.json();
    apiKey = data.key;
    console.log(' Vercel Key 사용중');
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${apiKey}&libraries=services,clusterer`;
    script.onload = () => {
      console.log('✅ Kakao SDK loaded');
      kakao.maps.load(() => {
        console.log('✅ kakao.maps.load() 완료');
        resolve();
      });
    };
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  console.log('✅ Frontend Initialized');
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
  const geoSources = {
    sido: '/public/ctprvn_wgs84.json',
    sig: '/public/sig_wgs84_simplified.json',
    emd: '/public/HangJeongDong_ver20250401_simplified.json',
  };
  const geoData = {};

  for (const [key, path] of Object.entries(geoSources)) {
    try {
      const res = await fetch(path);
      geoData[key] = await res.json();
      console.log(`✅ ${key} 레이어 로드 완료:`, geoData[key].features.length);
    } catch (err) {
      console.error(`❌ ${key} GeoJSON 로드 실패`, err);
    }
  }
  window.geoData = geoData;
  initRegionSearch(geoData, map);
  initSearchTabs();

  // 2️⃣ 지도 기본 표시 (현재 영역 내 주유소)
  try {
    const response = await fetchStationsInMap(map, 10000);
    if (!response || !response.items) {
      throw new Error('response.items가 비어있습니다');
    }

    const stations = response.items;
    drawMarkers(map, clusterer, stations);
  } catch (error) {
    console.error('❌ Error fetching stations:', error);
  }
  initSearch(map, clusterer);
});

export async function initSearch(map, clusterer) {
  const searchBtn = document.getElementById('search-button');
  const searchInput = document.getElementById('search-input');

  searchBtn.onclick = handleSearch;
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  async function handleSearch() {
    const keyword = searchInput.value.trim();
    const list = document.getElementById('suggestions');
    list.classList.remove('open');
    list.innerHTML = '';
    if (!keyword) return alert('검색어를 입력하세요.');

    try {
      // ✅ 1️⃣ Flask API 호출
      const results = await searchStations(keyword);
      const features = results.features || [];

      if (!features || features.length === 0) {
        alert('검색 결과가 없습니다.');
        list.classList.remove('open');
        list.innerHTML = '';
        return;
      }

      // ✅ 2️⃣ GeoJSON 구조를 평탄화해서 사용
      const stations = features.map((feature) => ({
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        name: feature.properties['상호'],
        address: feature.properties['주소'],
      }));

      const foundStation = stations.filter(
        (s) => s.name && s.name.toLowerCase().startsWith(keyword.toLowerCase())
      );
      if (foundStation.length === 0) {
        alert('검색 결과가 없습니다.');
        list.classList.remove('open');
        list.innerHTML = '';
        return;
      }
      list.innerHTML = '';
      foundStation.forEach((station) => {
        const li = document.createElement('li');
        li.textContent = `${station.name} (${station.address})`;
        li.classList.add('suggestion-item');
        li.addEventListener('click', () => {
          const pos = new kakao.maps.LatLng(station.lat, station.lng);
          map.setLevel(4);
          map.panTo(pos);

          list.innerHTML = '';
          list.classList.remove('open');
          document.getElementById('search-input').value = station.name;
        });
        list.appendChild(li);
      });
      list.classList.add('open');
    } catch (err) {
      console.error('❌ 검색 중 오류:', err);
      alert('검색 중 오류가 발생했습니다.');
    }
  }
}

(function () {
  // 버튼 & 요소
  const listBtn = document.getElementById('nav-list-btn');
  const guideBtn = document.getElementById('nav-guide-btn');
  const searchBtn = document.getElementById('nav-search-btn'); // 다른 아이콘 누르면 닫기용
  const panels = {
    list: document.getElementById('list-panel'),
    guide: document.getElementById('guide-panel'),
  };
  const closeBtns = {
    list: document.getElementById('list-panel-close'),
    guide: document.getElementById('guide-panel-close'),
  };
  const searchBox = document.querySelector('.search-container');

  // 유틸
  const isOpen = (p) => p && p.classList.contains('is-open');

  function anyOpen() {
    return Object.values(panels).some((p) => p && isOpen(p));
  }

  function pushSearch(on) {
    if (!searchBox) return;
    if (on) searchBox.classList.add('pushed-by-list');
    else searchBox.classList.remove('pushed-by-list');
  }

  function openPanel(panel) {
    if (!panel) return;
    closeAllPanels(); // ✅ 다른 패널은 자동으로 닫힘
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    pushSearch(true);
    syncActiveState(); // 🔹 버튼 active 상태 반영
  }

  function closePanel(panel) {
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    if (!anyOpen()) pushSearch(false); // 둘 다 닫히면 검색창 원위치
    syncActiveState(); // 🔹 버튼 active 상태 반영
  }

  function closeAllPanels() {
    Object.values(panels).forEach((p) => {
      if (p && isOpen(p)) {
        p.classList.remove('is-open');
        p.setAttribute('aria-hidden', 'true');
      }
    });
    pushSearch(false);
    syncActiveState(); // 🔹 둘 다 닫혔으니 active 제거
  }

  function syncActiveState() {
    if (listBtn) {
      if (isOpen(panels.list)) listBtn.classList.add('active');
      else listBtn.classList.remove('active');
    }
    if (guideBtn) {
      if (isOpen(panels.guide)) guideBtn.classList.add('active');
      else guideBtn.classList.remove('active');
    }
  }

  // 토글
  function toggle(panel) {
    if (!panel) return;
    if (isOpen(panel)) closePanel(panel);
    else openPanel(panel);
  }

  // 이벤트 바인딩
  if (listBtn) listBtn.addEventListener('click', () => toggle(panels.list));
  if (guideBtn) guideBtn.addEventListener('click', () => toggle(panels.guide));
  if (searchBtn) searchBtn.addEventListener('click', closeAllPanels); // 🔍 누르면 닫기

  if (closeBtns.list)
    closeBtns.list.addEventListener('click', () => closePanel(panels.list));
  if (closeBtns.guide)
    closeBtns.guide.addEventListener('click', () => closePanel(panels.guide));

  // ESC로 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllPanels();
  });

  //👇수정사항
  // 🔔 지도 카드에서 주유소를 클릭했을 때 목록 패널 열기
  window.addEventListener('stationSelected', (e) => {
    const station = e.detail;
    const panel = panels.list;
    if (!panel) return;

    const body = panel.querySelector('.side-panel__body');
    if (body) {
      body.innerHTML = `
      <article class="station-detail">
      <div class="station-detail__image">
        <img src="${station.imgUrl}"
           alt="${station.name}"
           onerror="this.src='https://absolute-s3-bucket.s3.ap-southeast-2.amazonaws.com/stations/default.jpg'">
      </div>

      <div class="station-detail__content">
        <!-- 기본 정보 -->
        <h2 class="station-detail__name">${station.name}</h2>
        <p class="station-detail__addr">${station.addr}</p>
        <p class="station-detail__status">${station.status}</p>

        <!-- 활용방안 소개 칸 (나중에 데이터 채워넣을 자리) -->
        <section class="station-detail__section">
          <h3 class="station-detail__section-title">추천 활용방안</h3>
          <p class="station-detail__section-body" id="station-recommendation">
            추후 분석 결과에 따른 추천 활용방안이 이 영역에 표시됩니다.
          </p>
        </section>

        <!-- 지표 그래프 칸 (나중에 차트/지표값 들어갈 자리) -->
        <section class="station-detail__section">
          <h3 class="station-detail__section-title">지표 요약</h3>
          <div class="station-detail__metrics" id="station-metrics">
            <!-- 나중에 그래프/지표 컴포넌트 렌더링 예정 -->
            <p class="station-detail__section-body is-muted">
              교통량, 인구, 상권 등 지표를 시각화한 그래프가 이 영역에 표시됩니다.
            </p>
          </div>
        </section>
      </div>
    </article>
    `;
    }

    // 📋 목록 패널 열고, 검색창 오른쪽으로 밀기 + 버튼 active 처리
    openPanel(panel);
  });
})();
