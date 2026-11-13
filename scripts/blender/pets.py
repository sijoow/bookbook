# bookbook 동물 5 — Blender 로 (11-13 사용자: "애완동물도 블렌더로 — 지금 애들은 발이 없어 보여서")
# 단위 = 앱과 같은 cm. 앱 좌표(x, y=위, z=앞) ↔ Blender (x, -z, y) — glTF 로 내보내면 그대로 앱 좌표
# 덩어리 이름: main(털) · accent(주둥이·배) · pink(볼·귀 안) · nose(코) · beak(부리·발) / 움직이는 것: earL·earR(축 = 붙는 곳) · tail(축 = 꼬리 뿌리)
# 눈은 앱 코드가 그대로 (깜빡임). 실행: blender -b -P scripts/blender/pets.py -- <출력 폴더>   (⚠ read_factory_settings 금지)
import bpy, bmesh, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "public/models/parts"
os.makedirs(OUT, exist_ok=True)

def T(x, y, z):
    """앱 좌표 → Blender 좌표"""
    return Vector((x, -z, y))

def S(sx, sy, sz):
    """앱 크기 비율 → Blender"""
    return (sx, sz, sy)

def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)

def ball(r, at, scale=(1, 1, 1), seg=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=at)
    o = bpy.context.active_object
    o.scale = scale
    return o

def cyl(r1, r2, h, at, rot=(0, 0, 0), seg=16):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2, depth=h, location=at, rotation=rot)
    return bpy.context.active_object

def join(objs, name, fuse=0.0, faces=5000):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target="MESH")
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if fuse:
        rm = o.modifiers.new("remesh", "REMESH")
        rm.mode = "VOXEL"
        rm.voxel_size = fuse
        sm = o.modifiers.new("smooth", "SMOOTH")
        sm.factor = 0.6
        sm.iterations = 8
        bpy.ops.object.convert(target="MESH")
        if len(o.data.polygons) > faces:
            dc = o.modifiers.new("dec", "DECIMATE")
            dc.ratio = faces / len(o.data.polygons)
            bpy.ops.object.convert(target="MESH")
    o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
    return o

def pivot(o, at, name):
    """움직이는 부위 — 축을 붙는 곳(at)으로 (흔들 때 거기를 중심으로 돈다)"""
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.scene.cursor.location = at
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    o.name = name
    o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
    return o

