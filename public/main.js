// public/js/main.js
import {
  initMap,
  drawMarkers,
  highlightMarker,
  resetHighlight,
  setMapInstance,
} from './map.js';
import {
  fetchStationsInMap,
  searchStations,
  fetchRecommendation,
  fetchStats,
  fetchVehicle,   // ⭐ 롤백 시 제거
  fetchEv,   // ⭐ 롤백 시 제거
  fetchAdminStats,   // ⭐ 롤백 시 제거
  fetchLand,   // ⭐ 롤백 시 제거
} from './api.js';
import {
  switchSearchMode,
  initSearchTabs,
  loadSidoData,
  initRegionSearch,
} from './search.js';

import {   // ⭐ 롤백 시 통째로 제거
  drawBufferCircle, 
  clearBufferCircle 
} from './map.js';

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
  await loadKakaoSDK();
  const map = initMap();
  setMapInstance(map);
  initSearchTabs();
  window.mapRef = map;   // ⭐ 롤백 시 제거

  // 1️⃣ 지도 초기화
  const clusterer = new kakao.maps.MarkerClusterer({
    map,
    averageCenter: true,
    minLevel: 10,
    minClusterSize: 10,
    disableClickZoom: false,
  });
  window.clustererRef = clusterer;
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

  kakao.maps.event.addListener(map, 'click', () => {
    resetHighlight(clusterer);
    window.dispatchEvent(new CustomEvent('mapClicked'));
  });

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

          const allMarkers = clusterer.getMarkers();
          const target = allMarkers.find((m) => {
            const p = m.getPosition();
            return (
              Math.abs(p.getLat() - station.lat) < 0.00001 &&
              Math.abs(p.getLng() - station.lng) < 0.00001
            );
          });

          // 3️⃣ 찾았으면 마커 확대
          if (target) {
            highlightMarker(clusterer, target);
          }

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
  /*kakao.maps.event.addListener(map, 'click', () => {
      resetHighlight(clusterer);
  });*/

}

