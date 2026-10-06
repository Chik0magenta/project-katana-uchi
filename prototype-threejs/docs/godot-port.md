# three.js 시안 → Godot 재구현 대응표

이 시안은 Godot로 다시 만들 때 **규칙·데이터를 거의 그대로 옮기고, 그림·UI만 Godot 방식으로 바꾸는** 것을 전제로 나눴다.

```
src/
  data/      순수 데이터 (지도·사건·재료·장소·밸런스)      → res://data/*.json  (또는 Resource)
  core/      규칙 (DOM·three.js를 모름, Node에서 테스트)    → res://scripts/core/*.gd (RefCounted / 오토로드)
  render/    three.js 픽셀 무대·그림·입자                  → 씬(Node2D·Sprite2D·CPUParticles2D)
  ui/        DOM 화면·버튼                                → Control 씬(PanelContainer·Button·Label)
  main.js    화면 전환·상단 막대·저장                     → Main 씬 + GameState 오토로드
```

## 1. 데이터 (`src/data/`)

| 파일 | 내용 | Godot |
|---|---|---|
| `map.js` | 노드(이름·지형·좌표·설명), 간선(일수·지형·이름) | `data/map.json`. 좌표는 지도 픽셀(216×169) 기준이라 그대로 쓴다. |
| `events.js` | 사건(지형 필터·가중치·조건·선택지·효과·결과 문구), 소문 | `data/events.json`. `requires`/`effects` 키 이름 유지. |
| `materials.js` | 원료 범위, 감정 단계 표 | `data/materials.json` |
| `locations.js` | 장소별 활동(비용·효과·방문당 횟수) | `data/locations.json` |
| `balance.js` | 모든 조정 수치 | `data/balance.json` (또는 `@export` Resource) |
| `gear.js` | 유닛(실력·체력·기본 무기), 코시라에 등급 | `data/gear.json` |
| `shops.js` | 상점·행상인 품목과 사들이는 비율 | `data/shops.json` |
| `encounters.js` | 전투 상대 묶음(전투력·체력·충격·보상) | `data/encounters.json` |

모두 JSON으로 직렬화 가능한 객체다(함수·클래스 없음). `JSON.stringify`로 바로 내보낼 수 있다.

## 2. 규칙 (`src/core/`)

| JS | 역할 | Godot 제안 |
|---|---|---|
| `rng.js` `Rng` | 상태 저장형 시드 난수 | `RandomNumberGenerator` (seed·state 저장) |
| `state.js` `createGame()` 등 | 영구 상태 생성, 식량 소비, 원료 생성, 감정, 변화 비교 | `GameState` 오토로드 (Dictionary 필드 그대로) |
| `travel.js` | 출발 미리보기, 출발, 하루 행동, 사건 추첨·해결, 도착, 탈진 | `Travel.gd` 정적 함수. 화면은 `journey.phase`(`event`/`choose`/`arrive`/`collapse`)만 보고 패널을 바꾼다. |
| `location.js` | 장소 활동 | `Location.gd` |
| `weapons.js` | 카타나 네 수치 계산, 무기 성능, 코시라에, 장비, 연마, 전투 뒤 칼 상태 | `Weapons.gd` 정적 함수 + 카타나 Dictionary(또는 Resource) |
| `economy.js` | 감정가, 상점·행상인 만들기, 사고팔기 | `Economy.gd` |
| `battle.js` | 전투 모의 실행, 승산 미리 보기, 결과 반영 | `Battle.gd`. `simulate()`를 그대로 옮기고 화면은 `rounds` 배열을 차례로 연출한다. |
| `forge/session.js` `ForgeSession` | 공방 한 번의 임시 상태와 단계(`stage`) 전환 | `ForgeSession.gd` (RefCounted). 결과가 나오면 `GameState.results`에 기록. |
| `forge/refine.js` `RefineSim` | 화덕·강재 온도, 침탄·탈탄·산화물, 접기 | `RefineSim.gd`. `tick(dt)`를 `_process(delta)`에서 호출. |
| `forge/shaping.js` `ShapingSim` | 구간별 성형, 냉간 타격, 과타격 | `ShapingSim.gd` |
| `forge/quench.js` `QuenchSim` | 담금질 온도·고름 | `QuenchSim.gd` |
| `forge/result.js` `computeResult()` | 결과 축·점수·원인 목록 | `BladeResult.gd` 정적 함수 |
| `forge/heat.js` | 발열색 띠와 문구 | `Gradient` 리소스 + 문구 배열 |

규칙 함수는 모두 `{ ok, reason, ... }`를 돌려준다. Godot에서도 Dictionary로 같은 모양을 쓰면 UI 코드가 단순해진다.
`tests/core.test.mjs`(12개)와 `tests/v02.test.mjs`(22개)의 테스트는 GDScript 테스트(GUT 등)로 그대로 옮겨 규칙이 같은지 확인하는 기준으로 쓸 수 있다.

## 3. 그림 (`src/render/`)

