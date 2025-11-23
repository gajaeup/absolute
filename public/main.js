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
} from './api.js';
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
  await loadKakaoSDK();
  const map = initMap();
  setMapInstance(map);
  initSearchTabs();

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
  const guideBtn = document.getElementById('nav-guide-btn');
  const searchBtn = document.getElementById('nav-search-btn'); // 다른 아이콘 누르면 닫기용
  const panels = {
    list: document.getElementById('list-panel'),
    feature: document.getElementById('feature-panel'),  // ⭐ 롤백 시 제거
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
    if (panel === panels.list) {
      closeRoadview();
    }
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
    closeRoadview();
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
  if (featureBtn) featureBtn.addEventListener('click', () => toggle(panels.feature));   // ⭐ 롤백 시 제거
  if (listBtn) listBtn.addEventListener('click', () => toggle(panels.list));
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
                <canvas id="metrics-chart"></canvas>
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
function drawStatsChart(stats) {
  if (!stats || !stats.relative) return;

  const ctx = document.getElementById('metrics-chart');
  if (!ctx) return;

  const loadingText = document.getElementById('metrics-loading-text');
  if (loadingText) loadingText.remove();

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

  if (window.statsChartInstance) {
    window.statsChartInstance.destroy();
  }

  window.statsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '지역 평균 대비 상대값(%)',
          data: relValues,
          backgroundColor: relValues.map((v) =>
            v >= 0 ? 'rgba(54, 162, 235, 0.75)' : 'rgba(250, 99, 132, 0.75)'
          ),
          borderColor: relValues.map((v) =>
            v >= 0 ? '#2F80ED' : '#EB5757'
          ),
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

let vehicleMarkers = [];
let evMarkers = [];

function clearMarkers(arr) {
  arr.forEach((m) => m.setMap(null));
  return [];
}

// =============================
// 행정동 정보 버튼 - ⭐ 롤백 시 제거
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

  box.innerHTML = `
    <div class="dash-info-box" style="
      padding:12px;border:1px solid #ddd;border-radius:8px;margin-top:10px;
      background:#fafafa;font-size:14px;line-height:1.5;
    ">
      <div><b>행정동:</b> ${data.region ?? '-'}</div>
      <div><b>인구:</b> ${data.population ?? '-'}</div>
      <div><b>교통량:</b> ${data.traffic ?? '-'}</div>
      <div><b>상권 밀집도:</b> ${data.commercial_density ?? '-'}</div>
      <div><b>관광지수:</b> ${data.tourism ?? '-'}</div>
    </div>
  `;
  box.style.display = "block";
});


// =============================
// 차량 기반시설 버튼 - ⭐ 롤백 시 제거
// =============================
document.getElementById("btn-vehicle")?.addEventListener("click", async () => {
  if (!window.selectedStation) return alert("주유소를 먼저 선택하세요.");

  const station = window.selectedStation;
  const stationId =
    `${Math.round(station.lat * 1_000_000)}_${Math.round(station.lng * 1_000_000)}`;

  const data = await fetchVehicle(stationId);
  if (!data) return;

  // 기존 마커 제거
  vehicleMarkers = clearMarkers(vehicleMarkers);

  data["정비소"].concat(data["세차장"], data["타이어"], data["카센터"]).forEach((item) => {
    const mk = new kakao.maps.Marker({
      map: window.mapRef,
      position: new kakao.maps.LatLng(item.lat, item.lng),
    });
    vehicleMarkers.push(mk);
  });

  alert(`총 ${data.total_count}개 차량기반시설 표시됨`);
});


// =============================
// EV 충전소 버튼 - ⭐ 롤백 시 제거
// =============================
document.getElementById("btn-ev")?.addEventListener("click", async () => {
  if (!window.selectedStation) return alert("주유소를 먼저 선택하세요.");

  const station = window.selectedStation;
  const stationId =
    `${Math.round(station.lat * 1_000_000)}_${Math.round(station.lng * 1_000_000)}`;

  const data = await fetchEv(stationId);
  if (!data) return;

  // 기존 ev 마커 제거
  evMarkers = clearMarkers(evMarkers);

  data.items.forEach((item) => {
    const mk = new kakao.maps.Marker({
      map: window.mapRef,
      position: new kakao.maps.LatLng(item.lat, item.lng),
    });
    evMarkers.push(mk);
  });

  alert(`EV 충전소 ${data.count}개 표시됨`);
});