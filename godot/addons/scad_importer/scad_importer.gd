@tool
extends EditorSceneFormatImporter

func _get_extensions():
    return PackedStringArray(["scad"])

func _get_import_flags():
    return EditorSceneFormatImporter.IMPORT_SCENE

func _import_scene(path: String, flags: int, options: Dictionary) -> Object:
    var global_source = ProjectSettings.globalize_path(path)
    var unique_id = str(hash(path))
    var temp_glb_path = ProjectSettings.globalize_path("user://scad_cache_" + unique_id + ".glb")

    var npx_command = "npx"
    var args = PackedStringArray()

    if OS.get_name() == "Windows":
        npx_command = "cmd.exe"
        args.append("/c")
        args.append("npx")

    args.append("--yes")
    args.append("-p")
    args.append("github:iliagrigorevdev/openscad-gltf-wasm")
    args.append("scad-convert")
    args.append(global_source)
    args.append(temp_glb_path)

    var output = []
    print("Importing SCAD via npx... (This might take a few seconds on the first run)")
    var exit_code = OS.execute(npx_command, args, output, true)

    if exit_code != 0:
        push_error("Failed to compile SCAD file. Ensure Node.js is installed.")
        push_error("npx output: ", "\n".join(output))
        return null

    var gltf_doc = GLTFDocument.new()
    var gltf_state = GLTFState.new()
    var err = gltf_doc.append_from_file(temp_glb_path, gltf_state)

    if FileAccess.file_exists(temp_glb_path):
        DirAccess.remove_absolute(temp_glb_path)

    if err != OK:
        push_error("Failed to parse the generated GLB.")
        return null

    var generated_scene = gltf_doc.generate_scene(gltf_state)
    if generated_scene:
        generated_scene.name = path.get_file().get_basename()

    # Godot's scene import pipeline takes ownership over the generated node!
    # It will automatically extract ImporterMeshInstance3D nodes and hook it into Advanced Scene Import.
    return generated_scene
