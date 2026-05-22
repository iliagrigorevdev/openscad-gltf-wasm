#include "ScadImportFactory.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "HAL/PlatformProcess.h"
#include "HttpModule.h"
#include "HttpManager.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Serialization/JsonSerializer.h"
#include "JsonObjectConverter.h"
#include "AssetToolsModule.h"
#include "IAssetTools.h"

UScadImportFactory::UScadImportFactory()
{
	bCreateNew = false;
	bEditorImport = true;
	// We return a generic object, as GLTF imports usually create scenes/static meshes
	SupportedClass = UObject::StaticClass(); 
	Formats.Add(TEXT("scad;OpenSCAD Script"));
}

bool UScadImportFactory::FactoryCanImport(const FString& Filename)
{
	return FPaths::GetExtension(Filename).Equals(TEXT("scad"), ESearchCase::IgnoreCase);
}

UObject* UScadImportFactory::FactoryCreateFile(UClass* InClass, UObject* InParent, FName InName, EObjectFlags Flags, const FString& Filename, const TCHAR* Parms, FFeedbackContext* Warn, bool& bOutCanceled)
{
	// 1. Generate Temp Path
	FString TempDir = FPaths::ProjectSavedDir() / TEXT("ScadCache");
	IFileManager::Get().MakeDirectory(*TempDir, true);
	
	FString UniqueID = FString::Printf(TEXT("%u"), GetTypeHash(Filename));
	FString TempGlbPath = TempDir / (InName.ToString() + TEXT("_") + UniqueID + TEXT(".glb"));
	TempGlbPath = FPaths::ConvertRelativePathToFull(TempGlbPath);
	FString GlobalSource = FPaths::ConvertRelativePathToFull(Filename);

	// 2. Setup NPX Command
	FString Command = TEXT("npx");
	FString Args = FString::Printf(TEXT("--yes -p github:iliagrigorevdev/openscad-gltf-wasm scad-convert \"%s\" \"%s\""), *GlobalSource, *TempGlbPath);

#if PLATFORM_WINDOWS
	Command = TEXT("cmd.exe");
	Args = FString::Printf(TEXT("/c npx %s"), *Args);
#endif

	UE_LOG(LogTemp, Log, TEXT("Importing SCAD via npx... (This might take a few seconds)"));

	// 3. Execute NPX Synchronously
	int32 ReturnCode = -1;
	FString StdOut, StdErr;
	FPlatformProcess::ExecProcess(*Command, *Args, &ReturnCode, &StdOut, &StdErr);

	// 4. Fallback to Local HTTP Server
	if (ReturnCode != 0 || !FPaths::FileExists(TempGlbPath))
	{
		UE_LOG(LogTemp, Warning, TEXT("npx conversion failed. Attempting fallback to local scad-serve..."));
		if (!TryScadServeFallback(GlobalSource, TempGlbPath))
		{
			UE_LOG(LogTemp, Error, TEXT("Failed to compile SCAD file. Ensure Node.js is installed or scad-serve is running."));
			UE_LOG(LogTemp, Error, TEXT("npx Output: %s"), *StdErr);
			return nullptr;
		}
	}

	// 5. Hand over to Unreal's GLTF Importer (Interchange/AssetTools)
	FAssetToolsModule& AssetToolsModule = FModuleManager::GetModuleChecked<FAssetToolsModule>("AssetTools");
	TArray<FString> FilesToImport;
	FilesToImport.Add(TempGlbPath);

	// This triggers Unreal's standard import pipeline for GLB in the target content directory
	TArray<UObject*> ImportedObjects = AssetToolsModule.Get().ImportAssets(FilesToImport, InParent->GetPathName());

	// 6. Cleanup
	if (FPaths::FileExists(TempGlbPath))
	{
		IFileManager::Get().Delete(*TempGlbPath);
	}

	// Return the primary created object so the Content Browser selects it
	return ImportedObjects.Num() > 0 ? ImportedObjects[0] : nullptr;
}

bool UScadImportFactory::TryScadServeFallback(const FString& SourcePath, const FString& OutGlbPath)
{
	FString FileContent;
	if (!FFileHelper::LoadFileToString(FileContent, *SourcePath))
	{
		return false;
	}

	// Create JSON Payload
	TSharedPtr<FJsonObject> JsonObject = MakeShareable(new FJsonObject);
	JsonObject->SetStringField(TEXT("content"), FileContent);
	FString JsonPayload;
	TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonPayload);
	FJsonSerializer::Serialize(JsonObject.ToSharedRef(), Writer);

	// Create HTTP Request
	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(TEXT("http://127.0.0.1:3000/api/convert"));
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Request->SetContentAsString(JsonPayload);
	Request->ProcessRequest();

	// Pseudo-blocking wait to mimic synchronous factory behavior
	double StartTime = FPlatformTime::Seconds();
	while (Request->GetStatus() == EHttpRequestStatus::Processing)
	{
		// Timeout after 60 seconds
		if (FPlatformTime::Seconds() - StartTime > 60.0)
		{
			Request->CancelRequest();
			return false;
		}
		
		// Tick HTTP manager and sleep slightly to avoid locking the editor completely
		FHttpModule::Get().GetHttpManager().Tick(0.1f);
		FPlatformProcess::Sleep(0.01f);
	}

	if (Request->GetStatus() == EHttpRequestStatus::Succeeded && Request->GetResponse()->GetResponseCode() == 200)
	{
		const TArray<uint8>& BinaryData = Request->GetResponse()->GetContent();
		if (BinaryData.Num() > 0)
		{
			return FFileHelper::SaveArrayToFile(BinaryData, *OutGlbPath);
		}
	}

	return false;
}
