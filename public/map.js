// public/js/map.js

export function initMap() {
  const map = new kakao.maps.Map(document.getElementById("map"), {
    center: new kakao.maps.LatLng(36.5, 127.8),
    level: 12,
  });
  return map;
}

export function drawMarkers(map, clusterer, stations) {
    console.log("📍 stations 샘플:", stations[0]);
    const markers = [];
    let openOverlay = null;
    let closeTimer = null;

    stations.forEach((station, idx) => {
        const lat = parseFloat(station["위도"]);
        const lng = parseFloat(station["경도"]);
        const name = station["상호"] || "(이름없음)";
        const addr = station["정제주소"] || station["주소"] || "주소정보 없음";
        const status = station["상태"] || "정보 없음";

        if (isNaN(lat) || isNaN(lng)) return; // 좌표 없으면 스킵

        // ✅ 마커 이미지
        const imageSrc =
            "https://map.pstatic.net/resource/api/v2/image/maps/selected-marker/229155@1x.png?version=19&mapping=marker-167";
        const imageSize = new kakao.maps.Size(20, 30);
        const imageOption = { offset: new kakao.maps.Point(15, 40) };
        const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);

        const marker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(lat, lng),
            image: markerImage,
            map: map,
      
        });
        const color = /폐업|휴업/.test(status) ? "#ff5a5f" : "#ffb74d";

        // ✅ 인포윈도우 내용 (S3 이미지 포함)
        const overlayContent = `
      <div class="info-window" id="iw-${idx}">
        <div class="info-img">
          <img src="https://absolute-s3-bucket.s3.ap-southeast-2.amazonaws.com/stations/${encodeURIComponent(
            addr
        )}.jpg"
            width="234" height="110"
            onerror="this.src='https://absolute-s3-bucket.s3.ap-southeast-2.amazonaws.com/stations/default.jpg'">
        </div>
        <div class="info-body">
          <div class="info-name">${name}</div>
          <div class="info-addr">${addr}</div>
          <div class="info-status"><span>${status}</span></div>
        </div>
      </div>
    `;

        const overlay = new kakao.maps.CustomOverlay({
            position: marker.getPosition(),
            content: overlayContent,
            yAnchor: 1.5,
        });

        kakao.maps.event.addListener(marker, "mouseover", () => {
            if (closeTimer) clearTimeout(closeTimer);
            if (openOverlay) openOverlay.setMap(null);

            overlay.setMap(map);
            openOverlay = overlay;

            setTimeout(() => {
                const iw = document.getElementById(`iw-${idx}`);
                if (!iw) return;

                iw.addEventListener("mouseenter", () => clearTimeout(closeTimer));
                iw.addEventListener("mouseleave", () => {
                    closeTimer = setTimeout(() => {
                        if (openOverlay) openOverlay.setMap(null);
                        openOverlay = null;
                    }, 200);
                });

                iw.addEventListener("click", (e) => {
                    e.stopPropagation();
                    showDetailPanel({ name, addr, status, lat, lng });
                    if (openOverlay) openOverlay.setMap(null);
                    openOverlay = null;
                });
            }, 80);
        });

        kakao.maps.event.addListener(marker, "mouseout", () => {
            closeTimer = setTimeout(() => {
                const hoveredCard = document.querySelector(".info-window:hover");
                if (!hoveredCard && openOverlay) {
                    openOverlay.setMap(null);
                    openOverlay = null;
                }
            }, 200);
        });

        markers.push(marker);
    });

  clusterer.addMarkers(markers);
}

export function highlightMarkers(clusterer, stations) {
    const allMarkers = clusterer.getMarkers();
    
    const highlightImage = new kakao.maps.MarkerImage(
    "https://map.pstatic.net/resource/api/v2/image/maps/selected-marker/229155@1x.png?version=19&mapping=marker-167",
    new kakao.maps.Size(35, 45),
    { offset: new kakao.maps.Point(25, 65) }
  );


  // 검색된 마커만 다시 강조
  stations.forEach((s) => {
    const targetLat = parseFloat(s.lat ?? s["위도"]);
    const targetLng = parseFloat(s.lng ?? s["경도"]);

    const matched = allMarkers.find((m) => {
      const pos = m.getPosition();
      return (
        Math.abs(pos.getLat() - targetLat) < 0.001 &&
        Math.abs(pos.getLng() - targetLng) < 0.001
      );
    });

    if (matched) {
      matched.setImage(highlightImage);
      matched.setZIndex(999); // 강조된 마커 위로 올리기
    }
  });
}
