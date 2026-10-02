using System.Xml.Linq;

namespace CityRadar.Architecture.Tests;

internal sealed class ProjectFile
{
    private ProjectFile(string path)
    {
        Path = path;
        Name = System.IO.Path.GetFileNameWithoutExtension(path);
        Document = XDocument.Load(path);
    }

    public string Path { get; }

    public string Name { get; }

    public XDocument Document { get; }

    public string Sdk => Document.Root?.Attribute("Sdk")?.Value ?? string.Empty;

    public string RawText => File.ReadAllText(Path);

    // Project names only: order and path separators do not matter (plan 0001).
    public IReadOnlySet<string> ProjectReferences => Includes("ProjectReference")
        .Select(include => System.IO.Path.GetFileNameWithoutExtension(include.Replace('\\', '/')))
        .ToHashSet(StringComparer.Ordinal);

    public IReadOnlySet<string> PackageReferences =>
        Includes("PackageReference").ToHashSet(StringComparer.OrdinalIgnoreCase);

    public IReadOnlySet<string> FrameworkReferences =>
        Includes("FrameworkReference").ToHashSet(StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyList<ProjectFile> In(string directory) =>
        Directory.GetDirectories(directory)
            .SelectMany(dir => Directory.GetFiles(dir, "*.csproj"))
            .Select(path => new ProjectFile(path))
            .OrderBy(project => project.Name, StringComparer.Ordinal)
            .ToList();

    private IEnumerable<string> Includes(string element) =>
        Document.Descendants(element)
            .Select(e => e.Attribute("Include")?.Value)
            .OfType<string>();
}
