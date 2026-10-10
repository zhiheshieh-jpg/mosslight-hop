"""Original lightweight Mosslight assets. Run with Blender --background --python."""
import bpy, math, json, struct, random
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist'/'assets'/'models'; OUT.mkdir(parents=True,exist_ok=True)
EDIT=ROOT/'models'; EDIT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)
random.seed(17)

def mat(name,c,metal=0,rough=.6,emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1)
    p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    if emission:
        p.inputs['Emission Color'].default_value=(*c,1); p.inputs['Emission Strength'].default_value=emission
    return m
ivory=mat('porcelain ivory',(0.94,.89,.72),rough=.35)
coral=mat('terracotta',(0.66,.20,.11))
ink=mat('dark eyes',(.027,.040,.043),rough=.27)
wood=mat('warm cedar',(.31,.135,.057)); woodLight=mat('honey wood',(.57,.30,.12))
woodDark=mat('dark beams',(.16,.075,.037)); wall=mat('warm plaster',(.84,.70,.43))
roof=mat('deep forest roof',(.09,.22,.19),rough=.8)
roofEdge=mat('roof edge',(.16,.32,.24))
amber=mat('amber glass',(1,.48,.10),rough=.25,emission=.8)
green=mat('leaf green',(.24,.43,.15)); green2=mat('leaf light',(.39,.56,.19)); green3=mat('leaf shadow',(.15,.32,.14))
stone=mat('warm grey stone',(.37,.39,.34))
dark=mat('city charcoal',(.028,.042,.075),metal=.3)
steel=mat('blue steel',(.12,.19,.25),metal=.65,rough=.32)
cyan=mat('neon turquoise',(.02,.95,.91),emission=3)
pink=mat('neon peach pink',(1,.10,.30),emission=3)
yellow=mat('noodle shop gold',(1,.62,.13),emission=1.5)
red=mat('lacquer red',(.49,.065,.085),rough=.4)
white=mat('ceramic',(.83,.86,.82),rough=.24)

def assign(o,m):
    o.data.materials.append(m); return o
def cube(n,loc,size,m,bev=.03):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=n; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); assign(o,m)
    if bev:
        mod=o.modifiers.new('soft crafted edges','BEVEL'); mod.width=bev; mod.segments=2
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
    return o
def uv(n,loc,scale,m,seg=16,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc); o=bpy.context.object; o.name=n; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); assign(o,m)
    for p in o.data.polygons:p.use_smooth=True
    return o
def ico(n,loc,scale,m,sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc); o=bpy.context.object; o.name=n; o.scale=scale; assign(o,m); return o
def cyl(n,loc,r,depth,m,vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=n;assign(o,m)
    mod=o.modifiers.new('edge bevel','BEVEL');mod.width=.015;mod.segments=2
    o.modifiers.new('weighted normals','WEIGHTED_NORMAL');return o
def beam(n,a,b,r,m,verts=10):
    a,b=Vector(a),Vector(b);o=cyl(n,(a+b)*.5,r,(b-a).length,m,verts);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def mesh(n,v,f,m):
    d=bpy.data.meshes.new(n);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(n,d);bpy.context.collection.objects.link(o);assign(o,m);return o
def text(n,value,loc,size,m,extrude=.004):
    c=bpy.data.curves.new(n,'FONT');c.body=value;c.align_x='CENTER';c.align_y='CENTER';c.size=size;c.extrude=extrude
    o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);assign(o,m);return o
def begin(name):
    col=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(col)
    bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection.children[name]
    return col
def bounds(col):
    pts=[o.matrix_world@Vector(v) for o in col.objects if o.type in {'MESH','FONT'} for v in o.bound_box]
    return [round(max(p[i] for p in pts)-min(p[i] for p in pts),3) for i in range(3)]
