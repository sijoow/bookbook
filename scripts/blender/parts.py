# bookbook 캐릭터 부위 — Blender 로 만들어 GLB 로 (11-13 사용자: "머리 스타일이나 모자 같은 캐릭터 요소를 블렌더로 … 전체적 교체")
# 머리 = 원점, 반지름 1 (앱에서 머리 반지름 10 으로 키운다). Blender 앞 = -Y → glTF 앞 = +Z (앱 아바타 얼굴 방향과 같다)
# 재질은 안 넣는다 — 앱이 만화 재질(머리 색·모자 색) + 갈색 펜 테두리를 입힌다
# 실행: blender -b -P scripts/blender/parts.py -- <출력 폴더>   (⚠ read_factory_settings 금지 — 확장 부품 폴더를 지운다)
import bpy, bmesh, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "public/models/parts"
os.makedirs(OUT, exist_ok=True)

def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)

def sphere(r, loc, scale=(1, 1, 1), rot=(0, 0, 0), seg=20, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = scale
    return o

def finish(objs, name, sub=1, fuse=0.0, faces=5000):
    """합치고 부드럽게 · 변형을 굳혀 GLB 로"""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        for m in o.modifiers:
            pass
    bpy.ops.object.convert(target="MESH")  # 수정자(두께·잘라 내기) 굳히기
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if fuse:
        # 점토처럼 한 덩어리로 — 복셀로 다시 빚고(이음매 없이) 부드럽게 다듬은 뒤 면 수를 줄인다 (11-13: 매끈하게 빚은 머리 느낌)
        rm = o.modifiers.new("remesh", "REMESH")
        rm.mode = "VOXEL"
        rm.voxel_size = fuse
        sm = o.modifiers.new("smooth", "SMOOTH")
        sm.factor = 0.7
        sm.iterations = 10
        bpy.ops.object.convert(target="MESH")
        n = len(o.data.polygons)
        if n > faces:
            dc = o.modifiers.new("dec", "DECIMATE")
            dc.ratio = faces / n
            bpy.ops.object.convert(target="MESH")
    if sub:
        m = o.modifiers.new("sub", "SUBSURF")
        m.levels = sub
        m.render_levels = sub
        bpy.ops.object.convert(target="MESH")
    o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_materials="NONE", export_yup=True)
    print("part ->", path, len(o.data.polygons), "면")
    bpy.data.objects.remove(o, do_unlink=True)

def front(x, z, r=1.0):
    """머리 앞면(-y) 위의 점"""
    y = -math.sqrt(max(0.0, r * r - x * x - z * z))
    return Vector((x, y, z))

