import { fetchStationsByRegion } from "./api.js";

/* =========================
   🔹 탭 전환
   ========================= */
export function switchSearchMode(mode) {
  const tabStation = document.getElementById("tab-station");
  const tabRegion = document.getElementById("tab-region");
  const stationModule = document.getElementById("station-search-module");
  const regionModule = document.getElementById("region-search-module");

  if (mode === "station") {
    tabStation.classList.add("active");
    tabRegion.classList.remove("active");

    stationModule.classList.remove("hidden");
    stationModule.classList.add("active");

    regionModule.classList.add("hidden");
    regionModule.classList.remove("active");
  } 
  else if (mode === "region") {
    tabRegion.classList.add("active");
    tabStation.classList.remove("active");

    regionModule.classList.remove("hidden");
    regionModule.classList.add("active");

    stationModule.classList.add("hidden");
    stationModule.classList.remove("active");

    loadSidoData();

  }
}

export function initSearchTabs() {
  document.getElementById("tab-station").addEventListener("click", () => switchSearchMode("station"));
  document.getElementById("tab-region").addEventListener("click", () => switchSearchMode("region"));
}

/* =========================
   🔹 시도 드롭다운 로드
   ========================= */
export function loadSidoData() {
  const selectSido = document.getElementById("select-sido");
  if (!window.geoData || !window.geoData.sido) return;

  selectSido.innerHTML = `<option value="">-- 시/도 선택 --</option>`;

  window.geoData.sido.features.forEach(f => {
    selectSido.add(new Option(f.properties.CTP_KOR_NM, f.properties.CTP_KOR_NM));
  });
}

/* =========================
   🔹 지역 검색 초기화
   ========================= */
export function initRegionSearch(geoData, map) {
  const sidoSel = document.getElementById("select-sido");
  const sigSel = document.getElementById("select-sigungu");
  const emdSel = document.getElementById("select-eupmyeondong");

  sigSel.innerHTML = `<option value="">-- 시/군/구 선택 --</option>`;
  emdSel.innerHTML = `<option value="">-- 읍/면/동 선택 --</option>`;

  loadSido(sidoSel, geoData);

  // 시도 선택
  sidoSel.addEventListener("change", async () => {
    sigSel.disabled = false;
    emdSel.disabled = true;

    loadSigungu(sidoSel.value, sigSel, geoData);
    drawSidoPolygon(sidoSel.value, geoData, map);

    await updateStationList(map);
  });

  // 시군구 선택
  sigSel.addEventListener("change", async () => {
    emdSel.disabled = false;

    loadEmd(sidoSel.value, sigSel.value, emdSel, geoData);
    drawSigunguPolygon(sidoSel.value, sigSel.value, geoData, map);

    await updateStationList(map);
  });

  // 읍면동 선택
  emdSel.addEventListener("change", async () => {
    const fullName = emdSel.value;
    drawEmdPolygon(fullName, geoData, map);
    await updateStationList(map);
  });
}

/* =========================
   🔹 드롭다운 로드 함수
   ========================= */

function loadSido(select, geoData) {
  select.innerHTML = `<option value="">-- 시/도 선택 --</option>`;
  geoData.sido.features.forEach(f => {
    select.add(new Option(f.properties.CTP_KOR_NM, f.properties.CTP_KOR_NM));
  });
}

function loadSigungu(sido, select, geoData) {
  select.innerHTML = `<option value="">-- 시/군/구 선택 --</option>`;

  const codeMap = {
    서울특별시:"11", 부산광역시:"26", 대구광역시:"27", 인천광역시:"28",
    광주광역시:"29", 대전광역시:"30", 울산광역시:"31", 세종특별자치시:"36",
    경기도:"41", 강원특별자치도:"51", 충청북도:"43", 충청남도:"44",
    전북특별자치도:"52", 전라남도:"46", 경상북도:"47", 경상남도:"48",
    제주특별자치도:"50"
  };

  const prefix = codeMap[sido];

  geoData.sig.features
    .filter(f => f.properties.SIG_CD.startsWith(prefix))
    .forEach(f => {
      select.add(new Option(f.properties.SIG_KOR_NM, f.properties.SIG_KOR_NM));
    });
}

function loadEmd(sido, sig, select, geoData) {
  select.innerHTML = `<option value="">-- 읍/면/동 선택 --</option>`;

  const prefix = `${sido} ${sig}`;

  geoData.emd.features
    .filter(f => f.properties.adm_nm.startsWith(prefix))
    .forEach(f => {
      select.add(new Option(
        f.properties.adm_nm.split(" ").pop(),
        f.properties.adm_nm
      ));
    });
}

/* =========================
   🔹 폴리곤 드로잉
   ========================= */