(function () {
  // 버튼 & 요소
  const listBtn = document.getElementById('nav-list-btn');
  const featureBtn = document.getElementById('nav-feature-btn');   // ⭐ 롤백 시 제거
  const parcelBtn = document.getElementById('nav-parcel-btn');  // ⭐ 롤백 시 제거
  const guideBtn = document.getElementById('nav-guide-btn');
  const searchBtn = document.getElementById('nav-search-btn'); // 다른 아이콘 누르면 닫기용
  const panels = {
    list: document.getElementById('list-panel'),
    feature: document.getElementById('feature-panel'),  // ⭐ 롤백 시 제거
    parcel: document.getElementById('parcel-panel'),  // ⭐ 롤백 시 제거
    guide: document.getElementById('guide-panel'),
  };
  const closeBtns = {
    list: document.getElementById('list-panel-close'),
    feature: document.getElementById('feature-panel-close'),  // ⭐ 롤백 시 제거
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

  function closeRoadview() {
    const container = document.getElementById('floating-roadview');
    if (container) {
      container.classList.add('hidden');
      container.innerHTML = ''; // 메모리 정리를 위해 내용 비우기
    }
  }
  /*
  function openPanel(panel) {
    if (!panel) return;
    closeAllPanels(); // ✅ 다른 패널은 자동으로 닫힘
  */
  function openPanel(panel, keepRoadview = false) {
    if (!panel) return;
    closeAllPanels(!keepRoadview);   // keepRoadview=true면 닫지 않음
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    pushSearch(true);
    syncActiveState(); // 🔹 버튼 active 상태 반영
  
    // ⭐ 롤백 시 제거 - 대시보드 패널 열릴 때는 주변 정보 모두 제거
    if (panel === panels.list) {
      vehicleMarkers = clearMarkers(vehicleMarkers);
      evMarkers = clearMarkers(evMarkers);
      clearBufferCircle();
    }
  }

  function closePanel(panel) {
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    /*
    if (panel === panels.list) {
      closeRoadview();
    }
      */
    // ⭐ 롤백 시 제거 - 주변 정보 패널 닫힐 때 지도 정리
    if (panel === panels.feature) {
      vehicleMarkers = clearMarkers(vehicleMarkers);
      evMarkers = clearMarkers(evMarkers);
      clearBufferCircle();
    }
    
    if (!anyOpen()) pushSearch(false); // 둘 다 닫히면 검색창 원위치
    syncActiveState(); // 🔹 버튼 active 상태 반영
  }

  /* function closeAllPanels() { */
  function closeAllPanels(shouldCloseRoadview = true) {
    Object.values(panels).forEach((p) => {
      if (p && isOpen(p)) {
        p.classList.remove('is-open');
        p.setAttribute('aria-hidden', 'true');
      }
    });
    /* closeRoadview(); */
    if (shouldCloseRoadview) {
      closeRoadview();
    }
    pushSearch(false);
    syncActiveState(); // 🔹 둘 다 닫혔으니 active 제거
  }

  function syncActiveState() {
    if (listBtn) {
      if (isOpen(panels.list)) listBtn.classList.add('active');
      else listBtn.classList.remove('active');
    }
    if (featureBtn) {   // ⭐ 롤백 시 제거
      if (isOpen(panels.feature)) featureBtn.classList.add('active');
      else featureBtn.classList.remove('active');
    }
    if (parcelBtn) {   // ⭐ 롤백 시 제거
      if (isOpen(panels.parcel)) parcelBtn.classList.add('active');
      else parcelBtn.classList.remove('active');
    }
    if (guideBtn) {
      if (isOpen(panels.guide)) guideBtn.classList.add('active');
      else guideBtn.classList.remove('active');
    }
  }

  /*
  // 토글
  function toggle(panel) {
    if (!panel) return;
    if (isOpen(panel)) closePanel(panel);
    else openPanel(panel);
  }
  */
  function toggle(panel, keepRoadview = false) {
    if (!panel) return;
    if (isOpen(panel)) closePanel(panel);
    else openPanel(panel, keepRoadview);
  }

  // 이벤트 바인딩
  /*
  if (featureBtn) featureBtn.addEventListener('click', () => toggle(panels.feature));
  */
  // ⭐ 롤백 시 제거
  if (featureBtn) featureBtn.addEventListener('click', () => toggle(panels.feature, true))
  featureBtn?.addEventListener('click', () => {
      // 패널이 열리지 않은 상태에서 클릭하면 toggle → openPanel → is-open 상태됨
      setTimeout(() => {
      if (!panels.feature.classList.contains('is-open')) return;
      if (!window.selectedStation) return;

      const { lat, lng } = window.selectedStation;

      clearBufferCircle();
      drawBufferCircle(lat, lng, 500);
      
      // 추가: 화면 이동 + 확대
    const offset = 0.0025; // 필요하면 0.002 ~ 0.004 사이로 조절
    const pos = new kakao.maps.LatLng(lat, lng - offset);
      window.mapRef.setLevel(4);   // 원하는 확대 레벨 (3~5가 적당)
      window.mapRef.panTo(pos);    // 지도를 해당 주유소로 이동
    }, 50);
  });

  // ⭐ 롤백 시 제거
  if (parcelBtn) parcelBtn.addEventListener('click', () => toggle(panels.parcel, true));
  parcelBtn?.addEventListener("click", async () => {
    if (!window.selectedStation) {
      const body = panels.parcel.querySelector(".side-panel__body");
      body.innerHTML = `<p style="color:#666;">⚠ 주유소를 먼저 선택하세요.</p>`;
      return;
    }

    const st = window.selectedStation;
    const stationId =
      `${Math.round(st.lat * 1_000_000)}_${Math.round(st.lng * 1_000_000)}`;

    const data = await fetchLand(stationId);
    const body = panels.parcel.querySelector(".side-panel__body");

    if (!data) {
      body.innerHTML = `<p style="color:#666;">⚠ 필지 정보를 불러올 수 없습니다.</p>`;
      return;
    }

    body.innerHTML = renderLandInfo(data);
    drawLandCharts(data);
  });

  /*
  if (listBtn) listBtn.addEventListener('click', () => toggle(panels.list));
  */
  if (listBtn) listBtn.addEventListener('click', () => toggle(panels.list, true));
  if (guideBtn) guideBtn.addEventListener('click', () => toggle(panels.guide));
  if (searchBtn) searchBtn.addEventListener('click', closeAllPanels); // 🔍 누르면 닫기

  if (closeBtns.list)
    closeBtns.list.addEventListener('click', () => closePanel(panels.list));
  if (closeBtns.feature)   // ⭐ 롤백 시 제거
    closeBtns.feature.addEventListener('click', () => closePanel(panels.feature));
  if (closeBtns.guide)
    closeBtns.guide.addEventListener('click', () => closePanel(panels.guide));

  // ESC로 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllPanels();
  });
  window.addEventListener('mapClicked', closeAllPanels);

  //👇수정사항
  // 🔔 지도 카드에서 주유소를 클릭했을 때 목록 패널 열기
  window.addEventListener('stationSelected', async (e) => {

    // ⭐ 롤백 시 제거 - 다른 주유소 클릭하면 이전 주변정보 즉시 제거
    vehicleMarkers = clearMarkers(vehicleMarkers);
    evMarkers = clearMarkers(evMarkers);
    clearBufferCircle();

    // ⭐ 롤백 시 제거 - 버튼 상태 리셋 추가
    document.getElementById("btn-vehicle")?.classList.remove("active");
    document.getElementById("btn-ev")?.classList.remove("active");

    // ⭐ 롤백 시 제거 - 버튼 내부 상태도 반드시 초기화
    vehicleVisible = false;
    evVisible = false;
    
    const station = e.detail;
    window.selectedStation = station;

    const clusterer = window.clustererRef;
    if (clusterer) {
      const allMarkers = clusterer.getMarkers();
      const target = allMarkers.find((m) => {
        const p = m.getPosition();
        return (
          Math.abs(p.getLat() - station.lat) < 0.000001 &&
          Math.abs(p.getLng() - station.lng) < 0.000001
        );
      });
      if (target) {
        highlightMarker(clusterer, target);
      }
    }
    const panel = panels.list;
    if (!panel) return;

    const stationId = `${Math.round(station.lat * 1_000_000)}_${Math.round(
      station.lng * 1_000_000
    )}`;
    console.log('📌 추천 요청 ID:', stationId);

    // 2) 추천 API 호출
    const recData = await fetchRecommendation(stationId);
    console.log('📌 추천 결과:', recData);

    // 3) 통계 API 호출
    const stats = await fetchStats(stationId);
    console.log('📊 통계 결과:', stats);

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
        <p class="station-detail__name">주유소명 : ${station.name}</p>
        <p class="station-detail__addr">주소 : ${station.addr}</p>
        <p class="station-detail__status">상태 : ${station.status} (${station.year} ~ )</p>\
        <!-- 지표 그래프 칸 (나중에 차트/지표값 들어갈 자리) -->
        <section class="station-detail__section">
          <h3 class="station-detail__section-title">지표 요약</h3>
          ${renderMetricsText(stats)}
          <div class="station-detail__metrics" id="station-metrics">
            <p class="station-detail__section-body is-muted" id="metrics-loading-text">
              지표를 불러오는 중입니다...
            </p>
              <canvas id="metrics-chart" style="margin-top: 6px;"></canvas>
            <div class="metrics-extra-charts">
              <canvas id="metrics-radar"></canvas>
            </div>
            <p class="metric-description" style="
              font-size: 11px;
              color: #666;
              margin-top: -2px;
              line-height: 1.0;
            ">
              ※ 모든 지표는 해당 지점이 속한 <strong>권역 평균(17개 시·도)</strong>을 기준(0%)으로 한 
              <strong>상대적 증감률(%)</strong>입니다.
              </p>
          </div>
        </section>
        <!-- 활용방안 소개 칸 -->
        <section class="station-detail__section">
          <h3 class="station-detail__section-title">추천 활용방안</h3>
          <p class="station-detail__section-body" id="station-recommendation">
            ${
              recData
                ? `
                ① ${recData.recommend1}<br>
                ② ${recData.recommend2}<br>
                ③ ${recData.recommend3}`
                : '추천 데이터가 없습니다.'
            }
          </p>
        </section>
                <div style="margin-top: 15px; text-align: center;">
             <a href="https://api.restation.site/api/stations/${stationId}/report" 
                target="_blank" 
                class="btn-view-report">
                📄 상세 분석 보고서 보기
             </a>
        </div>
      </div>
    </article>
    `;
    }

    // 통계 차트 렌더링
    drawStatsChart(stats);

    // 📋 목록 패널 열고, 검색창 오른쪽으로 밀기 + 버튼 active 처리
    openPanel(panel);
    showRoadview(station.lat, station.lng);
    
    // ⭐ 롤백 시 제거 - 주변정보 패널이 열려 있으면 500m 버퍼 다시 그림
    if (panels.feature.classList.contains('is-open')) {
      clearBufferCircle();
      drawBufferCircle(station.lat, station.lng, 500);
    }
  });

  function showRoadview(lat, lng) {
    const container = document.getElementById('floating-roadview');
    container.classList.remove('hidden');
    container.innerHTML = '';

    const pos = new kakao.maps.LatLng(lat, lng);
    const rv = new kakao.maps.Roadview(container);
    const rvc = new kakao.maps.RoadviewClient();

    rvc.getNearestPanoId(pos, 50, (panoId) => {
      if (panoId) rv.setPanoId(panoId, pos);
      else
        container.innerHTML =
          "<p style='padding:25px;text-align:center'>로드뷰 없음</p>";
    });
  }
})();

// 🔹 지표 텍스트 렌더링
function renderMetricsText(stats) {
  if (!stats || !stats.metrics) return '';

  const labelMap = {
    traffic: '일교통량(AADT)',
    tourism: '관광지수(행정동)',
    population: '인구수(행정동)',
    commercial_density: '상권지수',
    parcel_300m: '반경 300m 필지수',
    parcel_500m: '반경 500m 필지수',
  };

  const m = stats.metrics;

  const rows = Object.keys(m)
    .map((key) => {
      const name = labelMap[key] || key;
      const rawVal = m[key];
      let valueStr;

      if (typeof rawVal === 'number') {
        if (Math.abs(rawVal) < 1) {
          valueStr = rawVal.toFixed(3);
        } else if (Math.abs(rawVal) < 1000) {
          valueStr = rawVal.toLocaleString();
        } else {
          valueStr = Math.round(rawVal).toLocaleString();
        }
      } else {
        valueStr = rawVal;
      }

      return `
        <div class="metric-row" style="
          display:flex;
          justify-content:space-between;
          padding:4px 8px;
          margin-bottom:4px;
          background:#f8f9fa;
          border-radius:6px;
          border:1px solid #ececec;
          font-size:13px;
        ">
          <span class="metric-label" style="font-weight:600;color:#333;">
            ${name}
          </span>
          <span class="metric-value" style="color:#555;">
            ${valueStr}
          </span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="metrics-text-container" style="
      margin-bottom:10px;
      display:block;
    ">
      ${rows}
    </div>
  `;
}

// 통계 차트 함수 (relative 기반, 단위 %)
// 통계 차트 함수 (relative 기반, 단위 % + radar + scatter)
function drawStatsChart(stats) {
  if (!stats || !stats.relative) return;

  const barCtx = document.getElementById('metrics-chart');
  const radarCtx = document.getElementById('metrics-radar');
  const scatterCtx = document.getElementById('parcel-scatter');

  const loadingText = document.getElementById('metrics-loading-text');
  if (loadingText) loadingText.remove();

  if (!barCtx && !radarCtx && !scatterCtx) return;
  if (typeof Chart === 'undefined') return;

  const labelMap = {
    traffic: '일교통량(AADT)',
    tourism: '관광지수(행정동)',
    population: '인구수(행정동)',
    commercial_density: '상권지수',
    parcel_300m: '반경 300m 필지수',
    parcel_500m: '반경 500m 필지수',
  };

  const keys = Object.keys(stats.relative);
  const labels = keys.map((k) => labelMap[k] || k);
  const relValues = keys.map((k) => stats.relative[k]);

  // 👉 Radar용 값: relative 그대로 사용 (0% 기준)
  const radarLabels = labels;
  const radarValues = relValues;

  // 👉 Scatter용 값: parcel_300m vs parcel_500m
  const m = stats.metrics || {};
  const p300 = m.parcel_300m ?? null;
  const p500 = m.parcel_500m ?? null;

  // 🔹 1) Bar Chart (relative)
  if (barCtx) {
    if (window.statsBarChartInstance) {
      window.statsBarChartInstance.destroy();
    }
    window.statsBarChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '지역 평균 대비 상대값(%)',
            data: relValues,
          },
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw.toFixed(1)} %`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: '% (권역 평균 대비 증감률)',
            },
          },
        },
      },
    });
  }

  // 🔹 2) Radar Chart
  if (radarCtx) {
    if (window.statsRadarChartInstance) {
      window.statsRadarChartInstance.destroy();
    }
    window.statsRadarChartInstance = new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: radarLabels,
        datasets: [
          {
            label: '지표 프로필',
            data: radarValues,
          },
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          r: {
            beginAtZero: true,
            angleLines: { display: true },
            suggestedMin: Math.min(...radarValues, 0),
            suggestedMax: Math.max(...radarValues, 0),
          },
        },
      },
    });
  }
}