stats={}
def export(col,name):
    bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
    for o in col.objects:o.select_set(True)
    path=OUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
    raw=path.read_bytes();magic,version,length=struct.unpack_from('<4sII',raw)
    assert magic==b'glTF' and version==2 and length==len(raw)
    jl,jt=struct.unpack_from('<II',raw,12);j=json.loads(raw[20:20+jl])
    tris=sum(j['accessors'][p['indices']]['count']//3 for me in j.get('meshes',[]) for p in me['primitives'] if 'indices' in p)
    stats[name]={'blender_dimensions_xyz':bounds(col),'bytes':len(raw),'triangles':tris,'meshes':len(j.get('meshes',[])),'path':str(path)}

# Clean upright cuboid. Blender -Y is front; GLB front is +Z.
col=begin('01 Player')
cube('body',(0,0,.80),(.7,.65,1.6),ivory,.045)
cube('terracotta band',(0,0,.32),(.708,.658,.105),coral,.015)
for x in [-.13,.13]:
    uv('eye_left' if x<0 else 'eye_right',(x,-.328,1.04),(.036,.013,.047),ink,12,6)
    uv('eye glint',(x-.008,-.34,1.056),(.009,.005,.010),white,8,4)
export(col,'player')

# Cozy cedar cottage: a full silhouette, warm windows, porch and fine roof ribs.
col=begin('02 Forest Cottage')
cube('foundation',(0,0,.13),(4.32,3.90,.26),stone,.08)
cube('plaster walls',(0,0,1.23),(4,3.6,2.0),wall,.035)
mesh('front gable',[(-2,-1.8,2.23),(2,-1.8,2.23),(0,-1.8,4.72),(-2,1.8,2.23),(2,1.8,2.23),(0,1.8,4.72)],[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],wall)
for s in [-1,1]:
    v=[(0,-2.2,4.86),(s*2.5,-2.2,2.06),(s*2.5,2.2,2.06),(0,2.2,4.86)]
    mesh('roof panel',v+[(x,y,z-.15) for x,y,z in v],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],roof)
    for y in [-2.22,2.22]: beam('sloped roof trim',(0,y,4.88),(s*2.54,y,2.03),.065,woodDark)
    for y in [-1.7,-1.15,-.60,-.05,.50,1.05,1.60]:
        beam('raised roof rib',(0,y,4.885),(s*2.5,y,2.085),.023,roofEdge,6)
    beam('eaves',(s*2.5,-2.22,2.03),(s*2.5,2.22,2.03),.065,woodDark)
    for y in [-1.82,1.82]:cube('corner timber',(s*1.94,y,1.2),(.13,.13,2),woodDark)
beam('ridge',(0,-2.28,4.88),(0,2.28,4.88),.095,woodDark)
cube('door',(0,-1.83,1.03),(1,.10,1.65),woodDark,.08)
for x in [-.35,-.175,0,.175,.35]:cube('door planks',(x,-1.893,1.0),(.025,.017,1.46),woodLight,.007)
uv('door knob',(.33,-1.94,.96),(.045,.027,.045),yellow)
cube('door light',(0,-1.899,1.56),(.57,.03,.27),amber,.04)
for x in [-1.32,1.32]:
    cube('window casing',(x,-1.845,1.40),(.91,.13,.93),woodDark,.04)
    cube('glowing cottage window',(x,-1.922,1.40),(.75,.025,.76),amber,.025)
    cube('window mullion',(x,-1.95,1.40),(.06,.05,.81),woodLight,.01)
    cube('window mullion',(x,-1.95,1.40),(.81,.05,.06),woodLight,.01)
    cube('flower box',(x,-2.02,.93),(1,.29,.20),woodLight,.03)
    for j in range(5):
        ico('herbs',(x-.35+j*.17,-2.04,1.085),(.14,.13,.16),green2,1)
        if j%2==0:ico('little blooms',(x-.35+j*.17,-2.09,1.23),(.065,.065,.065),coral,1)
cube('porch',(0,-2.1,.24),(2.4,1.05,.19),woodLight,.025)
cube('lower stair',(0,-2.84,.09),(1.65,.55,.18),wood,.025)
cube('upper stair',(0,-2.60,.17),(1.75,.35,.18),woodLight,.025)
for x in [-1.06,1.06]:
    cube('porch post',(x,-2.40,1.15),(.10,.10,1.83),woodDark,.015)
    beam('porch diagonal',(x,-2.40,1.94),(x*.6,-2.40,2.21),.04,woodDark)
cube('porch lintel',(0,-2.40,2.04),(2.30,.12,.15),woodDark,.02)
cube('chimney',(1.04,.79,3.95),(.57,.59,2.35),stone,.025)
cube('chimney cap',(1.04,.79,5.08),(.76,.78,.14),woodDark,.025)
cube('chimney opening',(1.04,.79,5.155),(.47,.49,.01),ink,0)
for z in [3.22,3.54,3.86,4.18,4.5,4.82]:cube('brick mortar',(1.04,.479,z),(.58,.018,.035),woodDark,0)
cube('attic window casing',(0,-1.82,3.37),(.72,.13,.76),woodDark,.10)
cube('attic window',(0,-1.90,3.37),(.54,.03,.58),amber,.085)
cube('attic divider',(0,-1.933,3.37),(.055,.03,.60),woodLight,.008)
export(col,'forest_cottage')

# Round, friendly broadleaf tree with branching trunk and many color clusters.
col=begin('03 Forest Tree')
beam('main trunk',(0,0,0),(.07,0,3.95),.32,wood,12)
for a in [0,1.4,2.9,4.3,5.5]:
    beam('exposed root',(0,0,.27),(.74*math.cos(a),.74*math.sin(a),.025),.115,wood,8)
for i,(x,y,z) in enumerate([(-1.0,.15,4.4),(.95,.45,4.9),(.18,-.85,4.4),(-.6,-.45,5.25),(.1,.25,5.72)]):
    beam('branch',(.04,0,2.3+i*.18),(x*.7,y*.7,z-.50),.12 if i<3 else .09,wood,9)
