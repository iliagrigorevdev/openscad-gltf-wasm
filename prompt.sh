#!/bin/bash

# Check if arguments were provided
if [ -z "$1" ]; then
    echo "Usage: $0 <description of the object>"
    exit 1
fi

# The improved prompt text
PROMPT="Generate an OpenSCAD script to design the following: $*.

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
- Hierarchies: Use the 'bone(name=\"BoneName\", t=[x,y,z], r=[x,y,z])' module to define hierarchical animated parts.
- Animation Data: The 'animations' property is an array of tracks defining keyframes for each bone. Format:
  animations = [
    [\"BoneName\", [
      [time_in_seconds, [rot_x, rot_y, rot_z], [trans_x, trans_y, trans_z]], // Translation is optional
      [1.0, [0, 90, 0], [0, 5, 0]],
      ...
    ]]
  ];
- Translational Animation: If you want a bone to move translationally, provide the [trans_x, trans_y, trans_z] array in the keyframes. If omitted, the bone defaults to its resting position."

# Copy to clipboard and notify user
# Note: Using xclip for Linux. For macOS, use pbcopy.
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -n "$PROMPT" | pbcopy
else
    echo -n "$PROMPT" | xclip -sel clip
fi

echo "✅ Copied to clipboard: $PROMPT"
