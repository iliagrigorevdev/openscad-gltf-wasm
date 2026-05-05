/**
 * Generates an LLM prompt containing the required syntax rules for PBR and Animations
 * in this custom OpenSCAD fork.
 *
 * @param {string} description - The description of the object you want the AI to design.
 * @returns {string} The fully formatted LLM prompt.
 */
export function generatePrompt(description) {
  if (!description) {
    throw new Error("A description is required to generate a prompt.");
  }

  return `Generate an OpenSCAD script to design the following: ${description}.

Please utilize extended color attributes, specifically including 'roughness', 'metalness', 'clearcoat', 'clearcoatRoughness', 'sheen', 'sheenColor', 'sheenRoughness', 'transmission', and 'thickness' parameters.

Important PBR rules:
- Metalness: For solid metallic materials (e.g., gold, steel), use metalness near 1.0. High metalness blocks light transmission. (Default: 0.0)
- Roughness: Controls surface finish. 0.0 is perfectly smooth/glossy, while 1.0 is completely matte. (Default: 0.0)
- Transmission: Degree of optical transparency (0.0 to 1.0) for materials like glass or water. Note: When transmission is non-zero, alpha (opacity) should be set to 1.0. (Default: 0.0)
- Thickness: The thickness of the volume beneath the surface. If 0.0, the material is thin-walled (like a bubble). If > 0, it acts as a solid volume boundary (like a block of glass). (Default: 0.0)
- Clearcoat: Adds a clear, reflective layer on top of the base material (car paint, varnished wood, or wet surfaces). 1.0 is fully coated. (Default: 0.0)
- Clearcoat Roughness: Controls the smoothness of the clearcoat layer. (Default: 0.0)
- Sheen: Simulates backscattering from microfibers, creating a soft velvet-like rim light useful for cloth and fabrics. 1.0 is full intensity. (Default: 0.0)
- Sheen Color: Sets the RGB tint of the sheen layer (e.g., sheenColor = [1.0, 0.5, 0.5]). (Default: [0.0, 0.0, 0.0])
- Sheen Roughness: Controls the roughness of the sheen layer. (Default: 0.0)

Important Animation rules:
- Wrapping: Use the 'armature(animations=...)' module at the root to wrap all animated components.
- Hierarchies: Use the 'bone(name="BoneName", t=[x,y,z], r=[x,y,z])' module to define hierarchical animated parts.
- Animation Data: The 'animations' property is an array of tracks defining keyframes for each bone. Format:
  animations = [
    ["BoneName", [
      [time_in_seconds, [rot_x, rot_y, rot_z], [trans_x, trans_y, trans_z]], // Translation is optional
      [1.0, [0, 90, 0], [0, 5, 0]],
      ...
    ]]
  ];
- Translational Animation: If you want a bone to move translationally, provide the [trans_x, trans_y, trans_z] array in the keyframes. If omitted, the bone defaults to its resting position.`;
}
