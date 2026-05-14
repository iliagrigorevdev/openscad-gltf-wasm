/**
 * Generates an LLM prompt containing the required syntax rules for PBR and Animations
 * in this custom OpenSCAD fork.
 *
 * @param {string} description - The description of the object you want the AI to design.
 * @param {Object} options - Toggles for different prompt blocks
 * @returns {string} The fully formatted LLM prompt.
 */
export function generatePrompt(description, options = {}) {
  if (!description) {
    throw new Error("A description is required to generate a prompt.");
  }

  const opts = {
    basic: options.basic ?? true,
    transmission: options.transmission ?? true,
    clearcoat: options.clearcoat ?? true,
    sheen: options.sheen ?? true,
    emissive: options.emissive ?? true,
    specular: options.specular ?? true,
    iridescence: options.iridescence ?? true,
    autoSmoothAngle: options.autoSmoothAngle ?? true,
    animation: options.animation ?? true,
  };

  let prompt = `Generate an OpenSCAD script to design the following: ${description}.`;

  let attrs = [];
  if (opts.basic) attrs.push("'roughness'", "'metalness'");
  if (opts.autoSmoothAngle) attrs.push("'autoSmoothAngle'");
  if (opts.clearcoat) attrs.push("'clearcoat'", "'clearcoatRoughness'");
  if (opts.sheen) attrs.push("'sheen'", "'sheenColor'", "'sheenRoughness'");
  if (opts.transmission)
    attrs.push(
      "'transmission'",
      "'thickness'",
      "'attenuationColor'",
      "'attenuationDistance'",
      "'ior'",
    );
  if (opts.emissive) attrs.push("'emissive'", "'emissiveIntensity'");
  if (opts.specular) attrs.push("'specularColor'", "'specularIntensity'");
  if (opts.iridescence) attrs.push("'iridescence'", "'iridescenceIOR'");

  if (attrs.length > 0) {
    prompt += `\n\nPlease utilize extended color attributes, specifically including ${attrs.join(", ")} parameters.\n\nImportant PBR rules:`;

    if (opts.basic) {
      prompt += `\n- Metalness: For solid metallic materials (e.g., gold, steel), use metalness near 1.0. High metalness blocks light transmission. (Default: 0.0)`;
      prompt += `\n- Roughness: Controls surface finish. 0.0 is perfectly smooth/glossy, while 1.0 is completely matte. (Default: 1.0)`;
    }
    if (opts.transmission) {
      prompt += `\n- Transmission: Degree of optical transparency (0.0 to 1.0) for materials like glass or water. Note: When transmission is non-zero, alpha (opacity) should be set to 1.0. (Default: 0.0)`;
      prompt += `\n- Thickness: The thickness of the volume beneath the surface. If 0.0, the material is thin-walled (like a bubble). If > 0, it acts as a solid volume boundary (like a block of glass). (Default: 0.0)`;
      prompt += `\n- Attenuation Color & Distance: Used with transmission and thickness to simulate volume absorption (colored glass or liquids). Distance is how far light travels to reach the attenuationColor. (Defaults: [1.0, 1.0, 1.0] and 0.0)`;
      prompt += `\n- IOR (Index of Refraction): Controls how much light bends when entering a transmissive or clearcoat material. Water is ~1.33, Window Glass ~1.5, Diamond ~2.4. (Default: 1.5)`;
    }
    if (opts.clearcoat) {
      prompt += `\n- Clearcoat: Adds a clear, reflective layer on top of the base material (car paint, varnished wood, or wet surfaces). 1.0 is fully coated. (Default: 0.0)`;
      prompt += `\n- Clearcoat Roughness: Controls the smoothness of the clearcoat layer. (Default: 0.0)`;
    }
    if (opts.sheen) {
      prompt += `\n- Sheen: Simulates backscattering from microfibers, creating a soft velvet-like rim light useful for cloth and fabrics. 1.0 is full intensity. (Default: 0.0)`;
      prompt += `\n- Sheen Color: Sets the RGB tint of the sheen layer (e.g., sheenColor = [1.0, 0.5, 0.5]). (Default: [0.0, 0.0, 0.0])`;
      prompt += `\n- Sheen Roughness: Controls the roughness of the sheen layer. (Default: 0.0)`;
    }
    if (opts.emissive) {
      prompt += `\n- Emissive & Emissive Intensity: Makes the material glow. Emissive is an RGB color vector, intensity is a float multiplier. (Defaults: [0.0, 0.0, 0.0] and 1.0)`;
    }
    if (opts.specular) {
      prompt += `\n- Specular Color & Intensity: Overrides the default specular reflection. (Defaults: [1.0, 1.0, 1.0] and 1.0)`;
    }
    if (opts.iridescence) {
      prompt += `\n- Iridescence & Iridescence IOR: Simulates thin-film interference like soap bubbles, oil spills, or pearlescent surfaces. (Defaults: 0.0 and 1.3)`;
    }
    if (opts.autoSmoothAngle) {
      prompt += `\n- Auto Smooth Angle: Generates smooth vertex normals for adjoining faces with an angle difference less than this value (in degrees). Use > 0 (e.g., 30 or 45) for curved/smooth surfaces, 0.0 for flat shading. (Default: 0.0)`;
    }

    prompt += `\n\nExample Material Usage:\n// Syntax: color(c=color_value, alpha=1.0, [named PBR parameters...])\ncolor([0.2, 0.2, 0.2], alpha=1.0, metalness=1.0, roughness=0.3, iridescence=1.0, emissive=[0.0, 0.5, 1.0], emissiveIntensity=2.0, autoSmoothAngle=45.0)\n  cube([10, 10, 10]);`;
  }

  if (opts.animation) {
    prompt += `\n\nImportant Animation rules:
- Wrapping: Use the 'armature(animations=...)' module at the root to wrap all animated components.
- Hierarchies: Use the 'bone(name="BoneName", t=[x,y,z], r=[x,y,z])' module to define hierarchical animated parts.
- Auto-Unioning: Any child meshes (e.g., cube, cylinder, imported objects) placed directly inside an 'armature()' or 'bone()' node are automatically unioned together by the engine. Child bones remain separate nodes in the hierarchy.
- Animation Data: The 'animations' property is an array of named animation sequences. Each sequence contains an array of tracks defining keyframes for each bone. Format:
  animations = [
    ["AnimationName", [
      ["BoneName", [
        [time_in_seconds, [rot_x, rot_y, rot_z], [trans_x, trans_y, trans_z]], // Translation is optional
        [1.0, [0, 90, 0], [0, 5, 0]],
        ...
      ]]
    ]]
  ];
- Rotation Keyframes: Due to glTF Quaternion shortest-path interpolation, NEVER rotate more than 90 degrees between consecutive keyframes. To perform a full 360-degree rotation, you MUST manually subdivide it into 90-degree increments (e.g., 0, 90, 180, 270, 360).
- Translational Animation: If you want a bone to move translationally, provide the [trans_x, trans_y, trans_z] array in the keyframes. If omitted, the bone defaults to its resting position.

Example Animation Usage:
anim_data = [
  ["Action 1", [
    ["BaseSpinner", [
      [0.0, [0, 0, 0]],
      [1.0, [0, 0, 90]],
      [2.0, [0, 0, 180]],
      [3.0, [0, 0, 270]],
      [4.0, [0, 0, 360]]
    ]],
    ["ChildSlider", [
      [0.0, [0, 0, 0], [0, 0, 0]],
      [2.0, [0, 0, 0], [0, 0, 10]],
      [4.0, [0, 0, 0], [0, 0, 0]]
    ]]
  ]]
];

armature(animations=anim_data) {
  // Root bone
  bone(name="BaseSpinner", t=[0, 0, 0], r=[0, 0, 0]) {
    // Mesh attached to BaseSpinner
    color([0.2, 0.5, 0.8]) cube([10, 10, 2], center=true);

    // Nested child bone (inherits parent's transform)
    bone(name="ChildSlider", t=[0, 0, 2], r=[0, 0, 0]) {
      // Mesh attached to ChildSlider
      color([0.8, 0.2, 0.2]) cylinder(h=5, r=2);
    }
  }
}`;
  }

  return prompt;
}