| JS | Godot |
|---|---|
| `stage.js` 320×180 버퍼 → CSS 4배 확대 | 프로젝트 설정 `display/window/size/viewport_width=320, height=180`, `stretch/mode=viewport`, `stretch/scale_mode=integer`, 텍스처 필터 Nearest. 또는 SubViewport + TextureRect. **UI는 1280×720 별도 CanvasLayer**로 두면 글자가 선명하다. |
| 왼쪽 위 원점, 아래로 +y | Godot 2D와 같다. 좌표를 그대로 쓰면 된다. |
| `pixel.js` `PixelCanvas` (코드로 그리기) | 가장 빠른 길: 브라우저에서 각 캔버스를 PNG로 저장해 `res://art/`에 넣기. 또는 `Image.set_pixel`로 같은 함수를 옮기기. |
| `art/sprites.js` 문자 격자 스프라이트 | 격자를 PNG로 내보내거나 GDScript 배열로 옮겨 `Image`로 생성 |
| `art/backgrounds.js` 지도·길 레이어·장소·공방·도신 | 정적 그림은 PNG, `drawBladeShape`(성형 진행에 따라 모양이 바뀌는 도신)는 `Image`로 매번 다시 그리거나 `_draw()`로 |
| `fx.js` 입자 프리셋(spark·scale·steam·smoke·ember·rain·splash…) | `CPUParticles2D` 프리셋. 수명·속도·퍼짐·중력·색 단계 값을 그대로 옮긴다. |
| `views/*View.js` 화면별 연출 | 화면별 씬(`MapScene`, `TravelScene`…). `Tweens` → `create_tween()`, 망치 회전 → `Node2D` 피벗 회전 |
| 강재·도신 색 = 흰 그림 × 발열색 | `modulate = heat_color(temp)`, 빛 번짐은 가산 혼합 `CanvasItemMaterial(blend_mode=ADD)` |
| 이동 화면 가로 스크롤 레이어 | `ParallaxBackground` + `ParallaxLayer` (motion_mirroring 320) |

## 4. UI (`src/ui/`)

| JS 화면 | 주요 요소 | Godot |
|---|---|---|
| `title.js` | 새로 시작·이어하기·개발용 메뉴 | `TitleScreen.tscn` |
| `map.js` | 노드 이름표, 일수 표, 오른쪽 출발 패널 | 이름표는 `Label`을 노드 좌표×4 위치에, 패널은 `PanelContainer` |
| `travel.js` | 구간 진행 막대, 사건 글, 선택지/행동 버튼 | `phase`에 따라 버튼 목록을 다시 만드는 `VBoxContainer` |
| `location.js` | 활동 버튼 2열 | `GridContainer(columns=2)` |
| `inventory.js` `shop.js` `koshirae.js` | 겹쳐 뜨는 창(소지품·상점·코시라에·연마소) | `PopupPanel` 또는 CanvasLayer 위의 `PanelContainer`. 수치 막대는 `ProgressBar` |
| `battle.js` | 유닛 체력표, 합별 기록, 피해 숫자 | `BattleScene.tscn`. 기록 재생은 `Tween` 체인 |
| `workshop.js` | 공정 띠, 단계별 패널, 매 프레임 수치 갱신 | 단계별 패널 씬 + `_process`에서 라벨 갱신 |
| `result.js` | 성질·원인·재료·비교 | 3열 `HBoxContainer` |
| `dev.js` | 샘플 상태로 각 화면 진입 | 디버그 빌드에서만 보이는 메뉴 |

## 5. 그대로 지켜야 할 확정 규칙 (GDD)
- 지도에서 **인접 노드 한 구간**만 선택. 여러 구간 예약·자동 경로 없음. 캐릭터 직접 이동 없음.
- 하루 이동 → 그날의 사건 1회('아무 일 없음' 포함) → 해결 → **진행·노숙·되돌아가기** 선택. 선택 전에는 시간이 흐르지 않는다.
- 귀환 중 버튼 이름: 귀환 계속 / 노숙하기 / 목적지로 다시 향하기.

임시 규칙과 수치는 [`decisions-v0.1.md`](decisions-v0.1.md)와 [`decisions-v0.2.md`](decisions-v0.2.md)를 따르되, Godot 버전에서 바꾸면 그 문서도 함께 고친다.

## 6. v0.2에서 더한 것 (요약)
- 돈(문)과 상점: 마을 상점 재고는 방문마다 다시 채워지고(`state.visit.shops`), 행상인 재고는 그날 사건(`journey.event.shop`)에 붙는다.
- 카타나: 도신 결과 기록 + 코시라에 등급 → 네 수치(날카로움·날 유지력·도신 내구력·무게). 무작위 없음.
- 전투: 고를 때 결과를 모두 계산해 상태에 반영하고, 화면은 `state.lastBattle`의 기록을 재생만 한다(저장·새로고침에 안전).
- 성하 마을: `map.js`에 노드 1개와 길 2개, `locations.js`에 활동 5개가 늘었다.
