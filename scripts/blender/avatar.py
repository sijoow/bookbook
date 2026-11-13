# bookbook 캐릭터 — Blender 시험 (11-13 사용자: "캐릭터를 블렌더로도 한번 만들어 보는 건 어때")
# 아기 비율(큰 머리) · 단발 + 코랄 베레모 · 버터색 원피스 + 흰 깃 · 만화 명암(Shader to RGB) + 갈색 펜 테두리(Freestyle)
# 실행: blender -b -P blender_avatar.py -- <출력 png> <출력 glb>
import bpy, bmesh, math, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_PNG = argv[0] if len(argv) > 0 else "C:/tmp/avatar.png"
OUT_GLB = argv[1] if len(argv) > 1 else ""

# 공장 설정으로 다시 열지 않는다 (확장 부품 폴더를 정리해 버린다 — 11-13) → 기본 장면의 물체만 지운다
scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def toon(name, hexcol, dark=0.8, light=1.05):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = nt.nodes.new("ShaderNodeShaderToRGB")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    base = lin(hexcol)
    els = ramp.color_ramp.elements
    els[0].position = 0.0
    els[0].color = (*[c * dark for c in base], 1)
    els[1].position = 0.5
    els[1].color = (*base, 1)
    e = els.new(0.8)
    e.color = (*[min(1, c * light) for c in base], 1)
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(diff.outputs["BSDF"], s2r.inputs["Shader"])
    nt.links.new(s2r.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return m

def flat(name, hexcol):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*lin(hexcol), 1)
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return m

M = {
    "skin": toon("skin", "#f8d9c0"),
    "hair": toon("hair", "#7a5038", 0.68),
    "beret": toon("beret", "#ef8f7c"),
    "dress": toon("dress", "#f6d77c"),
    "collar": toon("collar", "#fbf4e6", 0.86),
    "shoe": toon("shoe", "#6b5140", 0.7),
    "eye": flat("eye", "#3a2a22"),
    "white": flat("white", "#ffffff"),
    "blush": flat("blush", "#f4a593"),
    "mouth": flat("mouth", "#8a4a3c"),
    "button": toon("button", "#b98552", 0.75),
}

def smooth(o, sub=2):
    o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
    if sub:
        m = o.modifiers.new("sub", "SUBSURF")
        m.levels = sub
        m.render_levels = sub
    return o

def sphere(name, r, loc, scale=(1, 1, 1), mat=None, rot=(0, 0, 0), seg=40, rings=20, sub=1):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    if mat:
        o.data.materials.append(mat)
    return smooth(o, sub)

# ── 머리 (아기 비율: 머리 지름 ≈ 몸 높이) ──
HEAD = Vector((0, 0, 2.25))
sphere("head", 1.0, HEAD, (1.04, 0.98, 0.96), M["skin"])
# 귀
for s in (-1, 1):
    sphere(f"ear{s}", 0.17, HEAD + Vector((s * 1.0, 0.05, -0.08)), (0.6, 0.8, 1), M["skin"])

def on_face(x, z, out=0.0):
    # 머리 앞면(-y) 위의 점
    dx, dz = x / 1.04, (z - HEAD.z) / 0.96
    y = -math.sqrt(max(0.0, 1 - dx * dx - dz * dz)) * 0.98
    return Vector((x, y - out, z))

# 눈 — 크고 둥글게 + 반짝이 둘 (점토 시험 그림처럼, 눈 사이 넓게)
for s in (-1, 1):
    c = on_face(s * 0.4, 2.12, 0.005)
    e = sphere(f"eye{s}", 0.15, c, (1.0, 0.35, 1.22), M["eye"], sub=1)
    sphere(f"hl{s}", 0.05, c + Vector((s * -0.04 - 0.035, -0.05, 0.08)), (1, 0.4, 1), M["white"], sub=0)
    sphere(f"hl2{s}", 0.024, c + Vector((s * -0.04 + 0.05, -0.05, -0.06)), (1, 0.4, 1), M["white"], sub=0)
    sphere(f"blush{s}", 0.15, on_face(s * 0.66, 1.92, 0.0), (1.25, 0.25, 0.75), M["blush"], sub=0)

# 코 (작은 콩) · 입 (작은 미소 — 짧은 곡선)
sphere("nose", 0.05, on_face(0, 2.0, 0.02), (1.1, 0.7, 0.8), M["skin"], sub=0)
curve = bpy.data.curves.new("smile", "CURVE")
curve.dimensions = "3D"
sp = curve.splines.new("BEZIER")
sp.bezier_points.add(2)
pts = [on_face(-0.09, 1.86, 0.01), on_face(0, 1.82, 0.012), on_face(0.09, 1.86, 0.01)]
for bp, p in zip(sp.bezier_points, pts):
    bp.co = p
    bp.handle_left_type = bp.handle_right_type = "AUTO"
curve.bevel_depth = 0.014
mouth = bpy.data.objects.new("mouth", curve)
mouth.data.materials.append(M["mouth"])
scene.collection.objects.link(mouth)

