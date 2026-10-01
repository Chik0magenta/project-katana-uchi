extends Node
## 데이터 로더. data/*.json을 읽어 둔다. 수치·콘텐츠는 JSON만 고쳐서 조정한다.

var balance: Dictionary = {}
var map: Dictionary = {}
var events: Array = []
var infos: Array = []
var materials: Dictionary = {}
var activities: Dictionary = {}


func _ready() -> void:
	reload()


func reload() -> void:
	balance = _load_json("res://data/balance.json")
	map = _load_json("res://data/map.json")
	var ev := _load_json("res://data/events.json")
	events = ev.get("events", [])
	infos = ev.get("infos", [])
	materials = _load_json("res://data/materials.json")
	activities = _load_json("res://data/activities.json")


func _load_json(path: String) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("데이터 파일을 열 수 없음: %s" % path)
		return {}
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("JSON 형식 오류: %s" % path)
		return {}
	return parsed


func b(key: String) -> Variant:
	return balance.get(key)


func node(id: String) -> Dictionary:
	return map["nodes"].get(id, {})


func node_name(id: String) -> String:
	return node(id).get("name", id)


func terrain_name(t: String) -> String:
	return map.get("terrain_names", {}).get(t, t)


## 두 노드가 직접 연결된 간선이면 {days, terrain}, 아니면 빈 딕셔너리.
func edge(a: String, b_id: String) -> Dictionary:
	for e in map["edges"]:
		if (e[0] == a and e[1] == b_id) or (e[0] == b_id and e[1] == a):
			return {"days": int(e[2]), "terrain": String(e[3])}
	return {}


func neighbors(id: String) -> Array:
	var out: Array = []
	for e in map["edges"]:
		if e[0] == id:
			out.append(e[1])
		elif e[1] == id:
			out.append(e[0])
	return out


func level_text(stat: String, value: float) -> String:
	for pair in materials["levels"][stat]:
		if value < float(pair[0]):
			return pair[1]
	return "?"
