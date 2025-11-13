export function switchSearchMode(mode) {
  const tabStation = document.getElementById("tab-station");
  const tabRegion = document.getElementById("tab-region");
  const stationModule = document.getElementById("station-search-module");
  const regionModule = document.getElementById("region-search-module");

  if (mode === "station") {
    tabStation.classList.add("active");
    tabRegion.classList.remove("active");
    stationModule.classList.add("active");
    stationModule.classList.remove("hidden");
    regionModule.classList.remove("active");
    regionModule.classList.add("hidden");
  } else if (mode === "region") {
    tabRegion.classList.add("active");
    tabStation.classList.remove("active");
    regionModule.classList.add("active");
    regionModule.classList.remove("hidden");
    stationModule.classList.remove("active");
    stationModule.classList.add("hidden");
    loadSidoData();
  }
}

// 🔹 시도 데이터 로드
export function loadSidoData() {
  const selectSido = document.getElementById("select-sido");
  const selectSigungu = document.getElementById("select-sigungu");
  const selectEupmyeondong = document.getElementById("select-eupmyeondong");

  const sidoList = [
    "서울특별시", "부산광역시", "대구광역시", "인천광역시",
    "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
    "경기도", "강원특별자치도", "충청북도", "충청남도",
    "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도"
  ];

  selectSido.innerHTML = "<option value=''>-- 시/도 선택 --</option>";
  selectSigungu.innerHTML = "<option value=''>-- 시/군/구 선택 --</option>";
  selectEupmyeondong.innerHTML = "<option value=''>-- 읍/면/동 선택 --</option>";

  sidoList.forEach((sido) => {
    const option = new Option(sido, sido);
    selectSido.add(option);
  });

  selectSido.addEventListener("change", (e) => {
    const selected = e.target.value;
    if (selected) {
      loadSigunguData(selected);
    }
  });
}

// 🔹 시군구 더미 로드 (백엔드 연동 가능)
function loadSigunguData(sido) {
  const selectSigungu = document.getElementById("select-sigungu");
  selectSigungu.disabled = false;
  selectSigungu.innerHTML = `<option value="">${sido}의 시군구 선택</option>`;
  // 실제로는 서버 API(`/api/regions?sido=${sido}`) 등에서 불러오면 됩니다.
}

// 🔹 탭 클릭 이벤트 초기화
export function initSearchTabs() {
  const tabStation = document.getElementById("tab-station");
  const tabRegion = document.getElementById("tab-region");

  tabStation.addEventListener("click", () => switchSearchMode("station"));
  tabRegion.addEventListener("click", () => switchSearchMode("region"));
}
