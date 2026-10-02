// Evaluates `dotnet package list --vulnerable --include-transitive --format json` output for
// scripts/security-check (plan 0001, risk 5). Fail-closed: anything it cannot read is RED.
// Usage: dotnet run --file nuget-audit.cs -- <json-file> <list-exit-code>
// Exit codes: 0 = no vulnerabilities, 3 = vulnerabilities found, 4 = audit infrastructure failure.
// (Not 1: `dotnet run` itself exits 1 when it cannot build/run this file, which must read as infra.)
using System.Text.Json;

const int Clean = 0;
const int Vulnerable = 3;
const int InfraFailure = 4;

if (args.Length != 2 || !int.TryParse(args[1], out var listExitCode))
{
    return Infra("usage: nuget-audit.cs <json-file> <list-exit-code>");
}

if (listExitCode != 0)
{
    // `dotnet package list --format json` writes its errors to stdout, i.e. into this file.
    ShowRawOutput(args[0]);
    return Infra($"`dotnet package list` exited with {listExitCode} (advisory/registry unreachable?)");
}

JsonDocument document;
try
{
    document = JsonDocument.Parse(File.ReadAllText(args[0]));
}
catch (Exception ex) when (ex is IOException or JsonException)
{
    ShowRawOutput(args[0]);
    return Infra("could not read the package list JSON: " + ex.Message);
}

using (document)
{
    var root = document.RootElement;

    if (root.TryGetProperty("problems", out var problems) && problems.GetArrayLength() > 0)
    {
        foreach (var problem in problems.EnumerateArray())
        {
            Console.Error.WriteLine("  problem: " + problem);
        }

        return Infra("the package list reported problems");
    }

    if (!root.TryGetProperty("projects", out var projects) || projects.GetArrayLength() == 0)
    {
        return Infra("the package list contains no projects; nothing was audited");
    }

    var findings = new List<string>();
    foreach (var project in projects.EnumerateArray())
    {
        var path = project.GetProperty("path").GetString();
        foreach (var framework in Elements(project, "frameworks"))
        {
            foreach (var kind in new[] { "topLevelPackages", "transitivePackages" })
            {
                foreach (var package in Elements(framework, kind))
                {
                    foreach (var vulnerability in Elements(package, "vulnerabilities"))
                    {
                        findings.Add($"{package.GetProperty("id").GetString()} {package.GetProperty("resolvedVersion").GetString()}"
                            + $" [{vulnerability.GetProperty("severity").GetString()}] {vulnerability.GetProperty("advisoryurl").GetString()}"
                            + $" in {path}");
                    }
                }
            }
        }
    }

    if (findings.Count > 0)
    {
        Console.Error.WriteLine("SECURITY: vulnerable NuGet packages found:");
        findings.Distinct().ToList().ForEach(f => Console.Error.WriteLine("  " + f));
        return Vulnerable;
    }

    Console.WriteLine($"nuget-audit: {projects.GetArrayLength()} projects audited, no known vulnerabilities");
    return Clean;
}

static IEnumerable<JsonElement> Elements(JsonElement parent, string name) =>
    parent.TryGetProperty(name, out var array) && array.ValueKind == JsonValueKind.Array
        ? array.EnumerateArray()
        : [];

// Root cause for infra failures (DNS, proxy, auth, 5xx): the raw tool output, capped.
static void ShowRawOutput(string path)
{
    const int MaxChars = 4000;
    try
    {
        var raw = File.ReadAllText(path).Trim();
        Console.Error.WriteLine("  dotnet package list output:");
        Console.Error.WriteLine(raw.Length > MaxChars ? raw[..MaxChars] + " ..." : raw);
    }
    catch (IOException ex)
    {
        Console.Error.WriteLine("  (raw output unavailable: " + ex.Message + ")");
    }
}

static int Infra(string message)
{
    Console.Error.WriteLine("SECURITY INFRA FAILURE: " + message);
    return InfraFailure;
}
