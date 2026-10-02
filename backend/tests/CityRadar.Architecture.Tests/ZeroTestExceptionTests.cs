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
        var sharedFiles = Directory.GetFiles(BackendPaths.Root, "Directory.Build.*", SearchOption.AllDirectories)
            .Where(file => !IsBuildOutput(Path.GetRelativePath(BackendPaths.Root, file)))
            .Concat(RepositoryFiles("scripts"))
            .Concat(RepositoryFiles(".github"));

        var offenders = sharedFiles.Where(file => IgnoresZeroTests(File.ReadAllText(file))).ToList();

        Assert.True(offenders.Count == 0, "Zero-test exception must not be shared: " + string.Join(", ", offenders));
    }

    [Fact]
    public void ZeroTestException_IsNotSetThroughTheEnvironment()
    {
        var offenders = RepositoryFiles("backend")
            .Concat(RepositoryFiles("scripts"))
            .Concat(RepositoryFiles(".github"))
            .Where(file => File.ReadAllText(file).Contains(ExitCodeIgnoreVariable, StringComparison.OrdinalIgnoreCase))
            .ToList();

        Assert.True(offenders.Count == 0, ExitCodeIgnoreVariable + " must not be set: " + string.Join(", ", offenders));
    }

    // Built by concatenation so this source file never matches its own scan.
    private static readonly string ExitCodeIgnoreVariable = "TESTINGPLATFORM_" + "EXITCODE_IGNORE";

    private static bool IgnoresZeroTests(string text) => IgnoreExitCode8().IsMatch(text);

    private static bool HasSourceFiles(string projectDirectory) =>
        Directory.EnumerateFiles(projectDirectory, "*.cs", SearchOption.AllDirectories)
            .Any(file => !IsBuildOutput(Path.GetRelativePath(projectDirectory, file)));

    private static IEnumerable<string> RepositoryFiles(string directory)
    {
        var root = Path.Combine(BackendPaths.Repository, directory);
        return Directory.Exists(root)
            ? Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
                .Where(file => !IsBuildOutput(Path.GetRelativePath(root, file)))
            : [];
    }

    private static bool IsBuildOutput(string relativePath) =>
        relativePath.Replace('\\', '/').Split('/').Any(segment => segment is "bin" or "obj");

    // Every MTP form that ignores exit code 8: "8", "=8", "2;8", "\"2;8\"", "3,8".
    [GeneratedRegex(@"--ignore-exit-code(?:[ \t]*=[ \t]*|[ \t]+)[""']?(?:\d+[;,][ \t]*)*8(?!\d)")]
    private static partial Regex IgnoreExitCode8();
}