# ── 단발 (bob) — 둥근 껍데기 + 끝이 동글동글한 밑단 + 앞머리 다발 다섯 ──
clear()
bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=1.1, location=(0, 0.05, 0.07))
shell = bpy.context.active_object
shell.scale = (1.06, 1.03, 1.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bm = bmesh.new()
bm.from_mesh(shell.data)
kill = [v for v in bm.verts if (v.co.y < -0.2 and v.co.z < 0.42 and abs(v.co.x) < 0.74) or v.co.z < -0.6]  # 얼굴 자리만 좁게 — 관자놀이 머리는 남겨 앞머리와 이어지게 (11-13: 옆이 비어 보였다)
bmesh.ops.delete(bm, geom=kill, context="VERTS")
bm.to_mesh(shell.data)
bm.free()
sol = shell.modifiers.new("solid", "SOLIDIFY")
sol.thickness = 0.08
parts = [shell]
# 밑단 — 옆·뒤로 동글동글 (앞쪽 얼굴 자리는 비운다)
for i in range(15):
    a = math.radians(46 + i * 19.1)  # 48° ~ 312° (뒤가 180°)
    x, y = math.sin(a) * 1.03, -math.cos(a) * 1.03 + 0.05
    parts.append(sphere(0.13, (x * 0.99, y, -0.56), (1.15, 0.8, 1.0)))  # 작게 — 크면 양옆 똥머리처럼 보였다 (11-13)
# 앞머리 — 끝이 둥근 다발 (가운데가 조금 길게)
for i, x in enumerate((-0.68, -0.35, 0.0, 0.35, 0.68)):
    z = 0.5 - abs(x) * 0.18
    p = front(x, z, 1.04)
    parts.append(sphere(0.2, p + Vector((0, -0.03, -0.02)), (1.12, 0.5, 1.3), rot=(0.3, 0, -x * 0.45)))
finish(parts, "hair-bob", sub=0, fuse=0.03, faces=6000)  # 면이 많아 부드럽게 칠하기만 (앱에서 부드러운 음영)

# ── 베레모 (beret) — 납작한 빵 + 가장자리 테 + 꼭지 ──
clear()
top = sphere(1.0, (0.1, 0.08, 0.88), (1.04, 1.0, 0.36), rot=(0.12, -0.22, 0))
bpy.ops.mesh.primitive_torus_add(major_radius=0.86, minor_radius=0.07, location=(0.1, 0.08, 0.76), rotation=(0.12, -0.22, 0))
rim = bpy.context.active_object
bpy.ops.mesh.primitive_cylinder_add(radius=0.055, depth=0.22, location=(0.18, 0.06, 1.24), rotation=(0.12, -0.22, 0))
stem = bpy.context.active_object
finish([top, rim, stem], "hat-beret")
print("done")

# ── 두 색 부위 — 본체(main)와 포인트 색(accent, 리본·단추·패치)을 따로 내보낸다 (앱이 각각 칠한다) ──
def finish_two(main, accent, name, sub=1):
    """main·accent 를 각각 합쳐 한 GLB 에 두 덩어리로 (이름 main / accent)"""
    made = []
    for objs, part in ((main, "main"), (accent, "accent")):
        if not objs:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.convert(target="MESH")
        if len(objs) > 1:
            bpy.ops.object.join()
        o = bpy.context.active_object
        o.name = part
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        if sub:
            m = o.modifiers.new("sub", "SUBSURF")
            m.levels = sub
            bpy.ops.object.convert(target="MESH")
        o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
        made.append(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in made:
        o.select_set(True)
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_materials="NONE", export_yup=True)
    print("part ->", path, sum(len(o.data.polygons) for o in made), "면")
    for o in made:
        bpy.data.objects.remove(o, do_unlink=True)

def dome(r, z_cut, loc=(0, 0, 0), scale=(1, 1, 1), thick=0.05, seg=28, rings=14):
    """구의 위쪽만 (z_cut 아래를 잘라) — 모자 몸통"""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < z_cut], context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    if thick:
        s = o.modifiers.new("solid", "SOLIDIFY")
        s.thickness = thick
    return o

# ── 캡모자 — 둥근 몸통 + 앞 챙 + 꼭지 단추(포인트) + 앞 별 패치(포인트) ──
clear()
crown = dome(1.32, 0.3, (0, 0.03, 0.06), (1.0, 1.0, 0.98))  # 머리카락(바깥 ~1.2)을 덮게 (11-13)
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.86, depth=0.07, location=(0, -0.98, 0.5), rotation=(0.2, 0, 0))
brim = bpy.context.active_object
bm = bmesh.new()
bm.from_mesh(brim.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.05], context="VERTS")  # 앞쪽 반만
bm.to_mesh(brim.data)
bm.free()
button = sphere(0.1, (0, 0.03, 1.36), (1, 1, 0.7))
bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=0.17, depth=0.04, location=(0, -1.16, 0.78), rotation=(math.pi / 2 - 0.55, 0, 0))
patch = bpy.context.active_object
finish_two([crown, brim], [button, patch], "hat-cap")

# ── 벙거지 — 둥근 몸통 + 아래로 처진 넓은 챙 + 띠(포인트) ──
clear()
top = dome(1.28, 0.25, (0, 0.03, 0.12), (1.04, 1.02, 0.95))
bpy.ops.mesh.primitive_cone_add(vertices=44, radius1=1.72, radius2=1.32, depth=0.32, location=(0, 0.03, 0.36), end_fill_type="NOTHING")
brim = bpy.context.active_object
sol = brim.modifiers.new("solid", "SOLIDIFY")
sol.thickness = 0.05
bpy.ops.mesh.primitive_torus_add(major_radius=1.33, minor_radius=0.065, location=(0, 0.03, 0.52))
band = bpy.context.active_object
finish_two([top, brim], [band], "hat-bucket")

