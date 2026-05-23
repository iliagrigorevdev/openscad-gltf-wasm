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
        print("npx conversion failed (Node.js/NPM not found or command failed). Attempting fallback to local scad-serve...")
        var fallback_success = _try_scad_serve_fallback(global_source, temp_glb_path)

        if not fallback_success:
            push_error("Failed to compile SCAD file. Ensure Node.js is installed or scad-serve is running.")
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

func _try_scad_serve_fallback(source_path: String, out_glb_path: String) -> bool:
    var file = FileAccess.open(source_path, FileAccess.READ)
    if not file:
        return false
    var content = file.get_as_text()
    file.close()

    var http = HTTPClient.new()
    var err = http.connect_to_host("127.0.0.1", 3000)
    if err != OK:
        return false

    # Wait for connection (up to 5 seconds)
    var max_wait = 500
    var wait = 0
    while http.get_status() in [HTTPClient.STATUS_CONNECTING, HTTPClient.STATUS_RESOLVING]:
        http.poll()
        OS.delay_msec(10)
        wait += 1
        if wait > max_wait:
            return false

    if http.get_status() != HTTPClient.STATUS_CONNECTED:
        return false

    var headers = PackedStringArray(["Content-Type: application/json"])
    var body = JSON.stringify({"content": content})
    err = http.request(HTTPClient.METHOD_POST, "/api/convert", headers, body)
    if err != OK:
        return false

    # Wait for request to process (up to 60 seconds)
    max_wait = 6000
    wait = 0
    while http.get_status() == HTTPClient.STATUS_REQUESTING:
        http.poll()
        OS.delay_msec(10)
        wait += 1
        if wait > max_wait:
            return false

    if http.has_response() and http.get_response_code() == 200:
        var rb = PackedByteArray()
        while http.get_status() == HTTPClient.STATUS_BODY:
            http.poll()
            var chunk = http.read_response_body_chunk()
            if chunk.size() == 0:
                OS.delay_msec(10)
            else:
                rb.append_array(chunk)

        if rb.is_empty():
            return false

        var out_file = FileAccess.open(out_glb_path, FileAccess.WRITE)
        if not out_file:
            return false
        out_file.store_buffer(rb)
        out_file.close()

        print("Successfully compiled SCAD using scad-serve fallback.")
        return true

    return false