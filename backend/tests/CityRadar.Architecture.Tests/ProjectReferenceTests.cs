using System.Xml.Linq;
using Xunit;

namespace CityRadar.Architecture.Tests;

// Spec 0001 AC-2, AC-6, AC-7 at project level (docs/architecture.md FD-1/FD-2). Reads the .csproj
// files themselves: an unused ProjectReference never reaches IL, so only this test sees it.
public sealed class ProjectReferenceTests
{
    private static readonly Dictionary<string, string[]> AllowedReferences = new(StringComparer.Ordinal)
    {
        ["CityRadar.Shared"] = [],
        ["CityRadar.Parking"] = ["CityRadar.Shared"],
        ["CityRadar.Traffic"] = ["CityRadar.Shared"],
        ["CityRadar.Infrastructure"] = ["CityRadar.Shared", "CityRadar.Parking", "CityRadar.Traffic"],
        ["CityRadar.Api"] = ["CityRadar.Shared", "CityRadar.Parking", "CityRadar.Traffic", "CityRadar.Infrastructure"],
    };

    private static readonly string[] ExpectedTestProjects =
    [
        "CityRadar.Api.Tests",
        "CityRadar.Architecture.Tests",
        "CityRadar.Infrastructure.Tests",
        "CityRadar.Parking.Tests",
        "CityRadar.Shared.Tests",
        "CityRadar.Traffic.Tests",
    ];

    private static readonly string[] BusinessModules = ["CityRadar.Shared", "CityRadar.Parking", "CityRadar.Traffic"];

    private static readonly string[] ForbiddenBusinessPackagePrefixes =
    [
        "Microsoft.AspNetCore",
        "Microsoft.Extensions.Caching",
        "Microsoft.Extensions.Http",
        "System.Net.Http",
    ];

    [Fact]
    public void ProductionProjects_AreExactlyTheFiveModules()
    {
        var actual = ProjectFile.In(BackendPaths.Src).Select(p => p.Name).Order(StringComparer.Ordinal);

        Assert.Equal(AllowedReferences.Keys.Order(StringComparer.Ordinal), actual);
    }

    [Fact]
    public void TestProjects_AreExactlyTheSixModuleTestProjects()
    {
        var actual = ProjectFile.In(BackendPaths.Tests).Select(p => p.Name).Order(StringComparer.Ordinal);

        Assert.Equal(ExpectedTestProjects, actual);
    }

    [Fact]
    public void Solution_ContainsEveryProjectExactlyOnce()
    {
        var inSolution = XDocument.Load(BackendPaths.Solution)
            .Descendants("Project")
            .Select(p => Path.GetFileNameWithoutExtension(p.Attribute("Path")!.Value.Replace('\\', '/')))
            .Order(StringComparer.Ordinal)
            .ToList();

        var onDisk = ProjectFile.In(BackendPaths.Src).Concat(ProjectFile.In(BackendPaths.Tests))
            .Select(p => p.Name)
            .Order(StringComparer.Ordinal);

        Assert.Equal(onDisk, inSolution);
    }

    [Fact]
    public void ModuleProjectReferences_MatchTheAllowedDirectionExactly()
    {
        var violations = new List<string>();
        foreach (var project in ProjectFile.In(BackendPaths.Src))
        {
            var allowed = AllowedReferences[project.Name];
            var missing = allowed.Except(project.ProjectReferences).ToList();
            var extra = project.ProjectReferences.Except(allowed).ToList();
            if (missing.Count > 0)
            {
                violations.Add($"{project.Name} is missing: {string.Join(", ", missing)}");
            }

            if (extra.Count > 0)
            {
                violations.Add($"{project.Name} must not reference: {string.Join(", ", extra)}");
            }
        }

        Assert.True(violations.Count == 0, string.Join(Environment.NewLine, violations));
    }

    [Fact]
    public void BusinessModules_DoNotTakeWebCachingOrHttpDependencies()
    {
        var violations = new List<string>();
        foreach (var project in ProjectFile.In(BackendPaths.Src).Where(p => BusinessModules.Contains(p.Name)))
        {
            if (project.Sdk != "Microsoft.NET.Sdk")
            {
                violations.Add($"{project.Name} uses SDK '{project.Sdk}' (only Microsoft.NET.Sdk is allowed)");
            }

            violations.AddRange(project.FrameworkReferences
                .Select(framework => $"{project.Name} has FrameworkReference {framework}"));

            violations.AddRange(project.PackageReferences
                .Where(package => ForbiddenBusinessPackagePrefixes.Any(prefix => package.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
                .Select(package => $"{project.Name} has forbidden PackageReference {package}"));
        }

        Assert.True(violations.Count == 0, string.Join(Environment.NewLine, violations));
    }
}