def export(name):
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(OUT, f"pet-{name}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_materials="NONE", export_yup=True)
    print("pet ->", path, sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"), "면")

def legs4(xs, zs, h=3.0, foot=1.25):
    """다리 넷 + 동그란 발 (발이 바닥에 닿는다 — 11-13: 발이 안 보였다)"""
    out = []
    for x in (-xs, xs):
        for z in (-zs, zs):
            out.append(cyl(1.05, 1.0, h, T(x, h / 2 + 0.4, z)))
            out.append(ball(foot, T(x, foot * 0.55, z + 0.35), S(1.0, 0.6, 1.25)))
    return out

# ── 강아지 ──
clear()
body = [ball(4.6, T(0, 5.2, 0), S(1, 0.85, 1.3)), ball(3.9, T(0, 9.4, 3.6))] + legs4(2.2, 2.6)
join(body, "main", fuse=0.28)
join([ball(1.7, T(0, 8.6, 7.0), S(1.1, 0.8, 1.0))], "accent")
join([ball(0.65, T(0, 9.1, 8.65))], "nose")
for s, nm in ((-1, "earL"), (1, "earR")):
    e = ball(1.9, T(s * 3.6, 9.5, 3.1), S(0.6, 1.3, 0.9))
    e.rotation_euler = (0, s * -0.35, 0)
    pivot(e, T(s * 3.0, 11.0, 3.1), nm)
t = cyl(0.95, 0.15, 3.4, T(0, 7.6, -5.7), rot=(-(math.pi / 2 - 0.75), 0, 0))
pivot(t, T(0, 6.4, -5.2), "tail")
export("dog")

# ── 고양이 ──
clear()
body = [ball(4.4, T(0, 5.0, 0), S(1, 0.82, 1.25)), ball(3.7, T(0, 9.2, 3.4))] + legs4(2.1, 2.4)
join(body, "main", fuse=0.28)
join([ball(1.5, T(0, 8.4, 6.4), S(1.2, 0.75, 0.8))], "accent")
join([ball(0.5, T(0, 8.9, 7.1))], "nose")
for s, nm in ((-1, "earL"), (1, "earR")):
    e = cyl(1.35, 0.1, 2.6, T(s * 2.0, 12.4, 3.2))
    e.rotation_euler = (0, s * 0.3, 0)
    pivot(e, T(s * 2.0, 11.2, 3.2), nm)
# 꼬리 — 위로 휘어 올라가는 굵은 선
cu = bpy.data.curves.new("tail", "CURVE")
cu.dimensions = "3D"
sp = cu.splines.new("BEZIER")
pts = [T(0, 5.6, -5.0), T(0, 8.6, -6.6), T(0, 12.1, -5.8), T(0, 13.6, -4.4)]
sp.bezier_points.add(len(pts) - 1)
for bp, p in zip(sp.bezier_points, pts):
    bp.co = p
    bp.handle_left_type = bp.handle_right_type = "AUTO"
cu.bevel_depth = 0.85
cu.bevel_resolution = 3
to = bpy.data.objects.new("tail", cu)
bpy.context.scene.collection.objects.link(to)
bpy.ops.object.select_all(action="DESELECT")
to.select_set(True)
bpy.context.view_layer.objects.active = to
bpy.ops.object.convert(target="MESH")
pivot(bpy.context.active_object, T(0, 5.6, -5.0), "tail")
export("cat")

# ── 토끼 (앉은 자세 — 앞발·뒷발) ──
clear()
body = [ball(5.0, T(0, 5.0, 0), S(1, 0.9, 1.1)), ball(3.8, T(0, 9.8, 2.6))]
body += [ball(1.15, T(s * 1.7, 0.8, 3.6), S(1, 0.7, 1.2)) for s in (-1, 1)]
body += [ball(1.5, T(s * 2.8, 0.75, 0.6), S(0.9, 0.55, 1.6)) for s in (-1, 1)]
join(body, "main", fuse=0.28)
join([ball(0.55, T(0, 9.4, 6.35))], "nose")
for s, nm in ((-1, "earL"), (1, "earR")):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=1.0, location=T(s * 1.4, 15.4, 2.2))
    e = bpy.context.active_object
    e.scale = S(1.0, 3.2, 0.75)
    e.rotation_euler = (0, s * 0.18, 0)
    ear = pivot(e, T(s * 1.3, 12.6, 2.2), nm)
    inner = ball(0.55, T(s * 1.4, 15.2, 2.75), S(1.0, 2.9, 0.5))
    inner.rotation_euler = (0, s * 0.18, 0)
    bpy.ops.object.select_all(action="DESELECT")
    inner.select_set(True)
    bpy.context.view_layer.objects.active = inner
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    inner.name = "pink" + nm[-1]
    inner.parent = ear
    inner.matrix_parent_inverse = ear.matrix_world.inverted()
t = ball(1.7, T(0, 4.6, -5.2))
pivot(t, T(0, 4.6, -5.2), "tail")
export("rabbit")

# ── 햄스터 ──
clear()
body = [ball(4.3, T(0, 4.3, 0), S(1.1, 0.95, 1.2))]
join(body, "main", fuse=0.25)
join([ball(2.8, T(0, 3.6, 2.9), S(1, 0.9, 0.6))], "accent")
join([ball(0.45, T(0, 5.0, 5.25))], "nose")
pink = [ball(1.0, T(s * 2.9, 4.7, 4.1), S(1, 0.7, 0.5)) for s in (-1, 1)]
pink += [ball(0.6, T(s * 1.7, 0.45, 2.7), S(1, 0.6, 1.2)) for s in (-1, 1)] + [ball(0.65, T(s * 2.3, 0.45, -1.4), S(1, 0.6, 1.3)) for s in (-1, 1)]
join(pink, "pink")
for s, nm in ((-1, "earL"), (1, "earR")):
    e = ball(1.1, T(s * 2.4, 8.2, 1.0), S(1, 1, 0.6))
    pivot(e, T(s * 2.2, 7.3, 1.0), nm)
export("hamster")

# ── 병아리 ──
clear()
body = [ball(3.8, T(0, 3.9, 0), S(1, 0.95, 1.1)), ball(2.8, T(0, 8.0, 1.2))]
join(body, "main", fuse=0.22)
beak = [cyl(0.8, 0.0, 1.7, T(0, 7.8, 4.4), rot=(math.pi / 2, 0, 0))]
for s in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=T(s * 1.3, 0.25, 1.0))
    f = bpy.context.active_object
    f.scale = S(1.4, 0.4, 1.8)
    beak.append(f)
join(beak, "beak")
for s, nm in ((-1, "earL"), (1, "earR")):
    w = ball(1.8, T(s * 3.6, 4.4, -0.2), S(0.45, 0.9, 1.1))
    w.rotation_euler = (0, s * -0.35, 0)
    pivot(w, T(s * 3.2, 5.6, -0.2), nm)
export("chick")
print("done pets")
