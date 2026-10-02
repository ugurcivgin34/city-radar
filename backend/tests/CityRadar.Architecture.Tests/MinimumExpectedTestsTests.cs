using System.Text.RegularExpressions;
using System.Xml.Linq;
using Xunit;

namespace CityRadar.Architecture.Tests;

// Plan 0001 amendment 2 — the PRIMARY zero-test guarantee. A test project without the zero-test
// exception runs with --minimum-expected-tests 1, so zero tests exits 8/9 and no injected
// --ignore-exit-code 8 can turn it green. scripts/check starts the run in a controlled
// environment so an inherited exit-code ignore list or a launch profile cannot either.
public sealed partial class MinimumExpectedTestsTests
{
    private const string ArgumentsProperty = "TestingPlatformCommandLineArguments";

    private static readonly string[] ProjectsThatMustRunTests = ["CityRadar.Api.Tests", "CityRadar.Architecture.Tests"];

    [Fact]
    public void EveryTestProjectWithoutTheZeroTestException_RequiresAtLeastOneTest()
    {
        var guarded = ProjectFile.In(BackendPaths.Tests)
            .Where(p => !ZeroTestExceptionTests.IgnoresZeroTests(p.RawText))
            .ToList();

        Assert.All(ProjectsThatMustRunTests, name => Assert.Contains(name, guarded.Select(p => p.Name)));

        var offenders = guarded.Where(p => !RequiresAtLeastOneTest(p.Document)).Select(p => p.Name).ToList();
        Assert.True(offenders.Count == 0, "Missing an active --minimum-expected-tests 1 (or more) in: " + string.Join(", ", offenders));
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

    // Review 4, F-2: only the ACTIVE setting counts — comments, conditional groups or properties,
    // and later overrides are read the way MSBuild reads them, not as raw text.
    [Theory]
    [InlineData("<Project><PropertyGroup><TestingPlatformCommandLineArguments>$(TestingPlatformCommandLineArguments) --minimum-expected-tests 1</TestingPlatformCommandLineArguments></PropertyGroup></Project>", true)]
    [InlineData("<Project><PropertyGroup><!-- <TestingPlatformCommandLineArguments>x</TestingPlatformCommandLineArguments> --></PropertyGroup><PropertyGroup><TestingPlatformCommandLineArguments>--minimum-expected-tests 2</TestingPlatformCommandLineArguments></PropertyGroup></Project>", true)]
    [InlineData("<Project><PropertyGroup><TestingPlatformCommandLineArguments>--minimum-expected-tests 1</TestingPlatformCommandLineArguments></PropertyGroup><PropertyGroup><TestingPlatformCommandLineArguments>$(TestingPlatformCommandLineArguments) --report-trx</TestingPlatformCommandLineArguments></PropertyGroup></Project>", true)]
    [InlineData("<Project><PropertyGroup><!-- <TestingPlatformCommandLineArguments>minimum-expected-tests 1</TestingPlatformCommandLineArguments> --></PropertyGroup></Project>", false)]
    [InlineData("<Project><PropertyGroup Condition=\"false\"><TestingPlatformCommandLineArguments>--minimum-expected-tests 1</TestingPlatformCommandLineArguments></PropertyGroup></Project>", false)]
    [InlineData("<Project><PropertyGroup><TestingPlatformCommandLineArguments Condition=\"false\">--minimum-expected-tests 1</TestingPlatformCommandLineArguments></PropertyGroup></Project>", false)]
    [InlineData("<Project><PropertyGroup><TestingPlatformCommandLineArguments>--minimum-expected-tests 1</TestingPlatformCommandLineArguments></PropertyGroup><PropertyGroup><TestingPlatformCommandLineArguments>--report-trx</TestingPlatformCommandLineArguments></PropertyGroup></Project>", false)]
    [InlineData("<Project><PropertyGroup><TestingPlatformCommandLineArguments>--minimum-expected-tests 0</TestingPlatformCommandLineArguments></PropertyGroup></Project>", false)]
    [InlineData("<Project />", false)]
    public void RequiresAtLeastOneTest_ReadsTheActiveSetting(string project, bool expected) =>
        Assert.Equal(expected, RequiresAtLeastOneTest(XDocument.Parse(project)));

    [Theory]
    [InlineData("--minimum-expected-tests 1", true)]
    [InlineData("--minimum-expected-tests=3", true)]
    [InlineData("--minimum-expected-tests 10", true)]
    [InlineData("--minimum-expected-tests 0", false)]
    [InlineData("--minimum-expected-tests", false)]
    public void MinimumOneTest_Pattern(string text, bool expected) =>
        Assert.Equal(expected, MinimumOneTest().IsMatch(text));

    // Unconditional top-level PropertyGroups, unconditional properties, last definition wins and
    // $(TestingPlatformCommandLineArguments) appends to the previous value — as MSBuild evaluates it.
    private static bool RequiresAtLeastOneTest(XDocument project)
    {
        var value = string.Empty;
        var definitions = project.Root?.Elements("PropertyGroup")
            .Where(group => group.Attribute("Condition") is null)
            .Elements(ArgumentsProperty)
            .Where(property => property.Attribute("Condition") is null) ?? [];

        foreach (var definition in definitions)
        {
            value = definition.Value.Replace("$(" + ArgumentsProperty + ")", value, StringComparison.Ordinal);
        }

        return MinimumOneTest().IsMatch(value);
    }

    [GeneratedRegex(@"--minimum-expected-tests(?:\s*[=:]\s*|\s+)[""']?[1-9]\d*")]
    private static partial Regex MinimumOneTest();
}