function clearPolygon() {
  if (window.polygons) window.polygons.forEach(p => p.setMap(null));
  window.polygons = [];
}

function drawSidoPolygon(name, geoData, map) {
  const feature = geoData.sido.features.find(f => f.properties.CTP_KOR_NM === name);
  drawPolygon(feature, map);
}

function drawSigunguPolygon(sidoName, sigName, geoData, map) {
  const codeMap = {
    서울특별시:"11", 부산광역시:"26", 대구광역시:"27", 인천광역시:"28",
    광주광역시:"29", 대전광역시:"30", 울산광역시:"31", 세종특별자치시:"36",
    경기도:"41", 강원특별자치도:"51", 충청북도:"43", 충청남도:"44",
    전북특별자치도:"52", 전라남도:"46", 경상북도:"47", 경상남도:"48",
    제주특별자치도:"50"
  };

  const prefix = codeMap[sidoName];

  const feature = geoData.sig.features.find(
    f =>
      f.properties.SIG_KOR_NM === sigName &&
      f.properties.SIG_CD.startsWith(prefix)
  );

  drawPolygon(feature, map);
}

function drawEmdPolygon(fullName, geoData, map) {
  const feature = geoData.emd.features.find(f => f.properties.adm_nm === fullName);
  drawPolygon(feature, map);
}

export function drawPolygon(feature, map) {
  if (!feature) return;

  clearPolygon();

  const paths = [];

  if (feature.geometry.type === "Polygon") {
    paths.push(feature.geometry.coordinates[0].map(([x, y]) => new kakao.maps.LatLng(y, x)));
  } else {
    feature.geometry.coordinates.forEach(poly => {
      paths.push(poly[0].map(([x, y]) => new kakao.maps.LatLng(y, x)));
    });
  }

  const polygon = new kakao.maps.Polygon({
    path: paths,
    strokeWeight: 2,
    strokeColor: "#00695c",
    fillColor: "rgba(0,150,136,0.35)",
    fillOpacity: 0.5,
  });

  polygon.setMap(map);
  window.polygons.push(polygon);

  const bounds = new kakao.maps.LatLngBounds();
  paths.flat().forEach(p => bounds.extend(p));
  map.setBounds(bounds);
}

/* =========================
   🔹 지역명 → API → 왼쪽 리스트 업데이트
   ========================= */

function getSelectedRegionName() {
  const sido = document.getElementById("select-sido").value;
  const sig = document.getElementById("select-sigungu").value;
  const emd = document.getElementById("select-eupmyeondong").value;

  if (emd) return emd;

  // 2) 시군구 선택한 경우 → "광주광역시 서구"
  if (sig) return `${sido} ${sig}`;

  // 3) 시도만 선택한 경우 → "광주광역시"
  return sido;
}

async function updateStationList(map) {
  const regionName = getSelectedRegionName();
  const listEl = document.getElementById("region-station-list");
   listEl.classList.remove("hidden");

  if (!regionName) {
    listEl.innerHTML = `<div class="empty-msg">지역을 선택하세요</div>`;
    return;
  }

  try {
    const data = await fetchStationsByRegion(regionName);

    console.log("📦 region API raw data:", data);

    // GeoJSON 기반 → features 배열을 사용해야 함
    const items = data.features || [];

    renderStationList(items,map);

  } catch (e) {
    console.error("API 오류:", e);
    renderStationList([],map);
  }
}

function renderStationList(items,map) {
  const listEl = document.getElementById("region-station-list");
  listEl.innerHTML = "";

  if (!items || items.length === 0) {
    listEl.innerHTML = `<div class="empty-msg">해당 지역에 주유소가 없습니다.</div>`;
    return;
  }

  items.forEach(feature => {
    const props = feature.properties || feature;
    const [lng, lat] = feature.geometry.coordinates;
    const el = document.createElement("div");
     el.className = "station-item";
     el.innerHTML = `
       <div class="station-name">${props["상호"] || "이름 없음"}</div>
       <div class="station-addr">${props["정제주소"] || props["주소"] || "-"}</div>
       <div class="station-status">${props["상태"] || "-"}</div>
     `;
    el.addEventListener("click", () => {
      const pos = new kakao.maps.LatLng(lat, lng);

      // 지도 이동
      map.setLevel(4);   // 줌 레벨 조정 (원하면 수정 가능)
      map.panTo(pos);

      // 🔥 선택된 주유소 상세 패널도 열고 싶으면 이벤트 발생
      window.dispatchEvent(new CustomEvent("stationSelected", {
        detail: { 
          name: props["상호"], 
          addr: props["정제주소"] || props["주소"],
          status: props["상태"],
          lat,
          lng
        }
      }));
    });
    
       listEl.appendChild(el);
     });
}
