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
    clusterer.clear();
    const markers = stations.map(station => {
        const lat = parseFloat(station["위도"]);
    const lng = parseFloat(station["경도"]);
    const name = station["상호"] || "(이름없음)";
    const addr = station["정제주소"] || station["주소"] || "주소정보 없음";
    const status = station["상태"] || "정보 없음";

    if (isNaN(lat) || isNaN(lng)) return null; // 좌표 없으면 스킵

    // ✅ 마커 이미지
    const imageSrc =
      "https://map.pstatic.net/resource/api/v2/image/maps/selected-marker/229155@1x.png?version=19&mapping=marker-167";
    const imageSize = new kakao.maps.Size(30, 40);
    const imageOption = { offset: new kakao.maps.Point(15, 40) };
    const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);

    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(lat, lng),
      image: markerImage,
      map: map,
      
    });

    // ✅ 인포윈도우 내용 (S3 이미지 포함)
    const overlayContent = `
      <div class="info-window">
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

    kakao.maps.event.addListener(marker, "click", () => {
      overlay.setMap(map);
    });

    return marker;
  }).filter(Boolean);

  clusterer.addMarkers(markers);
}
