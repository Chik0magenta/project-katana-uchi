# KATANA-UCHI (카타나우치) — v0.1 픽셀아트 플레이 시안

도공이 되어 재료를 구하고, 강재를 다루고, 한 자루의 칼을 만드는 탐험·제작 게임의 첫 플레이 시안입니다.
**지도 → 이동 사건 → 재료 확보 → 귀환 → 공방 제작 → 결과 → 재시도**가 이어서 동작합니다.

- 기준 문서: [`docs/KATANA-UCHI_GDD_v0.1_Final.md`](docs/KATANA-UCHI_GDD_v0.1_Final.md)
- 임시 규칙과 이유: [`docs/decisions-v0.1.md`](docs/decisions-v0.1.md)
- 화면 캡처: [`docs/screenshots/`](docs/screenshots/)

## 실행 방법

필요한 것: **Godot 4.3** (표준판, .NET 아님). 4.3보다 새 4.x 버전도 열 수 있지만 검증은 4.3에서만 했습니다.

### 에디터에서
1. Godot 4.3을 실행하고 **가져오기(Import)** → 이 폴더의 `project.godot`를 선택합니다.
2. 처음 열 때 폰트 임포트가 끝나면 **F5**(프로젝트 실행)를 누릅니다.

### 명령줄에서
```bash
# 처음 한 번: 리소스 임포트 (에디터로 한 번 열었다면 생략)
godot --headless --import --path .
# 실행
godot --path .
```

## 조작
- 모든 진행은 **마우스**로 합니다.
- **F12**: 개발용 실제 수치(탄소 %, 균일도, 불순도, 온도 °C) 표시 켜기/끄기.
- 타이틀의 **개발용 메뉴**: 지도·이동·장소·공방·결과 화면으로 바로 들어가는 검수용 메뉴(일반 플레이와 분리).

## 한 판의 흐름 (예시)
1. **지도**: 공방 마을에서 시작합니다. 빛나는 테두리의 장소(길로 바로 이어진 곳)만 목적지로 고를 수 있습니다. 출발 전에 왕복 식량을 확인하세요. 마을에서 *보급하기*로 식량을 채울 수 있습니다.
2. **이동**: 출발하면 첫날이 지나고 그날의 사건이 나옵니다. 사건에 대응한 뒤 **진행하기 / 노숙하기 / 되돌아가기**를 고릅니다. 고르기 전에는 시간이 흐르지 않습니다.
3. **장소**: 숯가마 숲에서 *숯 확보*, 강변 사철터에서 *사철 일기*(날용), 철광 산지에서 *철광석 캐기*(속심용). 갈림길 주막에서는 쉬고 식량을 얻을 수 있습니다.
4. **귀환**: 공방 마을로 돌아와 *공방에 들어가기*.
5. **공방**: 원료를 **제철**(원료 + 숯 → 강괴) → 강괴 2개 선택 → 각각 **가열·접쇠** → **피철/심철 배정** → 자동 **접합** → 6구간 **성형** → **점토** → 색을 보고 **담금질**.
6. **결과**: 경화·건전성·형상과 원인, 사용한 재료의 출처를 보고 다시 만들거나 다음 탐험을 떠납니다.

공방 요령: 주황~노란 주황일 때 꺼내 산화물을 털고 접기 · 노란빛을 넘기면 탄소가 빠짐 · 식은 쇠를 두드리면 금이 감 · 담금질은 밝은 진홍빛에서.

## 테스트

```bash
# 규칙·계산·연결 흐름 테스트 (창 없이 실행)
godot --headless --path . res://tests/test_runner.tscn

# 실제 마우스 클릭으로 타이틀→지도→이동→장소→공방→결과→재시도 진행 + 화면 밖/패널 넘침 검사
# (실제 창이 필요. 리눅스 서버에서는 xvfb-run 사용)
godot --path . res://tests/ui_click_test.tscn

# 주요 화면 캡처 → docs/screenshots/
godot --path . res://tools/screenshot_tour.tscn
```

## 폴더 구조

```
project.godot
scenes/main.tscn               # 시작 씬 (화면 전환 관리)
scripts/
  main.gd                      # 화면 전환
  autoload/db.gd               # data/*.json 로더
  autoload/game_state.gd       # 일차·식량·피로·인벤토리·위치 + 탐험 규칙 (영구 상태)
  autoload/art.gd              # 자체 제작 픽셀 그림 (코드로 그려 캐시)
  core/refine_session.gd       # 가열·접쇠 임시 상태
  core/shaping_session.gd      # 성형 임시 상태
  core/quench_session.gd       # 담금질 임시 상태
  core/blade_result.gd         # 결과 계산 (무작위 없음)
  core/heat.gd                 # 온도 → 색·문구
  screens/                     # 타이틀·지도·이동·장소·공방·결과·개발용 메뉴
  ui/                          # 테마, 상단 상태줄, 픽셀 표시 도구
data/
  map.json                     # 노드·길·일수·지형
  events.json                  # 사건과 소문
  materials.json               # 원료 프리셋, 숯, 감정 구간
  activities.json              # 장소 활동
  balance.json                 # 모든 조정 수치
tests/                         # 규칙 테스트, UI 클릭 테스트
tools/screenshot_tour.*        # 화면 캡처 도구
assets/fonts/                  # 나눔고딕 + OFL 라이선스
docs/                          # GDD, 결정 기록, 캡처
```

수치나 사건 문구를 바꾸려면 `data/` 아래 JSON만 고치면 됩니다.

## 외부 자산
- **나눔고딕** (NanumGothic Regular/Bold) — © NHN(NAVER) Corporation, SIL Open Font License 1.1. 전문: `assets/fonts/OFL-NanumGothic.txt`.
- 그 밖의 그림은 모두 이 프로젝트에서 코드로 그린 자체 제작 픽셀 그림입니다. 외부 아트·사운드는 없습니다.
