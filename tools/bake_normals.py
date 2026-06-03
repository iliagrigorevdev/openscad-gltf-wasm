import bpy
import sys
import argparse
import os

def setup_gpu():
    """Attempt to enable GPU compute for faster baking (Modern Blender API)."""
    try:
        preferences = bpy.context.preferences
        cycles_prefs = preferences.addons['cycles'].preferences

        if hasattr(cycles_prefs, "refresh_devices"):
            cycles_prefs.refresh_devices()

        gpu_enabled = False

        if hasattr(cycles_prefs, "devices"):
            for device in cycles_prefs.devices:
                if device.type != 'CPU':
                    device.use = True
                    gpu_enabled = True

        if gpu_enabled:
            bpy.context.scene.cycles.device = 'GPU'
            print("Enabled GPU compute.")
        else:
            bpy.context.scene.cycles.device = 'CPU'
            print("No GPU detected. Falling back to CPU compute.")

    except Exception as e:
        print(f"Warning: Could not configure GPU ({e}). Falling back to CPU.")
        bpy.context.scene.cycles.device = 'CPU'

def import_and_prepare_gltf(filepath, name):
    """Imports a GLTF file, joins meshes, and smooths shading."""
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=filepath)

    meshes = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']

    if not meshes:
        raise Exception(f"No meshes found in {filepath}")

    bpy.context.view_layer.objects.active = meshes[0]

    if len(meshes) > 1:
        bpy.ops.object.join()

    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()

    return obj

def unwrap_model(obj):
    """Generates an automatic UV map for the given object."""
    print(f"Generating UVs for {obj.name}...")
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    # Enter Edit mode, select all faces, and Smart UV Project
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # angle_limit 1.15 rad is approx 66 degrees. island_margin ensures no texture bleeding
    bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')

def bake_normals(args):
    # Clear the default scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    print(f"Importing high-poly model: {args.high}")
    high_poly = import_and_prepare_gltf(args.high, "HighPoly")

    print(f"Importing low-poly model: {args.low}")
    low_poly = import_and_prepare_gltf(args.low, "LowPoly")

    # Generate UVs for the low poly model
    unwrap_model(low_poly)

    # Set up rendering engine to Cycles (required for baking)
    bpy.context.scene.render.engine = 'CYCLES'
    setup_gpu()

    # Create the image to bake to
    img_name = "BakedNormal"
    img = bpy.data.images.new(name=img_name, width=args.res, height=args.res)
    img.colorspace_settings.name = 'Non-Color' # Normal maps must be non-color

    # Clean up existing materials on the low poly
    low_poly.data.materials.clear()

    # Create a material for the low poly object
    mat = bpy.data.materials.new(name="LowPolyMat")
    mat.use_nodes = True
    low_poly.data.materials.append(mat)

    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Find the Principled BSDF node
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')

    # Add Image Texture node
    tex_node = nodes.new('ShaderNodeTexImage')
    tex_node.image = img
    tex_node.image.colorspace_settings.name = 'Non-Color'

    # Add Normal Map node
    normal_node = nodes.new('ShaderNodeNormalMap')

    # Connect Nodes: Image -> Normal Map -> Principled BSDF Normal
    links.new(tex_node.outputs['Color'], normal_node.inputs['Color'])
    links.new(normal_node.outputs['Normal'], bsdf.inputs['Normal'])

    # Make Image Texture node ACTIVE (Crucial for baking in Blender)
    nodes.active = tex_node
    tex_node.select = True

    # Configure Bake Settings
    bpy.context.scene.render.bake.use_selected_to_active = True
    bpy.context.scene.render.bake.margin = args.margin
    bpy.context.scene.render.bake.max_ray_distance = args.distance

    # Select objects: High poly first, then Low poly (Low poly becomes active)
    bpy.ops.object.select_all(action='DESELECT')
    high_poly.select_set(True)
    low_poly.select_set(True)
    bpy.context.view_layer.objects.active = low_poly

    print("Starting Bake Process... This may take a while depending on resolution.")
    bpy.ops.object.bake(type='NORMAL')
    print("Baking Complete!")

    # Pack the baked image into the blend file data so it exports with GLTF
    img.pack()

    # Determine export format based on file extension
    output_path = os.path.abspath(args.out)
    export_format = 'GLB' if output_path.lower().endswith('.glb') else 'GLTF_SEPARATE'

    print(f"Exporting model to {output_path}...")
    bpy.ops.object.select_all(action='DESELECT')
    low_poly.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        use_selection=True,
        export_format=export_format,
        export_materials='EXPORT',
        export_normals=True
    )
    print(f"Successfully exported final model!")

if __name__ == "__main__":
    try:
        if "--" in sys.argv:
            argv = sys.argv[sys.argv.index("--") + 1:]
        else:
            print("Error: No script arguments found. Use '--' to separate blender args from script args.")
            sys.exit(1)

        parser = argparse.ArgumentParser(description="Bake Normal Map & Export GLTF")
        parser.add_argument("--high", required=True, help="Path to the High-Poly GLTF/GLB file")
        parser.add_argument("--low", required=True, help="Path to the Low-Poly GLTF/GLB file")
        parser.add_argument("--out", required=True, help="Path to save the output GLB/GLTF file")
        parser.add_argument("--res", type=int, default=2048, help="Texture resolution (Default: 2048)")
        parser.add_argument("--distance", type=float, default=0.05, help="Max ray distance. Increase if normals are empty/missing patches.")
        parser.add_argument("--margin", type=int, default=16, help="Bleed margin in pixels")

        args = parser.parse_args(argv)

        bake_normals(args)

    except Exception as e:
        print(f"\nCRITICAL SCRIPT ERROR: {e}\n")
        sys.exit(1)
