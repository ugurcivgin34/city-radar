using System.Text.RegularExpressions;
using Xunit;

namespace CityRadar.Architecture.Tests;

// Plan 0001 amendment 2 — the PRIMARY zero-test guarantee. A test project without the zero-test
// exception runs with --minimum-expected-tests 1, so zero tests exits 8/9 and no injected
// --ignore-exit-code 8 can turn it green. scripts/check starts the run in a controlled
// environment so an inherited exit-code ignore list or a launch profile cannot either.
public sealed partial class MinimumExpectedTestsTests
{
    private static readonly string[] ProjectsThatMustRunTests = ["CityRadar.Api.Tests", "CityRadar.Architecture.Tests"];

    [Fact]
    public void EveryTestProjectWithoutTheZeroTestException_RequiresAtLeastOneTest()
    {
        var guarded = ProjectFile.In(BackendPaths.Tests)
            .Where(p => !ZeroTestExceptionTests.IgnoresZeroTests(p.RawText))
            .ToList();

        Assert.All(ProjectsThatMustRunTests, name => Assert.Contains(name, guarded.Select(p => p.Name)));

        var offenders = guarded.Where(p => !MinimumOneTest().IsMatch(p.RawText)).Select(p => p.Name).ToList();
        Assert.True(offenders.Count == 0, "Missing --minimum-expected-tests 1 (or more) in: " + string.Join(", ", offenders));
    }

    [Fact]
    public void CheckTestStep_RunsInAControlledEnvironment()
    {
        var testStep = File.ReadAllLines(Path.Combine(BackendPaths.Repository, "scripts", "check.conf"))
            .Single(line => line.StartsWith("backend-test:", StringComparison.Ordinal));

        Assert.Contains("env -u TESTINGPLATFORM_EXITCODE_IGNORE ", testStep, StringComparison.Ordinal);
        Assert.Contains("dotnet test ", testStep, StringComparison.Ordinal);
        Assert.Contains(" --no-launch-profile", testStep, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("--minimum-expected-tests 1", true)]
    [InlineData("--minimum-expected-tests=3", true)]
    [InlineData("--minimum-expected-tests 10", true)]
    [InlineData("--minimum-expected-tests 0", false)]
    [InlineData("--minimum-expected-tests", false)]
    public void MinimumOneTest_Pattern(string text, bool expected) =>
        Assert.Equal(expected, MinimumOneTest().IsMatch(text));

    [GeneratedRegex(@"--minimum-expected-tests(?:\s*[=:]\s*|\s+)[""']?[1-9]\d*")]
    private static partial Regex MinimumOneTest();
}