clusters=[(-1.15,.15,4.33,1.25),(1.04,.30,4.73,1.24),(.25,-1.0,4.35,1.22),(-.50,-.65,5.24,1.19),(-.7,.8,4.9,1.15),(.15,.24,5.65,1.06),(.93,-.65,5.20,.85),(.48,1.0,4.73,1.05)]
for i,(x,y,z,s) in enumerate(clusters):
    ico('rounded canopy %02d'%i,(x,y,z),(s,s*.86,s*.87),[green,green2,green3,green,green2][i%5],2)
    for j in range(2):
        a=random.random()*6.28
        ico('canopy detail',(x+math.cos(a)*s*.65,y+math.sin(a)*s*.65,z+.32),(.35,.31,.32),green2 if j==0 else green,1)
for x,y in [(.55,.20),(-.45,-.36),(.30,-.51)]:ico('root moss',(x,y,.09),(.32,.27,.15),green,1)
export(col,'forest_tree')

# Night-market ramen stall. Emissive bars can catch bloom in the game scene.
col=begin('04 City Kiosk')
cube('kiosk foundation',(0,0,.13),(3.7,2.7,.26),dark,.07)
cube('back wall',(0,1.10,1.62),(3.40,.17,2.8),steel,.025)
for x in [-1.64,1.64]:
    cube('side panel',(x,.20,1.32),(.14,1.80,2.15),dark,.025)
    cube('front support',(x,-1.04,1.63),(.12,.12,2.80),steel,.02)
    cube('vertical neon',(x,-1.11,1.94),(.036,.025,1.95),cyan,.008)
cube('counter cabinet',(0,-.74,.77),(3.17,.52,1.16),red,.035)
cube('steel countertop',(0,-.75,1.38),(3.52,.84,.15),steel,.04)
cube('counter neon',(0,-1.19,1.34),(3.24,.025,.045),pink,.008)
for x in [-1.03,0,1.03]:
    cube('cabinet inset',(x,-1.011,.78),(.88,.022,.81),dark,.035)
    cube('cabinet stripe',(x,-1.032,.99),(.64,.015,.035),yellow,.007)
cube('canopy',(0,-.1,3.10),(3.91,2.91,.22),dark,.08)
cube('cyan roof rim',(0,-1.56,3.10),(3.72,.028,.055),cyan,.009)
cube('sign backing',(0,-1.56,2.77),(3.40,.15,.57),red,.035)
text('RAMEN neon sign','RAMEN',(0,-1.65,2.78),.39,yellow,.004)
for x in [-1.12,-.55,.02,.59,1.16]:
    cube('fabric curtain',(x,-1.24,2.22),(.49,.048,.42),red,.012)
    cube('curtain gold hem',(x,-1.272,2.04),(.45,.012,.03),yellow,.006)
for x in [-1.13,1.13]:
    uv('lantern',(x,-1.16,2.58),(.15,.15,.21),pink,12,8)
    cyl('lantern top',(x,-1.16,2.78),.09,.05,dark)
    cyl('lantern bottom',(x,-1.16,2.38),.09,.05,dark)
cube('back shelf',(0,.93,1.80),(3.01,.43,.11),woodDark,.015)
for i in range(8):
    cyl('bottle',(-1.27+i*.36,.86,2.0),.058,.30,[cyan,amber,coral][i%3],10)
    cyl('bottle neck',(-1.27+i*.36,.86,2.19),.028,.08,[cyan,amber,coral][i%3],8)
for x in [-.86,.10,.97]:
    uv('ramen bowl',(x,-.72,1.51),(.18,.18,.08),white,16,8)
    cyl('soup',(x,-.72,1.563),.145,.012,amber,16)
    for dx in [-.035,.035]:beam('chopstick',(x+dx,-.91,1.60),(x+dx+.06,-.48,1.62),.010,woodLight,6)
for x in [-1.03,.02,1.07]:
    cyl('stool seat',(x,-1.78,.70),.23,.12,red,16)
    cyl('stool stem',(x,-1.78,.39),.045,.56,steel,10)
    cyl('stool foot',(x,-1.78,.09),.21,.055,steel,12)
cube('side service box',(1.83,.53,1.21),(.35,.8,.85),steel,.055)
for z in [.97,1.09,1.21,1.33,1.45]:cube('vent',(2.013,.53,z),(.013,.58,.034),dark,.005)
export(col,'city_kiosk')

# Preserve local coordinates in named collections for editing and re-export.
bpy.ops.object.select_all(action='DESELECT')
bpy.context.scene.world.color=(.12,.14,.16)
bpy.context.scene['asset_front']='Blender -Y; exported glTF +Z. Each asset origin at base center.'
bpy.context.scene['asset_report']=json.dumps(stats)
bpy.ops.wm.save_as_mainfile(filepath=str(EDIT/'MosslightAssets.blend'))
(EDIT/'asset-report.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
print('MOSS_LIGHT_BUILD_OK '+json.dumps(stats))
