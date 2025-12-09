# 2025-2 전북대학교 산학실전캡스톤
해당 프로젝트는 **한국국토정보공사**([LX](https://www.lx.or.kr/kor.do))와 함께 진행하였습니다.

---

## 배포 링크 : https://absolute-beryl.vercel.app/



---
# 주제 
### GeoAI 기반 폐주유소 부지활용 의사결정 지원 시스템

## 과제 목표
### 데이터 분석을 통한 의사결정 지원 시스템을 구축하여 웹서비스 형태로 제공


---
## 필요성
+ 폐업/휴업하는 주유소가 증가하지만, 철거비용 부담으로 그대로 방치됨
<img width="1081" height="564" alt="image" src="https://github.com/user-attachments/assets/29b98af5-203c-4e71-8835-9fe54e05d323" />
<img width="1106" height="403" alt="image" src="https://github.com/user-attachments/assets/83ebfd59-b8d0-4cac-b693-780913a76179" />




--- 


## Tech Stack
* **Language:** JavaScript (ES6+), HTML5, CSS3
* **Library:** KakaoMap API

## Deployment
이 프로젝트는 **AWS EC2**와 **Vercel**을 통해 배포되었습니다.

* **Frontend:** Vercel (CI/CD 자동화 적용)
* **Backend:** fastAPI, S3
<img width="2404" height="1333" alt="image" src="https://github.com/user-attachments/assets/ebc34615-487e-4b02-af55-af89cad9facf" />

## How to Run (Local)

이 프로젝트는 별도의 빌드 과정 없이 바로 실행할 수 있습니다.
단, 원활한 API 호출 및 리소스 로딩을 위해 로컬 서버 환경에서 실행하는 것을 권장합니다.
Live Server 기능을 이용하시는 걸 추천합니다.



## Key Features

* **지도 시각화:** 카카오맵을 통해 분석된 폐주유소 위치를 지도 위에 표시

  <img width="1909" height="859" alt="image" src="https://github.com/user-attachments/assets/0efa8537-f3cb-46da-b3ba-2fe224cbbb68" />
  <img width="1499" height="760" alt="image" src="https://github.com/user-attachments/assets/e7594f07-a575-4b7f-abf1-61ff5f9e38bb" />


* **상세 정보 조회:** 마커 클릭 시 해당 주유소의 분석 데이터 표시
* **로드뷰 연동:** 해당 위치의 실제 현장 모습을 로드뷰로 확인
<img width="2260" height="1243" alt="image" src="https://github.com/user-attachments/assets/72a924f2-9d57-4689-8d99-f720c7b3b2d4" />

## 📂 Folder Structure
``` text
absolute/
├── api/          # KakaoMap API 
│   └── kakao.js  
├── public/             # css, 행정구역 json, png, 헤더 페이지
│   ├── main.js      # 지도 초기화 및 패널
│   ├── main.css
│   ├── api.js       # 백엔드 API 통신 함수
│   ├── map.js       # 마커 관리
│   └── search.js    # 검색 기능(주유소명, 행정구역별)
├── main.html       # 메인 페이지
└── README.md        # 프로젝트 설명 문서
```


## 백엔드 깃허브 링크 : https://github.com/culyrh/absolute