# ── 밀짚모자 — 넓은 챙 + 몸통 + 리본 띠·리본(포인트) ──
clear()
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.85, depth=0.07, location=(0, 0.03, 0.42))
brim = bpy.context.active_object
crown = dome(1.26, 0.3, (0, 0.03, 0.18), (1.0, 1.0, 0.98), thick=0.05)
bpy.ops.mesh.primitive_torus_add(major_radius=1.25, minor_radius=0.085, location=(0, 0.03, 0.6))
ribbon = bpy.context.active_object
bow = [sphere(0.14, (0.9 + s * 0.15, -0.8, 0.62), (1.4, 0.6, 0.85)) for s in (-1, 1)]
finish_two([brim, crown], [ribbon] + bow, "hat-straw")
print("done hats")

# ── 머리 모양 더 (11-13) — 같은 방식: 껍데기(길이만 다르게) + 앞머리 + 모양마다 덩어리 → 점토처럼 빚기 ──
def hair_shell(cut_z, open_z=0.45, r=1.1):
    """머리 껍데기 — open_z 아래 앞쪽은 얼굴 자리로 열고, cut_z 아래는 자른다"""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=r, location=(0, 0.05, 0.07))
    o = bpy.context.active_object
    o.scale = (1.06, 1.03, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if (v.co.y < -0.2 and v.co.z < open_z and abs(v.co.x) < 0.74) or v.co.z < cut_z], context="VERTS")
    bm.to_mesh(o.data)
    bm.free()
    s = o.modifiers.new("solid", "SOLIDIFY")
    s.thickness = 0.08
    return o

def bangs(n=5, z0=0.5, size=0.2):
    xs = [-0.68, -0.35, 0.0, 0.35, 0.68] if n == 5 else [-0.6, -0.2, 0.2, 0.6]
    out = []
    for x in xs:
        p = front(x, z0 - abs(x) * 0.18, 1.04)
        out.append(sphere(size, p + Vector((0, -0.03, -0.02)), (1.12, 0.5, 1.3), rot=(0.3, 0, -x * 0.45)))
    return out

def fuse_export(objs, name, accent=None, faces=6000):
    """머리는 빚어서 한 덩어리(main), 머리끈 같은 건 따로(accent)"""
    finish(objs, "_tmp_main", sub=0, fuse=0.03, faces=faces) if False else None
    # main 을 빚기
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    m = bpy.context.active_object
    m.name = "main"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    rm = m.modifiers.new("remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = 0.03
    sm = m.modifiers.new("smooth", "SMOOTH")
    sm.factor = 0.7
    sm.iterations = 10
    bpy.ops.object.convert(target="MESH")
    if len(m.data.polygons) > faces:
        dc = m.modifiers.new("dec", "DECIMATE")
        dc.ratio = faces / len(m.data.polygons)
        bpy.ops.object.convert(target="MESH")
    m.data.polygons.foreach_set("use_smooth", [True] * len(m.data.polygons))
    made = [m]
    if accent:
        bpy.ops.object.select_all(action="DESELECT")
        for o in accent:
            o.select_set(True)
        bpy.context.view_layer.objects.active = accent[0]
        bpy.ops.object.convert(target="MESH")
        if len(accent) > 1:
            bpy.ops.object.join()
        a = bpy.context.active_object
        a.name = "accent"
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        a.data.polygons.foreach_set("use_smooth", [True] * len(a.data.polygons))
        made.append(a)
    bpy.ops.object.select_all(action="DESELECT")
    for o in made:
        o.select_set(True)
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_materials="NONE", export_yup=True)
    print("part ->", path, sum(len(o.data.polygons) for o in made), "면")
    for o in made:
        bpy.data.objects.remove(o, do_unlink=True)

# 긴 생머리 — 어깨 아래까지 + 얼굴 옆으로 내려오는 두 가닥
clear()
objs = [hair_shell(-1.25)] + bangs(5)
for s in (-1, 1):
    objs.append(sphere(0.26, (s * 0.92, -0.32, -0.55), (0.8, 0.75, 2.1)))
fuse_export(objs, "hair-long")