let vehicleMarkers = [];
let evMarkers = [];

// 🔥 Heatmap(유사)용 원형 오버레이
let vehicleHeatOverlays = [];
let evHeatOverlays = [];

// 공통 마커/오버레이 제거 유틸
function clearMarkers(arr) {
  arr.forEach((m) => m.setMap(null));
  return [];
}
function clearOverlays(arr) {
  arr.forEach((o) => o.setMap(null));
  return [];
}

// =============================
// 필지 정보 렌더링 + 차트
// =============================
function renderLandInfo(data) {
  const land = data.land_price;
  const use = data.land_use;

  let mainUse = "-";
  if (use?.summary) {
    const firstCat = Object.values(use.summary)[0];
    if (firstCat && firstCat[0]) {
      mainUse = firstCat[0].name || "-";
    }
  }

  // 1) 개별공시지가 섹션 (그래프 영역 포함)
  const priceSection = `
    <section class="land-section">
      <h2 class="land-title">개별공시지가</h2>
      <table class="plain-table-2col">
        <tr><th>공시일자</th><th>공시가격</th></tr>
        <tr>
          <td>${land?.announce_date || "-"}</td>
          <td>${land?.price_str || "-"}</td>
        </tr>
      </table>

      <!-- 📊 공시지가 차트들 -->
      <div class="land-chart-grid">
        <div class="land-chart-item">
          <h3 class="land-chart-subtitle">공시지가</h3>
          <canvas id="land-price-bar"></canvas>
        </div>
        <div class="land-chart-item">
          <h3 class="land-chart-subtitle">권역 평균과 비교</h3>
          <canvas id="land-price-compare"></canvas>
          <p id="land-price-compare-msg" class="land-chart-msg"></p>
        </div>
      </div>
    </section>
  `;

  // 2) 필지 기본 정보
  const landDetailsSection = `
    <section class="land-section">
      <h2 class="land-title">필지 기본 정보</h2>
      <table class="plain-table-4col">
        <tr>
          <th>PNU</th>
          <th>주소</th>
          <th>대표 용도지역</th>
          <th>분류</th>
        </tr>
        <tr>
          <td>${data.pnu || "-"}</td>
          <td>${data.clean_address || data.address || "-"}</td>
          <td>${mainUse}</td>
          <td>${land?.type || "-"}</td>
        </tr>
      </table>
      <div class="land-usage-text-card">
        <p><strong>이 필지는</strong> <span class="land-usage-highlight">${mainUse}</span>에 속하는 필지입니다.</p>
      </div>
    </section>
  `;

  // 3) 토지이용계획 + 도넛 / 바 차트 / 워드클라우드
  let useList = [];
  if (use?.summary) {
    for (const arr of Object.values(use.summary)) {
      arr.forEach((u) => {
        useList.push(`${u.name}${u.data_date ? " (" + u.data_date + ")" : ""}`);
      });
    }
  }

  const landUseBox = `
    <section class="land-section">
      <h2 class="land-title">토지이용계획</h2>
      <div class="plain-box" id="land-use-text">
        ${useList.length ? useList.join(", ") : "-"}
      </div>

      <div class="land-chart-grid">
        <div class="land-chart-item">
          <h3 class="land-chart-subtitle">용도지역 구성</h3>
          <canvas id="land-usage-donut"></canvas>
        </div>
      </div>

      <div class="land-wordcloud" id="land-wordcloud"></div>
    </section>
  `;

  const footer = `
    <p class="land-notice">
      ※ 본 서비스에서 제공하는 부동산행정자료는 단순 열람조회용이며 법적 효력은 없습니다.
    </p>
  `;

  return `
    ${priceSection}
    ${landDetailsSection}
    ${landUseBox}
    ${footer}
  `;
}

