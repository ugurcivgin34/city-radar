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
        var offenders = ConfigurationSurfaces()
            .Where(file => !IsTestProjectFile(file))
            .Where(file => IgnoresZeroTests(File.ReadAllText(file)))
            .ToList();

        Assert.True(offenders.Count == 0, "Zero-test exception must not be shared: " + string.Join(", ", offenders));
    }

    [Fact]
    public void ZeroTestException_IsNotSetThroughTheEnvironment()
    {
        var offenders = ConfigurationSurfaces()
            .Where(file => AssignsExitCodeIgnoreVariable(File.ReadAllText(file)))
            .ToList();

        Assert.True(offenders.Count == 0, "TESTINGPLATFORM_EXITCODE_IGNORE must not be set: " + string.Join(", ", offenders));
    }

    // Assignments only: unsetting the variable (env -u, scripts/check.conf) is the opposite of a bypass.
    [Theory]
    [InlineData("TESTINGPLATFORM_EXITCODE_IGNORE=8")]
    [InlineData("  TESTINGPLATFORM_EXITCODE_IGNORE: \"8\"")]
    [InlineData("\"TESTINGPLATFORM_EXITCODE_IGNORE\": \"8\"")]
    [InlineData("$env:TESTINGPLATFORM_EXITCODE_IGNORE = \"8\"")]
    public void EnvironmentGuard_RecognizesAssignments(string text) =>
        Assert.True(AssignsExitCodeIgnoreVariable(text), "not recognized: " + text);

    [Fact]
    public void EnvironmentGuard_IgnoresUnset() =>
        Assert.False(AssignsExitCodeIgnoreVariable("env -u TESTINGPLATFORM_EXITCODE_IGNORE dotnet test"));

    // Secondary defense only (plan 0001 amendment 2): the primary guarantee is the runtime
    // minimum-expected-tests invariant (MinimumExpectedTestsTests). Only repository configuration
    // surfaces are scanned (review 2, B-2): IDE state, test results, build output, *.user and stray
    // local files never decide the check, so the same commit gives the same result locally and in CI.
    private static readonly string[] BackendConfigurationPatterns =
        ["*.csproj", "*.props", "*.targets", "*.rsp", "global.json", "testconfig.json", "launchSettings.json", "*.run.json"];

    private static readonly string[] LocalOnlySegments = ["bin", "obj", ".vs", "TestResults", "node_modules"];

    internal static bool IgnoresZeroTests(string text) => IgnoreExitCode8().IsMatch(text);

    private static bool AssignsExitCodeIgnoreVariable(string text) => ExitCodeIgnoreAssignment().IsMatch(text);

    private static bool HasSourceFiles(string projectDirectory) =>
        Directory.EnumerateFiles(projectDirectory, "*.cs", SearchOption.AllDirectories)
            .Any(file => !IsLocalOnly(Path.GetRelativePath(projectDirectory, file)));

    private static IEnumerable<string> ConfigurationSurfaces()
    {
        var backend = BackendConfigurationPatterns
            .SelectMany(pattern => Directory.EnumerateFiles(BackendPaths.Root, pattern, SearchOption.AllDirectories))
            .Where(file => !IsLocalOnly(Path.GetRelativePath(BackendPaths.Root, file)));

        var scripts = Directory.EnumerateFiles(Path.Combine(BackendPaths.Repository, "scripts"), "*", SearchOption.AllDirectories);

        var githubDirectory = Path.Combine(BackendPaths.Repository, ".github");
        var github = Directory.Exists(githubDirectory)
            ? Directory.EnumerateFiles(githubDirectory, "*.yml", SearchOption.AllDirectories)
                .Concat(Directory.EnumerateFiles(githubDirectory, "*.yaml", SearchOption.AllDirectories))
            : [];

        return backend.Concat(scripts).Concat(github).Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private static bool IsTestProjectFile(string file) =>
        file.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase)
        && string.Equals(Path.GetDirectoryName(Path.GetDirectoryName(file)), BackendPaths.Tests, StringComparison.OrdinalIgnoreCase);

    private static bool IsLocalOnly(string relativePath) =>
        relativePath.Replace('\\', '/').Split('/').Any(segment => LocalOnlySegments.Contains(segment, StringComparer.OrdinalIgnoreCase));

    // The guard itself is proven here, not only by whatever the repository happens to contain
    // (review 2, B-1). Deliberate obfuscation (%3B, &quot;, property indirection) is out of scope.
    [Theory]
    [InlineData("--ignore-exit-code 8")]
    [InlineData("--ignore-exit-code=8")]
    [InlineData("--ignore-exit-code:8")]
    [InlineData("--ignore-exit-code 2;8")]
    [InlineData("--ignore-exit-code \"2;8\"")]
    [InlineData("--ignore-exit-code 3,8")]
    [InlineData("--ignore-exit-code 8;2")]
    [InlineData("--ignore-exit-code 2 ;8")]
    [InlineData("--ignore-exit-code\n    8")]
    [InlineData("--ignore-exit-code\r\n  2;\r\n  8")]
    [InlineData("$(TestingPlatformCommandLineArguments) --ignore-exit-code 8")]
    public void Guard_RecognizesEveryFormThatIgnoresExitCode8(string text) =>
        Assert.True(IgnoresZeroTests(text), "not recognized: " + text);

    [Theory]
    [InlineData("--ignore-exit-code 18")]
    [InlineData("--ignore-exit-code 81")]
    [InlineData("--ignore-exit-code 2;18")]
    [InlineData("--ignore-exit-code 2")]
    [InlineData("--ignore-exit-code 28")]
    [InlineData("--ignore-exit-codes 8")]
    [InlineData("--minimum-expected-tests 8")]
    public void Guard_IgnoresFormsThatDoNotIgnoreExitCode8(string text) =>
        Assert.False(IgnoresZeroTests(text), "false positive: " + text);

    // Separator: whitespace (incl. newlines), "=" or ":"; list items separated by ";" or ",".
    [GeneratedRegex(@"--ignore-exit-code(?:\s*[=:]\s*|\s+)[""']?(?:\d+\s*[;,]\s*)*8(?!\d)")]
    private static partial Regex IgnoreExitCode8();

    // NAME=…, NAME: …, "NAME": …, $env:NAME = … (shell, MSBuild, YAML, JSON, PowerShell).
    [GeneratedRegex(@"TESTINGPLATFORM_EXITCODE_IGNORE[""']?\s*[=:]", RegexOptions.IgnoreCase)]
    private static partial Regex ExitCodeIgnoreAssignment();
}
