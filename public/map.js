// public/js/map.js
let lastHighlightedMarker = null;
let mapInstance = null;
export function setMapInstance(map) {
  mapInstance = map;
}
export function initMap() {
  const map = new kakao.maps.Map(document.getElementById('map'), {
    center: new kakao.maps.LatLng(36.5, 127.8),
    level: 12,
  });
  const btnRoadmap = document.getElementById('btn-roadmap');
  const btnHybrid = document.getElementById('btn-hybrid');

  btnRoadmap.onclick = () => {
    map.setMapTypeId(kakao.maps.MapTypeId.ROADMAP);
    btnRoadmap.classList.add('active');
    btnHybrid.classList.remove('active');
  };

  // 항공 지도
  btnHybrid.onclick = () => {
    map.setMapTypeId(kakao.maps.MapTypeId.HYBRID);
    btnHybrid.classList.add('active');
    btnRoadmap.classList.remove('active');
  };

  return map;
}

export function drawMarkers(map, clusterer, stations) {
  const markers = [];
  let openOverlay = null;
  let closeTimer = null;

  stations.forEach((station, idx) => {
    const lat = parseFloat(station['위도']);
    const lng = parseFloat(station['경도']);
    const name = station['상호'] || '(이름없음)';
    const addr = station['정제주소'] || station['주소'] || '주소정보 없음';
    const status = station['상태'] || '정보 없음';

    if (isNaN(lat) || isNaN(lng)) return; // 좌표 없으면 스킵

    // ✅ 마커 이미지
    const imageSrc =
      'https://map.pstatic.net/resource/api/v2/image/maps/selected-marker/229155@1x.png?version=19&mapping=marker-167';
    const imageSize = new kakao.maps.Size(20, 28);
    const imageOption = { offset: new kakao.maps.Point(15, 40) };
    const markerImage = new kakao.maps.MarkerImage(
      imageSrc,
      imageSize,
      imageOption
    );

    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(lat, lng),
      image: markerImage,
    });
    const color = /폐업|휴업/.test(status) ? '#ff5a5f' : '#ffb74d';

    // 🔹 이미지 URL
    const imgUrl = `https://absolute-s3-bucket.s3.ap-southeast-2.amazonaws.com/stations/${encodeURIComponent(
      addr
    )}.jpg`;

    // 🔹 오버레이에 쓸 DOM 요소 직접 생성
    const iwEl = document.createElement('div');
    iwEl.className = 'info-window';
    iwEl.id = `iw-${idx}`;
    iwEl.innerHTML = `
      <div class="info-img">
        <img src="${imgUrl}"
             width="234" height="110"
             onerror="this.src='https://absolute-s3-bucket.s3.ap-southeast-2.amazonaws.com/stations/default.jpg'">
      </div>
      <div class="info-body">
        <div class="info-name">${name}</div>
        <div class="info-addr">${addr}</div>
        <div class="info-status">상태: <span class="status-badge" style="background:${color};">${status}</span></div>
      </div>
    `;

    // ✅ 마우스가 카드 위에 올라가 있으면 닫힘 타이머 취소
    iwEl.addEventListener('mouseenter', () => {
      if (closeTimer) clearTimeout(closeTimer);
    });

    // ✅ 카드에서 벗어나면 일정 시간 뒤 닫기
    iwEl.addEventListener('mouseleave', () => {
      closeTimer = setTimeout(() => {
        if (openOverlay) openOverlay.setMap(null);
        openOverlay = null;
      }, 200);
    });

    // ✅ 카드 클릭 시 stationSelected 이벤트 발송
    iwEl.addEventListener('click', (e) => {
      e.stopPropagation();

      window.dispatchEvent(
        new CustomEvent('stationSelected', {
          detail: { stationId, name, addr, status, lat, lng, imgUrl },
        })
      );

      if (openOverlay) openOverlay.setMap(null);
      openOverlay = null;
    });

    const overlay = new kakao.maps.CustomOverlay({
      position: marker.getPosition(),
      content: iwEl, // ← 문자열이 아니라 실제 DOM 엘리먼트
      yAnchor: 1.5,
    });

    // ========== 마우스 오버 ==========
    kakao.maps.event.addListener(marker, 'mouseover', () => {
      if (closeTimer) clearTimeout(closeTimer);
      if (openOverlay) openOverlay.setMap(null);

      overlay.setMap(map);
      openOverlay = overlay;
    });

    // ========== 마우스 아웃 ==========
    kakao.maps.event.addListener(marker, 'mouseout', () => {
      closeTimer = setTimeout(() => {
        const hovered = document.querySelector('.info-window:hover');
        if (!hovered && openOverlay) {
          openOverlay.setMap(null);
          openOverlay = null;
        }
      }, 200);
    });

    markers.push(marker);
  });

  clusterer.addMarkers(markers);
}
export function highlightMarker(clusterer, targetMarker) {
  resetHighlight(clusterer);
  if (!targetMarker) return;
  const imageSrc =
    'https://map.pstatic.net/resource/api/v2/image/maps/selected-marker/229155@1x.png?version=19&mapping=marker-167';
  const largeSize = new kakao.maps.Size(35, 45); // 확 키운 버전

  const largeImage = new kakao.maps.MarkerImage(imageSrc, largeSize, {
    offset: new kakao.maps.Point(20, 55),
  });
  if (!mapInstance) {
    console.error('mapInstance가 설정되지 않았습니다.');
    return;
  }
  const position = targetMarker.getPosition();
  const bigMarker = new kakao.maps.Marker({
    position: position,
    image: largeImage,
    zIndex: 999, // ★ 다른 마커들보다 무조건 위에 보이도록 설정
    map: mapInstance, // 지도에 표시
  });
  kakao.maps.event.addListener(bigMarker, 'mouseover', () => {
    kakao.maps.event.trigger(targetMarker, 'mouseover');
  });

  // 2. 큰 마커에서 마우스가 나가면 -> 원본 마커의 'mouseout'을 강제 실행
  kakao.maps.event.addListener(bigMarker, 'mouseout', () => {
    kakao.maps.event.trigger(targetMarker, 'mouseout');
  });

  // 4️⃣ 전역 변수에 저장 (나중에 지우기 위해)
  lastHighlightedMarker = bigMarker;
  mapInstance.panTo(position);
}

export function resetHighlight(clusterer) {
  if (!lastHighlightedMarker) return;

  // 강조된 마커 삭제
  lastHighlightedMarker.setMap(null);
  lastHighlightedMarker = null;
}