# 양갈래 — 짧은 껍데기 + 옆으로 늘어진 두 다발 + 머리끈(포인트)
clear()
objs = [hair_shell(-0.35)] + bangs(5)
ties = []
for s in (-1, 1):
    objs.append(sphere(0.36, (s * 1.18, 0.12, -0.35), (0.85, 0.85, 1.35)))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.075, location=(s * 1.08, 0.1, 0.02), rotation=(0, s * 0.5, 0))
    ties.append(bpy.context.active_object)
fuse_export(objs, "hair-pigtails", accent=ties)

# 똥머리 — 위로 올린 동그란 머리 + 끈(포인트)
clear()
objs = [hair_shell(-0.5)] + bangs(5)
objs.append(sphere(0.42, (0, 0.38, 1.08), (1, 1, 0.95)))
bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.08, location=(0, 0.3, 0.74), rotation=(-0.45, 0, 0))
fuse_export(objs, "hair-bun", accent=[bpy.context.active_object])

# 짧은 머리 — 귀 위까지 + 앞머리 넷 + 삐친 머리 한 가닥
clear()
objs = [hair_shell(-0.05, open_z=0.4)] + bangs(4, 0.47, 0.19)  # 껍데기를 앞머리까지 내려 덮는다 (11-13: 잘린 단면이 밝은 띠로 보였다)
objs.append(sphere(0.14, (0.06, 0.1, 1.2), (0.7, 0.7, 1.6), rot=(0.4, 0, 0.3)))
fuse_export(objs, "hair-short")
print("done hair")

# ── 머리 8가지 더 (11-13 사용자: "나머지 머리도 블렌더로") ──
def on_shell(theta, phi, r=1.13):
    """머리 위 구면의 점 — theta: 위에서 내려온 각, phi: 앞(-y)에서 돈 각"""
    return Vector((math.sin(theta) * math.sin(phi) * r, -math.sin(theta) * math.cos(phi) * r + 0.05, math.cos(theta) * r + 0.07))

# 포니테일 — 묶은 머리끈(포인트) + 뒤로 늘어진 꼬리
clear()
objs = [hair_shell(-0.45)] + bangs(5)
objs.append(sphere(0.34, (0, 1.32, -0.35), (0.9, 0.85, 1.55), rot=(-0.35, 0, 0)))
objs.append(sphere(0.24, (0, 1.12, 0.22), (1, 1, 1)))
bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.075, location=(0, 1.15, 0.16), rotation=(1.2, 0, 0))
fuse_export(objs, "hair-ponytail", accent=[bpy.context.active_object])

# 땋은 머리 — 양옆으로 동글동글 이어진 땋은 다발 + 끝 머리끈(포인트)
clear()
objs = [hair_shell(-0.45)] + bangs(5)
ties = []
for s in (-1, 1):
    for i in range(5):
        objs.append(sphere(0.19 - i * 0.012, (s * (0.98 - i * 0.03), 0.12, -0.32 - i * 0.24), (1, 0.9, 1.15)))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.055, location=(s * 0.84, 0.12, -1.48))
    ties.append(bpy.context.active_object)
fuse_export(objs, "hair-braids", accent=ties)

# 뽀글 — 머리 위를 작은 동그라미가 빽빽이 덮는다
clear()
objs = [hair_shell(-0.4)]
for i, th in enumerate([0.15, 0.45, 0.75, 1.05, 1.35, 1.6]):
    n = max(6, int(14 * math.sin(th) + 4))
    for k in range(n):
        ph = (k + (i % 2) * 0.5) / n * 2 * math.pi
        if th > 1.0 and abs(((ph + math.pi) % (2 * math.pi)) - math.pi) < 0.75:
            continue  # 얼굴 자리는 비운다
        objs.append(sphere(0.2, on_shell(th, ph, 1.12), (1, 1, 1), seg=12, rings=6))
fuse_export(objs, "hair-curly", faces=7000)

# 웨이브 단발 — 단발보다 조금 길고 물결치는 큰 덩어리
clear()
objs = [hair_shell(-0.75)] + bangs(5)
for i in range(13):
    a = math.radians(46 + i * 22.3)
    for j, z in enumerate((-0.25, -0.62)):
        rr = 1.08 + (0.06 if (i + j) % 2 else 0.0)
        objs.append(sphere(0.2, (math.sin(a) * rr, -math.cos(a) * rr + 0.05, z), (1, 1, 1.15), seg=14, rings=7))
