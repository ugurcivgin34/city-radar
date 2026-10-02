using ArchUnitNET.xUnitV3;
using Xunit;
using static ArchUnitNET.Fluent.ArchRuleDefinition;

namespace CityRadar.Architecture.Tests;

// Spec 0001 AC-6..AC-9 at type level (docs/architecture.md FD-1..FD-4). Rules are namespace /
// assembly based, so types added later are covered automatically. Rules whose subject set is
// empty today use WithoutRequiringPositiveResults(); ArchitectureLoadTests guards against an
// empty model, and the negative proofs live in the build/verify evidence.
public sealed class ModuleDependencyTests
{
    private const string TechnicalNamespaces =
        @"^(CityRadar\.Infrastructure|CityRadar\.Api|Microsoft\.AspNetCore|Microsoft\.Extensions\.Caching|System\.Net\.Http)(\..+)?$";

    private const string ProviderNamespaces = @"^CityRadar\.Infrastructure\.Providers(\..+)?$";

    private const string ProviderDtoNamespaces = @"^CityRadar\.Infrastructure\.Providers\.[^.]+\.Dtos(\..+)?$";

    private const string ApiContractNamespaces = @"^CityRadar\.Api\.Contracts(\..+)?$";

    [Fact]
    public void Parking_DoesNotDependOn_Traffic() =>
        Types().That().ResideInAssembly(ModuleArchitecture.Parking)
            .Should().NotDependOnAnyTypesThat().ResideInAssembly(ModuleArchitecture.Traffic)
            .WithoutRequiringPositiveResults()
            .Check(ModuleArchitecture.Model);

    [Fact]
    public void Traffic_DoesNotDependOn_Parking() =>
        Types().That().ResideInAssembly(ModuleArchitecture.Traffic)
            .Should().NotDependOnAnyTypesThat().ResideInAssembly(ModuleArchitecture.Parking)
            .WithoutRequiringPositiveResults()
            .Check(ModuleArchitecture.Model);

    [Fact]
    public void BusinessModules_DoNotDependOn_TechnicalInfrastructure() =>
        Types().That().ResideInAssembly(ModuleArchitecture.Shared, ModuleArchitecture.Parking, ModuleArchitecture.Traffic)
            .Should().NotDependOnAnyTypesThat().ResideInNamespaceMatching(TechnicalNamespaces)
            .WithoutRequiringPositiveResults()
            .Check(ModuleArchitecture.Model);

    [Fact]
    public void ProviderDtos_AreNotPublic() =>
        Types().That().ResideInNamespaceMatching(ProviderDtoNamespaces)
            .Should().NotBePublic()
            .WithoutRequiringPositiveResults()
            .Check(ModuleArchitecture.Model);

    [Fact]
    public void ApiParkingAndTraffic_DoNotDependOn_Providers() =>
        Types().That().ResideInAssembly(ModuleArchitecture.Api, ModuleArchitecture.Parking, ModuleArchitecture.Traffic)
            .Should().NotDependOnAnyTypesThat().ResideInNamespaceMatching(ProviderNamespaces)
            .WithoutRequiringPositiveResults()
            .Check(ModuleArchitecture.Model);

    [Fact]
    public void ApiContracts_DoNotExpose_ModuleTypes() =>
        Types().That().ResideInNamespaceMatching(ApiContractNamespaces)
            .Should().NotDependOnAnyTypesThat().ResideInAssembly(ModuleArchitecture.Shared, ModuleArchitecture.Parking, ModuleArchitecture.Traffic)
            .WithoutRequiringPositiveResults()
            .Check(ModuleArchitecture.Model);
}