# ── 머리카락 — 단발 (껍데기 + 앞머리 다발) ──
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.1, location=HEAD + Vector((0, 0.06, 0.08)))
hair = bpy.context.active_object
hair.name = "hair"
hair.scale = (1.06, 1.02, 1.0)
bm = bmesh.new()
bm.from_mesh(hair.data)
# 얼굴 쪽 앞 아래를 잘라 얼굴을 연다 · 뒤·옆은 턱선까지 (단발)
kill = [v for v in bm.verts if (v.co.y < -0.2 and v.co.z < 0.5) or v.co.z < -0.6]
bmesh.ops.delete(bm, geom=kill, context="VERTS")
bm.to_mesh(hair.data)
bm.free()
sol = hair.modifiers.new("solid", "SOLIDIFY")
sol.thickness = 0.07
hair.data.materials.append(M["hair"])
smooth(hair, 2)
# 앞머리 — 끝이 둥근 다발 다섯
for i, x in enumerate((-0.62, -0.32, 0.0, 0.32, 0.62)):
    z = 2.72 - abs(x) * 0.25
    p = on_face(x, z, -0.02)
    sphere(f"bang{i}", 0.2, p + Vector((0, -0.06, -0.03)), (1.15, 0.45, 1.25), M["hair"], rot=(0.25, 0, -x * 0.5), sub=1)

# 베레모 — 코랄, 살짝 기울임 + 꼭지
sphere("beret", 1.0, HEAD + Vector((0.14, 0.12, 0.92)), (1.02, 1.0, 0.34), M["beret"], rot=(0.1, -0.22, 0), sub=2)
bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=0.2, location=HEAD + Vector((0.2, 0.12, 1.28)))
stem = bpy.context.active_object
stem.data.materials.append(M["beret"])

# ── 몸 — 버터색 원피스 (종 모양) + 흰 깃 + 단추 ──
sphere("torso", 0.6, (0, 0.02, 1.0), (0.98, 0.9, 1.05), M["dress"])
bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.88, radius2=0.5, depth=0.62, location=(0, 0.02, 0.55))
skirt = bpy.context.active_object
skirt.data.materials.append(M["dress"])
bev = skirt.modifiers.new("bev", "BEVEL")
bev.width = 0.12
bev.segments = 4
smooth(skirt, 2)
bpy.ops.mesh.primitive_torus_add(major_radius=0.4, minor_radius=0.1, location=(0, -0.02, 1.36))
collar = bpy.context.active_object
collar.scale = (1, 1, 0.6)
collar.data.materials.append(M["collar"])
smooth(collar, 1)
for i, z in enumerate((1.18, 0.92)):
    sphere(f"btn{i}", 0.06, (0, -0.56 + (0.0 if i == 0 else -0.02), z), (1, 0.5, 1), M["button"], sub=0)

# 팔·손
for s in (-1, 1):
    sphere(f"arm{s}", 0.16, (s * 0.6, 0.02, 1.0), (1, 1, 2.2), M["dress"], rot=(0, s * 0.16, 0))
    sphere(f"hand{s}", 0.14, (s * 0.68, -0.02, 0.62), (1, 1, 1), M["skin"])
# 다리·신발 (짧고 통통)
for s in (-1, 1):
    sphere(f"leg{s}", 0.17, (s * 0.25, 0.02, 0.22), (1, 1, 1.5), M["skin"])
    sphere(f"shoe{s}", 0.19, (s * 0.27, -0.08, 0.04), (1.05, 1.45, 0.62), M["shoe"])

# ── 장면: 종이색 배경 · 해 · 카메라 ──
world = bpy.data.worlds.new("paper")
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (*lin("#f7f1e3"), 1)
bg.inputs["Strength"].default_value = 1.0
scene.world = world
sun = bpy.data.lights.new("sun", "SUN")
sun.energy = 3.0
sun_o = bpy.data.objects.new("sun", sun)
sun_o.rotation_euler = (math.radians(55), math.radians(-35), math.radians(-55))
scene.collection.objects.link(sun_o)

target = bpy.data.objects.new("target", None)
target.location = (0, 0, 1.75)
scene.collection.objects.link(target)
cam_d = bpy.data.cameras.new("cam")
cam_d.lens = 50
cam = bpy.data.objects.new("cam", cam_d)
cam.location = (1.8, -7.0, 2.7)
scene.collection.objects.link(cam)
tr = cam.constraints.new("TRACK_TO")
tr.target = target
tr.track_axis = "TRACK_NEGATIVE_Z"
tr.up_axis = "UP_Y"
scene.camera = cam

# 엔진 — EEVEE (만화 명암은 Shader to RGB 라 EEVEE 에서만)
for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = eng
        break
    except Exception:
        pass
print("engine", scene.render.engine)
scene.render.resolution_x = 900
scene.render.resolution_y = 1100
scene.view_settings.view_transform = "Standard"
scene.render.film_transparent = False
# 갈색 펜 테두리 (Freestyle)
scene.render.use_freestyle = True
scene.render.line_thickness_mode = "ABSOLUTE"
scene.render.line_thickness = 2.4
vl = bpy.context.view_layer
vl.use_freestyle = True
fs = vl.freestyle_settings
ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("ink")
if ls.linestyle is None:
    ls.linestyle = bpy.data.linestyles.new("ink")
ls.select_silhouette = True
ls.select_border = True
ls.select_crease = False
ls.linestyle.color = lin("#5a4535")
ls.linestyle.thickness = 2.4
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print("render ->", OUT_PNG)

if OUT_GLB:
    try:
        bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", export_apply=True)
        print("glb ->", OUT_GLB)
    except Exception as ex:
        print("glb 실패", ex)
