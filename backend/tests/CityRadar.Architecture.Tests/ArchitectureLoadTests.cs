using Xunit;

namespace CityRadar.Architecture.Tests;

// Spec 0001 AC-11: the architecture rules can never pass against an empty model; every module
// assembly must actually be found and loaded.
public sealed class ArchitectureLoadTests
{
    [Fact]
    public void EveryModuleAssembly_IsLoadedIntoTheArchitectureModel()
    {
        var loaded = ModuleArchitecture.Model.Assemblies
            .Select(a => a.Name.Split(',')[0])
            .ToHashSet(StringComparer.Ordinal);

        Assert.All(ModuleArchitecture.ModuleNames, name => Assert.Contains(name, loaded));
    }

    [Fact]
    public void EveryModuleAssembly_ResolvesToTheBuiltModule() =>
        Assert.All(ModuleArchitecture.Assemblies, pair =>
        {
            Assert.Equal(pair.Key, pair.Value.GetName().Name);
            Assert.True(File.Exists(pair.Value.Location), pair.Key + " has no file on disk");
        });
}
