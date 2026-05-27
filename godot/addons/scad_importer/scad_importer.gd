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

func _get_relative_path(base: String, target: String) -> String:
    var base_parts = base.replace("\\", "/").split("/", false)
    var target_parts = target.replace("\\", "/").split("/", false)

    var common_count = 0
    var min_len = min(base_parts.size(), target_parts.size())
    for i in range(min_len):
        if base_parts[i] == target_parts[i]:
            common_count += 1
        else:
            break

    var rel_parts = PackedStringArray()
    for i in range(common_count, base_parts.size()):
        rel_parts.append("..")

    for i in range(common_count, target_parts.size()):
        rel_parts.append(target_parts[i])

    return "/".join(rel_parts)

func _get_dependencies_recursive(file_path: String, visited: Dictionary) -> void:
    if visited.has(file_path):
        return

    visited[file_path] = ""

    if not FileAccess.file_exists(file_path):
        return

    var file = FileAccess.open(file_path, FileAccess.READ)
    if not file:
        return

    var content = file.get_as_text()
    file.close()

    visited[file_path] = content

    var regex = RegEx.new()
    regex.compile("(?:include|use)\\s*[<\"]([^>\"]+)[>\"]")

    var base_dir = file_path.get_base_dir()
    for result in regex.search_all(content):
        var dep_rel_path = result.get_string(1)
        var dep_abs_path = base_dir.path_join(dep_rel_path).simplify_path()
        _get_dependencies_recursive(dep_abs_path, visited)

func _get_dependencies(file_path: String) -> Dictionary:
    var visited = {}
    _get_dependencies_recursive(file_path, visited)
    return visited

func _try_scad_serve_fallback(source_path: String, out_glb_path: String) -> bool:
    var deps = _get_dependencies(source_path)
    var content = deps.get(source_path, "")
    deps.erase(source_path)

    if content == "":
        return false

    var additional_files = {}
    var base_dir = source_path.get_base_dir()
    for dep_path in deps.keys():
        var rel_path = _get_relative_path(base_dir, dep_path)
        additional_files[rel_path] = deps[dep_path]

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

    # Pack the content and dependencies inside options object
    var payload = {
        "content": content,
        "options": {
            "additionalFiles": additional_files
        }
    }

    var body = JSON.stringify(payload)
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