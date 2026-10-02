using System.Text.RegularExpressions;
using Xunit;

namespace CityRadar.Architecture.Tests;

// Plan 0001 amendment 1: the Microsoft.Testing.Platform zero-test protection (exit code 8) is
// relaxed ONLY for the deliberately empty module test projects, and only while they stay empty.
public sealed partial class ZeroTestExceptionTests
{
    private static readonly string[] AllowedEmptyProjects =
    [
        "CityRadar.Infrastructure.Tests",
        "CityRadar.Parking.Tests",
        "CityRadar.Shared.Tests",
        "CityRadar.Traffic.Tests",
    ];

    [Fact]
    public void ZeroTestException_OnlyInAllowedEmptyProjects()
    {
        var offenders = ProjectFile.In(BackendPaths.Tests)
            .Where(p => IgnoresZeroTests(p.RawText) && !AllowedEmptyProjects.Contains(p.Name))
            .Select(p => p.Name)
            .ToList();

        Assert.True(offenders.Count == 0, "Zero-test exception not allowed in: " + string.Join(", ", offenders));
    }

    [Fact]
    public void ZeroTestException_IsRemovedOnceAProjectHasCode()
    {
        var offenders = ProjectFile.In(BackendPaths.Tests)
            .Where(p => IgnoresZeroTests(p.RawText) && HasSourceFiles(Path.GetDirectoryName(p.Path)!))
            .Select(p => p.Name)
            .ToList();

        Assert.True(offenders.Count == 0, "Project has code; remove --ignore-exit-code 8 from: " + string.Join(", ", offenders));
    }

    [Fact]
    public void ZeroTestException_IsNotSetBackendWide()
    {
        var offenders = Directory.GetFiles(BackendPaths.Root, "Directory.Build.*", SearchOption.AllDirectories)
            .Where(file => IgnoresZeroTests(File.ReadAllText(file)))
            .ToList();

        Assert.True(offenders.Count == 0, "Zero-test exception must not be shared: " + string.Join(", ", offenders));
    }

    private static bool IgnoresZeroTests(string text) => IgnoreExitCode8().IsMatch(text);

    private static bool HasSourceFiles(string projectDirectory) =>
        Directory.EnumerateFiles(projectDirectory, "*.cs", SearchOption.AllDirectories)
            .Any(file => !IsBuildOutput(Path.GetRelativePath(projectDirectory, file)));

    private static bool IsBuildOutput(string relativePath)
    {
        var first = relativePath.Replace('\\', '/').Split('/')[0];
        return first is "bin" or "obj";
    }

    [GeneratedRegex(@"--ignore-exit-code\s+8\b")]
    private static partial Regex IgnoreExitCode8();
}
