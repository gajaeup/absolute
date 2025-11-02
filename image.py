import time, os
import urllib.request
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

test_stations = [


]

def crawl_thumbnail(station):
    print(f"🔍 검색 중: {station}")

    options = webdriver.ChromeOptions()
    # options.add_argument("--headless")  # 필요하면 활성화
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    wait = WebDriverWait(driver, 10)
    driver.get("https://map.naver.com/v5/search")
    time.sleep(3)

    # ✅ 검색 입력
    search = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input.input_search")))
    search.send_keys(station)
    search.send_keys(Keys.ENTER)
    time.sleep(3)

    # ✅ 검색 결과 iframe 전환
    wait.until(EC.frame_to_be_available_and_switch_to_it((By.CSS_SELECTOR, "iframe#searchIframe")))
    
    # ✅ 첫 번째 장소 클릭
    first = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "a.place_bluelink")))
    first.click()
    time.sleep(3)

    # ✅ entryIframe 이동
    driver.switch_to.default_content()
    wait.until(EC.frame_to_be_available_and_switch_to_it((By.CSS_SELECTOR, "iframe#entryIframe")))

    # ✅ 대표 이미지 태그 찾기
    img = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.fNygA img")))
    img_url = img.get_attribute("src")

    print("🖼 이미지 URL:", img_url)

    # ✅ 저장 폴더 생성
    folder = "station_images"
    os.makedirs(folder, exist_ok=True)
    filename = os.path.join(folder, f"{station}.jpg")

    # ✅ 이미지 다운로드
    urllib.request.urlretrieve(img_url, filename)

    print(f"✅ 저장 완료 → {filename}\n")

    driver.quit()

# ✅ 테스트 3개 실행
for s in test_stations:
    try:
        crawl_thumbnail(s)
    except Exception as e:
        print("⚠ 오류:", e)
