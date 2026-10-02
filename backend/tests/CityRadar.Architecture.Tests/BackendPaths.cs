namespace CityRadar.Architecture.Tests;

internal static class BackendPaths
{
    // The backend root is the directory holding CityRadar.slnx, found by walking up from the
    // test binaries; tests read the real project files, never copies.
    public static string Root { get; } = FindRoot();

    public static string Src => Path.Combine(Root, "src");

    public static string Tests => Path.Combine(Root, "tests");

    public static string Solution => Path.Combine(Root, "CityRadar.slnx");

    public static string Repository => Directory.GetParent(Root)!.FullName;

    private static string FindRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "CityRadar.slnx")))
            {
                return dir.FullName;
            }
        }

        throw new InvalidOperationException("CityRadar.slnx not found above " + AppContext.BaseDirectory);
    }
}
