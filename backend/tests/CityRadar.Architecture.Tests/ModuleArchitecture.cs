using System.Reflection;
using ArchUnitNET.Loader;
using ArchitectureModel = ArchUnitNET.Domain.Architecture;

namespace CityRadar.Architecture.Tests;

internal static class ModuleArchitecture
{
    public static readonly string[] ModuleNames =
    [
        "CityRadar.Shared",
        "CityRadar.Parking",
        "CityRadar.Traffic",
        "CityRadar.Infrastructure",
        "CityRadar.Api",
    ];

    // Loaded by name: modules may have no types yet, so typeof(...) anchors are not available.
    public static IReadOnlyDictionary<string, Assembly> Assemblies { get; } =
        ModuleNames.ToDictionary(name => name, Assembly.Load, StringComparer.Ordinal);

    public static ArchitectureModel Model { get; } =
        new ArchLoader().LoadAssemblies([.. Assemblies.Values]).Build();

    public static Assembly Shared => Assemblies["CityRadar.Shared"];

    public static Assembly Parking => Assemblies["CityRadar.Parking"];

    public static Assembly Traffic => Assemblies["CityRadar.Traffic"];

    public static Assembly Api => Assemblies["CityRadar.Api"];
}
