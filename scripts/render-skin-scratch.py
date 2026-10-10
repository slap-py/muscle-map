"""Render pipeline scratch meshes in an isolated background Blender process."""
import bpy,sys
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];root=Path(__file__).resolve().parents[1];asset=(root/args[0]).resolve();output=(root/args[1]).resolve();output.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(asset))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in objects:
 for f in o.data.polygons:f.use_smooth=True
 o.color=(.68,.43,.29,1)
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO';scene.display.shading.studio_light='paint.sl'
scene.display.shading.color_type='OBJECT';scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH'
scene.world=bpy.data.worlds.new('World');scene.display.shading.background_type='WORLD';scene.world.color=(.9,.9,.9)
scene.render.resolution_x=1000;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)]);center=(lo+hi)/2
camera_data=bpy.data.cameras.new('Camera');camera=bpy.data.objects.new('Camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera
camera_data.type='ORTHO';camera_data.ortho_scale=max(hi-lo)*(1.5 if max(hi-lo)>.5 else 1.1)
for name,direction in [('dorsal',(0,0,1)),('plantar',(0,0,-1)),('anterior',(1,0,.01)),('posterior',(-1,0,.01)),('lateral',(0,-1,.01)),('medial',(0,1,.01))]:
 camera.location=center+Vector(direction).normalized()*2
 camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(output/f'{name}.png');bpy.ops.render.render(write_still=True)