fuse_export(objs, "hair-wavy", faces=7000)

# 가르마 — 짧은 머리 + 한쪽으로 크게 넘긴 앞머리 덩어리
clear()
objs = [hair_shell(-0.2, open_z=0.42)]
# 한쪽으로 쓸어 넘긴 앞머리 — 왼쪽 관자놀이에서 오른쪽 눈썹 위로 이어지는 작은 다발 여섯 (11-13: 소시지 하나는 떠 보였다)
for k in range(6):
    t = k / 5
    x = -0.66 + t * 1.22
    z = 0.66 - t * 0.26
    p = front(x, z, 1.04)
    objs.append(sphere(0.23 - t * 0.05, p + Vector((0, -0.02, 0)), (1.25, 0.55, 0.95), rot=(0.3, 0, -0.35)))
fuse_export(objs, "hair-side")

# 삐죽 — 짧은 머리 위로 뾰족뾰족
clear()
objs = [hair_shell(-0.05, open_z=0.4)]
# 앞머리도 짧고 뾰족하게 — 이마 위로 아래를 향한 작은 뿔 다섯 (11-13: 둥근 다발이 따로 놀았다)
for x in (-0.56, -0.28, 0.0, 0.28, 0.56):
    p = front(x, 0.5 - abs(x) * 0.1, 1.02)
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.17, radius2=0.0, depth=0.42, location=p + Vector((0, -0.05, -0.12)), rotation=(math.pi - 0.35, 0, 0))
    objs.append(bpy.context.active_object)
for k, (th, ph) in enumerate([(0.2, 0), (0.35, 1.2), (0.35, -1.2), (0.5, 2.4), (0.5, -2.4), (0.25, 3.14), (0.55, 0.6), (0.55, -0.6)]):
    p = on_shell(th, ph, 1.05)
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.2, radius2=0.0, depth=0.5, location=p + (p - Vector((0, 0.05, 0.07))).normalized() * 0.18)
    c = bpy.context.active_object
    c.rotation_mode = "QUATERNION"
    c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((p - Vector((0, 0.05, 0.07))).normalized())
    objs.append(c)
fuse_export(objs, "hair-spiky")

# 바가지 — 동그란 머리 + 일자로 자른 앞머리 띠
clear()
objs = [hair_shell(-0.15, open_z=0.42)]
for k in range(13):
    x = -0.66 + k * 0.11
    p = front(x, 0.45 - abs(x) * 0.12, 1.06)
    objs.append(sphere(0.12, p + Vector((0, -0.02, 0)), (1, 0.6, 1.3), seg=12, rings=6))
fuse_export(objs, "hair-bowl")

# 털모자 — 양옆 머리만(main) + 털모자(포인트: 몸통·테·방울)
clear()
objs = [sphere(0.3, (s * 0.95, -0.1, -0.35), (0.7, 0.8, 1.2)) for s in (-1, 1)]
knit = [dome(1.17, 0.15, (0, 0.03, 0.05), (1.0, 1.0, 1.0), thick=0.06)]
bpy.ops.mesh.primitive_torus_add(major_radius=1.15, minor_radius=0.16, location=(0, 0.03, 0.2))
knit.append(bpy.context.active_object)
knit.append(sphere(0.3, (0, 0.05, 1.3)))
fuse_export(objs, "hair-beanie", accent=knit, faces=3000)
print("done hair2")

# ── 눈 (11-13 사용자: "눈매도 블렌더로") — 눈동자(main, 눈동자 색) + 반짝이 둘(accent, 흰색). 가로 반지름 1, 앞 -Y
# 그림 눈과 같은 자리: 큰 빛 = 왼쪽 위(-x, +z), 작은 빛 = 오른쪽 아래 (앱이 그림 눈 크기 R 에 맞춰 키운다)
clear()
iris = sphere(1.0, (0, 0, 0), (1.0, 0.3, 1.08), seg=32, rings=16)
hl = [sphere(0.34, (-0.36, -0.3, 0.45), (1, 0.4, 1.05), seg=16, rings=8), sphere(0.15, (0.34, -0.3, -0.43), (1, 0.4, 1.05), seg=12, rings=6)]
finish_two([iris], hl, "eye", sub=0)
print("done eye")