// 숫자형 가격 추출 유틸
function extractPriceNumeric(land) {
  if (!land) return null;
  if (typeof land.price === "number") return land.price;
  if (land.price && !Number.isNaN(Number(land.price))) return Number(land.price);
  if (land.price_str) {
    const n = Number(String(land.price_str).replace(/[^\d]/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

// 필지 차트 생성
function drawLandCharts(data) {
  const land = data.land_price || {};
  const use = data.land_use || {};
  const price = extractPriceNumeric(land);

  // 1) 공시지가 바 차트
  const priceCtx = document.getElementById("land-price-bar");
  if (priceCtx && typeof Chart !== "undefined" && price != null) {
    if (window.landPriceChart) window.landPriceChart.destroy();
    window.landPriceChart = new Chart(priceCtx, {
      type: "bar",
      data: {
        labels: ["이 필지"],
        datasets: [
          {
            label: "공시지가",
            data: [price],
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                ctx.raw ? ctx.raw.toLocaleString() + " 원/㎡" : "-",
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  // 2) 공시지가 vs 지역 평균 비교 차트
  const compareCtx = document.getElementById("land-price-compare");
  const compareMsg = document.getElementById("land-price-compare-msg");
  let regionAvg =
    land.region_avg_price ||
    land.region_avg ||
    land.avg_price ||
    null;
  if (typeof regionAvg === "string") {
    const n = Number(regionAvg.replace(/[^\d]/g, ""));
    if (!Number.isNaN(n)) regionAvg = n;
  }

  if (compareCtx && typeof Chart !== "undefined" && price != null) {
    if (window.landPriceCompareChart) window.landPriceCompareChart.destroy();

    if (regionAvg != null) {
      if (compareMsg) compareMsg.textContent = "";
      window.landPriceCompareChart = new Chart(compareCtx, {
        type: "bar",
        data: {
          labels: ["이 필지", "행정동 평균"],
          datasets: [
            {
              label: "공시지가 비교",
              data: [price, regionAvg],
              borderWidth: 1.5,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  ctx.raw ? ctx.raw.toLocaleString() + " 원/㎡" : "-",
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      });
    } else {
      if (compareMsg) {
        compareMsg.textContent = "※ 지역 평균 공시지가 정보가 없어 비교 차트는 단일 값만 표시됩니다.";
      }
    }
  }

  // 3) 용도지역 도넛 차트
  const usageDonutCtx = document.getElementById("land-usage-donut");
  if (usageDonutCtx && typeof Chart !== "undefined" && use.summary) {

    // '용도지역' 또는 가장 유사한 key 자동 탐색
    let usageRegion =
      use.summary["용도지역"] ||
      use.summary["지역지구"] ||
      use.summary["도시지역"] ||
      null;

    // 용도지역이 없다면 전체 summary 중 name 속성 가진 항목들을 모아서 대체
    if (!usageRegion) {
      const all = [];
      Object.values(use.summary).forEach(arr => {
        arr.forEach(u => {
          if (u.name) all.push(u);
        });
      });
      usageRegion = all;
    }

    const nameCount = {};
    usageRegion.forEach((u) => {
      const key = u.name || "기타";
      nameCount[key] = (nameCount[key] || 0) + 1;
    });

    const labels = Object.keys(nameCount);
    const values = Object.values(nameCount);

    if (window.landUsageDonutChart) window.landUsageDonutChart.destroy();
    if (labels.length > 0) {
      window.landUsageDonutChart = new Chart(usageDonutCtx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
          {
            data: values,
            backgroundColor: [
              '#2563EB',   // 공공 파랑
              '#10B981',   // 공공 그린
              '#6B7280',   // 중성 회색
              '#9CA3AF',   // 연회색
            ],
          },
          ]
        },
        options: {
          responsive: true,
            plugins: {
            legend: { position: "bottom" },
          },
        },
      });
    }
  }

  // 4) 토지이용 Word cloud (간단 태그 클라우드)
  const wcEl = document.getElementById("land-wordcloud");
  if (wcEl && use.summary) {
    wcEl.innerHTML = "";

    const freq = {};
    Object.values(use.summary).forEach((arr) => {
      arr.forEach((u) => {
        const key = u.name || "기타";
        freq[key] = (freq[key] || 0) + 1;
      });
    });

    const entries = Object.entries(freq);
    if (entries.length === 0) {
      wcEl.textContent = "표시할 토지이용 항목이 없습니다.";
      return;
    }

    const maxVal = Math.max(...entries.map(([, v]) => v));
    const minVal = Math.min(...entries.map(([, v]) => v));

    entries.forEach(([name, count]) => {
      const span = document.createElement("span");
      const t =
        maxVal === minVal
          ? 0.5
          : (count - minVal) / (maxVal - minVal); // 0~1

      const fontSize = 10 + t * 18; // 12~30px
      span.textContent = name;
      span.style.fontSize = fontSize + "px";
      span.style.margin = "4px 8px";
      span.style.display = "inline-block";
      span.style.opacity = 0.7 + t * 0.3;
      wcEl.appendChild(span);
    });
  }
}

// =============================
// 행정동 정보 버튼 (KPI + Radar + Donut)
// =============================
document.getElementById("btn-admin-info")?.addEventListener("click", async () => {
  if (!window.selectedStation) {
    return alert("주유소를 먼저 선택하세요.");
  }

  const station = window.selectedStation;
  const stationId =
    `${Math.round(station.lat * 1_000_000)}_${Math.round(station.lng * 1_000_000)}`;

  const data = await fetchAdminStats(stationId);
  if (!data) return alert("행정동 정보를 불러올 수 없습니다.");

  const box = document.getElementById("dashboard-detail");
  if (!box) return;

  const metrics = {
    population: data.population ?? 0,
    traffic: data.traffic ?? 0,
    commercial_density: data.commercial_density ?? 0,
    tourism: data.tourism ?? 0,
  };

  box.innerHTML = `
    <!-- KPI 카드 -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">인구</div>
        <div class="kpi-value">${metrics.population?.toLocaleString?.() ?? "-"}</div>
        <div class="kpi-sublabel">${data.region || "행정동"}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">교통량</div>
        <div class="kpi-value">${metrics.traffic?.toLocaleString?.() ?? "-"}</div>
        <div class="kpi-sublabel">일평균 통행량(AADT)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">상권 밀집도</div>
        <div class="kpi-value">${metrics.commercial_density ?? "-"}</div>
        <div class="kpi-sublabel">상대 지표</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">관광지수</div>
        <div class="kpi-value">${metrics.tourism ?? "-"}</div>
        <div class="kpi-sublabel">행정동 단위</div>
      </div>
    </div>

    <!-- 레이더 & 도넛 -->
    <div class="admin-chart-grid">
      <div class="admin-chart-item">
        <h3 class="admin-chart-title">행정동 프로필</h3>
        <canvas id="admin-radar"></canvas>
      </div>
      <div class="admin-chart-item">
        <h3 class="admin-chart-title">지표 비중</h3>
        <canvas id="admin-donut"></canvas>
      </div>
    </div>
  `;
  box.style.display = "block";

  drawAdminCharts(metrics, data.region || "행정동");
});

function drawAdminCharts(metrics, regionLabel) {
  const radarCtx = document.getElementById("admin-radar");
  const donutCtx = document.getElementById("admin-donut");
  if (typeof Chart === "undefined") return;

  const labels = ["인구", "교통량", "상권 밀집도", "관광지수"];
  const values = [
    metrics.population || 0,
    metrics.traffic || 0,
    metrics.commercial_density || 0,
    metrics.tourism || 0,
  ];

  // 값 스케일이 너무 크니 정규화(0~1)
  const maxVal = Math.max(...values.map((v) => (v || 0))) || 1;
  const normValues = values.map((v) => (v || 0) / maxVal);

  // Radar
  if (radarCtx) {
    if (window.adminRadarChart) window.adminRadarChart.destroy();
    window.adminRadarChart = new Chart(radarCtx, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: regionLabel,
            data: normValues,
          },
        ],
      },
      options: {
        scales: {
          r: {
            beginAtZero: true,
            max: 1,
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  // Donut
  if (donutCtx) {
    if (window.adminDonutChart) window.adminDonutChart.destroy();
    window.adminDonutChart = new Chart(donutCtx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values.map((v) => (v || 0) <= 0 ? 0.1 : v),
          },
        ],
      },
      options: {
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });
  }
}

// =============================
// 차량 기반시설 버튼 (Heatmap + Donut)
// =============================
let vehicleVisible = false;

const btnVehicle = document.getElementById("btn-vehicle");
const btnEv = document.getElementById("btn-ev");

document.getElementById("btn-vehicle")?.addEventListener("click", async () => {
  if (!window.selectedStation) return alert("주유소를 먼저 선택하세요.");

  const box = document.getElementById("dashboard-detail");

  // 토글 OFF
  if (vehicleVisible) {
    vehicleMarkers = clearMarkers(vehicleMarkers);
    vehicleHeatOverlays = clearOverlays(vehicleHeatOverlays);
    vehicleVisible = false;
    btnVehicle.classList.remove("active");
    if (box && !evVisible) box.innerHTML = "";
    console.log("🚗 차량기반시설 마커/히트맵 제거됨");
    return;
  }

  const station = window.selectedStation;
  const stationId =
    `${Math.round(station.lat * 1_000_000)}_${Math.round(station.lng * 1_000_000)}`;

  const data = await fetchVehicle(stationId);
  if (!data) {
    console.log("🚗 차량기반시설 API 실패");
    return;
  }

  // 기존 마커/heatmap 제거
  vehicleMarkers = clearMarkers(vehicleMarkers);
  vehicleHeatOverlays = clearOverlays(vehicleHeatOverlays);

  const categories = ["정비소", "세차장", "타이어", "카센터"];
  const counts = {};

  categories.forEach((cat) => {
    const arr = data[cat] || [];
    counts[cat] = arr.length;

    arr.forEach((item) => {
      // 지도 마커
      const mk = new kakao.maps.Marker({
        map: window.mapRef,
        position: new kakao.maps.LatLng(item.lat, item.lng),
      });
      vehicleMarkers.push(mk);

      // 간단 Heatmap: 반투명 원
      const circle = new kakao.maps.Circle({
        center: new kakao.maps.LatLng(item.lat, item.lng),
        radius: 120,
        strokeWeight: 0,
        fillColor: "#FF5722",
        fillOpacity: 0.15,
      });
      circle.setMap(window.mapRef);
      vehicleHeatOverlays.push(circle);
    });
  });

  vehicleVisible = true;
  btnVehicle.classList.add("active");

  // 우측 패널 내용 채우기
  if (box) {
    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
    box.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">차량 기반시설</div>
          <div class="kpi-value">${totalCount}</div>
          <div class="kpi-sublabel">행정동 중심 반경 500m 내</div>
        </div>
      </div>
      <div class="admin-chart-grid">
        <div class="admin-chart-item">
          <h3 class="admin-chart-title">시설 구성 비율</h3>
          <canvas id="vehicle-donut"></canvas>
        </div>
      </div>
    `;

    const donutCtx = document.getElementById("vehicle-donut");
    if (donutCtx && typeof Chart !== "undefined") {
      if (window.vehicleDonutChart) window.vehicleDonutChart.destroy();
      window.vehicleDonutChart = new Chart(donutCtx, {
        type: "doughnut",
        data: {
          labels: Object.keys(counts),
          datasets: [
            {
              data: Object.values(counts),
            },
          ],
        },
        options: {
          plugins: {
            legend: { position: "bottom" },
          },
        },
      });
    }
  }

  console.log(`🚗 차량기반시설 ${data.total_count || ""}개 표시됨`);
});

// =============================
// EV 충전소 버튼 (Heatmap)
// =============================
let evVisible = false;

document.getElementById("btn-ev")?.addEventListener("click", async () => {
  if (!window.selectedStation) return alert("주유소를 먼저 선택하세요.");

  const box = document.getElementById("dashboard-detail");

  // 토글 OFF
  if (evVisible) {
    evMarkers = clearMarkers(evMarkers);
    evHeatOverlays = clearOverlays(evHeatOverlays);
    evVisible = false;
    btnEv.classList.remove("active");
    if (box && !vehicleVisible) box.innerHTML = "";
    console.log("🔌 EV 충전소 마커/히트맵 제거됨");
    return;
  }

  const station = window.selectedStation;
  const stationId =
    `${Math.round(station.lat * 1_000_000)}_${Math.round(station.lng * 1_000_000)}`;

  const data = await fetchEv(stationId);
  if (!data) {
    console.log("🔌 EV API 실패");
    return;
  }

  evMarkers = clearMarkers(evMarkers);
  evHeatOverlays = clearOverlays(evHeatOverlays);

  (data.items || []).forEach((item) => {
    const mk = new kakao.maps.Marker({
      map: window.mapRef,
      position: new kakao.maps.LatLng(item.lat, item.lng),
    });
    evMarkers.push(mk);

    const circle = new kakao.maps.Circle({
      center: new kakao.maps.LatLng(item.lat, item.lng),
      radius: 120,
      strokeWeight: 0,
      fillColor: "#1E88E5",
      fillOpacity: 0.18,
    });
    circle.setMap(window.mapRef);
    evHeatOverlays.push(circle);
  });

  evVisible = true;
  btnEv.classList.add("active");

  if (box) {
    box.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">EV 충전소</div>
          <div class="kpi-value">${data.count ?? (data.items?.length || 0)}</div>
          <div class="kpi-sublabel">행정동 중심 반경 500m 내</div>
        </div>
      </div>
    `;
  }

  console.log(`🔌 EV 충전소 ${data.count || data.items?.length || 0}개 표시됨`);
});

