using UnrealBuildTool;

public class ScadImporter : ModuleRules
{
	public ScadImporter(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = ModuleRules.PCHUsageMode.UseExplicitOrSharedPCHs;
		
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });
		
		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"UnrealEd",
			"AssetTools",
			"HTTP",
			"Json",
			"JsonUtilities",
			"InterchangeCore",
			"InterchangeEngine"
		});
	}
}